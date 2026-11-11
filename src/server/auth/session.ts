// DIG-11 — session layer for server components and server actions.
// `requireUser()` is THE entry point for every protected page/action
// (see src/server/README.md and AGENTS.md IDOR rules). The resolution and
// sliding-renewal policy itself is pure code: session-policy.ts.
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { authStore } from './store';
import {
  SESSION_COOKIE_NAME,
  buildClearedRoleHintCookie,
  buildClearedSessionCookie,
} from './cookies';
import { resolveSession, type ResolvedSession } from './session-policy';
import type { AuthSessionRow, AuthUser } from './types';

/**
 * Reads the `__Host-session` cookie and resolves it to a live session
 * (with sliding renewal). Returns null for missing/unknown/expired tokens.
 */
export async function getAuthSession(): Promise<ResolvedSession | null> {
  const jar = await cookies();
  return resolveSession(authStore, jar.get(SESSION_COOKIE_NAME)?.value, new Date());
}

/**
 * Guard for server components and server actions. Unauthenticated visitors
 * land on /login with a safe `?next=` so the sign-in can bring them back.
 */
export async function requireUser(nextPath?: string): Promise<AuthUser> {
  const auth = await getAuthSession();
  if (!auth) {
    redirect(nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : '/login');
  }
  return auth.user;
}

/** Guard for staff-only screens: students are bounced to their dashboard. */
export async function requireStaff(nextPath?: string): Promise<AuthUser> {
  const user = await requireUser(nextPath);
  if (user.role !== 'STAFF') redirect('/dashboard');
  return user;
}

/** Logout of the current device (server action only — cookies are set here). */
export async function signOutCurrentSession(): Promise<void> {
  const jar = await cookies();
  const auth = await getAuthSession();
  if (auth) await authStore.deleteSession(auth.session.tokenHash, new Date());
  jar.set(buildClearedSessionCookie());
  jar.set(buildClearedRoleHintCookie());
}

/** «Выйти со всех устройств»: revokes every session of the user. */
export async function signOutAllDevices(): Promise<number> {
  const jar = await cookies();
  const auth = await getAuthSession();
  const revoked = auth ? await authStore.deleteAllUserSessions(auth.user.id, new Date()) : 0;
  jar.set(buildClearedSessionCookie());
  jar.set(buildClearedRoleHintCookie());
  return revoked;
}

/**
 * DIG-19: live sessions of the user for the «Активные сессии» screen.
 * Read-only projection — token hashes only, newest first.
 */
export async function listActiveUserSessions(userId: string): Promise<AuthSessionRow[]> {
  return authStore.listUserSessions(userId, new Date());
}
