// DIG-35 — чистая логика центра уведомлений: категории-фильтры, группировка
// по дням, формат времени и сериализация строки ленты. Модуль без React и без
// серверных импортов (кроме type-only из слоя данных): одна и та же функция
// работает на экране /notifications, в панели колокольчика и в юнит-тестах.
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

/** Фильтры из задачи: Все, Непрочитанные, Учёба, Заявки, Деканат, Финансы. */
export const NOTIFICATION_FILTERS: readonly NotificationFilterOption[] = [
  { value: 'ALL', label: 'Все' },
  { value: 'UNREAD', label: 'Непрочитанные' },
  { value: 'STUDY', label: 'Учёба' },
  { value: 'REQUESTS', label: 'Заявки' },
  { value: 'DEANERY', label: 'Деканат' },
  { value: 'FINANCE', label: 'Финансы' },
];

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

const startOfDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Локальный календарный день: 0 — сегодня, 1 — вчера, больше — ранее. */
function dayDiff(from: Date, to: Date): number {
  const diff = startOfDay(from).getTime() - startOfDay(to).getTime();
  return Math.round(diff / 86_400_000);
}

/**
 * Группировка «Сегодня / Вчера / Ранее» по локальному календарю. Пустые
 * группы не попадают в результат; внутри группы строки идут от новых к старым.
 */
export function groupNotificationsByDay(
  items: NotificationFeedItem[],
  now: Date,
): NotificationDayGroup[] {
  const buckets: Record<'today' | 'yesterday' | 'earlier', NotificationFeedItem[]> = {
    today: [],
    yesterday: [],
    earlier: [],
  };
  for (const item of items) {
    const created = new Date(item.createdAt);
    const diff = dayDiff(created, now);
    if (diff <= 0) buckets.today.push(item);
    else if (diff === 1) buckets.yesterday.push(item);
    else buckets.earlier.push(item);
  }
  const byNewestFirst = (a: NotificationFeedItem, b: NotificationFeedItem) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  const groups: NotificationDayGroup[] = [
    { key: 'today', label: 'Сегодня', items: buckets.today.sort(byNewestFirst) },
    { key: 'yesterday', label: 'Вчера', items: buckets.yesterday.sort(byNewestFirst) },
    { key: 'earlier', label: 'Ранее', items: buckets.earlier.sort(byNewestFirst) },
  ];
  return groups.filter((g) => g.items.length > 0);
}

/** Время строки: сегодня и вчера — HH:MM, ранее — DD.MM. */
export function formatNotificationTime(createdAt: string | Date, now: Date): string {
  const created = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
  const hhmm = `${String(created.getHours()).padStart(2, '0')}:${String(created.getMinutes()).padStart(2, '0')}`;
  if (dayDiff(created, now) <= 1) return hhmm;
  const dd = String(created.getDate()).padStart(2, '0');
  const mm = String(created.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}`;
}
