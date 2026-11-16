// DIG-39 — public ticket numbers.
//
// Зеркало request-number.ts (DIG-12): URL обращения несёт только
// человекочитаемый номер `TS-<year>-<5 random A-Z0-9>`, никакого cuid и
// никакого порядкового номера. Случайный суффикс защищает от перебора
// 0001, 0002, …; скоуп владельца проверяет слой данных.

export const TICKET_NUMBER_PATTERN = /^TS-(\d{4})-[A-Z0-9]{5}$/;

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/** Форматирует новый публичный номер обращения; `random` инъекцируется в тестах. */
export function newTicketNumber(
  random: () => number = Math.random,
  now: Date = new Date(),
): string {
  let suffix = '';
  for (let i = 0; i < 5; i += 1) {
    suffix += ALPHABET[Math.floor(random() * ALPHABET.length)];
  }
  return `TS-${now.getFullYear()}-${suffix}`;
}

/**
 * Нормализация ввода перед поиском: trim, снятие ведущего «#», верхний
 * регистр. Оборонительная мера — слой данных всё равно скоупит поиск
 * владельцем, угаданный номер бесполезен без нужной сессии.
 */
export function normalizeTicketNumber(raw: string): string {
  return raw.trim().replace(/^#/, '').toUpperCase();
}

export function isValidTicketNumber(value: string): boolean {
  return TICKET_NUMBER_PATTERN.test(value);
}
