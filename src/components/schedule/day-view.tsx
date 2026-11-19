import { CalendarOff, ChevronLeft, ChevronRight } from 'lucide-react';

// DIG-23: DayView — десктопный вид «День» (Figma «04 · Расписание — день»).
// Заголовок дня со стрелками-соседями и кнопкой «Сегодня», список пар
// карточками EventCard; пустой день — иллюстрация и «Ближайшие пары: …».
// Серверный компонент: листание — ссылки (?view=day&date=…), без клиента.
// DIG-87 — строки интерфейса по локали (дефолт 'ru').
import type { ScheduleEventCard } from '@/lib/schedule-cards';
import { t, type Locale } from '@/lib/i18n';
import { EmptyState } from '@/components/ui/empty-state';
import { ListenDayButton } from '@/components/schedule/listen-day-button';
import { EventCard } from './event-card';

export interface NextStudyDayInfo {
  dateKey: string;
  /** «чт, 12 ноября» / «Thu, November 12». */
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
  /** DIG-24 — query-часть ссылки на детали (?view=…&date=…); без неё карточки не кликабельны. */
  eventQuery?: string;
  /** DIG-65 — «Озвучка и голосовой ввод» (настройка студента). */
  voiceEnabled?: boolean;
  /** DIG-87 — локаль интерфейса (cookie du-locale, дефолт ru). */
  locale?: Locale;
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
  voiceEnabled = true,
  eventQuery,
  locale = 'ru',
}: DayViewProps) {
  return (
    <div data-testid="desktop-day" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex items-center gap-2">
          {prevHref ? (
            <a
              href={prevHref}
              aria-label={t(locale, 'schedule.prevDayAria')}
              className={arrowClasses}
            >
              <ChevronLeft size={18} aria-hidden="true" />
            </a>
          ) : (
            <span
              aria-label={t(locale, 'schedule.prevDayAria')}
              aria-disabled="true"
              className={`${arrowClasses} cursor-not-allowed opacity-50`}
            >
              <ChevronLeft size={18} aria-hidden="true" />
            </span>
          )}
          {nextHref ? (
            <a
              href={nextHref}
              aria-label={t(locale, 'schedule.nextDayAria')}
              className={arrowClasses}
            >
              <ChevronRight size={18} aria-hidden="true" />
            </a>
          ) : (
            <span
              aria-label={t(locale, 'schedule.nextDayAria')}
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
                {t(locale, 'schedule.todayBadge')}
              </span>
            ) : null}
          </h2>
        </div>
        {/* DIG-65 — «Прослушать день»: озвучка выбранного дня (SpeechSynthesis);
            при выключенной настройке или без поддержки браузера кнопки нет. */}
        <div className="flex items-center gap-2">
          {!isToday ? (
            <a
              href={todayHref}
              className="rounded-button border border-border bg-card px-3 py-1.5 text-sm font-semibold shadow-soft transition-colors hover:bg-muted"
            >
              {t(locale, 'schedule.todayBtn')}
            </a>
          ) : null}
          <ListenDayButton
            title={title}
            isToday={isToday}
            events={events}
            enabled={voiceEnabled}
            locale={locale}
          />
        </div>
      </div>

      {events.length === 0 ? (
        <div data-testid="day-empty">
          <EmptyState
            icon={CalendarOff}
            illustration="no-classes"
            title={t(locale, 'schedule.day.empty.title')}
            description={
              nextStudy
                ? t(locale, 'schedule.day.empty.next', { label: nextStudy.label })
                : t(locale, 'schedule.day.empty.none')
            }
          />
        </div>
      ) : (
        <ol
          className="flex flex-col gap-2"
          aria-label={t(locale, 'schedule.day.listAria', { title })}
        >
          {events.map((event, index) => (
            <EventCard
              key={event.id}
              event={event}
              href={eventQuery ? `/schedule?${eventQuery}&event=${event.id}` : undefined}
              riseIndex={index}
              locale={locale}
            />
          ))}
        </ol>
      )}
    </div>
  );
}
