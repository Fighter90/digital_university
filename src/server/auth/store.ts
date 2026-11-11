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

export const authStore: AuthStore = createMemoryAuthStore();
export const ipRateLimiter: IpRateLimiter = createMemoryIpRateLimiter();

/** Sign-in through the app-wide store (production wiring of the pure flow). */
export function signInWithDefaults(input: Omit<SignInInput, 'now'>): Promise<SignInResult> {
  return signIn({ store: authStore, rateLimiter: ipRateLimiter }, input);
}
