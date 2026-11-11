// DIG-11 — auth core contract: passwords (argon2id), session tokens,
// sign-in flow (uniform error, lockout after 5 failures, per-IP rate limit),
// sessions (expiry, sliding renewal, logout, logout-all) and cookie shape.
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { ARGON2_PARAMS, hashPassword, verifyPassword } from '@/server/auth/password';
import { generateSessionToken, hashToken } from '@/server/auth/tokens';
import { createMemoryAuthStore, createMemoryIpRateLimiter } from '@/server/auth/memory-store';
import { resolveSession } from '@/server/auth/session-policy';
import {
  ERROR_MESSAGES,
  MAX_FAILED_LOGINS,
  LOCK_DURATION_MS,
  SESSION_TTL_MS,
  IP_RATE_MAX_ATTEMPTS,
  IP_RATE_WINDOW_MS,
  signIn,
} from '@/server/auth/login';
import { buildClearedSessionCookie, buildSessionCookie } from '@/server/auth/cookies';

const BASE = new Date('2026-11-11T10:00:00.000Z');
const at = (ms: number) => new Date(BASE.getTime() + ms);
const MIN = 60_000;

function setup() {
  const store = createMemoryAuthStore();
  const limiter = createMemoryIpRateLimiter();
  return { store, limiter };
}

async function seedUser(
  store: ReturnType<typeof createMemoryAuthStore>,
  overrides: Partial<{ login: string; password: string; role: 'STUDENT' | 'STAFF' }> = {},
) {
  const login = overrides.login ?? 'anna';
  const password = overrides.password ?? 'correct-horse';
  const row = store.seedUser({
    id: `u_${login}`,
    login,
    passwordHash: await hashPassword(password),
    role: overrides.role ?? 'STUDENT',
  });
  return { row, login, password };
}

const attempt = (
  input: Partial<{ login: string; password: string; ip: string; now: Date }> = {},
) => ({
  login: input.login ?? 'anna',
  password: input.password ?? 'correct-horse',
  ip: input.ip ?? '10.0.0.1',
  userAgent: 'vitest',
  now: input.now ?? BASE,
});

describe('password hashing (argon2id, OWASP params)', () => {
  it('produces an argon2id hash with m=19456 KiB, t=2, p=1', async () => {
    expect(ARGON2_PARAMS).toEqual({ memoryCost: 19456, timeCost: 2, parallelism: 1 });
    const hash = await hashPassword('secret-123');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(hash).toContain('m=19456,t=2,p=1');
  });

  it('never stores or returns the plaintext', async () => {
    const plain = 'sup3r-secret-пароль';
    const hash = await hashPassword(plain);
    expect(hash).not.toContain(plain);
    expect(await verifyPassword(hash, plain)).toBe(true);
    expect(await verifyPassword(hash, 'sup3r-secret-пароlь')).toBe(false);
  });

  it('verifyPassword returns false (not throws) on malformed hash', async () => {
    expect(await verifyPassword('not-a-hash', 'x')).toBe(false);
  });
});

describe('session tokens (256 bit, only hash stored)', () => {
  it('token is 43-char base64url from 32 random bytes and unique', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i += 1) {
      const t = generateSessionToken();
      expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
      seen.add(t);
    }
    expect(seen.size).toBe(1000);
  });

  it('hashToken is lowercase sha-256 hex and deterministic', () => {
    const token = generateSessionToken();
    const expected = createHash('sha256').update(token).digest('hex');
    expect(hashToken(token)).toBe(expected);
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(token)).not.toBe(token);
  });
});

describe('sign-in flow', () => {
  it('successful login creates a session with only the token hash stored', async () => {
    const { store, limiter } = setup();
    const { login, password, row } = await seedUser(store);

    const result = await signIn({ store, rateLimiter: limiter }, attempt({ login, password }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(result.user).toEqual({ id: row.id, login, role: 'STUDENT' });

    const sessions = store.listSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].tokenHash).toBe(hashToken(result.token));
    expect(JSON.stringify(sessions)).not.toContain(result.token);
    expect(sessions[0].expiresAt.getTime()).toBe(BASE.getTime() + SESSION_TTL_MS);
    expect(sessions[0].ip).toBe('10.0.0.1');
    expect(sessions[0].userAgent).toBe('vitest');
  });

  it('wrong password and unknown login share one uniform error message', async () => {
    const { store, limiter } = setup();
    await seedUser(store);

    const wrongPassword = await signIn(
      { store, rateLimiter: limiter },
      attempt({ password: 'nope' }),
    );
    const unknownLogin = await signIn(
      { store, rateLimiter: limiter },
      attempt({ login: 'ghost', password: 'nope' }),
    );

    expect(wrongPassword.ok).toBe(false);
    expect(unknownLogin.ok).toBe(false);
    if (!wrongPassword.ok && !unknownLogin.ok) {
      expect(wrongPassword.code).toBe('INVALID_CREDENTIALS');
      expect(unknownLogin.code).toBe('INVALID_CREDENTIALS');
      expect(wrongPassword.message).toBe(unknownLogin.message);
      expect(wrongPassword.message).toBe(ERROR_MESSAGES.INVALID_CREDENTIALS);
      expect(wrongPassword.message).not.toContain('anna');
    }
    expect(store.listSessions()).toHaveLength(0);
  });

  it('locks the account after 5 failed logins for 15 minutes', async () => {
    const { store, limiter } = setup();
    const { login, password } = await seedUser(store);

    for (let i = 1; i <= 4; i += 1) {
      await signIn({ store, rateLimiter: limiter }, attempt({ password: 'bad', now: at(i * MIN) }));
    }
    // 5th failure triggers the lock window on the user row.
    await signIn({ store, rateLimiter: limiter }, attempt({ password: 'bad', now: at(5 * MIN) }));
    const row = store.listUsers()[0];
    expect(row.failedLogins).toBeGreaterThanOrEqual(MAX_FAILED_LOGINS);
    expect(row.lockedUntil?.getTime()).toBe(at(5 * MIN).getTime() + LOCK_DURATION_MS);

    // Even the CORRECT password is rejected while locked.
    const locked = await signIn(
      { store, rateLimiter: limiter },
      attempt({ login, password, now: at(6 * MIN) }),
    );
    expect(locked.ok).toBe(false);
    if (!locked.ok) {
      expect(locked.code).toBe('ACCOUNT_LOCKED');
      expect(locked.message).toBe(ERROR_MESSAGES.ACCOUNT_LOCKED);
      expect(locked.retryAfterMinutes).toBeGreaterThan(0);
    }
    expect(store.listSessions()).toHaveLength(0);
  });

  it('unlocks after the 15-minute window and a correct password works again', async () => {
    const { store, limiter } = setup();
    const { login, password } = await seedUser(store);

    for (let i = 1; i <= MAX_FAILED_LOGINS; i += 1) {
      await signIn({ store, rateLimiter: limiter }, attempt({ password: 'bad', now: at(i * MIN) }));
    }
    const unlocked = await signIn(
      { store, rateLimiter: limiter },
      attempt({ login, password, now: at(MAX_FAILED_LOGINS * MIN + LOCK_DURATION_MS + MIN) }),
    );
    expect(unlocked.ok).toBe(true);
  });

  it('a successful login resets the failure counter', async () => {
    const { store, limiter } = setup();
    const { login, password } = await seedUser(store);

    for (let i = 1; i <= 4; i += 1) {
      await signIn({ store, rateLimiter: limiter }, attempt({ password: 'bad', now: at(i * MIN) }));
    }
    await signIn({ store, rateLimiter: limiter }, attempt({ login, password, now: at(5 * MIN) }));
    expect(store.listUsers()[0].failedLogins).toBe(0);
    expect(store.listUsers()[0].lockedUntil).toBeNull();

    // Fresh cycle: 4 more failures do not lock.
    for (let i = 6; i <= 9; i += 1) {
      const r = await signIn(
        { store, rateLimiter: limiter },
        attempt({ password: 'bad', now: at(i * MIN) }),
      );
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe('INVALID_CREDENTIALS');
    }
    expect(store.listUsers()[0].lockedUntil).toBeNull();
  });

  it('rate-limits by IP: 30 attempts per 15 minutes, then rejection', async () => {
    const { store, limiter } = setup();
    await seedUser(store);

    let limited = false;
    for (let i = 1; i <= IP_RATE_MAX_ATTEMPTS + 1; i += 1) {
      const r = await signIn(
        { store, rateLimiter: limiter },
        attempt({ password: 'bad', now: at(i) }), // 1 ms apart — same window
      );
      if (!r.ok && r.code === 'RATE_LIMITED') {
        limited = true;
        expect(i).toBe(IP_RATE_MAX_ATTEMPTS + 1);
        expect(r.retryAfterMinutes).toBeGreaterThan(0);
      }
    }
    expect(limited).toBe(true);

    // Another IP is not affected (unknown login → the uniform invalid-credentials error).
    const otherIp = await signIn(
      { store, rateLimiter: limiter },
      attempt({
        login: 'ghost',
        ip: '10.0.0.2',
        password: 'bad',
        now: at(IP_RATE_MAX_ATTEMPTS + 2),
      }),
    );
    expect(otherIp.ok).toBe(false);
    if (!otherIp.ok) expect(otherIp.code).toBe('INVALID_CREDENTIALS');

    // After the window passes the same IP may try again.
    const afterWindow = await signIn(
      { store, rateLimiter: limiter },
      attempt({
        ip: '10.0.0.1',
        password: 'bad',
        now: at(IP_RATE_WINDOW_MS + 2 * IP_RATE_MAX_ATTEMPTS),
      }),
    );
    expect(afterWindow.ok).toBe(false);
    if (!afterWindow.ok) expect(afterWindow.code).toBe('INVALID_CREDENTIALS');
  });
});

describe('session lookup, expiry, sliding renewal, logout', () => {
  async function loginOnce(store = createMemoryAuthStore(), now = BASE) {
    const limiter = createMemoryIpRateLimiter();
    const { login, password } = await seedUser(store);
    const result = await signIn({ store, rateLimiter: limiter }, attempt({ login, password, now }));
    if (!result.ok) throw new Error('login failed in test setup');
    return { store, token: result.token, tokenHash: hashToken(result.token) };
  }

  it('finds a live session by token hash, misses on unknown hash', async () => {
    const { store, tokenHash } = await loginOnce();
    expect(await store.findSessionByTokenHash(tokenHash, BASE)).not.toBeNull();
    expect(await store.findSessionByTokenHash('f'.repeat(64), BASE)).toBeNull();
  });

  it('expired session is invisible and lazily removed', async () => {
    const { store, tokenHash } = await loginOnce();
    expect(await store.findSessionByTokenHash(tokenHash, at(SESSION_TTL_MS + MIN))).toBeNull();
    expect(store.listSessions()).toHaveLength(0);
  });

  it('renews sliding when less than half the TTL remains', async () => {
    const { store, token } = await loginOnce();

    // remaining = 5d > TTL/2 → untouched
    const untouched = await resolveSession(store, token, at(2 * 24 * 3600_000));
    expect(untouched?.session.expiresAt.getTime()).toBe(BASE.getTime() + SESSION_TTL_MS);

    // remaining = 3d < TTL/2 → renewed to now + TTL (also persisted in the store)
    const renewed = await resolveSession(store, token, at(4 * 24 * 3600_000));
    expect(renewed?.session.expiresAt.getTime()).toBe(
      at(4 * 24 * 3600_000).getTime() + SESSION_TTL_MS,
    );
    const row = store.listSessions().find((s) => s.tokenHash === hashToken(token));
    expect(row?.expiresAt.getTime()).toBe(at(4 * 24 * 3600_000).getTime() + SESSION_TTL_MS);

    // missing cookie / garbage token → null
    expect(await resolveSession(store, undefined, BASE)).toBeNull();
    expect(await resolveSession(store, 'garbage', BASE)).toBeNull();
  });

  it('deleteSession logs out the current device only', async () => {
    const { store, tokenHash } = await loginOnce();
    store.seedUser({ id: 'u_boris', login: 'boris', passwordHash: 'x', role: 'STUDENT' });
    await store.createSession({
      userId: 'u_boris',
      tokenHash: 'a'.repeat(64),
      expiresAt: at(SESSION_TTL_MS),
      ip: null,
      userAgent: null,
    });

    await store.deleteSession(tokenHash, BASE);
    expect(await store.findSessionByTokenHash(tokenHash, BASE)).toBeNull();
    expect(store.listSessions()).toHaveLength(1);
    expect(store.listSessions()[0].userId).toBe('u_boris');
  });

  it('deleteAllUserSessions wipes every session of the user (and only theirs)', async () => {
    const { store, tokenHash } = await loginOnce();
    store.seedUser({ id: 'u_boris', login: 'boris', passwordHash: 'x', role: 'STUDENT' });
    await store.createSession({
      userId: 'u_boris',
      tokenHash: 'a'.repeat(64),
      expiresAt: at(SESSION_TTL_MS),
      ip: null,
      userAgent: null,
    });

    const count = await store.deleteAllUserSessions('u_anna', BASE);
    expect(count).toBe(1);
    expect(await store.findSessionByTokenHash(tokenHash, BASE)).toBeNull();
    expect(store.listSessions()).toHaveLength(1);
  });
});

describe('session cookie shape', () => {
  it('__Host-session is HttpOnly, Secure, SameSite=Lax, Path=/, 7 days', () => {
    const cookie = buildSessionCookie('tok');
    expect(cookie.name).toBe('__Host-session');
    expect(cookie.value).toBe('tok');
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.secure).toBe(true);
    expect(cookie.sameSite).toBe('lax');
    expect(cookie.path).toBe('/');
    expect(cookie.maxAge).toBe(SESSION_TTL_MS / 1000);
    expect(cookie.maxAge).toBe(7 * 24 * 3600);
  });

  it('cleared cookie expires immediately', () => {
    const cookie = buildClearedSessionCookie();
    expect(cookie.name).toBe('__Host-session');
    expect(cookie.value).toBe('');
    expect(cookie.maxAge).toBe(0);
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.secure).toBe(true);
  });
});
