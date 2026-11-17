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
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}
