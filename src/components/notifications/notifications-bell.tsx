'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, Settings2 } from 'lucide-react';
import {
  NOTIFICATION_FEED_LIMIT,
  NOTIFICATIONS_POLL_MS,
  type NotificationFeedItem,
} from '@/lib/notification-view';
import { markNotificationReadAction } from '@/server/actions/notifications';
import { UnreadBadge } from './unread-badge';
import { NotificationItemRow } from './notification-item-row';

type NotificationsBellProps = {
  initialItems: NotificationFeedItem[];
  initialCount: number;
};

// DIG-35 — колокольчик в шапке с панелью последних 5 уведомлений.
// Клавиатура: колокольчик — нативная кнопка (Enter/Space), при открытии фокус
// уходит в панель, Tab циклит внутри панели, Esc закрывает и возвращает фокус;
// клик мимо панели закрывает её. Счётчик ведёт UnreadBadge (polling
// /api/notifications/count раз в 60 с, DIG-14); лента панели перечитывается
// из /api/notifications/recent (скоуп владельца сессии — на сервере).
export function NotificationsBell({ initialItems, initialCount }: NotificationsBellProps) {
  const [items, setItems] = useState(initialItems);
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const wasOpenRef = useRef(false);

  // Живая лента панели: последние 5 строк, раз в 60 секунд.
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const url = `/api/notifications/recent?limit=${NOTIFICATION_FEED_LIMIT}`;
        const res = await fetch(url, { cache: 'no-store' });
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

  // Esc закрывает, клик мимо закрывает, фокус: в панель при открытии и
  // обратно на колокольчик при закрытии.
  useEffect(() => {
    if (!open) {
      if (wasOpenRef.current) {
        wasOpenRef.current = false;
        buttonRef.current?.focus();
      }
      return;
    }
    wasOpenRef.current = true;
    panelRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  /** Простой фокус-ловушка: Tab/Shift+Tab циклят по интерактивам панели. */
  const trapFocus = (event: React.KeyboardEvent) => {
    if (event.key !== 'Tab') return;
    const focusables = panelRef.current?.querySelectorAll<HTMLElement>('button, a[href]');
    if (!focusables || focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (active === panelRef.current) {
      // Tab из контейнера панели: вперёд — в первый интерактив, назад — в последний.
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
      return;
    }
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  /** Клик по строке панели: отметка прочитанной + переход + закрытие. */
  const openItem = useCallback((item: NotificationFeedItem) => {
    setItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, isRead: true } : row)));
    setOpen(false);
    if (item.link) window.location.assign(item.link);
    void markNotificationReadAction(item.id).then((state) => {
      if (!state.ok) window.location.reload();
    });
  }, []);

  return (
    <div className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        data-testid="notifications-bell"
        aria-expanded={open}
        aria-controls="notifications-panel"
        aria-haspopup="dialog"
        aria-label="Уведомления"
        onClick={() => setOpen((value) => !value)}
        className="relative grid size-8 place-items-center rounded-full text-neutral-600 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral-600 md:size-9"
      >
        <Bell className="size-4" aria-hidden="true" />
        <UnreadBadge count={initialCount} />
      </button>

      {open && (
        <div
          ref={panelRef}
          id="notifications-panel"
          role="dialog"
          aria-modal="true"
          aria-label="Уведомления"
          tabIndex={-1}
          data-testid="notifications-panel"
          onKeyDown={trapFocus}
          className="absolute right-0 top-full z-50 mt-2 flex max-h-[80dvh] w-[340px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-card border border-neutral-200/80 bg-card shadow-hover focus:outline-none"
        >
          <div className="flex items-center justify-between gap-2 border-b border-neutral-100 px-4 py-3">
            <p className="text-sm font-bold text-neutral-900">Последние уведомления</p>
            <Link
              href="/notifications"
              data-testid="panel-all"
              className="shrink-0 rounded-button px-1.5 py-0.5 text-xs font-semibold text-accent-ink hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral-600"
            >
              Все уведомления
            </Link>
          </div>

          <div className="flex-1 overflow-y-auto p-1.5">
            {items.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-neutral-600">
                Новых уведомлений нет
              </p>
            ) : (
              <ul className="flex flex-col">
                {items.slice(0, NOTIFICATION_FEED_LIMIT).map((item) => (
                  <li key={item.id}>
                    <NotificationItemRow
                      variant="compact"
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
            )}
          </div>

          <div className="border-t border-neutral-100 px-4 py-2.5">
            <Link
              href="/settings"
              data-testid="panel-settings"
              className="inline-flex items-center gap-1.5 rounded-button px-1 py-0.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral-600"
            >
              <Settings2 className="size-3.5" aria-hidden="true" />
              Настроить уведомления
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
