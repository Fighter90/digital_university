// DIG-11 — cookie shapes for the session and the signed role hint.
// Pure module (no `next/headers`), so both the app and unit tests can use it.
// `__Host-` prefix: the browser only accepts it with Secure + Path=/ and no
// Domain attribute — exactly what the DIG-11 spec requires.
import { SESSION_TTL_MS } from './types';
import { ROLE_COOKIE_NAME } from './role-cookie';

export interface CookieSpec {
  name: string;
  value: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax';
  path: '/';
  maxAge: number;
}

export const SESSION_COOKIE_NAME = '__Host-session';
export const SESSION_MAX_AGE_SECONDS = Math.floor(SESSION_TTL_MS / 1000); // 604800

/** Cookie with the raw session token (the token lives ONLY in this cookie). */
export function buildSessionCookie(token: string): CookieSpec {
  return {
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

/** Expires the session cookie (used by logout / logout-all). */
export function buildClearedSessionCookie(): CookieSpec {
  return { ...buildSessionCookie(''), maxAge: 0 };
}

/** Cookie with the signed role hint consumed by middleware (defense-in-depth). */
export function buildRoleHintCookie(value: string): CookieSpec {
  return {
    name: ROLE_COOKIE_NAME,
    value,
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

export function buildClearedRoleHintCookie(): CookieSpec {
  return { ...buildRoleHintCookie(''), maxAge: 0 };
}
