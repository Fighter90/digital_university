// DIG-11 — the sign-in flow: per-IP rate limit → account lock check →
// argon2id verification → session creation.
//
// Security properties (each pinned by tests/auth-core.test.ts):
// - one uniform error for "unknown login" and "wrong password";
// - 5 consecutive failures lock the account for 15 minutes (even for the
//   correct password); the counter resets on success and after the lock;
// - a sliding-window limiter caps attempts per IP;
// - an unknown login still costs one argon2id verification (timing parity);
// - nothing about the password or the raw token is ever logged.
import { hashPassword, verifyPassword } from './password';
import { generateSessionToken, hashToken } from './tokens';
import {
  IP_RATE_MAX_ATTEMPTS,
  IP_RATE_WINDOW_MS,
  LOCK_DURATION_MS,
  MAX_FAILED_LOGINS,
  SESSION_TTL_MS,
  type AuthStore,
  type AuthUser,
  type IpRateLimiter,
} from './types';

export {
  IP_RATE_MAX_ATTEMPTS,
  IP_RATE_WINDOW_MS,
  LOCK_DURATION_MS,
  MAX_FAILED_LOGINS,
  SESSION_TTL_MS,
};

/** The SAME message for a wrong login and a wrong password (no oracle). */
export const ERROR_MESSAGES = {
  INVALID_CREDENTIALS: 'Неверный логин или пароль.',
  ACCOUNT_LOCKED: 'Слишком много попыток, попробуйте через 15 минут.',
  RATE_LIMITED: 'Слишком много попыток входа. Попробуйте позже.',
} as const;

export type AuthErrorCode = keyof typeof ERROR_MESSAGES;

export type SignInResult =
  | { ok: true; token: string; user: AuthUser }
  | {
      ok: false;
      code: AuthErrorCode;
      message: string;
      retryAfterMinutes?: number;
    };

export interface SignInInput {
  login: string;
  password: string;
  ip?: string | null;
  userAgent?: string | null;
  now?: Date;
}

export interface SignInDeps {
  store: AuthStore;
  rateLimiter: IpRateLimiter;
}

const minutes = (ms: number) => Math.max(1, Math.ceil(ms / (60 * 1000)));

/**
 * A real argon2id hash of an unrelated throwaway password. When the login is
 * unknown we still verify against it so both branches take the same time.
 */
let dummyHashPromise: Promise<string> | null = null;
function dummyHash(): Promise<string> {
  dummyHashPromise ??= hashPassword(`timing-equalizer:${Math.random()}`);
  return dummyHashPromise;
}

export async function signIn(
  { store, rateLimiter }: SignInDeps,
  input: SignInInput,
): Promise<SignInResult> {
  const now = input.now ?? new Date();
  const login = input.login.trim();
  const ipKey = input.ip || 'unknown';

  // 1) Per-IP sliding window — counted BEFORE verification (brute force guard).
  const limited = rateLimiter.hit(ipKey, now);
  if (limited.limited) {
    return {
      ok: false,
      code: 'RATE_LIMITED',
      message: ERROR_MESSAGES.RATE_LIMITED,
      retryAfterMinutes: minutes(limited.retryAfterMs),
    };
  }

  // 2) The user must not be under an active lock.
  const user = await store.findUserByLogin(login);
  if (user?.lockedUntil && user.lockedUntil > now) {
    return {
      ok: false,
      code: 'ACCOUNT_LOCKED',
      message: ERROR_MESSAGES.ACCOUNT_LOCKED,
      retryAfterMinutes: minutes(user.lockedUntil.getTime() - now.getTime()),
    };
  }

  // 3) Constant-ish cost verification for both known and unknown logins.
  const passwordOk = user
    ? await verifyPassword(user.passwordHash, input.password)
    : await verifyPassword(await dummyHash(), input.password);

  if (!user || !passwordOk) {
    if (user) await store.recordFailedLogin(user.id, now);
    return {
      ok: false,
      code: 'INVALID_CREDENTIALS',
      message: ERROR_MESSAGES.INVALID_CREDENTIALS,
    };
  }

  // 4) Success: reset the counter, mint the token, store ONLY its hash.
  await store.resetLoginFailures(user.id);
  const token = generateSessionToken();
  await store.createSession({
    userId: user.id,
    tokenHash: hashToken(token),
    expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
    ip: input.ip ?? null,
    userAgent: input.userAgent ?? null,
  });

  return {
    ok: true,
    token,
    user: { id: user.id, login: user.login, role: user.role },
  };
}
