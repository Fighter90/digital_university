// DIG-69 — локализация интерфейса RU/EN (минимально инвазивная: без
// реструктуризации роутов и без новых зависимостей).
//
// Локаль хранится в cookie `du-locale` (дефолт — 'ru'). Словари плоские,
// набор ключей одинаковый (проверяется компиляцией и юнит-тестом).
// ДЕМО-КОНТЕНТ (ФИО, дисциплины, новости) не переводится — только интерфейс.
//
// Модуль чистый (без next/headers): импортируется и сервером, и клиентом.
// Серверное чтение cookie — в ./server (getLocale), запись — server action
// setLocale (src/server/actions/locale.ts).
import { en } from './en';
import { ru } from './ru';

export type Locale = 'ru' | 'en';

export const DEFAULT_LOCALE: Locale = 'ru';

/** Все поддерживаемые локали (порядок = порядок в переключателе). */
export const LOCALES: readonly Locale[] = ['ru', 'en'];

/** Cookie с выбранной локалью кабинета. */
export const LOCALE_COOKIE = 'du-locale';

/** Срок жизни cookie локали: год (прототип, Long-term для демо). */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const dictionaries: Record<Locale, Record<string, string>> = { ru, en };

export type TranslationKey = keyof typeof ru;

/** Проверка значения из cookie/формы: только валидные локали проходят. */
export function isLocale(value: unknown): value is Locale {
  return value === 'ru' || value === 'en';
}

/**
 * Перевод по ключу с интерполяцией `{name}`. RU — канон: словарь EN по
 * построению полон, но на случай рассинхрона в рантайме — откат на RU,
 * затем на сам ключ (строка никогда не undefined).
 */
export function t(
  locale: Locale,
  key: TranslationKey,
  vars?: Record<string, string | number>,
): string {
  let text: string = (dictionaries[locale] as Record<string, string>)[key] ?? ru[key] ?? key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}

// ── заголовки по pathname-префиксу ──────────────────────────────────────────

type PrefixKey = { href: string; key: TranslationKey };

/** href → ключ заголовка страницы (более длинный префикс приоритетнее). */
const TITLE_BY_HREF: readonly PrefixKey[] = [
  { href: '/grades/gradebook', key: 'title.gradebook' },
  { href: '/grades/session', key: 'title.session' },
  // DIG-103 — подстраница рейтинга группы (длинный префикс приоритетнее /grades).
  { href: '/grades/rating', key: 'title.gradesRating' },
  { href: '/grades', key: 'title.grades' },
  { href: '/staff/requests', key: 'title.staffRequests' },
  { href: '/staff/appeals', key: 'title.staffAppeals' },
  { href: '/staff/announcements', key: 'title.staffAnnouncements' },
  { href: '/staff', key: 'title.staffDashboard' },
  { href: '/requests', key: 'title.requests' },
  { href: '/schedule', key: 'title.schedule' },
  { href: '/tasks', key: 'title.tasks' },
  { href: '/notifications', key: 'title.notifications' },
  { href: '/deanery', key: 'title.deanery' },
  { href: '/feedback', key: 'title.feedback' },
  { href: '/help', key: 'title.help' },
  { href: '/guide', key: 'title.guide' },
  // DIG-73 — страница документации MCP.
  { href: '/mcp', key: 'title.mcp' },
  { href: '/people', key: 'title.people' },
  { href: '/profile', key: 'title.profile' },
  { href: '/settings', key: 'title.settings' },
  { href: '/news', key: 'title.news' },
  { href: '/services', key: 'title.services' },
  { href: '/dashboard', key: 'title.dashboard' },
  { href: '/more', key: 'title.more' },
  // DIG-42 — «Дополнительное образование».
  { href: '/dpo', key: 'title.dpo' },
];

/** href → ключ пункта меню (SideNav / TabBar / «Ещё»). */
const MENU_KEY_BY_HREF: readonly PrefixKey[] = [
  { href: '/ai-assistant', key: 'menu.aiAssistant' },
  { href: '/dashboard', key: 'menu.dashboard' },
  { href: '/tasks', key: 'menu.tasks' },
  { href: '/schedule', key: 'menu.schedule' },
  { href: '/grades', key: 'menu.grades' },
  { href: '/requests', key: 'menu.requests' },
  { href: '/notifications', key: 'menu.notifications' },
  { href: '/deanery', key: 'menu.deanery' },
  { href: '/feedback', key: 'menu.feedback' },
  { href: '/help', key: 'menu.help' },
  { href: '/guide', key: 'menu.guide' },
  // DIG-73 — страница документации MCP.
  { href: '/mcp', key: 'menu.mcp' },
  { href: '/people', key: 'menu.people' },
  { href: '/profile', key: 'menu.profile' },
  { href: '/settings', key: 'menu.settings' },
  { href: '/more', key: 'menu.more' },
  // DIG-42 — «Дополнительное образование».
  { href: '/dpo', key: 'menu.dpo' },
  { href: '/staff/requests', key: 'menu.staffRequests' },
  { href: '/staff/appeals', key: 'menu.staffAppeals' },
  { href: '/staff/announcements', key: 'menu.staffAnnouncements' },
  { href: '/staff', key: 'menu.staff' },
];

/**
 * Самый длинный совпавший префикс: `/schedule/week` → `/schedule`, но
 * `/schedule-extra` не матчится (те же правила, что resolveActiveSection).
 */
function longestPrefixMatch(pathname: string, table: readonly PrefixKey[]): TranslationKey | null {
  let match: PrefixKey | null = null;
  for (const entry of table) {
    const hits = pathname === entry.href || pathname.startsWith(`${entry.href}/`);
    if (hits && (match === null || entry.href.length > match.href.length)) match = entry;
  }
  return match?.key ?? null;
}

/**
 * Заголовок страницы по префиксу пути. RU-значения словаря байт-в-байт
 * равны прежним заголовкам страниц; на EN — английский словарь. Совпадения
 * нет — fallback (страницы-детей с динамическими h1 не ломаем).
 */
export function sectionTitle(locale: Locale, pathname: string, fallback?: string): string {
  const key = longestPrefixMatch(pathname, TITLE_BY_HREF);
  if (key) return t(locale, key);
  return fallback ?? t(locale, 'title.dashboard');
}

/**
 * Пункт меню по префиксу пути. RU — байт-в-байт прежние подписи nav-items
 * (у одного href бывают короткая и полная подписи: таб-бар «Заявки» vs
 * меню «Заявки и справки»), поэтому fallback каноничен. EN — словарь.
 */
export function navLabel(locale: Locale, pathname: string, fallback: string): string {
  if (locale === 'ru') return fallback;
  const key = longestPrefixMatch(pathname, MENU_KEY_BY_HREF);
  return key ? t('en', key) : fallback;
}

// ── статусы заявок и обращения ──────────────────────────────────────────────

/** Подпись статуса заявки по канону/легаси-значению («status.SUBMITTED» …). */
export function requestStatusLabel(locale: Locale, status: string): string {
  return t(locale, `status.${status}` as TranslationKey);
}

/** Подпись статуса обращения (appeal-status). */
export function appealStatusLabel(locale: Locale, status: 'OPEN' | 'ANSWERED' | 'CLOSED'): string {
  return t(locale, `appeal.${status}`);
}

// ── форматирование дат по локали ────────────────────────────────────────────

const LOCALE_TAGS: Record<Locale, string> = { ru: 'ru-RU', en: 'en-US' };

/** «16 ноября» / «November 16» — даты без времени. */
export function formatDate(locale: Locale, value: Date): string {
  return new Intl.DateTimeFormat(LOCALE_TAGS[locale], { day: 'numeric', month: 'long' }).format(
    value,
  );
}
