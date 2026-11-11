// DIG-11 — session tokens: 256 bits of randomness, only the SHA-256 lands in the DB.
import { createHash, randomBytes } from 'node:crypto';

/** 32 random bytes as base64url — exactly 43 characters, cookie-safe. */
export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Lowercase hex SHA-256 of a token. This — and only this — is stored. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}
