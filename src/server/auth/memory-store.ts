// DIG-11 — in-memory AuthStore + per-IP rate limiter.
// Used by unit tests and, until the Prisma schema branch (DIG-9) is merged,
// as the app's active store (see src/server/auth/store.ts).
import {
  IP_RATE_MAX_ATTEMPTS,
  IP_RATE_WINDOW_MS,
  LOCK_DURATION_MS,
  MAX_FAILED_LOGINS,
  type AuthSessionRow,
  type AuthStore,
  type AuthUserRow,
  type IpRateLimiter,
  type Role,
} from './types';

export interface MemoryAuthStore extends AuthStore {
  /** Test/setup helper: insert a user with an already-hashed password. */
  seedUser(input: {
    id: string;
    login: string;
    passwordHash: string;
    role: Role;
    failedLogins?: number;
    lockedUntil?: Date | null;
  }): AuthUserRow;
  listUsers(): AuthUserRow[];
  listSessions(): AuthSessionRow[];
}

export function createMemoryAuthStore(): MemoryAuthStore {
  const users = new Map<string, AuthUserRow>();
  const sessions = new Map<string, AuthSessionRow>();
  let sessionSeq = 0;

  return {
    seedUser(input) {
      const row: AuthUserRow = {
        failedLogins: 0,
        lockedUntil: null,
        ...input,
      };
      users.set(row.id, row);
      return { ...row };
    },

    listUsers() {
      return [...users.values()].map((u) => ({ ...u }));
    },

    listSessions() {
      return [...sessions.values()].map((s) => ({ ...s }));
    },

    async findUserByLogin(login) {
      const row = [...users.values()].find((u) => u.login === login);
      return row ? { ...row } : null;
    },

    async recordFailedLogin(userId, now) {
      const row = users.get(userId);
      if (!row) return { failedLogins: 0, lockedUntil: null };
      // A failure after an expired lock starts a fresh counting cycle.
      const effective = row.lockedUntil && row.lockedUntil <= now ? 0 : row.failedLogins;
      const failedLogins = effective + 1;
      const lockedUntil =
        failedLogins >= MAX_FAILED_LOGINS ? new Date(now.getTime() + LOCK_DURATION_MS) : null;
      row.failedLogins = failedLogins;
      row.lockedUntil = lockedUntil;
      return { failedLogins, lockedUntil };
    },

    async resetLoginFailures(userId) {
      const row = users.get(userId);
      if (!row) return;
      row.failedLogins = 0;
      row.lockedUntil = null;
    },

    async createSession(data) {
      sessionSeq += 1;
      const row: AuthSessionRow = {
        id: `s_${sessionSeq}`,
        userId: data.userId,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
        ip: data.ip ?? null,
        userAgent: data.userAgent ?? null,
        createdAt: data.createdAt ?? new Date(),
      };
      sessions.set(row.tokenHash, row);
      return { ...row };
    },

    async findSessionByTokenHash(tokenHash, now) {
      const session = sessions.get(tokenHash);
      if (!session) return null;
      if (session.expiresAt <= now) {
        sessions.delete(tokenHash); // lazy cleanup of expired rows
        return null;
      }
      const user = users.get(session.userId);
      if (!user) return null;
      return { session: { ...session }, user: { ...user } };
    },

    async touchSession(id, expiresAt) {
      const row = [...sessions.values()].find((s) => s.id === id);
      if (row) row.expiresAt = expiresAt;
    },

    async deleteSession(tokenHash) {
      return sessions.delete(tokenHash) ? 1 : 0;
    },

    async deleteAllUserSessions(userId) {
      let count = 0;
      for (const [hash, row] of sessions) {
        if (row.userId === userId) {
          sessions.delete(hash);
          count += 1;
        }
      }
      return count;
    },

    async listUserSessions(userId, now) {
      return [...sessions.values()]
        .filter((s) => s.userId === userId && s.expiresAt > now)
        .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
        .map((s) => ({ ...s }));
    },

    // ── DIG-44 — смена пароля и завершение сеанса ────────────────────────────

    async setPasswordHash(userId, passwordHash) {
      const row = users.get(userId);
      if (!row) return; // unknown user — silent no-op (не существующий id)
      row.passwordHash = passwordHash;
    },

    async deleteSessionById(userId, sessionId) {
      // Владение внутри адаптера: чужая сессия по id недостижима.
      const row = [...sessions.values()].find((s) => s.id === sessionId && s.userId === userId);
      if (!row) return 0;
      return sessions.delete(row.tokenHash) ? 1 : 0;
    },
  };
}

export function createMemoryIpRateLimiter(options?: {
  windowMs?: number;
  maxAttempts?: number;
  now?: () => Date;
}): IpRateLimiter {
  const windowMs = options?.windowMs ?? IP_RATE_WINDOW_MS;
  const maxAttempts = options?.maxAttempts ?? IP_RATE_MAX_ATTEMPTS;
  const hits = new Map<string, number[]>();

  return {
    hit(key, now) {
      const floor = now.getTime() - windowMs;
      const recent = (hits.get(key) ?? []).filter((t) => t > floor);
      recent.push(now.getTime());
      hits.set(key, recent);
      if (recent.length > maxAttempts) {
        // The window frees up when the oldest recorded attempt ages out.
        return { limited: true, retryAfterMs: recent[0] + windowMs - now.getTime() };
      }
      return { limited: false, retryAfterMs: 0 };
    },
  };
}
