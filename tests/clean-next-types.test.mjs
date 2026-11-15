// Pruning of stale generated Next.js type artifacts — pins the contract that
// keeps `npm run typecheck` deterministic on a shared checkout (review
// round 2, DIG-63 gates: GATES: lint=pass typecheck=fail with three
// `TS2307: Cannot find module '…/src/app/api/calendar/ics/route.js'` lines
// coming from `.next/types/…` — generated on this very branch, then run
// against a checkout without that route).
//
// tsconfig.json includes `.next/types/**/*.ts` and `.next-dev/types/**/*.ts`
// (Next.js recommendation). Those files are build/dev outputs that import
// route modules by relative path, so when the checked-out tree no longer
// matches the artifacts (branch switch/reset between review rounds,
// concurrent sessions on one workspace), plain `tsc --noEmit` reports
// errors about files that exist in neither git nor the current tree.
//
// The fix lives OUTSIDE scripts/swarm/ (product build entry point), same
// policy as build-lock (DIG-55): the orchestrator cannot be fixed here —
// every consumer of `npm run typecheck` (swarm gates, CI, humans) gets a
// clean, current-tree-only typecheck, and the very next gates step
// (`npm run build`) regenerates and validates the generated types itself.
//
// Run: node --test tests/clean-next-types.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { cleanNextTypes, GENERATED_TYPE_DIRS } from '../scripts/clean-next-types.mjs';

const MODULE_PATH = fileURLToPath(new URL('../scripts/clean-next-types.mjs', import.meta.url));

/** Fresh scratch dir per test. */
const scratch = (label) => mkdtempSync(path.join(tmpdir(), `clean-next-types-${label}-`));

/** The exact shape of a stale artifact: generated types import the route by path. */
const staleRouteType = (relImport) => `// File: /repo/src/app/api/calendar/ics/route.ts
import * as entry from '${relImport}'
type TEntry = typeof import('${relImport}')
`;

test('removes stale generated type dirs, keeps the rest of .next', () => {
  const root = scratch('stale');
  const nextTypes = path.join(root, '.next', 'types', 'app', 'api', 'calendar', 'ics');
  const devTypes = path.join(root, '.next-dev', 'types');
  mkdirSync(nextTypes, { recursive: true });
  mkdirSync(devTypes, { recursive: true });
  writeFileSync(
    path.join(nextTypes, 'route.ts'),
    staleRouteType('../../../../../../src/app/api/calendar/ics/route.js'),
  );
  writeFileSync(
    path.join(devTypes, 'validator.ts'),
    staleRouteType('../../src/app/api/calendar/ics/route.js'),
  );
  const warmCache = path.join(root, '.next', 'cache', 'webpack', 'warm.bin');
  mkdirSync(path.dirname(warmCache), { recursive: true });
  writeFileSync(warmCache, 'keep-me');

  const removed = cleanNextTypes({ root });

  assert.deepEqual(
    removed.sort(),
    ['.next-dev/types', '.next/types'],
    'both generated type dirs reported',
  );
  assert.equal(existsSync(path.join(root, '.next', 'types')), false, '.next/types pruned');
  assert.equal(existsSync(path.join(root, '.next-dev', 'types')), false, '.next-dev/types pruned');
  assert.equal(readFileSync(warmCache, 'utf8'), 'keep-me', 'build caches must survive');

  rmSync(root, { recursive: true, force: true });
});

test('idempotent on a fresh checkout — no .next at all, nothing created', () => {
  const root = scratch('fresh');

  const removed = cleanNextTypes({ root });

  assert.deepEqual(removed, [], 'nothing to remove on a fresh checkout');
  assert.equal(existsSync(path.join(root, '.next')), false, 'must not create .next');
  assert.equal(existsSync(path.join(root, '.next-dev')), false, 'must not create .next-dev');

  rmSync(root, { recursive: true, force: true });
});

test('covers both distDirs of the repo (build → .next, dev → .next-dev, DIG-12)', () => {
  assert.ok(GENERATED_TYPE_DIRS.includes('.next/types'), 'build distDir types covered');
  assert.ok(GENERATED_TYPE_DIRS.includes('.next-dev/types'), 'dev distDir types covered');
});

test('CLI exits 0 and prunes the given root', () => {
  const root = scratch('cli');
  const nextTypes = path.join(root, '.next', 'types');
  mkdirSync(nextTypes, { recursive: true });
  writeFileSync(path.join(nextTypes, 'validator.ts'), 'export {}');

  const run = spawnSync(process.execPath, [MODULE_PATH, root], { encoding: 'utf8' });
  assert.equal(run.status, 0, `CLI must succeed: ${run.stderr}`);
  assert.equal(existsSync(nextTypes), false, 'CLI pruned .next/types');

  rmSync(root, { recursive: true, force: true });
});
