// DIG-69 — серверное чтение локали из cookie (next/headers).
// Отдельный файл, чтобы чистый словарь (./index) остался импортируемым
// клиентскими компонентами.
import { cookies } from 'next/headers';
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from './index';

/**
 * Локаль кабинета из cookie `du-locale`; нет/битая cookie — 'ru'.
 * Читается в root layout (html lang, плашка концепта), cabinet layout
 * (Shell) и серверных страницах (заголовки, статусы).
 */
export async function getLocale(): Promise<Locale> {
  try {
    const store = await cookies();
    const value = store.get(LOCALE_COOKIE)?.value;
    return isLocale(value) ? value : DEFAULT_LOCALE;
  } catch {
    // cookies() недоступен вне request-scope (юнит-тесты рендерят серверные
    // компоненты через renderToStaticMarkup) — fail-soft на дефолт 'ru':
    // тестовые снимки рендерят дефолтную локаль байт-в-байт.
    return DEFAULT_LOCALE;
  }
}
