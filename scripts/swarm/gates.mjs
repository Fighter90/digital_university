#!/usr/bin/env node
// Deterministic test gates for the digital_university swarm.
// Runs whatever quality scripts exist in package.json; a repo without
// package.json (pre-scaffold) passes with a warning so the very first
// task (DIG-6, repo init) can ship. The verdict is the EXIT CODE.
//
// Prints: GATES: <name>=<pass|skip|fail> ... and GATES_SUMMARY: green|red

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const results = [];

const plan = () => {
  const pkgPath = resolve(ROOT, 'package.json');
  if (!existsSync(pkgPath)) {
    return [
      { name: 'bootstrap', cmd: null, note: 'no package.json — scaffold task, gates trivially green' },
    ];
  }
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  const scripts = pkg.scripts || {};
  const has = (s) => (scripts[s] ? { cmd: `npm run ${s}` } : null);
  const hasTS = existsSync(resolve(ROOT, 'tsconfig.json'));
  const out = [];
  const lint = has('lint');
  out.push(lint ? { ...lint, name: 'lint' } : { name: 'lint', cmd: 'npx next lint', skip: 'no lint script' });
  const type = has('typecheck') || (hasTS ? { cmd: 'npx tsc --noEmit' } : null);
  out.push(type ? { ...type, name: 'typecheck' } : { name: 'typecheck', cmd: null, skip: 'no typescript' });
  const test = has('test');
  out.push(test ? { ...test, name: 'test' } : { name: 'test', cmd: null, skip: 'no test script' });
  const build = has('build');
  out.push(build ? { ...build, name: 'build' } : { name: 'build', cmd: null, skip: 'no build script' });
  return out;
};

export const planGates = ({ hasPackageJson, scripts = {}, hasTS = false }) => {
  if (!hasPackageJson) return [{ name: 'bootstrap', skip: 'no package.json — scaffold task, gates trivially green' }];
  const has = (s) => Boolean(scripts[s]);
  return [
    has('lint') ? { name: 'lint', cmd: 'npm run lint' } : { name: 'lint', skip: 'no lint script' },
    has('typecheck')
      ? { name: 'typecheck', cmd: 'npm run typecheck' }
      : hasTS
        ? { name: 'typecheck', cmd: 'npx tsc --noEmit' }
        : { name: 'typecheck', skip: 'no typescript' },
    // build ДО test: тесты-санити (next-env.d.ts) требуют артефактов сборки на свежем checkout
    has('build') ? { name: 'build', cmd: 'npm run build' } : { name: 'build', skip: 'no build script' },
    has('test') ? { name: 'test', cmd: 'npm test' } : { name: 'test', skip: 'no test script' },
  ];
};

const main = () => {
  const steps = plan();
  let failed = false;
  for (const s of steps) {
    if (!s.cmd || s.skip) {
      results.push(`${s.name}=skip(${s.skip || 'n/a'})`);
      continue;
    }
    const r = spawnSync('bash', ['-lc', s.cmd], { encoding: 'utf8', timeout: 20 * 60_000, env: process.env });
    const ok = r.status === 0;
    results.push(`${s.name}=${ok ? 'pass' : 'fail'}`);
    if (!ok) {
      failed = true;
      console.error(`--- ${s.cmd} failed (exit ${r.status}) — tail: ---`);
      console.error(((r.stdout || '') + (r.stderr || '')).slice(-1800));
      break; // first red gate wins — its output feeds the executor
    }
  }
  console.log(`GATES: ${results.join(' ')}`);
  console.log(`GATES_SUMMARY: ${failed ? 'red' : 'green'}`);
  process.exit(failed ? 1 : 0);
};

const isMain = process.argv[1] && resolve(process.argv[1]) === decodeURIComponent(new URL(import.meta.url).pathname);
if (isMain) main();
