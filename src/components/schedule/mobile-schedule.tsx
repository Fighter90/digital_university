'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarOff } from 'lucide-react';
import { cn } from 'cn';

// DIG-23: MobileSchedule — вид расписания < 768 px (Figma M3 «Расписание»).
//
// Вид «день»: сверху горизонтальная лента дат недели (скроллится сама,
// страница горизонтально не скроллится), под ней карточки выбранного дня;
// по умолчанию — сегодня. Свайп влево/вправо по списку листает дни.
// Вид «неделя» (переключатель «Неделя» на мобильном): компактный список
// по дням — заголовок дня, счётчик пар и плотные карточки; перенос и отмена
// видны теми же бейджами, что и на десктопе.
//
// Данные (5 недель вокруг выбранного дня) приходят с сервера — свайп и
// выбор дня не ходят в сеть. Лента автоскроллится к выбранному дню внутри
// СВОЕГО контейнера (scrollTo по offsetLeft), не трогая страницу.

import {
  formatDayTitleFromKey,
  pairsLabel,
  ribbonWeekDays,
  swipeDirection,
  type ScheduleEventCard,
} from '@/lib/schedule-cards';
import { EmptyState } from '@/components/ui/empty-state';
import { EventCard } from './event-card';

export interface MobileDayView {
  dateKey: string;
  weekdayShort: string;
  dayNumber: number;
  /** «чт, 12 ноября» — подпись для компактного списка и пустых дней. */
  listLabel: string;
  isToday: boolean;
  events: ScheduleEventCard[];
}

export interface MobileScheduleProps {
  mode: 'day' | 'week';
  days: MobileDayView[];
  /** Выбранный день при загрузке (сегодня или ?date=…). */
  initialDateKey: string;
  /** Ближайший учебный день за пределами окна (для пустых дней). */
  nextStudy: { dateKey: string; label: string } | null;
}

const SWIPE_THRESHOLD = 48;

export function MobileSchedule({ mode, days, initialDateKey, nextStudy }: MobileScheduleProps) {
  const [selectedKey, setSelectedKey] = useState(initialDateKey);
  const ribbonRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Маркер гидрации: свайп и клики ленты живут на обработчиках, которые
  // появляются только после гидрации — e2e ждут data-hydrated="true",
  // чтобы жест по SSR-разметке не был проглочен (урок DIG-50).
  useEffect(() => {
    rootRef.current?.setAttribute('data-hydrated', 'true');
  }, []);

  const selectedIndex = useMemo(() => {
    const index = days.findIndex((day) => day.dateKey === selectedKey);
    if (index !== -1) return index;
    return Math.max(
      days.findIndex((day) => day.isToday),
      0,
    );
  }, [days, selectedKey]);
  const selected = days[Math.max(0, selectedIndex)] ?? days[0];

  // Лента показывает неделю выбранного дня и автоскроллится к нему.
  const weekKeys = useMemo(
    () =>
      ribbonWeekDays(
        days.map((day) => day.dateKey),
        selectedKey,
      ),
    [days, selectedKey],
  );
  const weekDays = weekKeys
    .map((key) => days.find((day) => day.dateKey === key))
    .filter((day): day is MobileDayView => Boolean(day));

  useEffect(() => {
    const ribbon = ribbonRef.current;
    if (!ribbon || typeof ribbon.scrollTo !== 'function') return;
    const active = ribbon.querySelector<HTMLElement>('[data-selected="true"]');
    if (!active) return;
    ribbon.scrollTo({
      left: active.offsetLeft - ribbon.clientWidth / 2 + active.offsetWidth / 2,
      behavior: 'smooth',
    });
  }, [selectedKey]);

  // Свайп по списку пар листает дни; у краёв окна — кламп.
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const shiftDay = (delta: number) => {
    const nextIndex = Math.min(Math.max(selectedIndex + delta, 0), days.length - 1);
    setSelectedKey(days[nextIndex]!.dateKey);
  };

  if (!selected) return null;

  if (mode === 'week') {
    return <WeekList days={weekDays.length > 0 ? weekDays : days.slice(0, 7)} />;
  }

  return (
    <div
      ref={rootRef}
      data-testid="mobile-schedule"
      data-hydrated="false"
      className="flex flex-col gap-3"
    >
      {/* Лента дат недели: скроллится сама, страницу не двигает */}
      <div
        ref={ribbonRef}
        data-testid="date-ribbon"
        className="-mx-3 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="flex w-max gap-1.5">
          {weekDays.map((day) => {
            const isSelected = day.dateKey === selectedKey;
            return (
              <button
                key={day.dateKey}
                type="button"
                data-testid={`ribbon-item-${day.dateKey}`}
                data-selected={isSelected ? 'true' : undefined}
                onClick={() => setSelectedKey(day.dateKey)}
                aria-current={isSelected ? 'date' : undefined}
                className={cn(
                  'flex min-w-12 flex-col items-center gap-0.5 rounded-card border px-2 py-1.5 transition-colors',
                  isSelected
                    ? 'border-accent bg-accent text-white shadow-soft'
                    : 'border-border bg-card text-foreground',
                  day.isToday && !isSelected && 'border-accent-soft bg-accent-soft text-accent-ink',
                )}
              >
                <span className="text-[11px] font-semibold uppercase">{day.weekdayShort}</span>
                <span className="text-base font-bold leading-none">{day.dayNumber}</span>
                <span
                  aria-hidden="true"
                  className={cn(
                    'size-1 rounded-pill',
                    day.events.length > 0
                      ? isSelected
                        ? 'bg-white'
                        : 'bg-accent'
                      : 'bg-transparent',
                  )}
                />
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-baseline justify-between gap-2">
        <h2 data-testid="mobile-day-title" className="text-base font-bold tracking-heading">
          {formatDayTitleFromKey(selected.dateKey)}
          {selected.isToday ? (
            <span className="ml-2 rounded-pill bg-accent-soft px-2 py-0.5 align-middle text-xs font-semibold text-accent-ink">
              сегодня
            </span>
          ) : null}
        </h2>
        <span className="text-xs text-muted-foreground">{pairsLabel(selected.events.length)}</span>
      </div>

      {selected.events.length === 0 ? (
        <div data-testid="mobile-day-empty">
          <EmptyState
            icon={CalendarOff}
            title="Пар в этот день нет"
            className="px-4 py-8"
            description={emptyDescription(days, selectedKey, selectedIndex, nextStudy)}
          />
        </div>
      ) : (
        <ol
          data-testid="mobile-day-list"
          className="flex touch-pan-y flex-col gap-2"
          onTouchStart={(event) => {
            const touch = event.touches[0];
            touchStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
          }}
          onTouchEnd={(event) => {
            const start = touchStart.current;
            touchStart.current = null;
            const touch = event.changedTouches[0];
            if (!start || !touch) return;
            const direction = swipeDirection(
              start.x,
              start.y,
              touch.clientX,
              touch.clientY,
              SWIPE_THRESHOLD,
            );
            if (direction === 'next') shiftDay(1);
            if (direction === 'prev') shiftDay(-1);
          }}
        >
          {selected.events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </ol>
      )}
    </div>
  );
}

/** Ближайшие пары для пустого дня: сначала окно данных, потом серверный ответ. */
function emptyDescription(
  days: readonly MobileDayView[],
  selectedKey: string,
  selectedIndex: number,
  nextStudy: MobileScheduleProps['nextStudy'],
): string {
  for (let i = selectedIndex + 1; i < days.length; i += 1) {
    const day = days[i]!;
    if (day.events.length > 0 && day.dateKey > selectedKey) {
      return `Ближайшие пары: ${day.listLabel}.`;
    }
  }
  if (nextStudy && nextStudy.dateKey > selectedKey) {
    return `Ближайшие пары: ${nextStudy.label}.`;
  }
  return 'В семестре пар больше нет';
}

/** Компактный список недели (переключатель «Неделя» на мобильном). */
function WeekList({ days }: { days: readonly MobileDayView[] }) {
  return (
    <div data-testid="mobile-week-list" className="flex flex-col gap-4">
      {days.map((day) => (
        <section
          key={day.dateKey}
          data-testid={`compact-day-${day.dateKey}`}
          aria-label={day.listLabel}
        >
          <div className="mb-1.5 flex items-baseline justify-between gap-2">
            <h3 className="text-sm font-bold tracking-heading">
              {day.listLabel}
              {day.isToday ? (
                <span className="ml-2 rounded-pill bg-accent-soft px-1.5 py-0.5 align-middle text-[11px] font-semibold text-accent-ink">
                  сегодня
                </span>
              ) : null}
            </h3>
            <span className="text-xs text-muted-foreground">
              {day.events.length > 0 ? pairsLabel(day.events.length) : null}
            </span>
          </div>
          {day.events.length === 0 ? (
            <p className="rounded-card border border-dashed border-border px-3 py-3 text-center text-xs text-muted-foreground">
              Нет пар
            </p>
          ) : (
            <ol className="flex flex-col gap-1.5">
              {day.events.map((event) => (
                <EventCard key={event.id} event={event} compact />
              ))}
            </ol>
          )}
        </section>
      ))}
    </div>
  );
}
