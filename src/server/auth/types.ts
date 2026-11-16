// DIG-11 — shared auth types and constants.
// No secrets and no plaintext material lives here: this module only describes
// the shapes exchanged between the login flow, the stores and the session layer.

export type Role = 'STUDENT' | 'STAFF';

/** Row of the `User` table (DIG-9 schema): the password is only an argon2id hash. */
export interface AuthUserRow {
  id: string;
  login: string;
  passwordHash: string;
  role: Role;
  failedLogins: number;
  lockedUntil: Date | null;
}

/** Row of the `Session` table (DIG-9 schema): only the SHA-256 of the cookie token. */
export interface AuthSessionRow {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  ip: string | null;
  userAgent: string | null;
  /** DIG-19: when the device signed in — shown in «Активные сессии». */
  createdAt?: Date | null;
}

/** Safe projection of a user — safe to return to the UI layer. */
export interface AuthUser {
  id: string;
  login: string;
  role: Role;
}

// ── OWASP / product constants ────────────────────────────────────────────────

/** OWASP Password Storage cheat-sheet minimum for argon2id (19 MiB, 2, 1). */
export const ARGON2_PARAMS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

/** Session lifetime: 7 days, renewed while the user keeps working (sliding). */
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** 5 failed sign-ins in a row lock the account… */
export const MAX_FAILED_LOGINS = 5;
/** …for 15 minutes. */
export const LOCK_DURATION_MS = 15 * 60 * 1000;

/** Per-IP brute-force guard: sliding window. */
export const IP_RATE_WINDOW_MS = 15 * 60 * 1000;
export const IP_RATE_MAX_ATTEMPTS = 30;

// ── Store ports ──────────────────────────────────────────────────────────────

/**
 * Persistence port of the auth layer. Two adapters implement it:
 * `createPrismaAuthStore` (PostgreSQL, production) and
 * `createMemoryAuthStore` (tests / until the DB migration lands).
 * Every adapter MUST persist only hashes — see tests/auth-store.test.ts.
 */
export interface AuthStore {
  findUserByLogin(login: string): Promise<AuthUserRow | null>;
  /** Bumps the failure counter and (from 5 on) sets `lockedUntil = now + 15 min`. */
  recordFailedLogin(
    userId: string,
    now: Date,
  ): Promise<Pick<AuthUserRow, 'failedLogins' | 'lockedUntil'>>;
  resetLoginFailures(userId: string): Promise<void>;
  createSession(data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    ip?: string | null;
    userAgent?: string | null;
    /** DIG-19: sign-in time for the «Активные сессии» screen (defaults to now). */
    createdAt?: Date | null;
  }): Promise<AuthSessionRow>;
  /** Returns the session+user only when the token hash matches and `expiresAt > now`. */
  findSessionByTokenHash(
    tokenHash: string,
    now: Date,
  ): Promise<{ session: AuthSessionRow; user: AuthUserRow } | null>;
  /** Sliding renewal of a live session. */
  touchSession(id: string, expiresAt: Date): Promise<void>;
  /** Logout of the current device. */
  deleteSession(tokenHash: string, now?: Date): Promise<number>;
  /** «Выйти со всех устройств». */
  deleteAllUserSessions(userId: string, now?: Date): Promise<number>;
  /**
   * DIG-19: live (non-expired) sessions of ONE user, newest first — the
   * «Активные сессии» screen. Read-only; contains only token hashes.
   */
  listUserSessions(userId: string, now: Date): Promise<AuthSessionRow[]>;
  /**
   * DIG-44 — смена пароля: записывает НОВЫЙ argon2id-хэш пользователя.
   * Плaintext сюда не попадает никогда — только готовый хэш.
   */
  setPasswordHash(userId: string, passwordHash: string): Promise<void>;
  /**
   * DIG-44 — «Завершить» на экране активных сеансов: удаляет сессию
   * ТОЛЬКО когда она принадлежит данному пользователю (владение проверяется
   * внутри адаптера — подделанный sessionId чужой сессии ничего не удалит).
   * Возвращает 1, если сессия удалена, иначе 0.
   */
  deleteSessionById(userId: string, sessionId: string): Promise<number>;
}

/** Sliding-window rate limiter keyed by IP. */
export interface IpRateLimiter {
  hit(key: string, now: Date): { limited: boolean; retryAfterMs: number };
}
