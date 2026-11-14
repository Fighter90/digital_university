#!/usr/bin/env node
// DIG-55 (review round 2) — serialize `next build` on a shared checkout.
//
// Several swarm sessions (orchestrator instances) run on this repository at
// the same time. Two concurrent `next build` processes write the same
// `.next` directory and corrupt each other mid-build — observed as
// `unhandledRejection [Error: ENOENT: … copyfile '.next/server/edge-runtime-webpack.js'
// -> '.next/standalone/.next/server/…']` right after "Collecting build
// traces", which fails the gates' build step nondeterministically.
//
// This wrapper takes an exclusive, crash-safe lock (mkdir is atomic on
// POSIX and Windows) around the real build, so every consumer of
// `npm run build` / `pnpm build` — swarm gates, the Playwright webServer
// (`pnpm build && pnpm start`) and deploy/Dockerfile — queues instead of
// racing. A lock left by a crashed/killed holder is stolen once its pid is
// dead, or after staleMs as a last resort.
//
// Product-side module on purpose: scripts/swarm/ is orchestrator
// infrastructure and must stay untouched by screen/bug tasks.

import { mkdirSync, rmSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULTS = {
  staleMs: 10 * 60_000, // wedged holder older than this is considered dead
  pollMs: 2_000, // re-try cadence while another build holds the lock
  timeoutMs: 10 * 60_000, // give up with a clear error (gates allow 20 min)
};

/** Repo-local binary (works without npm/pnpm adding .bin to PATH). */
const repoBin = (bin) => {
  const p = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'node_modules', '.bin', bin);
  return existsSync(p) ? p : bin;
};

/** true if `pid` is a live process (EPERM counts as alive: exists, no perms). */
export const isProcessAlive = (pid) => {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
};

const readHolderPid = (lockPath) => {
  try {
    return Number(readFileSync(resolve(lockPath, 'pid'), 'utf8').trim());
  } catch {
    return 0;
  }
};

const lockAgeMs = (lockPath) => {
  try {
    return Date.now() - statSync(resolve(lockPath, 'pid')).mtimeMs;
  } catch {
    return 0;
  }
};

/** Synchronous sleep (blocks the event loop — this is a build wrapper). */
const sleepSync = (ms) => {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
};

/**
 * Acquire the exclusive build lock. Throws Error('build-lock-timeout') if
 * `timeoutMs` elapses while another LIVE holder keeps the lock.
 */
export const acquireBuildLock = ({
  lockPath,
  staleMs = DEFAULTS.staleMs,
  pollMs = DEFAULTS.pollMs,
  timeoutMs = DEFAULTS.timeoutMs,
} = {}) => {
  if (!lockPath) throw new Error('build-lock: lockPath is required');
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    try {
      // mkdir is atomic: exactly one process wins.
      mkdirSync(lockPath);
      writeFileSync(resolve(lockPath, 'pid'), String(process.pid));
      return;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }

    const holderPid = readHolderPid(lockPath);
    const stale = lockAgeMs(lockPath) > staleMs;
    if (stale || (holderPid > 0 && !isProcessAlive(holderPid))) {
      // Crash- or kill-left lock (or wedged beyond staleMs): steal it and
      // race for the re-created directory; losers re-enter the wait loop.
      console.warn(
        `[build-lock] stealing stale lock at ${lockPath} (holder pid=${holderPid || 'unknown'})`,
      );
      rmSync(lockPath, { recursive: true, force: true });
      continue;
    }

    if (Date.now() >= deadline) {
      throw new Error(
        `build-lock-timeout: another build still holds ${lockPath} (holder pid=${holderPid})`,
      );
    }
    sleepSync(pollMs);
  }
};

/** Release the lock; idempotent (no-op when it is already gone). */
export const releaseBuildLock = ({ lockPath } = {}) => {
  if (lockPath) rmSync(lockPath, { recursive: true, force: true });
};

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const lockPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', '.next-build.lock');
  const cmd = process.argv.slice(2);
  if (cmd.length === 0) cmd.push(repoBin('next'), 'build');

  try {
    acquireBuildLock({ lockPath });
  } catch (error) {
    console.error(`[build-lock] ${error.message}`);
    process.exit(1);
  }

  // Best-effort release on Ctrl-C / termination so the next build is not
  // delayed by stale-lock stealing.
  let interrupted = false;
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      interrupted = true;
      releaseBuildLock({ lockPath });
      process.exit(130);
    });
  }

  try {
    console.log(`[build-lock] acquired, running: ${cmd.join(' ')}`);
    const result = spawnSync(cmd[0], cmd.slice(1), { stdio: 'inherit' });
    if (interrupted) process.exit(130);
    process.exit(result.status ?? 1);
  } finally {
    releaseBuildLock({ lockPath });
  }
}
