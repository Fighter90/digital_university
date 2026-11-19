// DIG-86 — серверное чтение режимов доступности из cookie du-a11y (next/headers).
// Отдельный файл, чтобы чистый модуль (./) остался импортируемым клиентскими
// компонентами (паттерн src/lib/i18n/server.ts).
import { cookies } from 'next/headers';

import { A11Y_COOKIE, DEFAULT_A11Y_PREFS, a11yPrefsFromCookie, type A11yPrefs } from '.';
import { A11Y_VERSION_COOKIE, isPlainVersionFromCookie } from './version';

/**
 * Режимы доступности из cookie `du-a11y`; нет/битая cookie — оба выключены.
 * Читается в root layout (классы на <html> до первой отрисовки) и на экране
 * «Настройки → Доступность» (состояние тумблеров).
 */
export async function getA11yPrefs(): Promise<A11yPrefs> {
  try {
    const store = await cookies();
    return a11yPrefsFromCookie(store.get(A11Y_COOKIE)?.value);
  } catch {
    // cookies() недоступен вне request-scope (юнит-тесты рендерят серверные
    // компоненты через prerenderToNodeStream) — fail-soft на дефолт.
    return { ...DEFAULT_A11Y_PREFS };
  }
}

/**
 * DIG-100 — включена ли plain-версия для слабовидящих (cookie
 * du-a11y-version). Читается в root layout (класс a11y-plain на <html>),
 * cabinet layout (полоска над шапкой Shell) и на лендинге (полоска
 * над шапкой + футер). Нет/битая cookie — обычная версия.
 */
export async function isA11yPlain(): Promise<boolean> {
  try {
    const store = await cookies();
    return isPlainVersionFromCookie(store.get(A11Y_VERSION_COOKIE)?.value);
  } catch {
    // cookies() недоступен вне request-scope — fail-soft на обычную версию.
    return false;
  }
}
