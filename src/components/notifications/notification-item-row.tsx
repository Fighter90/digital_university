'use client';

import { MessageSquareText, CalendarDays, FileText, GraduationCap, Info, Megaphone, Wallet } from 'lucide-react';
import type { NotificationType } from '@/server/data/types';
import { cn } from '@/lib/utils';
import { t, type Locale } from '@/lib/i18n';
import { formatNotificationTime } from '@/lib/notification-view';
import { requestNumberLabel } from '@/lib/requests-view';

// DIG-35 — строка уведомления (экран и панель колокольчика).
// variant="full" — строка экрана: вся площадь кликабельна (кнопка-стретч),
// действие («Скачать», «Открыть расписание») — отдельная кнопка поверх.
// variant="compact" — строка панели: одна кнопка на всю строку.
// DIG-89 — метки категории/«Важно»/aria по локали.

type NotificationItemRowProps = {
  itemId: string;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  important: boolean;
  actionLabel: string | null;
  createdAt: string;
  variant?: 'full' | 'compact';
  onOpen: () => void;
  /** DIG-89 — локаль интерфейса (cookie du-locale, дефолт ru). */
  locale?: Locale;
};

const CATEGORY: Record<
  NotificationType,
  { icon: typeof CalendarDays; tint: string; labelKey: `notif.type.${NotificationType}` }
> = {
  SCHEDULE: { icon: CalendarDays, tint: 'bg-info-soft text-info-ink', labelKey: 'notif.type.SCHEDULE' },
  GRADE: { icon: GraduationCap, tint: 'bg-success-soft text-success-ink', labelKey: 'notif.type.GRADE' },
  REQUEST: {
    icon: FileText,
    tint: 'bg-lesson-seminar-soft text-lesson-seminar-ink',
    labelKey: 'notif.type.REQUEST',
  },
  NEWS: { icon: Megaphone, tint: 'bg-warning-soft text-warning-ink', labelKey: 'notif.type.NEWS' },
  TICKET: {
    icon: MessageSquareText,
    tint: 'bg-sky-100 text-sky-700',
    labelKey: 'notif.type.TICKET',
  },

  SYSTEM: { icon: Info, tint: 'bg-warning-soft text-warning-ink', labelKey: 'notif.type.SYSTEM' },
  DEADLINE: { icon: Wallet, tint: 'bg-error-soft text-error-ink', labelKey: 'notif.type.DEADLINE' },
};

export function NotificationItemRow({
  itemId,
  type,
  title,
  body,
  isRead,
  important,
  actionLabel,
  createdAt,
  variant = 'full',
  onOpen,
  locale = 'ru',
}: NotificationItemRowProps) {
  const category = CATEGORY[type];
  const Icon = category.icon;
  const time = formatNotificationTime(createdAt, new Date());
  const compact = variant === 'compact';
  // DIG-89 — EN: кириллические номера заявок в заголовке транслитерируются
  // («ЗД-2026-000123» → «ZD-2026-000123»); RU — заголовок без изменений.
  const displayTitle = requestNumberLabel(title, locale);

  const meta = (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 text-xs tabular-nums',
        isRead ? 'text-neutral-500' : 'font-medium text-neutral-700',
      )}
    >
      <time dateTime={createdAt}>{time}</time>
      {!isRead && (
        <span
          data-testid="unread-dot"
          aria-hidden="true"
          className="size-2 rounded-full bg-coral-500"
        />
      )}
      {!isRead && <span className="sr-only">{t(locale, 'notif.row.unread')}</span>}
    </span>
  );

  const iconBadge = (
    <span
      aria-hidden="true"
      className={cn('grid size-9 shrink-0 place-items-center rounded-button', category.tint)}
    >
      <Icon className="size-4.5" />
    </span>
  );

  const titleRow = (
    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
      <span
        className={cn(
          'truncate text-sm',
          isRead ? 'font-medium text-neutral-900' : 'font-bold text-neutral-900',
        )}
      >
        {displayTitle}
      </span>
      {important && (
        <span className="shrink-0 rounded-pill bg-error-soft px-2 py-0.5 text-[11px] font-semibold text-error-ink">
          {t(locale, 'notif.row.important')}
        </span>
      )}
    </span>
  );

  // ── compact: обёртка строки + одна кнопка на всю площадь (панель) ─────────
  if (compact) {
    return (
      <div data-testid={`notification-item-${itemId}`}>
        <button
          type="button"
          data-testid="notification-item"
          onClick={onOpen}
          className="flex w-full items-start gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-neutral-50 focus-visible:bg-neutral-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-coral-600"
        >
          {iconBadge}
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            {titleRow}
            <span className="truncate text-xs text-neutral-600">{body}</span>
          </span>
          {meta}
        </button>
      </div>
    );
  }

  // ── full: кнопка-стретч на всю площадь + действие поверх (экран) ──────────
  return (
    <div
      data-testid={`notification-item-${itemId}`}
      className="relative rounded-card border border-neutral-200/80 bg-card shadow-soft"
    >
      {/* Кнопка-стретч: клик по строке отмечает прочитанной и ведёт к объекту. */}
      <button
        type="button"
        onClick={onOpen}
        aria-label={t(locale, 'notif.row.openAria', { title: displayTitle })}
        className="absolute inset-0 z-0 rounded-card focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-coral-600"
      />
      <div
        data-testid="notification-item"
        className={cn(
          'pointer-events-none relative z-10 flex items-start gap-3 p-3 md:p-4',
          actionLabel && 'pb-1 md:pb-1',
        )}
      >
        {iconBadge}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-start justify-between gap-2">
            {titleRow}
            {meta}
          </div>
          <p className="truncate text-sm text-neutral-600">{body}</p>
        </div>
      </div>
      {actionLabel && (
        <div className="relative z-10 flex justify-end px-3 pb-3 md:px-4 md:pb-3">
          <button
            type="button"
            onClick={onOpen}
            className="pointer-events-auto rounded-button px-2 py-1 text-xs font-semibold text-accent-ink transition-colors hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral-600"
          >
            {actionLabel}
          </button>
        </div>
      )}
    </div>
  );
}
