'use client';

// DIG-22 — недельный вид расписания в стиле Google Calendar (Figma
// «03 · Расписание — неделя», референс — календарь ResumeCraft; каноничное
// соответствие «экран ↔ задача» — docs/figma-screens.md, где 03 → DIG-22:
// в тексте задачи фрейм по ошибке назван «04» — это «Детали пары», DIG-24).
//
// Клиентский оркестратор недельной сетки: панель инструментов («Сегодня»,
// стрелки ‹ ›, подпись недели, День / Неделя / Месяц (живой переключатель
// с DIG-23), «Синхронизировать»), левая
// колонка (мини-календарь месяца, фильтры по типу занятия со счётчиками
// и по преподавателю), сетка 08:00–20:00 (64 px на час, колонка сегодняшнего
// дня тонирована, красная линия текущего времени — обновление раз в минуту),
// блоки пар по цветам дизайн-токенов типов занятий, перенос (штриховка,
// пунктир, бейдж «Перенос», «было: ауд. 214 / 11:10»), отмена (зачёркнутый
// заголовок, бледный блок, бейдж «Отменена»), пересекающиеся пары делят
// ширину колонки. Мобильный вид (< 768 px) рендерит страница (DIG-23).
//
// Клавиатура: ←/→ листают недели (router.push — URL ?week=2026-W46 меняется
// без перезагрузки страницы), Esc закрывает панель деталей. Клик по паре —
// боковая панель с деталями (полная карточка пары — задача DIG-24).
// Листание данных — сервером (resolveWeekPage + getSchedule на странице),
// фильтры — локальные (клиентские), поэтому не перезапрашивают сеть.

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CalendarOff, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { cn } from 'cn';

import { moscowParts } from '@/lib/schedule-time';
import {
  GRID_HEIGHT_PX,
  layoutDayEvents,
  lessonKindMeta,
  type MiniCalendarCell,
  type ScheduleEventView,
} from '@/lib/schedule-view';
import type { ScheduleKind } from '@/server/data/types';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { Sheet } from '@/components/ui/sheet';
import { ViewSwitcher } from '@/components/schedule/view-switcher';

export interface WeekDayColumnData {
  dateKey: string;
  weekdayShort: string;
  dayNumber: number;
  isToday: boolean;
  events: ScheduleEventView[];
}

export interface WeekViewProps {
  /** Канонический ключ отображаемой недели («2026-W46») — для data-атрибута. */
  weekKey: string;
  weekLabel: string;
  semesterLabel: string;
  /** Ключи соседних недель (null — стрелка отключена: граница семестра). */
  prevWeekKey: string | null;
  nextWeekKey: string | null;
  /** Ключ недели «сегодня» — цель кнопки «Сегодня». */
  todayWeekKey: string;
  /** Московский ключ сегодняшнего дня (подсветка в сетке и мини-календаре). */
  todayKey: string;
  days: WeekDayColumnData[];
  mini: { monthLabel: string; weekdays: readonly string[]; cells: MiniCalendarCell[] };
  kindCounts: Array<{ kind: ScheduleKind; count: number }>;
  teachers: string[];
}

const weekHrefDefault = (weekKey: string) => `/schedule?week=${weekKey}`;

/** Штриховка блока переноса (серая, как в макете). */
const HATCH =
  '[background-image:repeating-linear-gradient(135deg,rgba(34,34,34,0.06)_0px,rgba(34,34,34,0.06)_1px,transparent_1px,transparent_10px)]';

export function WeekView({
  weekKey,
  weekLabel,
  semesterLabel,
  prevWeekKey,
  nextWeekKey,
  todayWeekKey,
  todayKey,
  days,
  mini,
  kindCounts,
  teachers,
}: WeekViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // DIG-23: страница может быть открыта с явным ?view=week — листание недель
  // сохраняет параметр вида, чтобы вид не сбрасывался на авто.
  const viewParam = searchParams.get('view');
  const weekHref = useCallback(
    (weekKey: string) =>
      viewParam === 'week'
        ? `/schedule?view=week&week=${encodeURIComponent(weekKey)}`
        : weekHrefDefault(weekKey),
    [viewParam],
  );
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<ScheduleEventView | null>(null);
  const [visibleKinds, setVisibleKinds] = useState<Record<ScheduleKind, boolean>>({
    LECTURE: true,
    SEMINAR: true,
    LAB: true,
    PRACTICE: true,
    CONSULTATION: true,
  });
  const [teacher, setTeacher] = useState('ALL');
  /** Минуты «сейчас» по Москве; null до mount (SSR-мисматч исключён). */
  const [nowMinutes, setNowMinutes] = useState<number | null>(null);

  // Красная линия текущего времени: обновление раз в минуту (заметка задачи).
  useEffect(() => {
    const update = () => {
      const p = moscowParts(new Date());
      setNowMinutes(p.hour * 60 + p.minute);
    };
    update();
    const timer = setInterval(update, 60_000);
    return () => clearInterval(timer);
  }, []);

  // Клавиатура: ←/→ листают недели, Esc закрывает панель деталей.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable ||
          target.closest('[role="radiogroup"]'))
      ) {
        return;
      }
      if (event.key === 'Escape') {
        setSelected(null);
        return;
      }
      if (selected) return; // панель открыта — стрелки не листают недели
      if (event.key === 'ArrowLeft' && prevWeekKey) {
        event.preventDefault();
        router.push(weekHref(prevWeekKey));
      } else if (event.key === 'ArrowRight' && nextWeekKey) {
        event.preventDefault();
        router.push(weekHref(nextWeekKey));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [router, selected, prevWeekKey, nextWeekKey, weekHref]);

  // Фильтры: по типу занятия и по преподавателю — локально, без сети.
  const filteredDays = useMemo(
    () =>
      days.map((day) => ({
        ...day,
        laid: layoutDayEvents(
          day.events
            .filter(
              (event) =>
                visibleKinds[event.kind] && (teacher === 'ALL' || event.teacher === teacher),
            )
            .map((event) => ({ ...event, start: event.startMinutes, end: event.endMinutes })),
        ),
      })),
    [days, visibleKinds, teacher],
  );
  const totalEvents = filteredDays.reduce((sum, day) => sum + day.laid.length, 0);
  const showNowLine = nowMinutes !== null && days.some((day) => day.isToday);

  return (
    <>
      {/* Десктопный недельный вид (>= 768 px); на мобильном — отдельная задача */}
      <div className="hidden md:block" data-testid="week-board" data-week-key={weekKey}>
        {/* ── Панель инструментов ─────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* «Сегодня» — ссылка со стилями кнопки: button внутри <a> —
                невалидная вложенность интерактива (ревью раунд 2) */}
            <Link
              href={weekHref(todayWeekKey)}
              aria-label="Перейти к текущей неделе"
              className={buttonVariants({ variant: 'secondary', size: 'sm' })}
            >
              Сегодня
            </Link>
            {prevWeekKey ? (
              <Link
                href={weekHref(prevWeekKey)}
                aria-label="Предыдущая неделя"
                className="inline-flex size-9 items-center justify-center rounded-button border border-border bg-card text-foreground shadow-soft transition-colors hover:bg-muted"
              >
                <Icon icon={ChevronLeft} size={18} />
              </Link>
            ) : (
              <button
                type="button"
                aria-label="Предыдущая неделя"
                aria-disabled="true"
                disabled
                className="inline-flex size-9 cursor-not-allowed items-center justify-center rounded-button border border-border bg-card text-muted-foreground opacity-50"
              >
                <Icon icon={ChevronLeft} size={18} />
              </button>
            )}
            {nextWeekKey ? (
              <Link
                href={weekHref(nextWeekKey)}
                aria-label="Следующая неделя"
                className="inline-flex size-9 items-center justify-center rounded-button border border-border bg-card text-foreground shadow-soft transition-colors hover:bg-muted"
              >
                <Icon icon={ChevronRight} size={18} />
              </Link>
            ) : (
              <button
                type="button"
                aria-label="Следующая неделя"
                aria-disabled="true"
                disabled
                className="inline-flex size-9 cursor-not-allowed items-center justify-center rounded-button border border-border bg-card text-muted-foreground opacity-50"
              >
                <Icon icon={ChevronRight} size={18} />
              </button>
            )}
            <h2
              data-testid="week-label"
              className="ml-1 text-lg font-bold tracking-heading sm:text-xl"
            >
              {weekLabel}
            </h2>
            <span className="text-xs text-muted-foreground">{semesterLabel}</span>
          </div>
          <div className="flex items-center gap-3">
            {/* DIG-23: переключатель видов живой — «День» и «Месяц» ведут
                в соответствующие виды (URL ?view=… с переносом контекста) */}
            <ViewSwitcher view="week" platform="desktop" />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => startTransition(() => router.refresh())}
              disabled={pending}
            >
              <Icon icon={RefreshCw} size={16} className={pending ? 'animate-spin' : ''} />
              Синхронизировать
            </Button>
          </div>
        </div>

        <div className="mt-4 flex gap-5">
          {/* ── Левая колонка: мини-календарь и фильтры ─────────────────────── */}
          <aside className="hidden w-60 shrink-0 flex-col gap-4 lg:flex">
            <MiniCalendar
              monthLabel={mini.monthLabel}
              weekdays={mini.weekdays}
              cells={mini.cells}
              todayKey={todayKey}
              weekDateKeys={days.map((day) => day.dateKey)}
            />
            <div className="rounded-card border border-border bg-card p-3">
              <p className="mb-2 text-sm font-bold">Типы занятий</p>
              <div className="flex flex-col gap-2">
                {kindCounts.map(({ kind, count }) => {
                  const meta = lessonKindMeta(kind);
                  return (
                    <label key={kind} className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={visibleKinds[kind]}
                        onChange={(e) =>
                          setVisibleKinds((prev) => ({ ...prev, [kind]: e.target.checked }))
                        }
                        className={cn('size-4 rounded border-border', meta.checkbox)}
                      />
                      <span className="flex-1">{meta.label}</span>
                      <span
                        className="text-xs tabular-nums text-muted-foreground"
                        data-count={count}
                      >
                        {count}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="rounded-card border border-border bg-card p-3">
              <p className="mb-2 text-sm font-bold">Преподаватель</p>
              <select
                data-testid="teacher-filter"
                aria-label="Фильтр по преподавателю"
                value={teacher}
                onChange={(e) => setTeacher(e.target.value)}
                className="h-10 w-full rounded-button border border-border bg-card px-3 text-sm"
              >
                <option value="ALL">Все преподаватели</option>
                {teachers.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          </aside>

          {/* ── Сетка недели ────────────────────────────────────────────────── */}
          <div className="min-w-0 flex-1">
            {/* шапка дней */}
            <div
              className="grid"
              style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0, 1fr))` }}
            >
              <span aria-hidden="true" />
              {days.map((day) => (
                <div key={day.dateKey} className="pb-2 text-center">
                  <span className="block text-[11px] font-medium text-muted-foreground">
                    {day.weekdayShort}
                  </span>
                  <span
                    data-today={day.isToday ? 'true' : undefined}
                    className={cn(
                      'mx-auto mt-1 flex size-8 items-center justify-center rounded-pill text-sm font-bold',
                      day.isToday ? 'bg-coral-500 text-white' : 'text-foreground',
                    )}
                  >
                    {day.dayNumber}
                  </span>
                </div>
              ))}
            </div>
            {/* тело сетки */}
            <div
              data-testid="week-grid"
              className="relative flex overflow-hidden rounded-card border border-border bg-card"
              style={{ height: GRID_HEIGHT_PX }}
            >
              {/* гуттер с часами */}
              <div className="relative w-14 shrink-0" aria-hidden="true">
                {Array.from({ length: 12 }, (_, h) => (
                  <span
                    key={h}
                    className="absolute -translate-y-1/2 pr-2 text-right text-[11px] tabular-nums text-muted-foreground"
                    style={{ top: h * 64, right: 8 }}
                  >
                    {`${String(8 + h).padStart(2, '0')}:00`}
                  </span>
                ))}
              </div>
              {/* колонки дней */}
              <div
                className="relative grid flex-1"
                style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
              >
                {filteredDays.map((day) => (
                  <div
                    key={day.dateKey}
                    data-date-key={day.dateKey}
                    data-today={day.isToday ? 'true' : undefined}
                    className={cn(
                      'relative border-l border-border',
                      day.isToday && 'bg-coral-50/60',
                    )}
                  >
                    {/* горизонтальные линии часов */}
                    {Array.from({ length: 12 }, (_, h) => (
                      <span
                        key={h}
                        aria-hidden="true"
                        className="absolute inset-x-0 border-t border-border/70"
                        style={{ top: h * 64 }}
                      />
                    ))}
                    {day.laid.map(({ event, column, columns }) => (
                      <LessonBlock
                        key={event.id}
                        event={event}
                        column={column}
                        columns={columns}
                        onOpen={() => setSelected(event)}
                      />
                    ))}
                  </div>
                ))}
                {/* красная линия текущего времени поверх блоков */}
                {showNowLine ? (
                  <div
                    aria-hidden="true"
                    data-testid="now-line"
                    className="pointer-events-none absolute inset-y-0 z-20"
                    style={{ left: 0, right: 0 }}
                  >
                    <div
                      className="relative border-t-2 border-error"
                      style={{ top: eventTop(nowMinutes) }}
                    >
                      <span className="absolute -left-1 -top-[5px] size-2 rounded-full bg-error" />
                    </div>
                  </div>
                ) : null}
                {/* пустая неделя или всё скрыто фильтрами */}
                {totalEvents === 0 ? (
                  <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                    <EmptyState
                      icon={CalendarOff}
                      title="На этой неделе пар нет"
                      description={
                        teacher === 'ALL' && Object.values(visibleKinds).every(Boolean)
                          ? 'Листайте недели стрелками или нажмите «Сегодня».'
                          : 'Попробуйте включить фильтры типов занятий или «Все преподаватели».'
                      }
                      className="pointer-events-auto w-72 border-none shadow-none"
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Мобильный вид (< 768 px) рендерит страница: лента дат + пары дня
          (MobileSchedule) — см. src/app/(cabinet)/schedule/page.tsx (DIG-23) */}

      {/* ── Боковая панель деталей пары (полная карточка — DIG-24) ────────── */}
      <Sheet
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title={selected?.discipline ?? ''}
        description={
          selected ? `${lessonKindMeta(selected.kind).label} · ${selected.timeLabel}` : undefined
        }
      >
        {selected ? <LessonDetails event={selected} /> : null}
      </Sheet>
    </>
  );
}

function eventTop(minutes: number): number {
  // кламп как у блоков: линия не выше низа сетки
  return Math.min(Math.max(0, ((minutes - 480) / 60) * 64), GRID_HEIGHT_PX);
}

// ── Блок пары ────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, { label: string; status: 'warning' | 'neutral' }> = {
  moved: { label: 'Перенос', status: 'warning' },
  cancelled: { label: 'Отменена', status: 'neutral' },
};

function LessonBlock({
  event,
  column,
  columns,
  onOpen,
}: {
  event: ScheduleEventView & { start: number; end: number };
  column: number;
  columns: number;
  onOpen: () => void;
}) {
  const meta = lessonKindMeta(event.kind);
  const status = event.isMoved ? 'moved' : event.isCancelled ? 'cancelled' : 'scheduled';
  const top = ((event.start - 480) / 60) * 64;
  const height = Math.max(0, ((Math.min(event.end, 1200) - Math.max(event.start, 480)) / 60) * 64);
  if (height <= 0) return null; // пара целиком вне сетки 08:00–20:00
  const widthPercent = 100 / columns;
  const previous = event.previousLabel;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={event.ariaLabel}
      data-status={status}
      data-testid={`lesson-${event.id}`}
      className={cn(
        'absolute z-10 flex flex-col items-start gap-0.5 overflow-hidden rounded-md border p-1.5 text-left transition-shadow hover:shadow-soft',
        'border-border border-l-[3px]',
        event.isCancelled ? 'border-l-border bg-muted/70 text-muted-foreground' : meta.block,
        event.isMoved && 'border-dashed border-foreground-muted',
        event.isMoved && HATCH,
      )}
      style={{
        top: Math.max(0, top),
        height,
        left: `${column * widthPercent}%`,
        width: `${widthPercent}%`,
      }}
    >
      <span
        className={cn(
          'text-[10px] font-bold uppercase tracking-wide',
          event.isCancelled && 'line-through',
        )}
      >
        {meta.label}
      </span>
      <span
        className={cn('text-[11px] font-bold leading-tight', event.isCancelled && 'line-through')}
      >
        {event.discipline}
      </span>
      <span className="text-[10px] tabular-nums leading-tight">
        {event.timeLabel} · {event.roomLabel}
      </span>
      {status !== 'scheduled' ? (
        <Badge status={STATUS_BADGE[status]!.status} className="px-1.5 py-0 text-[10px]">
          {STATUS_BADGE[status]!.label}
        </Badge>
      ) : null}
      {previous ? <span className="text-[10px] leading-tight opacity-80">{previous}</span> : null}
      {event.isMoved && event.changeNote ? (
        <span className="text-[10px] leading-tight opacity-70">{event.changeNote}</span>
      ) : null}
      {event.isCancelled && event.note ? (
        <span className="text-[10px] leading-tight opacity-70">{event.note}</span>
      ) : null}
    </button>
  );
}

// ── Детали пары в боковой панели ─────────────────────────────────────────────

function LessonDetails({ event }: { event: ScheduleEventView }) {
  const previous = event.previousLabel;
  const rows: Array<[string, React.ReactNode]> = [
    ['Тип', lessonKindMeta(event.kind).label],
    ['Время', event.timeLabel],
    ['Аудитория', event.roomLabel],
    ['Преподаватель', event.teacher],
    ['Статус', <LessonStatusLabel key="status" event={event} />],
  ];
  return (
    <div className="flex flex-col gap-4">
      <dl className="flex flex-col gap-2.5">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-4">
            <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
            <dd className="text-right text-sm font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      {previous ? (
        <p className="rounded-button bg-muted px-3 py-2 text-sm text-muted-foreground">
          {previous}
        </p>
      ) : null}
      {event.changeNote ? (
        <p className="rounded-button bg-warning-soft px-3 py-2 text-sm text-warning-ink">
          Причина: {event.changeNote}
        </p>
      ) : null}
      {event.note ? (
        <p className="rounded-button bg-muted px-3 py-2 text-sm text-muted-foreground">
          {event.note}
        </p>
      ) : null}
    </div>
  );
}

function LessonStatusLabel({ event }: { event: ScheduleEventView }) {
  if (event.isCancelled) return <Badge status="neutral">Отменена</Badge>;
  if (event.isMoved) return <Badge status="warning">Перенос</Badge>;
  return <Badge status="success">По расписанию</Badge>;
}

// ── Мини-календарь месяца ────────────────────────────────────────────────────

function MiniCalendar({
  monthLabel,
  weekdays,
  cells,
  todayKey,
  weekDateKeys,
}: {
  monthLabel: string;
  weekdays: readonly string[];
  cells: MiniCalendarCell[];
  todayKey: string;
  weekDateKeys: string[];
}) {
  const weekSet = new Set(weekDateKeys);
  return (
    <div data-testid="mini-calendar" className="rounded-card border border-border bg-card p-3">
      <p className="mb-2 text-sm font-bold tracking-heading">{monthLabel}</p>
      <div className="grid grid-cols-7 text-center text-[11px] font-medium text-muted-foreground">
        {weekdays.map((weekday) => (
          <span key={weekday}>{weekday}</span>
        ))}
      </div>
      <div className="mt-1.5 grid grid-cols-7 text-center text-xs">
        {cells.map((cell) => {
          const isToday = cell.dateKey === todayKey;
          const inWeek = weekSet.has(cell.dateKey);
          return (
            <span key={cell.dateKey} className="py-0.5">
              <span
                data-today={isToday ? 'true' : undefined}
                data-in-week={inWeek ? 'true' : undefined}
                className={cn(
                  'mx-auto flex size-7 items-center justify-center rounded-pill',
                  !cell.inMonth && 'text-foreground-muted',
                  inWeek && !isToday && 'bg-accent-soft font-semibold',
                  isToday && 'bg-coral-500 font-bold text-white',
                )}
              >
                {cell.day}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
