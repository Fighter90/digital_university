// Swarm orchestrator unit tests — pin the parsing/rendering contracts that the
// pipeline depends on. No LLM, no network: pure functions only.
// Run: node --test tests/swarm-orchestrator.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fsMod from 'node:fs';
import cpMod from 'node:child_process';
import {
  extractDev,
  extractVerdict,
  extractSecurity,
  buildAiLog,
  securityFailureFeedback,
  acquireLock,
  planWorkerRetry,
} from '../scripts/swarm/orchestrator.mjs';
import { planGates } from '../scripts/swarm/gates.mjs';

test('extractDev: full summary line', () => {
  const tail = 'some chatter\nDEV_SUMMARY:\nstatus: done\ntests: foo.test.ts\nrisk: low';
  const d = extractDev(tail);
  assert.equal(d.status, 'done');
  assert.match(d.summary, /status: done/);
});

test('extractDev: missing marker → blocked', () => {
  assert.equal(extractDev('no marker here').status, 'blocked');
});

test('extractDev: all statuses recognized', () => {
  for (const s of ['done', 'already-implemented', 'not-reproducible', 'blocked']) {
    assert.equal(extractDev(`status: ${s}`).status, s);
  }
});

test('extractVerdict: accept ru/en forms', () => {
  assert.equal(extractVerdict('Вердикт: принят').verdict, 'ACCEPT');
  assert.equal(extractVerdict('VERDICT: ACCEPT').verdict, 'ACCEPT');
  assert.equal(extractVerdict('VERDICT: RETURN\nnotes: 1) fix x').verdict, 'RETURN');
  assert.match(extractVerdict('VERDICT: RETURN\nnotes: 1) fix x').notes, /fix x/);
});

test('extractVerdict: no verdict → RETURN with fallback note', () => {
  const v = extractVerdict('analysed the diff thoroughly');
  assert.equal(v.verdict, 'RETURN');
  assert.match(v.notes, /no verdict/);
});

test('extractSecurity: pass/fail/absent', () => {
  assert.equal(extractSecurity('SECURITY_VERDICT: PASS').verdict, 'PASS');
  const f = extractSecurity('SECURITY_VERDICT: FAIL\nfindings: 1) a.ts:12 — IDOR');
  assert.equal(f.verdict, 'FAIL');
  assert.match(f.findings, /IDOR/);
  assert.equal(extractSecurity('nothing').verdict, 'FAIL');
});

test('buildAiLog: contains key fields', () => {
  const md = buildAiLog({
    identifier: 'DIG-6',
    title: 'Init repo',
    today: '2026-11-11',
    rounds: 2,
    verdicts: 'RETURN → ACCEPT',
    security: 'PASS',
    gates: 'GATES: lint=pass typecheck=pass',
    prUrl: 'https://github.com/x/y/pull/1',
    story: 'Было нужно — рой сделал — студент получает.',
    devSummary: 'status: done',
  });
  assert.match(md, /## DIG-6 · Init repo/);
  assert.match(md, /2026-11-11/);
  assert.match(md, /RETURN → ACCEPT/);
  assert.match(md, /https:\/\/github\.com\/x\/y\/pull\/1/);
  assert.match(md, /История:/);
});

test('securityFailureFeedback: retries within round budget, fails at the end', () => {
  // round 1 of 3 → retry with findings as notes (never skips a task)
  const retry = securityFailureFeedback(0, 3, '1) a.ts:12 — creds in code');
  assert.equal(retry.action, 'retry');
  assert.match(retry.notes, /SECURITY-GATE/);
  assert.match(retry.notes, /creds in code/);
  assert.equal(securityFailureFeedback(1, 3, 'x').action, 'retry');
  // last round → fail with the findings (failIssue happens in the pipeline)
  const fin = securityFailureFeedback(2, 3, '1) hard failure');
  assert.equal(fin.action, 'fail');
  assert.match(fin.notes, /hard failure/);
});

test('acquireLock: fresh file, stale pid reclaimed, live pid refused', () => {
  const { mkdtempSync, writeFileSync, readFileSync, rmSync } = fsMod;
  const { spawnSync } = cpMod;
  const dir = mkdtempSync('/tmp/swarm-lock-');
  const lockPath = `${dir}/lock`;
  // fresh lock
  acquireLock(lockPath, process.pid);
  assert.equal(readFileSync(lockPath, 'utf8'), String(process.pid));
  // stale owner (dead pid) → reclaimed
  writeFileSync(lockPath, '999999');
  acquireLock(lockPath, process.pid);
  assert.equal(readFileSync(lockPath, 'utf8'), String(process.pid));
  // live owner → refused
  const live = cpMod.spawn('sleep', ['5']);
  writeFileSync(lockPath, String(live.pid));
  assert.throws(() => acquireLock(lockPath, process.pid), /holds the lock/);
  try {
    process.kill(live.pid, 'SIGKILL');
  } catch {}
  rmSync(dir, { recursive: true, force: true });
});

test('planGates: adaptive per package.json', () => {
  const full = planGates({
    hasPackageJson: true,
    scripts: { lint: 'next lint', test: 'vitest', build: 'next build' },
    hasTS: true,
  });
  assert.deepEqual(
    full.map((s) => `${s.name}:${s.cmd ? 'run' : 'skip'}`),
    ['lint:run', 'typecheck:run', 'build:run', 'test:run'],
  );
  const noTest = planGates({ hasPackageJson: true, scripts: { lint: 'x' }, hasTS: false });
  assert.deepEqual(
    noTest.map((s) => `${s.name}:${s.cmd ? 'run' : 'skip'}`),
    ['lint:run', 'typecheck:skip', 'build:skip', 'test:skip'],
  );
  const bootstrap = planGates({ hasPackageJson: false });
  assert.equal(bootstrap.length, 1);
  assert.equal(bootstrap[0].name, 'bootstrap');
});

// ── planWorkerRetry: пережить rate-limit/краш LLM-воркера, не роняя весь рой ──

test('planWorkerRetry: code 0 — фаза завершилась, повторы не нужны', () => {
  const p = planWorkerRetry({ code: 0, tail: 'DEV_SUMMARY:\nstatus: done', attempt: 0 });
  assert.equal(p.action, 'accept');
});

test('planWorkerRetry: краш без вердикта → cooldown + retry той же фазы', () => {
  const p = planWorkerRetry({
    code: 1,
    tail: 'executor · glm Read docs/figma-screens.md',
    status: 'blocked', // extractDev без маркера DEV_SUMMARY даёт blocked
    attempt: 0,
    maxRetries: 2,
    cooldownMs: 180000,
  });
  assert.equal(p.action, 'retry');
  assert.equal(p.cooldownMs, 180000);
});

test('planWorkerRetry: маркер rate limit → retry даже при наличии вердикта', () => {
  for (const marker of [
    'Retrying… Rate limit',
    'HTTP 429',
    'quota exceeded',
    'Too Many Requests',
  ]) {
    const p = planWorkerRetry({
      code: 1,
      tail: `chatter ${marker} chatter\nDEV_SUMMARY:\nstatus: blocked`,
      status: 'blocked',
      attempt: 1,
      maxRetries: 2,
      cooldownMs: 60000,
    });
    assert.equal(p.action, 'retry', `marker: ${marker}`);
  }
});

test('planWorkerRetry: попытки исчерпаны → сдаёмся (blocked идёт в Linear)', () => {
  const p = planWorkerRetry({
    code: 1,
    tail: 'Retrying… Rate limit',
    status: 'blocked',
    attempt: 2,
    maxRetries: 2,
    cooldownMs: 60000,
  });
  assert.equal(p.action, 'give-up');
});

test('planWorkerRetry: честный blocked (code 0, чистый выход) — accept, дальше решает конвейер', () => {
  const p = planWorkerRetry({
    code: 0,
    tail: 'DEV_SUMMARY:\nstatus: blocked\nrisk: неоднозначная задача',
    status: 'blocked',
    attempt: 0,
    maxRetries: 2,
  });
  assert.equal(p.action, 'accept');
});

test('planWorkerRetry: код ≠ 0, честный blocked с DEV_SUMMARY без rate-маркеров — не ретраим', () => {
  const p = planWorkerRetry({
    code: 1,
    tail: 'executor crashed after summary\nDEV_SUMMARY:\nstatus: blocked',
    status: 'blocked',
    attempt: 0,
    maxRetries: 2,
  });
  assert.equal(p.action, 'give-up');
});

test('planWorkerRetry: already-implemented при code 0 — accept', () => {
  const p = planWorkerRetry({
    code: 0,
    tail: 'DEV_SUMMARY:\nstatus: already-implemented',
    status: 'already-implemented',
    attempt: 0,
  });
  assert.equal(p.action, 'accept');
});
