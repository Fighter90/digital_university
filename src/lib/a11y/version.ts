// DIG-100 — «Версия для слабовидящих» (plain-режим, отдельная ссылка).
//
// Состояние живёт в cookie `du-a11y-version` (значения 'plain' | 'off') —
// тот же паттерн, что du-a11y (DIG-86) и du-locale (DIG-69): cookie читает
// root layout и ставит класс a11y-plain на <html> server-side, до первой
// отрисовки, для ВСЕХ страниц (кабинет, лендинг, вход). Запись cookie —
// только через owner-scoped server action toggleA11yVersion
// (src/server/actions/a11y.ts, requireDataCtx по сессии).
//
// Plain перекрывает режимы DIG-86 (du-a11y) и системный
// prefers-reduced-motion, включая их поведение: CSS-слой .a11y-plain
// в самом конце src/app/globals.css даёт белый фон, чёрный текст, синие
// подчёркнутые ссылки, базовый шрифт с засечками ≥20px, линейную колонку
// вместо сеток, без градиентов/теней/анимаций/фонов.
//
// Модуль чистый (без next/headers): импортируется и сервером, и клиентом.
// Серверное чтение cookie — isA11yPlain в ./server.

/** Значения cookie du-a11y-version: plain-версия включена / выключена. */
export type A11yVersion = 'plain' | 'off';

/** Cookie с версией интерфейса для слабовидящих. */
export const A11Y_VERSION_COOKIE = 'du-a11y-version';

/** Срок жизни cookie: год (прототип — как du-a11y, du-locale). */
export const A11Y_VERSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Класс plain-версии на <html> (ставит root layout из cookie). */
export const A11Y_PLAIN_CLASS = 'a11y-plain';

/** Проверка значения из cookie/формы: только 'plain' | 'off' проходят. */
export function isA11yVersion(value: unknown): value is A11yVersion {
  return value === 'plain' || value === 'off';
}

/** Значение cookie → включена ли plain-версия (нет/битая — обычная версия). */
export function isPlainVersionFromCookie(raw: string | undefined | null): boolean {
  return raw === 'plain';
}
