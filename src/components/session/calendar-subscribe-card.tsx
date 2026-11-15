'use client';

import { useState } from 'react';
import { CalendarPlus, Check, Copy } from 'lucide-react';
import { cn } from 'cn';

// DIG-63 — карточка живой ICS-подписки (экран «Сессия», 1440 + 360 px):
// персональная подписанная ссылка, которую студент один раз добавляет в
// Google/Apple Calendar — дальше пары и дедлайны обновляются сами.
// Ссылка действует до выхода из кабинета: при выходе подписка отзывается
// (см. server/data/calendar.ts), при новом входе выдаётся новая.
export function CalendarSubscribeCard({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Клипборд недоступен (не https / нет разрешения): ссылка остаётся
      // в поле ввода — студент скопирует её вручную.
      setCopied(false);
    }
  };

  return (
    <div
      data-testid="calendar-subscribe"
      className="animate-rise rounded-card border border-border bg-card p-4 shadow-soft"
      style={{ '--du-rise-delay': '90ms' } as React.CSSProperties}
    >
      <p className="flex items-center gap-2 text-sm font-semibold">
        <CalendarPlus aria-hidden="true" className="size-4 text-accent-ink" />
        Подписка на календарь
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Добавьте ссылку в Google Calendar («Из URL») или Apple Calendar («Подписка на календарь») —
        расписание и дедлайны будут обновляться в вашем календаре автоматически.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          data-testid="calendar-subscribe-url"
          readOnly
          value={url}
          aria-label="Персональная ссылка подписки на календарь"
          onFocus={(event) => event.currentTarget.select()}
          className="w-full min-w-0 truncate rounded-pill border border-border bg-muted px-3 py-2 font-mono text-[11px] text-neutral-700"
        />
        <button
          type="button"
          data-testid="calendar-subscribe-copy"
          onClick={copy}
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-button border border-border bg-card px-3 py-2 text-sm font-semibold text-neutral-700 hover:bg-muted"
        >
          {copied ? (
            <>
              <Check aria-hidden="true" className="size-4" /> Скопировано
            </>
          ) : (
            <>
              <Copy aria-hidden="true" className="size-4" /> Скопировать
            </>
          )}
        </button>
      </div>
      <p role="status" aria-live="polite" className={cn('mt-2 text-[11px] text-muted-foreground')}>
        Ссылка персональная: действует до выхода из кабинета, при новом входе выдаётся новая.
      </p>
    </div>
  );
}
