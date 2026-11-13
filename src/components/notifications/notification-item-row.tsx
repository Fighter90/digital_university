'use client';

import { CalendarDays, FileText, GraduationCap, Info, Megaphone, Wallet } from 'lucide-react';
import type { NotificationType } from '@/server/data/types';
import { cn } from '@/lib/utils';
import { formatNotificationTime } from '@/lib/notification-view';

// DIG-35 — строка уведомления (экран и панель колокольчика).
// variant="full" — строка экрана: вся площадь кликабельна (кнопка-стретч),
// действие («Скачать», «Открыть расписание») — отдельная кнопка поверх.
// variant="compact" — строка панели: одна кнопка на всю строку.

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
};

const CATEGORY: Record<
  NotificationType,
  { icon: typeof CalendarDays; tint: string; label: string }
> = {
  SCHEDULE: { icon: CalendarDays, tint: 'bg-info-soft text-info-ink', label: 'Расписание' },
  GRADE: { icon: GraduationCap, tint: 'bg-success-soft text-success-ink', label: 'Оценки' },
  REQUEST: {
    icon: FileText,
    tint: 'bg-lesson-seminar-soft text-lesson-seminar-ink',
    label: 'Заявки',
  },
  NEWS: { icon: Megaphone, tint: 'bg-warning-soft text-warning-ink', label: 'Деканат' },
  SYSTEM: { icon: Info, tint: 'bg-warning-soft text-warning-ink', label: 'Системные' },
  DEADLINE: { icon: Wallet, tint: 'bg-error-soft text-error-ink', label: 'Финансы' },
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
}: NotificationItemRowProps) {
  const category = CATEGORY[type];
  const Icon = category.icon;
  const time = formatNotificationTime(createdAt, new Date());
  const compact = variant === 'compact';

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
      {!isRead && <span className="sr-only">Не прочитано</span>}
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
        {title}
      </span>
      {important && (
        <span className="shrink-0 rounded-pill bg-error-soft px-2 py-0.5 text-[11px] font-semibold text-error-ink">
          Важно
        </span>
      )}
    </span>
  );

  // ── compact: одна кнопка на всю строку (панель колокольчика) ──────────────
  if (compact) {
    return (
      <button
        type="button"
        data-testid={`notification-item-${itemId}`}
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
        aria-label={`Открыть: ${title}`}
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
