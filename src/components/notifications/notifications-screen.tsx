'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Bell, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  NOTIFICATION_FILTERS,
  NOTIFICATIONS_POLL_MS,
  groupNotificationsByDay,
  matchNotificationFilter,
  type NotificationFeedItem,
  type NotificationFilter,
} from '@/lib/notification-view';
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from '@/server/actions/notifications';
import { NotificationItemRow } from './notification-item-row';

type NotificationsScreenProps = {
  initialItems: NotificationFeedItem[];
};

// DIG-35 — центр уведомлений (Figma «08 · Уведомления»): фильтры, группировка
// по дням, строки с конкретикой, «Отметить все прочитанными», пустые состояния.
// Лента перечитывается раз в 60 секунд (polling recent-эндпоинта, скоуп
// владельца сессии — на сервере), отметки идут через server actions.
export function NotificationsScreen({ initialItems }: NotificationsScreenProps) {
  const [items, setItems] = useState(initialItems);
  const [filter, setFilter] = useState<NotificationFilter>('ALL');

  // Живая лента: раз в 60 секунд перечитываем свой список (без перезагрузки).
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch('/api/notifications/recent?limit=50', { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as { items?: unknown };
        if (alive && Array.isArray(data.items)) setItems(data.items as NotificationFeedItem[]);
      } catch {
        // Сеть недоступна — повторим на следующем интервале.
      }
    };
    const interval = setInterval(tick, NOTIFICATIONS_POLL_MS);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, []);

  const unreadCount = useMemo(() => items.filter((i) => !i.isRead).length, [items]);
  const filtered = useMemo(
    () => items.filter((item) => matchNotificationFilter(item, filter)),
    [items, filter],
  );
  const groups = useMemo(() => groupNotificationsByDay(filtered, new Date()), [filtered]);

  /** Клик по строке (или её действию): отметка + переход к объекту. */
  const openItem = useCallback((item: NotificationFeedItem) => {
    setItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, isRead: true } : row)));
    if (item.link) window.location.assign(item.link);
    void markNotificationReadAction(item.id).then((state) => {
      // Отметка не применилась (чужой/несуществующий id) — вернём правду.
      if (!state.ok) window.location.reload();
    });
  }, []);

  const markAll = useCallback(() => {
    setItems((prev) => prev.map((row) => ({ ...row, isRead: true })));
    void markAllNotificationsReadAction();
    // Синхронизируем серверные части (счётчик в шапке, бейдж в меню) сразу.
    window.location.reload();
  }, []);

  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold sm:text-2xl">Уведомления</h1>
          <p className="mt-1 text-sm text-neutral-600">
            События кабинета: пары, заявки, деканат и оплаты. Видны только ваши.
          </p>
        </div>
        <Link
          href="/settings"
          data-testid="notification-settings-link"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-button px-2 py-1 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral-600"
        >
          <Settings2 className="size-4" aria-hidden="true" />
          Настроить уведомления
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div
          role="group"
          aria-label="Фильтры уведомлений"
          className="-mx-4 flex min-w-0 gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0"
        >
          {NOTIFICATION_FILTERS.map((option) => {
            const selected = option.value === filter;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={selected}
                onClick={() => setFilter(option.value)}
                className={cn(
                  'shrink-0 rounded-pill px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral-600',
                  selected
                    ? 'bg-foreground text-background'
                    : 'border border-neutral-200 bg-card text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900',
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          data-testid="mark-all-read"
          onClick={markAll}
          disabled={unreadCount === 0}
          className="shrink-0 rounded-button px-3 py-1.5 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral-600 disabled:cursor-not-allowed disabled:text-neutral-400 disabled:hover:bg-transparent"
        >
          Отметить все прочитанными
        </button>
      </div>

      {items.length === 0 ? (
        <div
          data-testid="notifications-empty"
          className="flex flex-col items-center gap-3 rounded-block border border-dashed border-neutral-300 bg-card px-6 py-14 text-center"
        >
          {/* Иллюстрация колокольчика (вымышленная, без внешних ассетов). */}
          <span
            aria-hidden="true"
            className="grid size-20 place-items-center rounded-full bg-coral-50 ring-8 ring-coral-50/60"
          >
            <Bell className="size-9 text-coral-400" strokeWidth={1.5} />
          </span>
          <p className="text-sm font-bold text-neutral-900">Новых уведомлений нет</p>
          <p className="max-w-xs text-sm text-neutral-600">
            Здесь появятся события: перенос пар, статусы заявок, оценки и дедлайны оплат.
          </p>
        </div>
      ) : groups.length === 0 ? (
        <div
          data-testid="notifications-filter-empty"
          className="rounded-card border border-dashed border-neutral-300 px-6 py-10 text-center text-sm text-neutral-600"
        >
          Здесь пока пусто
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.key} aria-label={group.label} className="flex flex-col gap-2">
            <h2 className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">
              {group.label}
            </h2>
            <ul className="flex flex-col gap-2">
              {group.items.map((item) => (
                <li key={item.id}>
                  <NotificationItemRow
                    itemId={item.id}
                    type={item.type}
                    title={item.title}
                    body={item.body}
                    isRead={item.isRead}
                    important={item.important}
                    actionLabel={item.actionLabel}
                    createdAt={item.createdAt}
                    onOpen={() => openItem(item)}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </section>
  );
}
