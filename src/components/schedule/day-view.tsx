import { CalendarOff, ChevronLeft, ChevronRight } from 'lucide-react';

// DIG-23: DayView — десктопный вид «День» (Figma «04 · Расписание — день»).
// Заголовок дня со стрелками-соседями и кнопкой «Сегодня», список пар
// карточками EventCard; пустой день — иллюстрация и «Ближайшие пары: …».
// Серверный компонент: листание — ссылки (?view=day&date=…), без клиента.
import type { ScheduleEventCard } from '@/lib/schedule-cards';
import { EmptyState } from '@/components/ui/empty-state';
import { EventCard } from './event-card';

export interface NextStudyDayInfo {
  dateKey: string;
  /** «чт, 12 ноября». */
  label: string;
}

export interface DayViewProps {
  title: string;
  isToday: boolean;
  events: ScheduleEventCard[];
  prevHref: string | null;
  nextHref: string | null;
  todayHref: string;
  nextStudy: NextStudyDayInfo | null;
}

const arrowClasses =
  'inline-flex size-9 items-center justify-center rounded-button border border-border bg-card text-foreground shadow-soft transition-colors hover:bg-muted';

export function DayView({
  title,
  isToday,
  events,
  prevHref,
  nextHref,
  todayHref,
  nextStudy,
}: DayViewProps) {
  return (
    <div data-testid="desktop-day" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex items-center gap-2">
          {prevHref ? (
            <a href={prevHref} aria-label="Предыдущий день" className={arrowClasses}>
              <ChevronLeft size={18} aria-hidden="true" />
            </a>
          ) : (
            <span
              aria-label="Предыдущий день"
              aria-disabled="true"
              className={`${arrowClasses} cursor-not-allowed opacity-50`}
            >
              <ChevronLeft size={18} aria-hidden="true" />
            </span>
          )}
          {nextHref ? (
            <a href={nextHref} aria-label="Следующий день" className={arrowClasses}>
              <ChevronRight size={18} aria-hidden="true" />
            </a>
          ) : (
            <span
              aria-label="Следующий день"
              aria-disabled="true"
              className={`${arrowClasses} cursor-not-allowed opacity-50`}
            >
              <ChevronRight size={18} aria-hidden="true" />
            </span>
          )}
          <h2
            data-testid="day-title"
            className="ml-1 text-lg font-bold tracking-heading sm:text-xl"
          >
            {title}
            {isToday ? (
              <span className="ml-2 rounded-pill bg-accent-soft px-2 py-0.5 align-middle text-xs font-semibold text-accent-ink">
                сегодня
              </span>
            ) : null}
          </h2>
        </div>
        {!isToday ? (
          <a
            href={todayHref}
            className="rounded-button border border-border bg-card px-3 py-1.5 text-sm font-semibold shadow-soft transition-colors hover:bg-muted"
          >
            Сегодня
          </a>
        ) : null}
      </div>

      {events.length === 0 ? (
        <div data-testid="day-empty">
          <EmptyState
            icon={CalendarOff}
            title="Пар в этот день нет"
            description={
              nextStudy ? `Ближайшие пары: ${nextStudy.label}` : 'В семестре пар больше нет'
            }
          />
        </div>
      ) : (
        <ol className="flex flex-col gap-2" aria-label={`Пары, ${title}`}>
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </ol>
      )}
    </div>
  );
}
