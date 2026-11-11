// DIG-11, review round 3 — the middleware itself must keep the auth cookies
// alive while the browser stays active («скользящее продление»):
// - an allowed request with a session cookie re-issues `__Host-session` with
//   the SAME token value and a fresh full 7-day Max-Age;
// - a VERIFIED role hint is re-issued the same way (an active STAFF member
//   must not lose the middleware /staff gate when the hint would expire);
// - redirect/forbidden responses and cookie-less requests never set cookies.
// These tests import the real middleware function (next/server works in the
// node vitest environment; the module itself is DB-free).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from '@/server/auth/cookies';
import { ROLE_COOKIE_NAME, signRoleHint } from '@/server/auth/role-cookie';

const SECRET = 'middleware-test-secret';
const ORIGIN = 'http://localhost:3000';

const request = (path: string, cookieHeader?: string, method = 'GET') =>
  new NextRequest(`${ORIGIN}${path}`, {
    method,
    headers: cookieHeader ? new Headers({ cookie: cookieHeader }) : undefined,
  });

const setCookieHeaders = (response: Response): string[] => response.headers.getSetCookie();

const setCookieFor = (response: Response, name: string): string | undefined =>
  setCookieHeaders(response).find((header) => header.startsWith(`${name}=`));

/** Same as `setCookieFor` but narrows to `string` via an assertion. */
const setCookieForOrFail = (response: Response, name: string): string => {
  const header = setCookieFor(response, name);
  expect(header, `Set-Cookie for ${name} must be present`).toBeDefined();
  if (!header) throw new Error('unreachable: header asserted above');
  return header;
};

/** Extracts `Max-Age=…` from a raw Set-Cookie header. */
const maxAgeOf = (header: string): number => {
  const match = header.match(/Max-Age=(\d+)/i);
  return match ? Number(match[1]) : -1;
};

describe('middleware: sliding renewal of auth cookies (review round 3)', () => {
  const OLD_SECRET = process.env.AUTH_SECRET;
  beforeAll(() => {
    process.env.AUTH_SECRET = SECRET;
  });
  afterAll(() => {
    if (OLD_SECRET === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = OLD_SECRET;
  });

  it('re-issues the session cookie with the same token and a fresh 7-day Max-Age', async () => {
    const response = await middleware(request('/dashboard', `${SESSION_COOKIE_NAME}=tok_abc123`));

    const header = setCookieForOrFail(response, SESSION_COOKIE_NAME);
    expect(header).toContain(`${SESSION_COOKIE_NAME}=tok_abc123`); // token value unchanged
    expect(maxAgeOf(header)).toBe(SESSION_MAX_AGE_SECONDS); // full 7 days again
    expect(header.toLowerCase()).toContain('httponly');
    expect(header.toLowerCase()).toContain('secure');
    expect(header.toLowerCase()).toContain('samesite=lax');
    expect(header.toLowerCase()).toContain('path=/');
  });

  it('re-issues a verified role hint so an active STAFF member keeps the /staff gate', async () => {
    const hint = await signRoleHint('STAFF', 'u_staff1', SECRET);
    const response = await middleware(
      request('/staff/requests', `${SESSION_COOKIE_NAME}=tok_abc123; ${ROLE_COOKIE_NAME}=${hint}`),
    );

    const header = setCookieForOrFail(response, ROLE_COOKIE_NAME);
    expect(header).toContain(`${ROLE_COOKIE_NAME}=${hint}`); // value unchanged
    expect(maxAgeOf(header)).toBe(SESSION_MAX_AGE_SECONDS);
    expect(setCookieFor(response, SESSION_COOKIE_NAME)).toBeDefined();
  });

  it('never extends a role hint that failed verification', async () => {
    const response = await middleware(
      request('/staff', `${SESSION_COOKIE_NAME}=tok_abc123; ${ROLE_COOKIE_NAME}=forged.value`),
    );

    // Student-gate redirect → no cookie writes at all on this response.
    expect(response.status).toBe(307);
    expect(setCookieFor(response, ROLE_COOKIE_NAME)).toBeUndefined();
  });

  it.each([
    ['anonymous visitor redirected to /login', '/dashboard', false],
    ['student bounced off /staff', '/staff', true],
    ['CSRF-forbidden API mutation', '/api/requests', true],
  ])('sets no auth cookies on %s', async (_name, path, withCookie) => {
    const cookieParts: string[] = [];
    if (withCookie) cookieParts.push(`${SESSION_COOKIE_NAME}=tok_abc123`);
    if (path === '/staff') cookieParts.push(`${ROLE_COOKIE_NAME}=tampered.or-unverifiable`);
    if (path === '/api/requests') {
      cookieParts.push(`${SESSION_COOKIE_NAME}=tok_abc123`);
    }
    const headers = new Headers({
      ...(cookieParts.length > 0 ? { cookie: cookieParts.join('; ') } : {}),
      ...(path === '/api/requests'
        ? { origin: 'https://evil.example', host: 'localhost:3000' }
        : {}),
    });

    const response = await middleware(
      new NextRequest(`${ORIGIN}${path}`, { method: 'POST', headers }),
    );

    expect(setCookieFor(response, SESSION_COOKIE_NAME)).toBeUndefined();
    expect(setCookieFor(response, ROLE_COOKIE_NAME)).toBeUndefined();
  });

  it('anonymous requests without cookies stay cookie-free on public paths', async () => {
    const response = await middleware(request('/login'));
    expect(setCookieHeaders(response)).toHaveLength(0);
  });
});
