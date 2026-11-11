// DIG-11 — the auth store instance used by the running app.
//
// NOTE(DIG-11): the PostgreSQL schema (User/Session — DIG-9) and the seed data
// (DIG-10) live on their own branches and are not merged into this one yet, so
// the prototype runs on the in-memory store: sessions survive page navigations
// but not a server restart. Switching to PostgreSQL is a one-line change:
//
//   import { PrismaPg } from '@prisma/adapter-pg';
//   import { PrismaClient } from '@/generated/prisma';
//   export const authStore = createPrismaAuthStore(
//     new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? '' }) }),
//   );
//
// (the Prisma adapter is already implemented and tested — prisma-store.ts).
import { createMemoryAuthStore, createMemoryIpRateLimiter } from './memory-store';
import { signIn, type SignInInput, type SignInResult } from './login';
import type { AuthStore, IpRateLimiter } from './types';

// DIG-12: the singleton must survive separate dev-mode server bundles (pages
// vs route handlers) — Next.js/Turbopack instantiates module graphs per entry,
// so a bare module singleton is NOT shared (session resolved on a page but
// invisible in an API route; caught by e2e/data-isolation.spec.ts). The
// globalThis cache is the standard Next.js fix (same reason PrismaClient
// recommends it). In production (single standalone bundle) the cache is
// harmless — one process, one realm.
const globals = globalThis as unknown as {
  __authStore?: AuthStore;
  __ipRateLimiter?: IpRateLimiter;
};

export const authStore: AuthStore = (globals.__authStore ??= createMemoryAuthStore());
export const ipRateLimiter: IpRateLimiter = (globals.__ipRateLimiter ??=
  createMemoryIpRateLimiter());

/** Sign-in through the app-wide store (production wiring of the pure flow). */
export function signInWithDefaults(input: Omit<SignInInput, 'now'>): Promise<SignInResult> {
  return signIn({ store: authStore, rateLimiter: ipRateLimiter }, input);
}
