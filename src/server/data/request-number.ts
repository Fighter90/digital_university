// DIG-12 — public request numbers.
//
// URLs never carry sequential or database ids of a request. The visible key is
// a human-readable number `SR-<year>-<5 random A-Z0-9>`, unique per request,
// combined with the owner check inside the data layer. A random suffix keeps
// the numbers non-sequential: they cannot be enumerated like 0001, 0002, ….

export const REQUEST_NUMBER_PATTERN = /^SR-(\d{4})-[A-Z0-9]{5}$/;

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/** Formats a new public request number; `random` is injectable for tests. */
export function newRequestNumber(
  random: () => number = Math.random,
  now: Date = new Date(),
): string {
  let suffix = '';
  for (let i = 0; i < 5; i += 1) {
    suffix += ALPHABET[Math.floor(random() * ALPHABET.length)];
  }
  return `SR-${now.getFullYear()}-${suffix}`;
}

/**
 * Normalizes user/URL input before a lookup: trims, drops a leading «#»,
 * upper-cases. Defensive only — the data layer still scopes every lookup by
 * the owner, so a guessed number is useless without the right session.
 */
export function normalizeRequestNumber(raw: string): string {
  return raw.trim().replace(/^#/, '').toUpperCase();
}

export function isValidRequestNumber(value: string): boolean {
  return REQUEST_NUMBER_PATTERN.test(value);
}
