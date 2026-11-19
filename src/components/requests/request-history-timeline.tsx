// DIG-33 — история заявки как вертикальный таймлайн (Figma «06 ·
// Заявки — карточка»): линия, точка события, автор, переход/статус,
// комментарий и время. Все метки времени — единый форматтер
// formatRequestDate (Europe/Moscow + «МСК») — приёмка «время везде
// одинаковое и в поясе пользователя». Серверный компонент: действий
// внутри нет, клиентский JS не нужен.
import { formatRequestDate } from '@/lib/request-labels';
import { timelineEventText, type RequestTimelineEvent } from '@/lib/request-card-view';
import type { Locale } from '@/lib/i18n';

function dotClass(role: RequestTimelineEvent['actorRole']): string {
  if (role === 'STAFF') return 'border-coral-600 bg-coral-100';
  if (role === 'STUDENT') return 'border-accent bg-accent-soft';
  return 'border-border bg-muted'; // автоматика (создание мгновенной заявки)
}

export function RequestHistoryTimeline({
  events,
  locale = 'ru',
}: {
  events: readonly RequestTimelineEvent[];
  /** DIG-84 — локаль интерфейса (cookie du-locale, дефолт ru). */
  locale?: Locale;
}) {
  return (
    <ol
      data-testid="request-history"
      className="relative ml-3 flex flex-col gap-5 border-l border-border pl-0"
    >
      {events.map((event) => (
        <li key={event.id} data-testid="request-history-item" className="relative pl-6">
          <span
            aria-hidden="true"
            className={`absolute -left-[7px] top-1.5 size-3.5 rounded-full border-2 ${dotClass(event.actorRole)}`}
          />
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <span className="text-sm font-medium text-foreground">{event.actorName}</span>
            <span data-testid="request-timestamp" className="text-xs text-muted-foreground">
              {formatRequestDate(event.createdAt, locale)}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {timelineEventText(event, locale)}
            {event.comment ? ` — ${event.comment}` : ''}
          </p>
        </li>
      ))}
    </ol>
  );
}
