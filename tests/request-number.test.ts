// DIG-30 — безопасная работа с номером заявки из URL.
//
// Динамический сегмент App Router приходит уже декодированным, но в нём
// может остаться «сырой» процент (например `%` из `/api/requests/%25/…`):
// повторный decodeURIComponent бросает URIError и роняет роут с 500,
// нарушая контракт единого 404 (DIG-12). Хелпер обязан декодировать
// корректные последовательности и НЕ бросать на мусорных.
import { describe, expect, it } from 'vitest';
import { decodeRequestNumberParam, normalizeRequestNumber } from '@/server/data/request-number';
import { CANONICAL_REQUEST_NUMBER_PATTERN } from '@/server/data/canonical-request-number';

describe('decodeRequestNumberParam: не бросает URIError (ревью DIG-30)', () => {
  it('уже декодированный номер проходит без изменений', () => {
    expect(decodeRequestNumberParam('ЗД-2026-000123')).toBe('ЗД-2026-000123');
  });

  it('процентно-закодированный номер декодируется', () => {
    const encoded = encodeURIComponent('ЗД-2026-000123');
    expect(encoded).toContain('%');
    expect(decodeRequestNumberParam(encoded)).toBe('ЗД-2026-000123');
    // «%25» — валидная кодировка символа «%» и декодируется честно.
    expect(decodeRequestNumberParam('%25')).toBe('%');
  });

  it('мусорные последовательности возвращаются как есть, без исключения', () => {
    // `%` — то, что остаётся от `%25` после декодирования сегмента
    // фреймворком; `%E0%A4%A` — обрезанная UTF-8 последовательность;
    // `100%` — процент в конце.
    for (const garbage of ['%', '100%', '%E0%A4%A', 'ЗД-2026-%0']) {
      expect(() => decodeRequestNumberParam(garbage)).not.toThrow();
      expect(decodeRequestNumberParam(garbage)).toBe(garbage);
    }
  });

  it('после нормализации мусор не похож на канонический номер → контракт 404', () => {
    const normalized = normalizeRequestNumber(decodeRequestNumberParam('%'));
    expect(CANONICAL_REQUEST_NUMBER_PATTERN.test(normalized)).toBe(false);
  });
});
