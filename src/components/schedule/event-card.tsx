import { cn } from 'cn';

// DIG-23: EventCard — общая карточка пары (Figma «04 · Расписание — день»).
// Время слева (начало жирным, «до конец» мелкой строкой), цветная полоса
// типа занятия, название, аудитория/онлайн, преподаватель и ЗАМЕТНЫЕ бейджи
// переноса (штриховка + warning) или отмены (зачёркнутое название + error).
// Одна и та же карточка работает на десктопе и на мобильном (критерий
// приёмки: перенос и отмена видны одинаково) и в компактном списке недели.
import { LESSON_KIND_META } from '@/lib/schedule-cards';
import type { ScheduleEventCard } from '@/lib/schedule-cards';
import { Badge } from '@/components/ui/badge';
import { EventTypePill } from './event-type-pill';

export interface EventCardProps {
  event: ScheduleEventCard;
  /** Компактный режим (мобильный список недели): меньше отступы, без учителя. */
  compact?: boolean;
}

export function EventCard({ event, compact = false }: EventCardProps) {
  const meta = LESSON_KIND_META[event.kind];
  return (
    <li
      data-testid={`day-card-${event.id}`}
      data-status={event.status}
      data-compact={compact ? 'true' : undefined}
      aria-label={event.ariaLabel}
      className={cn(
        'relative flex gap-3 overflow-hidden rounded-card border border-border bg-card p-3.5 shadow-soft',
        event.isMoved && 'hatch-rescheduled border-warning',
        event.isCancelled && 'opacity-70',
        compact && 'p-2.5',
      )}
    >
      {/* цветная полоса типа занятия */}
      <span
        aria-hidden="true"
        className={cn(
          'absolute inset-y-0 left-0 w-1',
          meta.stripe,
          event.isCancelled && 'opacity-40',
        )}
      />
      {/* время слева */}
      <span className="flex w-14 shrink-0 flex-col pt-0.5 font-mono">
        <span className="text-sm font-bold text-neutral-900">{event.startLabel}</span>
        <span className="text-[11px] leading-tight text-neutral-500">до {event.endLabel}</span>
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span
            className={cn(
              'text-sm font-bold text-neutral-900',
              event.isCancelled && 'line-through decoration-2',
            )}
          >
            {event.discipline}
          </span>
          <EventTypePill kind={event.kind} />
        </div>
        <p className={cn('text-xs text-neutral-600', compact && 'truncate')}>
          {compact ? event.roomLabel : `${event.roomLabel} · ${event.teacher}`}
        </p>
        {event.isMoved || event.isCancelled ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {event.isMoved ? <Badge status="warning">Перенос</Badge> : null}
            {event.isCancelled ? <Badge status="error">Отмена</Badge> : null}
            {event.isMoved && event.previousRoomLabel ? (
              <span className="text-xs font-semibold text-warning-ink">
                {event.previousRoomLabel}
              </span>
            ) : null}
            {event.isMoved && event.previousTimeLabel ? (
              <span className="text-xs font-semibold text-warning-ink">
                {event.previousTimeLabel}
              </span>
            ) : null}
          </div>
        ) : null}
        {event.isCancelled && event.note ? (
          <p className="text-xs font-medium text-error-ink">{event.note}</p>
        ) : null}
        {event.isMoved && event.changeNote ? (
          <p className="text-xs font-medium text-warning-ink">{event.changeNote}</p>
        ) : null}
        {!event.isMoved && !event.isCancelled && event.note ? (
          <p className="text-xs text-neutral-500">{event.note}</p>
        ) : null}
      </div>
    </li>
  );
}
