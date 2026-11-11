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
      };
    }): Promise<AuthSessionRow>;
    findUnique(args: {
      where: { tokenHash: string };
    }): Promise<(AuthSessionRow & { user: AuthUserRow | null }) | null>;
    update(args: { where: { id: string }; data: { expiresAt: Date } }): Promise<AuthSessionRow>;
    deleteMany(args: {
      where: { tokenHash?: string; userId?: string };
    }): Promise<{ count: number }>;
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
        },
      });
    },

    async findSessionByTokenHash(tokenHash, now) {
      const row = await client.session.findUnique({ where: { tokenHash } });
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
  };
}
