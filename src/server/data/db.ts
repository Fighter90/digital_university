// DIG-12 — the app instance of the data port.
//
// NOTE(DIG-12): until the Prisma schema branch (DIG-10) is merged, the
// prototype runs on the in-memory adapter seeded with fictional demo data
// (see demo-seed.ts) — the same approach DIG-11 uses for the auth store.
// Switching to PostgreSQL is a one-line change:
//
//   import { PrismaPg } from '@prisma/adapter-pg';
//   import { PrismaClient } from '@/generated/prisma';
//   export const dataDb = createPrismaDataDb(
//     new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? '' }) }),
//   );
//
// This module is the ONLY file outside prisma-adapter code allowed to import
// the Prisma client (enforced by eslint no-restricted-imports, see
// tests/eslint-isolation-rule.test.ts). Pages and components import data
// functions from '@/server/data/*' — never the db directly.

import { createMemoryDataDb } from './memory-db';

// DIG-12: same globalThis rationale as the auth store singleton — in dev,
// pages and API routes are separate server bundles, and a bare module
// singleton would give the route handler a DIFFERENT (empty) dataset.
const globals = globalThis as unknown as { __dataDb?: ReturnType<typeof createMemoryDataDb> };

export const dataDb = (globals.__dataDb ??= createMemoryDataDb());
