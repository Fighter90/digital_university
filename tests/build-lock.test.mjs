// Build-serialization lock — pins the contract that lets several swarm
// sessions share one checkout without racing `next build` on the same
// `.next` (review round 2, DIG-55 gates: unhandledRejection ENOENT
// copyfile `.next/server/edge-runtime-webpack.js` → `.next/standalone/…`;
// two orchestrator executors build concurrently on this machine).
//
// The lock lives OUTSIDE scripts/swarm/ (product build entry point),
// so the orchestrator cannot be fixed here — every consumer of
// `npm run build` (gates, e2e webServer `pnpm build`, Dockerfile) queues
// instead of racing.
//
// Run: node --test tests/build-lock.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { acquireBuildLock, releaseBuildLock, isProcessAlive } from '../scripts/build-lock.mjs';

const MODULE_PATH = fileURLToPath(new URL('../scripts/build-lock.mjs', import.meta.url));

/** Fresh scratch dir per test. */
const scratch = (label) => mkdtempSync(path.join(tmpdir(), `build-lock-${label}-`));

/** A pid that is guaranteed to be dead: spawnSync returns after exit. */
const deadPid = () => spawnSync(process.execPath, ['-e', '""']).pid;

test('acquire creates the lock dir with our pid; release removes it', () => {
  const root = scratch('basic');
  const lockPath = path.join(root, 'lock');

  acquireBuildLock({ lockPath });
  assert.ok(existsSync(path.join(lockPath, 'pid')), 'pid file written');
  const pid = Number(readFileSync(path.join(lockPath, 'pid'), 'utf8'));
  assert.equal(pid, process.pid);

  releaseBuildLock({ lockPath });
  assert.equal(existsSync(lockPath), false, 'lock removed');

  rmSync(root, { recursive: true, force: true });
});

test('isProcessAlive: own pid alive, exited child dead', () => {
  assert.equal(isProcessAlive(process.pid), true);
  const pid = deadPid();
  assert.ok(Number.isInteger(pid) && pid > 0);
  assert.equal(isProcessAlive(pid), false);
});

test('stale lock (dead holder pid) is stolen immediately', () => {
  const root = scratch('stale');
  const lockPath = path.join(root, 'lock');
  mkdirSync(lockPath);
  writeFileSync(path.join(lockPath, 'pid'), String(deadPid()));

  const t0 = Date.now();
  acquireBuildLock({ lockPath, staleMs: 60_000 });
  assert.ok(Date.now() - t0 < 5_000, 'acquire did not wait for a dead holder');

  releaseBuildLock({ lockPath });
  rmSync(root, { recursive: true, force: true });
});

test('second builder waits (busy) and proceeds after release — serialization', () => {
  const root = scratch('busy');
  const lockPath = path.join(root, 'lock');

  acquireBuildLock({ lockPath });

  // Child tries to acquire while WE hold the lock → must fail fast (timeout).
  const tryAcquire = (timeoutMs) =>
    spawnSync(process.execPath, [
      '--input-type=module',
      '-e',
      `
        import { acquireBuildLock } from ${JSON.stringify(MODULE_PATH)};
        try {
          acquireBuildLock({ lockPath: ${JSON.stringify(lockPath)}, timeoutMs: ${timeoutMs}, pollMs: 50 });
          process.exit(0);
        } catch {
          process.exit(7);
        }
      `,
    ]);
  const busy = tryAcquire(400);
  assert.equal(busy.status, 7, 'child must time out while the lock is held');

  // After release the same child acquires cleanly.
  releaseBuildLock({ lockPath });
  const free = tryAcquire(2_000);
  assert.equal(free.status, 0, 'child must acquire after release');
  if (free.status !== 0) console.error(free.stderr?.toString());

  rmSync(root, { recursive: true, force: true });
});

test('corrupt lock (garbage pid) is treated by stale policy, not a crash', () => {
  const root = scratch('corrupt');
  const lockPath = path.join(root, 'lock');
  mkdirSync(lockPath);
  writeFileSync(path.join(lockPath, 'pid'), 'not-a-pid');

  acquireBuildLock({ lockPath, staleMs: 1 }); // staleMs=1ms → immediately stale
  releaseBuildLock({ lockPath });

  rmSync(root, { recursive: true, force: true });
});
