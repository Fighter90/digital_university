// Swarm orchestrator unit tests — pin the parsing/rendering contracts that the
// pipeline depends on. No LLM, no network: pure functions only.
// Run: node --test tests/swarm-orchestrator.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractDev, extractVerdict, extractSecurity, buildAiLog } from '../scripts/swarm/orchestrator.mjs';
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
    identifier: 'DIG-6', title: 'Init repo', today: '2026-11-11',
    rounds: 2, verdicts: 'RETURN → ACCEPT', security: 'PASS',
    gates: 'GATES: lint=pass typecheck=pass', prUrl: 'https://github.com/x/y/pull/1',
    story: 'Было нужно — рой сделал — студент получает.', devSummary: 'status: done',
  });
  assert.match(md, /## DIG-6 · Init repo/);
  assert.match(md, /2026-11-11/);
  assert.match(md, /RETURN → ACCEPT/);
  assert.match(md, /https:\/\/github\.com\/x\/y\/pull\/1/);
  assert.match(md, /История:/);
});

test('planGates: adaptive per package.json', () => {
  const full = planGates({ hasPackageJson: true, scripts: { lint: 'next lint', test: 'vitest', build: 'next build' }, hasTS: true });
  assert.deepEqual(full.map((s) => `${s.name}:${s.cmd ? 'run' : 'skip'}`), ['lint:run', 'typecheck:run', 'test:run', 'build:run']);
  const noTest = planGates({ hasPackageJson: true, scripts: { lint: 'x' }, hasTS: false });
  assert.deepEqual(noTest.map((s) => `${s.name}:${s.cmd ? 'run' : 'skip'}`), ['lint:run', 'typecheck:skip', 'test:skip', 'build:skip']);
  const bootstrap = planGates({ hasPackageJson: false });
  assert.equal(bootstrap.length, 1);
  assert.equal(bootstrap[0].name, 'bootstrap');
});
