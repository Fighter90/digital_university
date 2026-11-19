// DIG-35 — чистая логика центра уведомлений: категории-фильтры, группировка
// по дням, формат времени и сериализация строки ленты. Модуль без React и без
// серверных импортов (кроме type-only из слоя данных): одна и та же функция
// работает на экране /notifications, в панели колокольчика и в юнит-тестах.
// DIG-79 (BUG-02/12): HH:MM и календарные дни считаются в явной зоне
// Europe/Moscow — SSR и гидрация рендерят одинаковые строки (React #418).
import { moscowParts } from '@/lib/schedule-time';
import { t, type Locale } from '@/lib/i18n';
import type { NotificationRow, NotificationType } from '@/server/data/types';

/** Панель колокольчика показывает последние 5 уведомлений (задача DIG-35). */
export const NOTIFICATION_FEED_LIMIT = 5;

/** Период опроса ленты: критерий приёмки — обновление без перезагрузки. */
export const NOTIFICATIONS_POLL_MS = 60_000;

export type NotificationFilter = 'ALL' | 'UNREAD' | 'STUDY' | 'REQUESTS' | 'DEANERY' | 'FINANCE';

export interface NotificationFilterOption {
  value: NotificationFilter;
  label: string;
}

/**
 * Фильтры из задачи: Все, Непрочитанные, Учёба, Заявки, Деканат, Финансы.
 * DIG-89 — RU-подписи берутся из словаря (ключи notif.filter.*, значения
 * байт-в-байт равны прежним литералам).
 */
const FILTER_VALUES = ['ALL', 'UNREAD', 'STUDY', 'REQUESTS', 'DEANERY', 'FINANCE'] as const;

export const NOTIFICATION_FILTERS: readonly NotificationFilterOption[] = FILTER_VALUES.map(
  (value) => ({ value, label: t('ru', `notif.filter.${value}`) }),
);

// DIG-89 — EN-подписи фильтров и групп «Сегодня / Вчера / Ранее».

/** EN-набор фильтров (тесты и клиентский рендер). */
export const NOTIFICATION_FILTERS_EN: readonly NotificationFilterOption[] = [
  { value: 'ALL', label: 'All' },
  { value: 'UNREAD', label: 'Unread' },
  { value: 'STUDY', label: 'Studies' },
  { value: 'REQUESTS', label: 'Requests' },
  { value: 'DEANERY', label: 'Deanery' },
  { value: 'FINANCE', label: 'Finance' },
];

/** Фильтры по локали: RU — канон, EN — словарь. */
export function notificationFilters(locale: Locale = 'ru'): readonly NotificationFilterOption[] {
  return locale === 'en' ? NOTIFICATION_FILTERS_EN : NOTIFICATION_FILTERS;
}

/** Подпись одного фильтра: «Непрочитанные» / «Unread». */
export function notificationFilterLabel(value: NotificationFilter, locale: Locale = 'ru'): string {
  return locale === 'en'
    ? NOTIFICATION_FILTERS_EN.find((f) => f.value === value)!.label
    : NOTIFICATION_FILTERS.find((f) => f.value === value)!.label;
}

/**
 * Строка ленты на клиенте: даты сериализованы в ISO (RSC-пропсы и JSON
 * recent-эндпоинта имеют один и тот же вид).
 */
export interface NotificationFeedItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  /** «Важно» — только срочное (перенос/отмена сегодня, недопуск, доработка заявки, дедлайн оплаты). */
  important: boolean;
  /** Подпись действия строки («Скачать», «Открыть расписание»); ведёт на link. */
  actionLabel: string | null;
  /** Куда ведёт строка (объект уведомления); null — просто отметка прочитанной. */
  link: string | null;
  createdAt: string;
}

export function toNotificationFeedItem(row: NotificationRow): NotificationFeedItem {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    isRead: row.isRead,
    important: row.important ?? false,
    actionLabel: row.actionLabel ?? null,
    link: row.link ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Типы → категория: Учёба = SCHEDULE+GRADE, Заявки = REQUEST, Деканат = NEWS+SYSTEM, Финансы = DEADLINE. */
export function matchNotificationFilter(
  item: Pick<NotificationFeedItem, 'type' | 'isRead'>,
  filter: NotificationFilter,
): boolean {
  switch (filter) {
    case 'UNREAD':
      return !item.isRead;
    case 'STUDY':
      return item.type === 'SCHEDULE' || item.type === 'GRADE';
    case 'REQUESTS':
      return item.type === 'REQUEST';
    case 'DEANERY':
      return item.type === 'NEWS' || item.type === 'SYSTEM';
    case 'FINANCE':
      return item.type === 'DEADLINE';
    case 'ALL':
      return true;
  }
}

export interface NotificationDayGroup {
  key: 'today' | 'yesterday' | 'earlier';
  label: string;
  items: NotificationFeedItem[];
}

/** Номер московского календарного дня («дней от эпохи») — для разницы дней. */
function moscowDayNumber(date: Date): number {
  const p = moscowParts(date);
  return Math.round(Date.UTC(p.year, p.month - 1, p.day) / 86_400_000);
}

/** Сколько КАЛЕНДАРНЫХ дней прошло с `from` до `to` по Москве (может быть 0 и отрицательным). */
function calendarDaysBetween(from: Date, to: Date): number {
  return moscowDayNumber(to) - moscowDayNumber(from);
}

/**
 * Группировка «Сегодня / Вчера / Ранее» по локальному календарю. Пустые
 * группы не попадают в результат; внутри группы строки идут от новых к старым.
 * DIG-89: подписи групп по локали (RU — канон байт-в-байт).
 */
export function groupNotificationsByDay(
  items: NotificationFeedItem[],
  now: Date,
  locale: Locale = 'ru',
): NotificationDayGroup[] {
  const dayLabel = (key: 'today' | 'yesterday' | 'earlier'): string =>
    t(locale, `notif.group.${key}` as const);
  const buckets: Record<'today' | 'yesterday' | 'earlier', NotificationFeedItem[]> = {
    today: [],
    yesterday: [],
    earlier: [],
  };
  for (const item of items) {
    const created = new Date(item.createdAt);
    const daysAgo = calendarDaysBetween(created, now);
    // Будущие даты (смещённые часы сервера) показываем как «сегодня».
    if (daysAgo <= 0) buckets.today.push(item);
    else if (daysAgo === 1) buckets.yesterday.push(item);
    else buckets.earlier.push(item);
  }
  const byNewestFirst = (a: NotificationFeedItem, b: NotificationFeedItem) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  const groups: NotificationDayGroup[] = [
    { key: 'today', label: dayLabel('today'), items: buckets.today.sort(byNewestFirst) },
    { key: 'yesterday', label: dayLabel('yesterday'), items: buckets.yesterday.sort(byNewestFirst) },
    { key: 'earlier', label: dayLabel('earlier'), items: buckets.earlier.sort(byNewestFirst) },
  ];
  return groups.filter((g) => g.items.length > 0);
}

/** Время строки: сегодня и вчера — HH:MM, ранее — DD.MM (обе метки — по Москве). */
export function formatNotificationTime(createdAt: string | Date, now: Date): string {
  const created = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
  const p = moscowParts(created);
  const hhmm = `${pad2(p.hour)}:${pad2(p.minute)}`;
  if (calendarDaysBetween(created, now) <= 1) return hhmm;
  return `${pad2(p.day)}.${pad2(p.month)}`;
}

const pad2 = (n: number): string => String(n).padStart(2, '0');
