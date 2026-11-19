// DIG-86 — режим доступности «Крупный текст и без эффектов» (для слабовидящих).
//
// Настройка живёт в cookie `du-a11y` (как локаль в du-locale, DIG-69): её
// читает root layout и ставит классы a11y-large-text / a11y-no-effects на
// <html> — server-side, до первой отрисовки, для ВСЕХ страниц кабинета
// (аноним и сотрудник получают значения по умолчанию). Запись cookie —
// только через owner-scoped server action setA11y (src/server/actions/a11y.ts).
//
// Модуль чистый (без next/headers): импортируется и сервером, и клиентом.
// Серверное чтение cookie — в ./server.

export type A11yPref = 'large-text' | 'no-effects';

/** Cookie с режимами доступности кабинета. */
export const A11Y_COOKIE = 'du-a11y';

/** Срок жизни cookie: год (прототип, Long-term для демо — как du-locale). */
export const A11Y_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Все режимы доступности в каноническом порядке сериализации. */
export const A11Y_PREFS: readonly A11yPref[] = ['large-text', 'no-effects'];

/** Включённые режимы (не переданные/битые — выключены). */
export interface A11yPrefs {
  /** Крупный текст: базовый размер 125%+, усиленные веса, крупные отступы. */
  largeText: boolean;
  /** Без эффектов: без анимаций, плавных появлений, теней и переходов. */
  noEffects: boolean;
}

export const DEFAULT_A11Y_PREFS: A11yPrefs = { largeText: false, noEffects: false };

/** Проверка значения из cookie/вызова action: только валидные режимы проходят. */
export function isA11yPref(value: unknown): value is A11yPref {
  return value === 'large-text' || value === 'no-effects';
}

/**
 * Значение cookie du-a11y → включённые режимы. Значение — подмножество
 * A11Y_PREFS через запятую («large-text,no-effects»); порядок значений и
 * мусор между ними не важны — всё невалидное отбрасывается.
 */
export function a11yPrefsFromCookie(raw: string | undefined | null): A11yPrefs {
  if (!raw) return { ...DEFAULT_A11Y_PREFS };
  const parts = new Set(
    raw
      .split(',')
      .map((part) => part.trim())
      .filter((part): part is A11yPref => isA11yPref(part)),
  );
  return { largeText: parts.has('large-text'), noEffects: parts.has('no-effects') };
}

/** Включённые режимы → значение cookie (канонический порядок, '' если пусто). */
export function a11yPrefsToCookie(prefs: A11yPrefs): string {
  return A11Y_PREFS.filter((pref) => prefs[pref === 'large-text' ? 'largeText' : 'noEffects']).join(
    ',',
  );
}

/** Тумблер одного режима: включение/выключение независимо от второго. */
export function withA11yPref(prefs: A11yPrefs, pref: A11yPref, enabled: boolean): A11yPrefs {
  return pref === 'large-text'
    ? { ...prefs, largeText: enabled }
    : { ...prefs, noEffects: enabled };
}

/** Классы для <html> из включённых режимов (дополняет appearanceClasses, DIG-44). */
export function a11yClasses(prefs: A11yPrefs): string[] {
  const classes: string[] = [];
  if (prefs.largeText) classes.push('a11y-large-text');
  if (prefs.noEffects) classes.push('a11y-no-effects');
  return classes;
}
