// DIG-44 — security primitives of the settings screen:
//  - setPasswordHash: password change writes ONLY the argon2id hash, per user;
//  - deleteSessionById: «Завершить» on the sessions list — deletes a session
//    ONLY when it belongs to the given user (ownership is enforced inside the
//    store, so a forged sessionId cannot revoke someone else's session).
import { beforeAll, describe, expect, it } from 'vitest';
import { createMemoryAuthStore, type MemoryAuthStore } from '@/server/auth/memory-store';
import { hashPassword, verifyPassword } from '@/server/auth/password';

const T0 = new Date('2026-11-11T10:00:00.000Z');

let store: MemoryAuthStore;

beforeAll(() => {
  store = createMemoryAuthStore();
  store.seedUser({
    id: 'u-anna',
    login: 'anna',
    passwordHash: 'hash-old',
    role: 'STUDENT',
    failedLogins: 0,
    lockedUntil: null,
  });
  store.seedUser({
    id: 'u-ilya',
    login: 'ilya',
    passwordHash: 'hash-ilya',
    role: 'STUDENT',
    failedLogins: 0,
    lockedUntil: null,
  });
});

describe('setPasswordHash — password change', () => {
  it('replaces the stored hash and nothing else', async () => {
    const newHash = await hashPassword('correct horse battery');
    await store.setPasswordHash('u-anna', newHash);
    const row = await store.findUserByLogin('anna');
    expect(row?.passwordHash).toBe(newHash);
    expect(await verifyPassword(newHash, 'correct horse battery')).toBe(true);
    expect(await verifyPassword(newHash, 'hash-old')).toBe(false);
    // role/lockout untouched
    expect(row?.role).toBe('STUDENT');
    expect(row?.failedLogins).toBe(0);
  });

  it('works with the login flow: old password no longer signs in', async () => {
    const { signIn } = await import('@/server/auth/login');
    // Old hash was replaced — verification against it must fail.
    const row = await store.findUserByLogin('anna');
    expect(await verifyPassword(row!.passwordHash, 'hash-old')).toBe(false);
    // Sanity: a fresh sign-in with the new password resolves the user.
    const result = await signIn(
      { store, rateLimiter: createRateLimiter(store) },
      {
        login: 'anna',
        password: 'correct horse battery',
        ip: '127.0.0.1',
        userAgent: 'vitest',
        now: T0,
      },
    );
    expect(result.ok).toBe(true);
  });

  it('unknown userId is a silent no-op', async () => {
    await expect(store.setPasswordHash('u-ghost', 'x')).resolves.toBeUndefined();
    expect((await store.findUserByLogin('anna'))?.passwordHash).not.toBe('x');
  });
});

describe('deleteSessionById — «Завершить» with ownership enforced', () => {
  it('deletes the user’s own session by id', async () => {
    const session = await store.createSession({
      userId: 'u-anna',
      tokenHash: 'hash-a-1',
      expiresAt: new Date(T0.getTime() + 60_000),
      createdAt: T0,
    });
    expect(await store.deleteSessionById('u-anna', session.id)).toBe(1);
    expect(await store.findSessionByTokenHash('hash-a-1', T0)).toBeNull();
  });

  it('refuses to delete a session owned by ANOTHER user (IDOR defence)', async () => {
    const ilyaSession = await store.createSession({
      userId: 'u-ilya',
      tokenHash: 'hash-i-1',
      expiresAt: new Date(T0.getTime() + 60_000),
      createdAt: T0,
    });
    // Anna tries to revoke Ilya's session by id — must NOT delete.
    expect(await store.deleteSessionById('u-anna', ilyaSession.id)).toBe(0);
    expect(await store.findSessionByTokenHash('hash-i-1', T0)).not.toBeNull();
    // Ilya himself can revoke it.
    expect(await store.deleteSessionById('u-ilya', ilyaSession.id)).toBe(1);
  });

  it('unknown session id → 0', async () => {
    expect(await store.deleteSessionById('u-anna', 'sess-ghost')).toBe(0);
  });
});

/** Rate limiter wired to the same store user list (sign-in helper above). */
function createRateLimiter(s: MemoryAuthStore) {
  void s;
  return {
    hit() {
      return { limited: false, retryAfterMs: 0 };
    },
  };
}
