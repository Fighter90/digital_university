// DIG-11 — session resolution policy (pure, unit-testable):
// token → store lookup → uniform safe projection → sliding renewal.
// The cookie/redirect plumbing around it lives in session.ts.
import { hashToken } from './tokens';
import { SESSION_TTL_MS, type AuthSessionRow, type AuthStore, type AuthUser } from './types';

export interface ResolvedSession {
  user: AuthUser;
  session: AuthSessionRow;
}

/**
 * Resolves a raw session token to a live session.
 * - unknown/expired token → null;
 * - when less than half of the 7-day TTL remains, the session is renewed by
 *   the full TTL (sliding) — the cookie value itself never changes.
 */
export async function resolveSession(
  store: AuthStore,
  token: string | undefined | null,
  now: Date,
): Promise<ResolvedSession | null> {
  if (!token) return null;

  const found = await store.findSessionByTokenHash(hashToken(token), now);
  if (!found) return null;

  const remainingMs = found.session.expiresAt.getTime() - now.getTime();
  if (remainingMs < SESSION_TTL_MS / 2) {
    const renewedUntil = new Date(now.getTime() + SESSION_TTL_MS);
    await store.touchSession(found.session.id, renewedUntil);
    found.session.expiresAt = renewedUntil;
  }

  return {
    user: { id: found.user.id, login: found.user.login, role: found.user.role },
    session: found.session,
  };
}
