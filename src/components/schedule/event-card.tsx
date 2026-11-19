import Link from 'next/link';

import { cn } from '@/lib/utils';
import { personHrefByFullName } from '@/lib/people-catalog';

// DIG-23: EventCard — общая карточка пары (Figma «04 · Расписание — день»).
// Время слева (начало жирным, «до конец» мелкой строкой), цветная полоса
// типа занятия, название, аудитория/онлайн, преподаватель и ЗАМЕТНЫЕ бейджи
// переноса (штриховка + warning) или отмены (зачёркнутое название + error).
// Одна и та же карточка работает на десктопе и на мобильном (критерий
// приёмки: перенос и отмена видны одинаково) и в компактном списке недели.
//
// DIG-24: с пропсом href вся карточка — нативная ссылка на панель деталей
// (?event=<id>; обычный <a>, не next/link — soft-навигация между вариантами
// страницы расписания ненадёжна, см. ViewSwitcher). data-event-id — цель
// возврата фокуса при закрытии панели. Без href карточка остаётся строкой
// списка (обратная совместимость рендеров без контекста панели).
import { LESSON_KIND_META } from '@/lib/schedule-cards';
import type { ScheduleEventCard } from '@/lib/schedule-cards';
import { t, type Locale } from '@/lib/i18n';
import { riseDelayStyle } from '@/lib/motion';
import { enDisciplineName, enPersonName, enScheduleNote } from '@/lib/en-demo-content';
import { Badge } from '@/components/ui/badge';
import { EventTypePill } from './event-type-pill';

export interface EventCardProps {
  event: ScheduleEventCard;
  /** Компактный режим (мобильный список недели): меньше отступы, без учителя. */
  compact?: boolean;
  /** Ссылка на панель деталей пары (?event=<id>); без пропса карточка — <li>. */
  href?: string;
  /**
   * DIG-71 — индекс в списке для каскадного появления (animate-rise +
   * --du-rise-delay через riseDelayStyle). Без пропса анимации нет.
   */
  riseIndex?: number;
  /** DIG-87 — локаль интерфейса (cookie du-locale, дефолт ru). */
  locale?: Locale;
}

export function EventCard({
  event,
  compact = false,
  href,
  riseIndex,
  locale = 'ru',
}: EventCardProps) {
  const meta = LESSON_KIND_META[event.kind];
  /** DIG-37: имя преподавателя — ссылка на карточку в справочнике
   *  (href — по каноническому RU-ФИО сида; подпись — по локали, DIG-93). */
  const teacherHref = personHrefByFullName(event.teacher);
  // DIG-93 — демо-контент по локали (дисциплина, преподаватель, заметки);
  // фильтр недели сравнивает канонические имена — модели не трогаем.
  const discipline = locale === 'en' ? enDisciplineName(event.discipline) : event.discipline;
  const teacher = locale === 'en' ? enPersonName(event.teacher) : event.teacher;
  const note = locale === 'en' ? enScheduleNote(event.note) : event.note;
  const riseStyle = riseIndex === undefined ? undefined : riseDelayStyle(riseIndex);
  const card = (
    <>
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
        <span className="text-[11px] leading-tight text-neutral-500">
          {t(locale, 'schedule.untilPrefix')} {event.endLabel}
        </span>
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span
            className={cn(
              'text-sm font-bold text-neutral-900',
              event.isCancelled && 'line-through decoration-2',
            )}
          >
            {discipline}
          </span>
          <EventTypePill kind={event.kind} locale={locale} />
        </div>
        {compact ? (
          <p className="truncate text-xs text-neutral-600">{event.roomLabel}</p>
        ) : (
          <p className="text-xs text-neutral-600">
            {event.roomLabel} ·{' '}
            {teacherHref ? (
              <Link
                href={teacherHref}
                data-testid={`event-teacher-${event.id}`}
                className="font-medium underline decoration-neutral-300 underline-offset-2 hover:text-coral-600 hover:decoration-coral-400"
              >
                {teacher}
              </Link>
            ) : (
              teacher
            )}
          </p>
        )}
        {event.isMoved || event.isCancelled ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {event.isMoved ? (
              <Badge status="warning">{t(locale, 'schedule.badge.moved')}</Badge>
            ) : null}
            {event.isCancelled ? (
              <Badge status="error">{t(locale, 'schedule.badge.cancelled')}</Badge>
            ) : null}
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
        {event.isCancelled && note ? (
          <p className="text-xs font-medium text-error-ink">{note}</p>
        ) : null}
        {event.isMoved && (locale === 'en' ? enScheduleNote(event.changeNote) : event.changeNote) ? (
          <p className="text-xs font-medium text-warning-ink">
            {locale === 'en' ? enScheduleNote(event.changeNote) : event.changeNote}
          </p>
        ) : null}
        {!event.isMoved && !event.isCancelled && note ? (
          <p className="text-xs text-neutral-500">{note}</p>
        ) : null}
      </div>
    </>
  );
  const cardClasses = cn(
    'relative flex gap-3 overflow-hidden rounded-card border border-border bg-card p-3.5 shadow-soft',
    event.isMoved && 'hatch-rescheduled border-warning',
    event.isCancelled && 'opacity-70',
    compact && 'p-2.5',
    href && 'lift-hover press-scale focus-visible:outline-accent',
    riseIndex !== undefined && 'animate-rise',
  );
  if (href) {
    return (
      <li>
        <a
          href={href}
          data-testid={`day-card-${event.id}`}
          data-event-id={event.id}
          data-status={event.status}
          data-compact={compact ? 'true' : undefined}
          aria-label={event.ariaLabel}
          className={cn(cardClasses, 'block')}
          style={riseStyle}
        >
          {card}
        </a>
      </li>
    );
  }
  return (
    <li
      data-testid={`day-card-${event.id}`}
      data-status={event.status}
      data-compact={compact ? 'true' : undefined}
      aria-label={event.ariaLabel}
      className={cardClasses}
      style={riseStyle}
    >
      {card}
    </li>
  );
}
