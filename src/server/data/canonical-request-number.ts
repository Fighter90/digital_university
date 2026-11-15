// DIG-30 — публичный номер канонической заявки «ЗД-<год>-<6 цифр>».
//
// Формат гарантирует CHECK в init-миграции DIG-9
// (`"number" ~ '^ЗД-[0-9]{4}-[0-9]{6}$'`), уникальность — UNIQUE на
// колонке. В PostgreSQL номер собирается приложением из
// nextval('request_number_seq'); in-memory адаптер ведёт счётчик по
// году (см. memory-db.ts, nextCanonicalRequestSeq). Номер — публичный
// ключ заявки в URL: не id, не последовательность БД, а владение всё
// равно проверяется слоем данных (чужой номер бесполезен).

export const CANONICAL_REQUEST_NUMBER_PATTERN = /^ЗД-(\d{4})-[0-9]{6}$/;

/** «ЗД-2026-000123»: год подачи + 6-значный порядковый номер. */
export function formatCanonicalRequestNumber(year: number, seq: number): string {
  const safeYear = Math.max(2000, Math.min(2999, Math.trunc(year)));
  const safeSeq = Math.max(0, Math.trunc(seq));
  return `ЗД-${safeYear}-${String(safeSeq).padStart(6, '0')}`;
}

export function isValidCanonicalRequestNumber(value: string): boolean {
  return CANONICAL_REQUEST_NUMBER_PATTERN.test(value);
}

/** Год подачи из номера; null — номер не канонического формата. */
export function canonicalRequestNumberYear(value: string): number | null {
  const match = CANONICAL_REQUEST_NUMBER_PATTERN.exec(value);
  return match ? Number(match[1]) : null;
}

/**
 * Порядковый номер из номера заявки (для счётчика in-memory адаптера);
 * null — номер не канонического формата.
 */
export function canonicalRequestNumberSeq(value: string): number | null {
  if (!isValidCanonicalRequestNumber(value)) return null;
  return Number(value.slice(-6));
}
