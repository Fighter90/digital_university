// DIG-11 — signed role hint cookie (`__Host-role`) consumed by middleware.
//
// Middleware runs on the edge runtime and cannot reach PostgreSQL, so the role
// for the cheap `/staff` gate travels in a second HMAC-SHA256-signed cookie.
// This is UX-grade defense-in-depth ONLY: every staff page/action re-checks
// the role server-side via `requireStaff()` against the session in the DB.
// Forging the hint without AUTH_SECRET is infeasible, and forging it anyway
// still gets stopped by the server-side check.
//
// Edge-safe: Web Crypto only (no node:crypto), manual base64url.

export const ROLE_COOKIE_NAME = '__Host-role';

const ROLES = ['STUDENT', 'STAFF'] as const;
export type HintRole = (typeof ROLES)[number];

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmacKey(secret: string, usage: KeyUsage[]): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    usage,
  );
}

/** `${role}.${userId}.${hmac}` — the signature covers both role and userId. */
export async function signRoleHint(
  role: HintRole,
  userId: string,
  secret: string,
): Promise<string> {
  const payload = `${role}.${userId}`;
  const signature = await crypto.subtle.sign(
    'HMAC',
    await hmacKey(secret, ['sign']),
    encoder.encode(payload),
  );
  return `${payload}.${toBase64Url(new Uint8Array(signature))}`;
}

/** Returns `{role, userId}` for a valid cookie value, `null` otherwise. */
export async function verifyRoleHint(
  value: string | undefined | null,
  secret: string,
): Promise<{ role: HintRole; userId: string } | null> {
  if (!value || !secret) return null;
  const parts = value.split('.');
  if (parts.length !== 3) return null;
  const [role, userId, signature] = parts;
  if (!ROLES.includes(role as HintRole) || !userId) return null;
  try {
    const valid = await crypto.subtle.verify(
      'HMAC',
      await hmacKey(secret, ['verify']),
      fromBase64Url(signature) as unknown as ArrayBuffer,
      encoder.encode(`${role}.${userId}`),
    );
    return valid ? { role: role as HintRole, userId } : null;
  } catch {
    return null;
  }
}
