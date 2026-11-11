// DIG-11 — PostgreSQL adapter of the auth layer, mapped 1:1 to the DIG-9 schema
// (`User.login` unique, `Session.tokenHash` unique, `User.failedLogins/lockedUntil`).
//
// The client is taken as a minimal structural interface instead of importing the
// generated Prisma client directly: this branch compiles before the schema
// branch is merged, and unit tests can drive the adapter with a fake client.
// Neither plaintext passwords nor raw session tokens ever reach this adapter's
// writes — enforced by tests/auth-store.test.ts.
import {
  LOCK_DURATION_MS,
  MAX_FAILED_LOGINS,
  type AuthSessionRow,
  type AuthStore,
  type AuthUserRow,
} from './types';

export interface PrismaAuthClient {
  user: {
    findUnique(args: { where: { login: string } | { id: string } }): Promise<AuthUserRow | null>;
    update(args: {
      where: { id: string };
      data: { failedLogins?: number; lockedUntil?: Date | null; passwordHash?: string };
    }): Promise<AuthUserRow>;
  };
  session: {
    create(args: {
      data: {
        userId: string;
        tokenHash: string;
        expiresAt: Date;
        ip?: string | null;
        userAgent?: string | null;
        createdAt?: Date | null;
      };
    }): Promise<AuthSessionRow>;
    /**
     * DIG-50: the session row MUST come with its owner (`include: { user }`) —
     * the real generated client returns relations only when asked, unlike the
     * in-test fake. A session without its user must never leave this layer.
     */
    findUnique(args: {
      where: { tokenHash: string };
      include?: { user: true };
    }): Promise<(AuthSessionRow & { user: AuthUserRow | null }) | null>;
    update(args: { where: { id: string }; data: { expiresAt: Date } }): Promise<AuthSessionRow>;
    deleteMany(args: {
      where: { tokenHash?: string; userId?: string };
    }): Promise<{ count: number }>;
    /** DIG-19: own-session listing for the «Активные сессии» screen. */
    findMany(args: { where: { userId: string } }): Promise<AuthSessionRow[]>;
  };
}

export function createPrismaAuthStore(client: PrismaAuthClient): AuthStore {
  return {
    async findUserByLogin(login) {
      return client.user.findUnique({ where: { login } });
    },

    async recordFailedLogin(userId, now) {
      const user = await client.user.findUnique({ where: { id: userId } });
      if (!user) return { failedLogins: 0, lockedUntil: null };
      // A failure after an expired lock starts a fresh counting cycle.
      const effective = user.lockedUntil && user.lockedUntil <= now ? 0 : user.failedLogins;
      const failedLogins = effective + 1;
      const lockedUntil =
        failedLogins >= MAX_FAILED_LOGINS ? new Date(now.getTime() + LOCK_DURATION_MS) : null;
      const updated = await client.user.update({
        where: { id: userId },
        data: { failedLogins, lockedUntil },
      });
      return { failedLogins: updated.failedLogins, lockedUntil: updated.lockedUntil };
    },

    async resetLoginFailures(userId) {
      await client.user.update({
        where: { id: userId },
        data: { failedLogins: 0, lockedUntil: null },
      });
    },

    async createSession(data) {
      return client.session.create({
        data: {
          userId: data.userId,
          tokenHash: data.tokenHash,
          expiresAt: data.expiresAt,
          ip: data.ip ?? null,
          userAgent: data.userAgent ?? null,
          createdAt: data.createdAt ?? new Date(),
        },
      });
    },

    async findSessionByTokenHash(tokenHash, now) {
      // DIG-50: `include: { user: true }` обязателен — реальный клиент Prisma
      // не отдаёт связь, пока её не запросишь (фейк в тестах всегда вкладывал
      // user, поэтому расхождение всплыло только на живой БД: сессии
      // создаются, но requireUser() их не находит → редирект на /login).
      const row = await client.session.findUnique({
        where: { tokenHash },
        include: { user: true },
      });
      if (!row || !row.user) return null;
      if (row.expiresAt <= now) {
        await client.session.deleteMany({ where: { tokenHash } });
        return null;
      }
      const { user, ...session } = row;
      return { session, user };
    },

    async touchSession(id, expiresAt) {
      await client.session.update({ where: { id }, data: { expiresAt } });
    },

    async deleteSession(tokenHash) {
      const { count } = await client.session.deleteMany({ where: { tokenHash } });
      return count;
    },

    async deleteAllUserSessions(userId) {
      const { count } = await client.session.deleteMany({ where: { userId } });
      return count;
    },

    async listUserSessions(userId, now) {
      const rows = await client.session.findMany({ where: { userId } });
      return rows
        .filter((row) => row.expiresAt > now)
        .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
    },
  };
}
