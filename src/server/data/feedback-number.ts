// DIG-40 — публичные номера обращений канала обратной связи.
//
// Зеркало ticket-number.ts (DIG-39): URL несёт только человекочитаемый номер
// `FB-<year>-<5 random A-Z0-9>`, никакого cuid и никакого порядкового номера.
// Случайный суффикс защищает от перебора 0001, 0002, …; для подписанных
// обращений скоуп владельца проверяет слой данных, анонимные обращения по
// карточке не открываются никому (связи с пользователем нет).

export const FEEDBACK_NUMBER_PATTERN = /^FB-(\d{4})-[A-Z0-9]{5}$/;

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/** Форматирует новый публичный номер; `random` инъекцируется в тестах. */
export function newFeedbackNumber(
  random: () => number = Math.random,
  now: Date = new Date(),
): string {
  let suffix = '';
  for (let i = 0; i < 5; i += 1) {
    suffix += ALPHABET[Math.floor(random() * ALPHABET.length)];
  }
  return `FB-${now.getFullYear()}-${suffix}`;
}

/**
 * Нормализация ввода перед поиском: trim, снятие ведущего «#», верхний
 * регистр. Оборонительная мера — слой данных всё равно проверяет доступ:
 * подписанные скоупятся владельцем, анонимные не открываются никому.
 */
export function normalizeFeedbackNumber(raw: string): string {
  return raw.trim().replace(/^#/, '').toUpperCase();
}

export function isValidFeedbackNumber(value: string): boolean {
  return FEEDBACK_NUMBER_PATTERN.test(value);
}
