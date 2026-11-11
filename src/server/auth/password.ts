// DIG-11 — password hashing: argon2id with OWASP parameters.
// Plaintext passwords never leave this module boundary as anything but an
// argument; they are never stored or logged (AGENTS.md, DIG-11).
import { hash, verify } from '@node-rs/argon2';
import { ARGON2_PARAMS } from './types';

/**
 * Hashes a password with argon2id (memory 19 MiB, t=2, p=1 — OWASP
 * Password Storage cheat-sheet). Returns a PHC string such as
 * `$argon2id$v=19$m=19456,t=2,p=1$…`.
 */
export function hashPassword(plain: string): Promise<string> {
  return hash(plain, {
    memoryCost: ARGON2_PARAMS.memoryCost,
    timeCost: ARGON2_PARAMS.timeCost,
    parallelism: ARGON2_PARAMS.parallelism,
  });
}

/**
 * Verifies a password against a stored hash. Never throws on a malformed
 * hash — returns `false` so a corrupted row cannot turn into a 500.
 */
export async function verifyPassword(storedHash: string, plain: string): Promise<boolean> {
  try {
    return await verify(storedHash, plain);
  } catch {
    return false;
  }
}

export { ARGON2_PARAMS };
