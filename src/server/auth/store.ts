// DIG-11 — the auth store instance used by the running app.
// DIG-50 — выбор хранилища по окружению: при заданном DATABASE_URL приложение
// обязано работать на prisma-store (PostgreSQL, generated client из
// src/generated/prisma). Раньше падение/отсутствие клиента молча откатывало
// прод на memory-store — вход на ostrovok.store был невозможен. Теперь
// отката нет: выбор строго по env; без DATABASE_URL разрешён memory-store,
// но только с явным WARN-логом при старте (и /api/health публикует вид,
// чтобы security мог проверить: на проде memory не активен).
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma';
import { createMemoryAuthStore, createMemoryIpRateLimiter } from './memory-store';
import { createPrismaAuthStore, type PrismaAuthClient } from './prisma-store';
import { signIn, type SignInInput, type SignInResult } from './login';
import type { AuthStore, IpRateLimiter } from './types';

/** Which persistence backend the app is running on. */
export type AuthStoreKind = 'prisma' | 'memory';

export interface AuthStoreSelection {
  kind: AuthStoreKind;
  /** Set for memory only — the WARN the module logs at startup. */
  warning?: string;
}

/**
 * Pure, unit-tested selection rule (DIG-50): DATABASE_URL present → prisma,
 * otherwise memory with an explicit warning. There is deliberately NO
 * try/catch fallback here: if PostgreSQL is unreachable the error surfaces
 * at the failing request instead of silently degrading to in-memory.
 */
export function selectAuthStoreKind(databaseUrl: string | undefined | null): AuthStoreSelection {
  const url = databaseUrl?.trim();
  if (url) return { kind: 'prisma' };
  return {
    kind: 'memory',
    warning:
      '[auth] DATABASE_URL не задан — auth store работает в памяти (memory-store): ' +
      'пользователи и сессии исчезнут при перезапуске сервера. ' +
      'Задайте DATABASE_URL для PostgreSQL.',
  };
}

export interface AppAuthStore {
  selection: AuthStoreSelection;
  store: AuthStore;
  rateLimiter: IpRateLimiter;
}

/** Builds the app-wide auth store from the environment (prisma | memory+WARN). */
export function createAppAuthStore(databaseUrl: string | undefined | null): AppAuthStore {
  const selection = selectAuthStoreKind(databaseUrl);
  if (selection.kind === 'prisma') {
    const client = new PrismaClient({
      adapter: new PrismaPg({ connectionString: databaseUrl as string }),
    });
    // Единственная точка встречи сгенерированного клиента и структурного
    // порта PrismaAuthClient (порт существует ради фейков в тестах):
    // адаптер использует узкое подмножество API, а контракт покрывают
    // tests/auth-store.test.ts и миграция DIG-9. Приводит и расхождение
    // nullable-полей (createdAt) генератора с портом.
    const wired = client as unknown as PrismaAuthClient;
    return {
      selection,
      store: createPrismaAuthStore(wired),
      rateLimiter: createMemoryIpRateLimiter(),
    };
  }
  // DIG-50: memory is allowed only outside production deployments — and it
  // must never be silent (this WARN is what was missing on ostrovok.store).
  console.warn(selection.warning);
  return { selection, store: createMemoryAuthStore(), rateLimiter: createMemoryIpRateLimiter() };
}

// Same globalThis rationale as the data-layer singleton: in dev, pages and
// API routes are separate server bundles — one client per process, not per bundle.
const globals = globalThis as unknown as { __appAuthStore?: AppAuthStore };

const appAuthStore = (globals.__appAuthStore ??= createAppAuthStore(process.env.DATABASE_URL));

export const authStore: AuthStore = appAuthStore.store;
export const ipRateLimiter: IpRateLimiter = appAuthStore.rateLimiter;
/** Active backend kind — surfaced by /api/health (DIG-50 security check). */
export const authStoreKind: AuthStoreKind = appAuthStore.selection.kind;

/** Sign-in through the app-wide store (production wiring of the pure flow). */
export function signInWithDefaults(input: Omit<SignInInput, 'now'>): Promise<SignInResult> {
  return signIn({ store: authStore, rateLimiter: ipRateLimiter }, input);
}
