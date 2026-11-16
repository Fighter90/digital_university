#!/usr/bin/env node
// DIG-63 (review round 2, carried in DIG-48) — run the typecheck gate under
// the SAME build lock as `next build`.
//
// `npm run typecheck` used to be `clean-next-types.mjs && next typegen &&
// tsc --noEmit` with no lock. On a shared checkout (several swarm sessions)
// a parallel session holding the lock and running `next build` could get
// its `.next/types` deleted by our prune step mid-build — exactly the class
// of failure the prune script itself was written to cure. Wrapping the
// whole chain in the same mkdir-lock serializes prune/typegen/tsc against
// any concurrent `npm run build` on this checkout.
//
// Exit discipline mirrors scripts/build-lock.mjs: `process.exit()` skips
// `finally`, so the release happens on the straight-line path after the
// steps complete and only then the process exits.
//
// Usage: `node scripts/typecheck-locked.mjs` — default steps (prune →
// typegen → tsc); `node scripts/typecheck-locked.mjs <cmd> [args...]` — run
// an arbitrary command under the lock (used by the behavioral tests).
//
// Product-side module on purpose: scripts/swarm/ is orchestrator
// infrastructure and must stay untouched by screen/bug tasks (same policy
// as scripts/build-lock.mjs).

import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { acquireBuildLock, releaseBuildLock, repoBin } from './build-lock.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const lockPath = process.env.BUILD_LOCK_PATH
  ? resolve(process.env.BUILD_LOCK_PATH)
  : resolve(root, '.next-build.lock');

/** The canonical typecheck chain, identical to the old unlocked script. */
const defaultSteps = () => [
  [process.execPath, [resolve(root, 'scripts', 'clean-next-types.mjs')]],
  [repoBin('next'), ['typegen']],
  [repoBin('tsc'), ['--noEmit']],
];

const argv = process.argv.slice(2);
const steps = argv.length > 0 ? [[argv[0], argv.slice(1)]] : defaultSteps();

try {
  acquireBuildLock({ lockPath });
} catch (error) {
  console.error(`[typecheck-locked] ${error.message}`);
  process.exit(1);
}

let exitCode;
try {
  for (const [bin, args] of steps) {
    console.log(`[typecheck-locked] running: ${bin} ${args.join(' ')}`);
    const result = spawnSync(bin, args, { stdio: 'inherit', cwd: root });
    if (result.status !== 0) {
      exitCode = result.status ?? 1;
      break;
    }
  }
  exitCode ??= 0;
} finally {
  releaseBuildLock({ lockPath });
}
process.exit(exitCode);
