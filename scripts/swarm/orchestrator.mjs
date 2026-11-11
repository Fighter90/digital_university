#!/usr/bin/env node
// Swarm orchestrator — Цифровой деканат (digital_university).
// Linear(DIG, label `swarm`) → CLAIM → EXECUTOR → GATES → REVIEWER → SECURITY →
// DOCUMENTER → PR → (Linear Done при --merge; деплой при --deploy).
//
// Все git/gh/npm/Linear-шаги — детерминированный код. Решение «что писать»
// принимает только LLM-агент (opencode run --agent …). Архитектура:
// scripts/swarm/README.md. Уроки career-ops-роя перенесены: маркеры,
// meta-verdict, reflog-rescue, «уже в main», чистое дерево, лок-файл.
//
// Usage: node scripts/swarm/orchestrator.mjs [--max N] [--rounds N] [--dry-run]
//               [--no-pr] [--merge] [--deploy] [--pin DIG-XX]
// Env:   LINEAR_DIGITAL_UNIVERSITY_API_KEY (обязателен), SWARM_EXECUTOR_TIMEOUT_MIN.

import { spawn } from 'node:child_process';
import {
  openSync,
  writeSync,
  closeSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  unlinkSync,
  appendFileSync,
} from 'node:fs';
import { resolve } from 'node:path';
import {
  pickIssue,
  claimIssue,
  doneIssue,
  failIssue,
  addComment,
  lastFailureNotes,
  LABEL,
} from './linear.mjs';

const ROOT = process.cwd();
const SWARM = resolve(ROOT, 'scripts/swarm');
const STATE = resolve(ROOT, '.task-board');
const LOGS = resolve(STATE, 'log');

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const num = (n, d) => {
  const i = args.indexOf(n);
  return i >= 0 ? Number(args[i + 1]) || d : d;
};
const MAX_TASKS = num('--max', 1);
const MAX_ROUNDS = num('--rounds', 3);
const DRY = flag('--dry-run');
const NO_PR = flag('--no-pr');
const MERGE = flag('--merge');
const DEPLOY = flag('--deploy');
const PIN =
  process.env.SWARM_PIN_ISSUE || (args.includes('--pin') ? args[args.indexOf('--pin') + 1] : '');
const EXEC_MS = (Number(process.env.SWARM_EXECUTOR_TIMEOUT_MIN) || 30) * 60_000;

let logFile = null;
const ts = () => new Date().toISOString().replace('T', ' ').slice(0, 19);
function log(msg) {
  const line = `[${ts()}] ${msg}`;
  console.log(line);
  if (logFile) appendFileSync(logFile, line + '\n');
}
const short = (s, n = 400) => String(s).replace(/\s+/g, ' ').trim().slice(0, n);

function run(cmd, args_, { timeoutMs = 600_000, cwd = ROOT } = {}) {
  return new Promise((res) => {
    const p = spawn(cmd, args_, {
      cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    });
    let out = '',
      err = '',
      done = false;
    const fin = (code) => {
      if (done) return;
      done = true;
      clearTimeout(t);
      res({ code, out, err, all: out + err });
    };
    const t = setTimeout(() => {
      try {
        process.kill(-p.pid, 'SIGKILL');
      } catch {}
      try {
        p.kill('SIGKILL');
      } catch {}
      setTimeout(() => fin(-999), 5000);
    }, timeoutMs);
    p.stdout.on('data', (d) => {
      out += d;
    });
    p.stderr.on('data', (d) => {
      err += d;
    });
    p.on('close', (code) => fin(code));
    p.on('error', () => fin(-998));
  });
}
const sh = async (cmd, opts) => {
  const r = await run('bash', ['-lc', cmd], opts);
  log(`  $ ${cmd.slice(0, 120)} → ${r.code}`);
  return r;
};

// LLM worker: `opencode run --agent <role> "<message>"`. System prompt lives in
// .opencode/agent/<role>.md; the message carries the task data + markers contract.
async function worker(role, message, { timeoutMs = 25 * 60_000 } = {}) {
  log(`  [${role}] GLM worker started (timeout ${Math.round(timeoutMs / 60000)}m)`);
  const r = await run('opencode', ['run', '--agent', role, message], { timeoutMs });
  const tail = r.all.slice(-4000);
  log(`  [${role}] finished code=${r.code}`);
  log(`  [${role}] tail: ${short(tail, 600)}`);
  return { ...r, tail };
}
const after = (text, marker, until) => {
  const i = text.indexOf(marker);
  if (i < 0) return null;
  const j = until ? text.indexOf(until, i + marker.length) : -1;
  return text.slice(i + marker.length, j > 0 ? j : undefined).trim();
};

// ---------- pure helpers (unit-tested in tests/swarm-orchestrator.test.mjs) ----------

export const extractDev = (tail) => {
  const status =
    (tail.match(/status:\s*(done|already-implemented|not-reproducible|blocked)/) || [])[1] ||
    'blocked';
  return { status, summary: after(tail, 'DEV_SUMMARY:') || '' };
};

export const extractVerdict = (all) => {
  const accept = /verdict\s*[:\-—]*\s*accept|вердикт\s*[:\-—]*\s*(принят|accept)/i;
  const ret = /verdict\s*[:\-—]*\s*return|вердикт\s*[:\-—]*\s*(вернуть|return)/i;
  if (accept.test(all)) return { verdict: 'ACCEPT', notes: '' };
  if (ret.test(all)) {
    const notes = after(all, /VERDICT:\s*RETURN|вердикт[^\n]*вернуть/i) || short(all, 600);
    return { verdict: 'RETURN', notes };
  }
  return { verdict: 'RETURN', notes: 'reviewer produced no verdict — treat as RETURN' };
};

export const extractSecurity = (all) => {
  const m = all.match(/SECURITY_VERDICT\s*[:\-—]*\s*(PASS|FAIL)/i);
  if (!m)
    return { verdict: 'FAIL', findings: 'security agent produced no verdict — treat as FAIL' };
  if (m[1].toUpperCase() === 'PASS') return { verdict: 'PASS', findings: '' };
  const findings = after(all, /SECURITY_VERDICT\s*[:\-—]*\s*FAIL/i) || short(all, 600);
  return { verdict: 'FAIL', findings };
};

export const buildAiLog = ({
  identifier,
  title,
  today,
  rounds,
  verdicts,
  security,
  gates,
  prUrl,
  story,
  devSummary,
}) => {
  const lines = [];
  lines.push(`## ${identifier} · ${title}`);
  lines.push('');
  lines.push(`- **Дата:** ${today}`);
  lines.push(`- **Оркестратор:** scripts/swarm/orchestrator.mjs (детерминированный, без LLM)`);
  lines.push(
    `- **Агенты:** executor → gates → reviewer → security → documenter (все на GLM-5.3, opencode run)`,
  );
  lines.push(`- **Раундов dev↔review:** ${rounds}`);
  lines.push(`- **Гейты:** ${gates}`);
  lines.push(`- **Ревью:** ${verdicts}`);
  lines.push(`- **Security:** ${security}`);
  lines.push(`- **PR:** ${prUrl || '— (ветка оставлена без PR)'}`);
  if (devSummary) lines.push(`- **Итог исполнителя:** ${short(devSummary, 300)}`);
  if (story) lines.push(`- **История:** ${short(story, 400)}`);
  lines.push('');
  return lines.join('\n');
};

// Security runs INSIDE the develop loop: a FAIL returns the issue to the
// executor with findings (same budget of rounds), it must never skip a task.
export const securityFailureFeedback = (round, maxRounds, findings) => {
  if (round + 1 < maxRounds) {
    return { action: 'retry', notes: `SECURITY-GATE ВЕРНУЛ ИЗМЕНЕНИЕ — исправь:\n${findings}` };
  }
  return { action: 'fail', notes: findings };
};

/** Acquire the single-instance lock; stale locks from SIGKILLed orchestrators
 *  (OOM pressure — lesson of the DIG-7 cycle) are reclaimed when their PID is dead. */
export function acquireLock(lockPath, currentPid) {
  let fd;
  try {
    fd = openSync(lockPath, 'wx');
  } catch {
    let ownerPid = 0;
    try {
      ownerPid = parseInt(readFileSync(lockPath, 'utf8').trim(), 10) || 0;
    } catch {}
    let alive = false;
    try {
      if (ownerPid) {
        process.kill(ownerPid, 0);
        alive = true;
      }
    } catch (e) {
      alive = e.code === 'EPERM';
    }
    if (alive) throw new Error(`another swarm instance holds the lock (pid ${ownerPid})`);
    try {
      unlinkSync(lockPath);
    } catch {}
    fd = openSync(lockPath, 'wx');
  }
  writeSync(fd, String(currentPid));
  closeSync(fd);
}

async function preflight() {
  if (!existsSync(resolve(ROOT, 'scripts/swarm/orchestrator.mjs')))
    throw new Error('run from the repo root');
  if (!process.env.LINEAR_DIGITAL_UNIVERSITY_API_KEY)
    throw new Error('LINEAR_DIGITAL_UNIVERSITY_API_KEY is not set');
  const oc = await sh('opencode --version', { timeoutMs: 30_000 });
  if (oc.code !== 0) throw new Error('opencode CLI not found');
  const clean = await sh('git status --porcelain');
  if (clean.out.trim()) throw new Error('working tree is not clean — commit or stash first');
  const br = await sh('git rev-parse --abbrev-ref HEAD');
  if (br.out.trim() !== 'main') throw new Error(`must run on main (now: ${br.out.trim()})`);
}

async function metaVerdict(revAll) {
  const msg = `Ты — VERDICT CLERK, не ревьюер. Другой агент проверял дифф и выдал анализ:\n---\n${short(revAll, 2200)}\n---\nДетерминированные тест-гейты зелёные. Реши: называет ли анализ блокирующие дефекты (логика, безопасность, выход за рамки задачи, сломанные тесты) или это одобряющее ревью?\nПечатай РОВНО одну строку в конце:\nVERDICT: ACCEPT\nили\nVERDICT: RETURN\nНичего после этой строки.`;
  const r = await worker('reviewer', msg, { timeoutMs: 6 * 60_000 });
  return extractVerdict(r.all || r.tail);
}

async function main() {
  mkdirSync(LOGS, { recursive: true });
  await preflight();
  const lock = resolve(STATE, 'lock');
  acquireLock(lock, process.pid);

  try {
    for (let n = 0; n < MAX_TASKS; n++) {
      logFile = resolve(LOGS, `cycle-${Date.now()}.log`);
      log(`=== task ${n + 1}/${MAX_TASKS} ===`);
      await sh('git fetch origin -q && git checkout -q --detach origin/main');

      const issue = await pickIssue({ pin: PIN });
      if (!issue) {
        log('queue empty — no Todo issues labeled `swarm`.');
        break;
      }
      // carry the previous cycle's review findings into the executor's context
      const prior = await lastFailureNotes(issue.identifier);
      if (prior)
        issue.description = `${issue.description}\n\n---\nПРЕДЫДУЩИЕ ЗАМЕЧАНИЯ РОЯ (исправь каждый пункт):\n${prior}`;
      log(
        `picked ${issue.identifier}: ${issue.title}${prior ? ' (+ предыдущие замечания ревью)' : ''}`,
      );
      if (DRY) {
        log('dry-run: would claim → develop → gates → review → security → document → PR → Done.');
        break;
      }

      const branch = issue.branch || `swarm/${issue.identifier.toLowerCase()}`;
      let devStatus = null,
        devSummary = '',
        story = null,
        securityPassed = false;
      const verdicts = [];
      let round = 0,
        reviewNotes = '',
        gatesLine = '',
        prUrl = '';

      try {
        await claimIssue(issue.identifier);

        // ---- develop (executor ↔ reviewer/security loop)
        for (; round < MAX_ROUNDS; round++) {
          log(`-- round ${round + 1}/${MAX_ROUNDS}: develop`);
          await sh(
            `git checkout -q ${branch} 2>/dev/null || git checkout -q -B ${branch} origin/main`,
          );
          const desc = `${issue.description}\n\n(полное описание выше; статус задачи Linear не читать и не менять — этим владеет оркестратор)`;
          const dev = await worker(
            'executor',
            [
              `ЗАДАЧА: ${issue.identifier} — ${issue.title}`,
              `ОПИСАНИЕ:\n${desc}`,
              `Раунд разработки ${round + 1}.`,
              reviewNotes
                ? `\nРЕВЬЮ ВЕРНУЛО ИЗМЕНЕНИЕ С ЗАМЕЧАНИЯМИ — исправь каждый пункт:\n${reviewNotes}`
                : '',
            ].join('\n'),
            { timeoutMs: EXEC_MS },
          );

          const commits = parseInt(
            (await sh('git rev-list --count origin/main..HEAD')).out.trim() || '0',
            10,
          );
          const dev1 = extractDev(dev.tail);
          devStatus = commits > 0 ? 'done' : dev1.status === 'done' ? 'blocked' : dev1.status;
          devSummary = dev1.summary;
          log(
            `  commits on branch: ${commits}; executor status: ${dev1.status} → using ${devStatus}`,
          );

          // career-ops lessons: reflog rescue + already-merged detection
          if (devStatus !== 'done' && dev1.status !== 'not-reproducible') {
            const found = await sh(`git log --all --grep="${issue.identifier}" --pretty=%H -5`, {
              timeoutMs: 60_000,
            });
            let sha = '',
              mergedSha = '';
            for (const cand of found.out.trim().split('\n')) {
              if (!/^[0-9a-f]{7,40}$/.test(cand)) continue;
              const anc = await sh(
                `git merge-base --is-ancestor ${cand} origin/main && echo ancestor || echo fresh`,
              );
              if (anc.out.includes('fresh')) {
                sha = cand;
                break;
              }
              if (!mergedSha) mergedSha = cand;
            }
            if (!sha && mergedSha) {
              const ev = `**Уже в main** — работа присутствует коммитом ${mergedSha.slice(0, 9)}. Закрыто как Done.`;
              await doneIssue(issue.identifier, ev);
              log(`already merged: ${mergedSha.slice(0, 9)} — issue closed as Done`);
              devStatus = 'already-merged';
              break;
            }
            if (sha) {
              log(`  reflog rescue: found lost work ${sha.slice(0, 9)} — cherry-picking`);
              const cp = await sh(`git cherry-pick ${sha}`);
              const afterCp = parseInt(
                (await sh('git rev-list --count origin/main..HEAD')).out.trim() || '0',
                10,
              );
              if (cp.code === 0 && afterCp > 0) {
                devStatus = 'done';
                devSummary = `(rescued from lost branch commit ${sha.slice(0, 9)}) ${devSummary}`;
              } else {
                await sh('git cherry-pick --abort');
              }
            }
          }
          if (devStatus !== 'done') break;

          log('-- gates: lint/typecheck/test/build (scripts/swarm/gates.mjs)');
          const gates = await sh('node scripts/swarm/gates.mjs', { timeoutMs: 45 * 60_000 });
          gatesLine = (gates.all.match(/GATES:.*/)?.[0] || 'GATES: n/a').trim();
          if (gates.code !== 0) {
            if (round + 1 < MAX_ROUNDS) {
              reviewNotes = `Тест-гейты упали. Хвост вывода:\n${short(gates.all.slice(-1500), 1500)}`;
              log(`  gates FAILED — feeding output back to the executor`);
              continue;
            }
            throw new Error(`gates failed after ${MAX_ROUNDS} rounds (${gatesLine})`);
          }
          log(`  gates green ${gatesLine}`);

          log(`-- round ${round + 1}: review (fresh context)`);
          const diff = await sh(`git diff origin/main...HEAD`);
          const rev = await worker(
            'reviewer',
            [
              `ЗАДАЧА: ${issue.identifier} — ${issue.title}`,
              `ОПИСАНИЕ (кратко):\n${short(issue.description, 1200)}`,
              `Дифф относительно origin/main:\n<DIFF>\n${diff.all.slice(0, 60_000)}\n</DIFF>`,
            ].join('\n'),
            { timeoutMs: 15 * 60_000 },
          );
          let v = extractVerdict(rev.all || rev.tail);
          if (v.verdict === 'RETURN' && /no verdict/.test(v.notes)) {
            log('  verdict missing — running meta-verdict pass');
            v = await metaVerdict(rev.all || rev.tail);
          }
          verdicts.push(v.verdict);
          if (v.verdict === 'ACCEPT') {
            log('  verdict: ACCEPT');

            log('-- security gate (fresh context, inside the round loop)');
            const diff2 = await sh(`git diff origin/main...HEAD`);
            const sec = await worker(
              'security',
              [
                `ЗАДАЧА: ${issue.identifier} — ${issue.title}`,
                `Дифф:\n<DIFF>\n${diff2.all.slice(0, 60_000)}\n</DIFF>`,
              ].join('\n'),
              { timeoutMs: 15 * 60_000 },
            );
            const sv = extractSecurity(sec.all || sec.tail);
            securityPassed = sv.verdict === 'PASS';
            if (!securityPassed) {
              const fb = securityFailureFeedback(round, MAX_ROUNDS, sv.findings);
              if (fb.action === 'retry') {
                reviewNotes = fb.notes;
                log(`  security: FAIL — feeding findings back to the executor`);
                continue;
              }
              await failIssue(issue.identifier, 'security', sv.findings.slice(0, 300));
              throw new Error('security gate: FAIL');
            }
            log('  security: PASS');
            break;
          }
          reviewNotes = v.notes;
          log(`  verdict: RETURN — ${short(v.notes, 160)}`);
        }

        if (devStatus === 'already-merged') {
          log('finished: already in main');
          continue;
        }
        if (devStatus !== 'done') {
          if (devStatus === 'blocked') {
            await failIssue(
              issue.identifier,
              'executor',
              'исполнитель сообщил blocked — ветка и доска оставлены человеку',
            );
            throw new Error('executor reported blocked');
          }
          await failIssue(issue.identifier, 'executor', `статус «${devStatus}» — задача не готова`);
          throw new Error(`executor finished with ${devStatus}`);
        }
        if (!verdicts.length || verdicts[verdicts.length - 1] !== 'ACCEPT') {
          await failIssue(
            issue.identifier,
            'review',
            `нет ACCEPT за ${MAX_ROUNDS} раунда.\nЗамечания последнего ревью (исправить в первую очередь):\n${(reviewNotes || '(без деталей)').slice(0, 2500)}`,
          );
          throw new Error('review: no ACCEPT');
        }
        if (!securityPassed) {
          await failIssue(
            issue.identifier,
            'security',
            'security не прошёл — ветка оставлена человеку',
          );
          throw new Error('security gate: FAIL');
        }

        // ---- document (тексты рой пишет сам, файл — детерминированно)
        log('-- documenter');
        const stat = await sh(`git diff --stat origin/main...HEAD`);
        const doc = await worker(
          'documenter',
          [
            `ЗАДАЧА: ${issue.identifier} — ${issue.title}`,
            `DEV SUMMARY:\n${devSummary || '(без summary)'}`,
            `DIFF STAT:\n${short(stat.out, 1200)}`,
          ].join('\n'),
          { timeoutMs: 8 * 60_000 },
        );
        const fixed = after(doc.tail, 'CHLOG_FIXED:', 'CHLOG_NOTES:');
        const notes = after(doc.tail, 'CHLOG_NOTES:', 'STORY:');
        story = after(doc.tail, 'STORY:');
        if (!fixed || !notes || !story) throw new Error('documenter output incomplete');
        log(`  story: ${short(story, 120)}`);

        // ai-log entry + changelog entry — committed deterministically on the branch
        const today = new Date().toISOString().slice(0, 10);
        const aiLog = buildAiLog({
          identifier: issue.identifier,
          title: issue.title,
          today,
          rounds: round + 1,
          verdicts: verdicts.join(' → ') || 'ACCEPT',
          security: securityPassed ? 'PASS' : 'FAIL',
          gates: gatesLine || 'green',
          prUrl: '',
          story,
          devSummary,
        });
        const logPath = `docs/ai-log/${today}-${issue.identifier.toLowerCase()}.md`;
        writeFileSync(resolve(ROOT, logPath), aiLog);
        const clPath = 'CHANGELOG.md';
        if (existsSync(resolve(ROOT, clPath))) {
          const cl = readFileSync(resolve(ROOT, clPath), 'utf8');
          const entry = `### Unreleased\n\n#### Изменения\n${fixed}\n\n#### Заметки\n${notes}\n`;
          writeFileSync(
            resolve(ROOT, clPath),
            cl.includes('### Unreleased')
              ? cl
                  .replace('#### Изменения\n', `#### Изменения\n${fixed}\n`)
                  .replace('#### Заметки\n', `#### Заметки\n${notes}\n`)
              : cl.replace(/(# Changelog\n+)/, `$1\n${entry}`),
          );
          await sh(
            `git add ${JSON.stringify(clPath)} ${JSON.stringify(logPath)} && git commit -q -m ${JSON.stringify(`docs(swarm): ai-log + changelog — ${issue.identifier}`)}`,
          );
        } else {
          await sh(
            `git add ${JSON.stringify(logPath)} && git commit -q -m ${JSON.stringify(`docs(swarm): ai-log — ${issue.identifier}`)}`,
          );
        }

        if (NO_PR) {
          log('--no-pr: stopping after ACCEPT + security + document. Branch kept.');
          break;
        }

        // ---- PR
        log('-- release: push + PR');
        const pushBr = await sh(`git push -u origin ${branch}`, { timeoutMs: 300_000 });
        if (pushBr.code !== 0) throw new Error(`branch push failed: ${short(pushBr.all)}`);
        const prBody = resolve(STATE, `pr-body-${issue.identifier}.md`);
        writeFileSync(
          prBody,
          `${story}\n\n---\nЦикл роя: dev(${MAX_ROUNDS} max) → гейты (${gatesLine || 'green'}) → ревью: ${verdicts.join(' → ')} → security: PASS.\nЗадача: ${issue.identifier}. Концепт для конкурса, данные вымышленные.\n`,
        );
        const pr = await sh(
          `gh pr create --head ${branch} --title ${JSON.stringify(`${issue.identifier}: ${issue.title}`)} --body-file ${JSON.stringify(prBody)}`,
          { timeoutMs: 120_000 },
        );
        prUrl = (pr.out.match(/https:\/\/github\.com\/\S+/) || [])[0];
        if (!prUrl) throw new Error(`gh pr create failed: ${short(pr.all)}`);
        log(`  PR: ${prUrl}`);
        await addComment(
          issue.identifier,
          `🔀 PR готов: ${prUrl}\nГейты: ${gatesLine || 'green'} · Ревью: ACCEPT · Security: PASS\nMerge — за человеком (или флаг \`--merge\`).`,
        );

        if (MERGE) {
          log('-- merge (squash)');
          await sh(`gh pr merge ${prUrl.split('/').pop()} --squash --delete-branch`, {
            timeoutMs: 300_000,
          });
          await sh('git fetch origin -q && git checkout -q --detach origin/main');
          const ev = `**Отправлено роем** (${today})\n\n- PR: ${prUrl} (squash-merged)\n- Гейты: ${gatesLine || 'green'} · Ревью: ACCEPT · Security: PASS\n- История: ${short(story, 300)}\n- ai-log: \`${logPath}\``;
          await doneIssue(issue.identifier, ev);
          log(`merged: ${prUrl} — issue Done`);

          if (DEPLOY) {
            log('-- deploy');
            const dep = await sh('bash scripts/swarm/deploy.sh', { timeoutMs: 20 * 60_000 });
            if (dep.code !== 0) throw new Error(`deploy failed: ${short(dep.all)}`);
            await addComment(issue.identifier, `🚀 Задеплоено на https://ostrovok.store`);
          }
        }

        log(`=== DONE: ${issue.identifier} ===`);
      } catch (e) {
        await failIssue(issue.identifier, 'pipeline', String(e));
        throw e;
      }
    }
  } finally {
    try {
      unlinkSync(resolve(STATE, 'lock'));
    } catch {}
  }
}

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]) === decodeURIComponent(new URL(import.meta.url).pathname);
if (isMain) {
  main().then(
    () => process.exit(0),
    (e) => {
      console.error(`SWARM ERROR: ${String(e).slice(0, 500)}`);
      process.exit(1);
    },
  );
}
