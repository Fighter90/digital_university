// DIG-86 — серверное чтение режимов доступности из cookie du-a11y (next/headers).
// Отдельный файл, чтобы чистый модуль (./) остался импортируемым клиентскими
// компонентами (паттерн src/lib/i18n/server.ts).
import { cookies } from 'next/headers';

import { A11Y_COOKIE, DEFAULT_A11Y_PREFS, a11yPrefsFromCookie, type A11yPrefs } from '.';

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
