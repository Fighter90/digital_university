// DIG-11 — Prisma adapter contract (matches DIG-9 schema: User.login unique,
// Session.tokenHash unique, User.failedLogins/lockedUntil).
// Acceptance: neither plaintext passwords nor plaintext session tokens
// ever reach the persistence layer — only the argon2id hash and SHA-256.
import { describe, expect, it } from 'vitest';
import { createPrismaAuthStore, type PrismaAuthClient } from '@/server/auth/prisma-store';
import { createMemoryIpRateLimiter } from '@/server/auth/memory-store';
import { hashPassword, verifyPassword } from '@/server/auth/password';
import { hashToken } from '@/server/auth/tokens';
import { signIn } from '@/server/auth/login';

const BASE = new Date('2026-11-11T10:00:00.000Z');

type UserRow = {
  id: string;
  login: string;
  passwordHash: string;
  role: 'STUDENT' | 'STAFF';
  failedLogins: number;
  lockedUntil: Date | null;
};
type SessionRow = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  ip: string | null;
  userAgent: string | null;
};

function fakePrisma(users: UserRow[]) {
  const sessions: SessionRow[] = [];
  const calls = { userUpdate: [] as unknown[], sessionCreate: [] as unknown[] };
  let seq = 0;
  const client: PrismaAuthClient = {
    user: {
      async findUnique(args) {
        const where = args.where;
        if ('login' in where) return users.find((u) => u.login === where.login) ?? null;
        return users.find((u) => u.id === where.id) ?? null;
      },
      async update(args) {
        calls.userUpdate.push(args);
        const user = users.find((u) => u.id === args.where.id);
        if (!user) throw new Error('user not found');
        const { failedLogins, lockedUntil, passwordHash } = args.data;
        if (failedLogins !== undefined) user.failedLogins = failedLogins;
        if (lockedUntil !== undefined) user.lockedUntil = lockedUntil;
        if (passwordHash !== undefined) user.passwordHash = passwordHash;
        return user;
      },
    },
    session: {
      async create(args) {
        calls.sessionCreate.push(args);
        const row: SessionRow = {
          id: `s_${(seq += 1)}`,
          userId: args.data.userId,
          tokenHash: args.data.tokenHash,
          expiresAt: args.data.expiresAt,
          ip: args.data.ip ?? null,
          userAgent: args.data.userAgent ?? null,
        };
        sessions.push(row);
        return row;
      },
      async findUnique(args) {
        const row = sessions.find((s) => s.tokenHash === args.where.tokenHash);
        if (!row) return null;
        return { ...row, user: users.find((u) => u.id === row.userId) ?? null };
      },
      async update(args) {
        const row = sessions.find((s) => s.id === args.where.id);
        if (!row) throw new Error('session not found');
        row.expiresAt = args.data.expiresAt;
        return row;
      },
      async deleteMany(args) {
        const where = args.where;
        const match = (s: SessionRow) =>
          (!where.tokenHash || s.tokenHash === where.tokenHash) &&
          (!where.userId || s.userId === where.userId);
        const before = sessions.length;
        for (let i = sessions.length - 1; i >= 0; i -= 1) {
          if (match(sessions[i])) sessions.splice(i, 1);
        }
        return { count: before - sessions.length };
      },
    },
  };
  return { client, sessions, calls };
}

describe('prisma auth store (DIG-9 schema mapping)', () => {
  it('stores the argon2id hash and sha-256 token hash — never plaintext', async () => {
    const password = 'correct-horse-battery';
    const { client, sessions, calls } = fakePrisma([
      {
        id: 'u1',
        login: 'anna',
        passwordHash: await hashPassword(password),
        role: 'STUDENT',
        failedLogins: 0,
        lockedUntil: null,
      },
    ]);
    const store = createPrismaAuthStore(client);

    const result = await signIn(
      { store, rateLimiter: createMemoryIpRateLimiter() },
      { login: 'anna', password, ip: '10.1.1.1', userAgent: 'vitest', now: BASE },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Session row: only the hash of the token, token itself nowhere.
    expect(sessions).toHaveLength(1);
    expect(sessions[0].tokenHash).toBe(hashToken(result.token));
    const dumped = JSON.stringify({ sessions, calls });
    expect(dumped).not.toContain(result.token);
    // Never a column like `token:` with the raw value.
    expect(calls.sessionCreate[0]).not.toHaveProperty('data.token');

    // User row keeps the argon2id hash; the plaintext password is not stored anywhere.
    const stored = await client.user.findUnique({ where: { login: 'anna' } });
    expect(stored?.passwordHash.startsWith('$argon2id$')).toBe(true);
    expect(JSON.stringify(stored)).not.toContain(password);
    expect(await verifyPassword(stored!.passwordHash, password)).toBe(true);
  });

  it('locks the account via failedLogins/lockedUntil columns after 5 failures', async () => {
    const { client } = fakePrisma([
      {
        id: 'u1',
        login: 'anna',
        passwordHash: await hashPassword('pw'),
        role: 'STUDENT',
        failedLogins: 0,
        lockedUntil: null,
      },
    ]);
    const store = createPrismaAuthClient_store(client);
    const limiter = createMemoryIpRateLimiter();

    for (let i = 0; i < 5; i += 1) {
      await signIn(
        { store, rateLimiter: limiter },
        { login: 'anna', password: 'wrong', ip: '10.1.1.2', userAgent: null, now: BASE },
      );
    }
    const user = await client.user.findUnique({ where: { login: 'anna' } });
    expect(user?.failedLogins).toBe(5);
    expect(user?.lockedUntil?.getTime()).toBe(BASE.getTime() + 15 * 60_000);

    // Correct password while locked is rejected by the adapter-backed store too.
    const locked = await signIn(
      { store, rateLimiter: limiter },
      { login: 'anna', password: 'pw', ip: '10.1.1.2', userAgent: null, now: BASE },
    );
    expect(locked.ok).toBe(false);
    if (!locked.ok) expect(locked.code).toBe('ACCOUNT_LOCKED');
  });

  it('expires sessions by expiresAt and renews via touchSession', async () => {
    const { client, sessions } = fakePrisma([
      {
        id: 'u1',
        login: 'anna',
        passwordHash: await hashPassword('pw'),
        role: 'STAFF',
        failedLogins: 0,
        lockedUntil: null,
      },
    ]);
    const store = createPrismaAuthClient_store(client);
    const result = await signIn(
      { store, rateLimiter: createMemoryIpRateLimiter() },
      { login: 'anna', password: 'pw', ip: null, userAgent: null, now: BASE },
    );
    if (!result.ok) throw new Error('setup login failed');

    const future = new Date(BASE.getTime() + 6 * 24 * 3600_000);
    const live = await store.findSessionByTokenHash(hashToken(result.token), future);
    expect(live?.user.role).toBe('STAFF');

    await store.touchSession(live!.session.id, new Date(future.getTime() + 7 * 24 * 3600_000));
    expect(sessions[0].expiresAt.getTime()).toBe(future.getTime() + 7 * 24 * 3600_000);

    const expired = await store.findSessionByTokenHash(
      hashToken(result.token),
      new Date(future.getTime() + 8 * 24 * 3600_000),
    );
    expect(expired).toBeNull();
  });
});

function createPrismaAuthClient_store(client: PrismaAuthClient) {
  return createPrismaAuthStore(client);
}
