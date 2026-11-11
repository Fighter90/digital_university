// DIG-22 — недельный вид расписания (Figma «03 · Расписание — неделя»,
// референс — календарь ResumeCraft): чистая вью-логика экрана.
//
// Модуль без серверных импортов (используется и страницей-сервером, и
// клиентским WeekView), детерминированный и покрыт юнит-тестами
// (tests/schedule-view.test.ts). Всё календарное время — Europe/Moscow
// через src/lib/schedule-time.ts; наружу недели канонизируются ключом
// ISO-недели «2026-W46» (параметр URL ?week=…).
//
// Состав:
//  - ключ недели: isoWeekKeyOf / mondayOfIsoWeekKey / formatWeekKey
//    (четверговый трюк, валидация 53-недельных годов, round-trip);
//  - подпись недели «9 – 15 ноября 2026» (переход месяца/года);
//  - сетка 08:00–20:00, 64 px на час: eventTopPx = (start − 480)/60·64,
//    eventHeightPx = duration/60·64 с клампом за границы сетки;
//  - layoutDayEvents: пересекающиеся пары делят ширину колонки,
//    «встык» — не пересечение;
//  - toScheduleEventViews: серийализуемая модель блока пары + понятный
//    aria-label («Семинар, Математический анализ, 11:10–12:30, ауд. 305,
//    перенос» / «…, отменена»);
//  - lessonKindMeta: подпись и цвета дизайн-токенов типов занятий
//    (лекция — коралловый, семинар — синий, лаб. — зелёный, экзамен —
//    янтарный);
//  - miniCalendarCells: месяц отображаемой недели целыми строками Пн–Вс;
//  - resolveWeekPage: страница недели для /schedule — парсинг ?week=,
//    кламп по границам семестра (pageMoscowWeek), соседние недели для
//    стрелок ‹ ›.

import {
  formatMoscowTime,
  fromMoscowWallClock,
  moscowDateKey,
  moscowParts,
  pageMoscowWeek,
  semesterBounds,
  shiftMoscowDays,
  startOfMoscowWeek,
  type SemesterBounds,
} from '@/lib/schedule-time';
import { LESSON_KIND_LABELS } from '@/lib/dashboard-format';
import type { ScheduleEventRow, ScheduleKind, ScheduleStatus } from '@/server/data/types';

// ── Сетка дня: 08:00–20:00, 64 px на час ─────────────────────────────────────

export const GRID_START_HOUR = 8;
export const GRID_END_HOUR = 20;
export const GRID_START_MINUTES = GRID_START_HOUR * 60; // 480
export const GRID_END_MINUTES = GRID_END_HOUR * 60; // 1200
export const PX_PER_HOUR = 64;
/** Высота сетки в px: 12 часов × 64. */
export const GRID_HEIGHT_PX = ((GRID_END_MINUTES - GRID_START_MINUTES) / 60) * PX_PER_HOUR; // 768

/** top блока пары внутри колонки: (start − 480)/60·64, кламп в [0, высота сетки]. */
export function eventTopPx(startMinutes: number): number {
  const raw = ((startMinutes - GRID_START_MINUTES) / 60) * PX_PER_HOUR;
  return Math.min(Math.max(0, raw), GRID_HEIGHT_PX);
}

/** height блока пары: duration/60·64, не выше низа сетки; вне сетки — 0. */
export function eventHeightPx(startMinutes: number, endMinutes: number): number {
  const from = Math.max(startMinutes, GRID_START_MINUTES);
  const to = Math.min(endMinutes, GRID_END_MINUTES);
  return Math.max(0, ((to - from) / 60) * PX_PER_HOUR);
}

// ── Ключ недели в URL (?week=2026-W46) ───────────────────────────────────────

export interface IsoWeek {
  year: number;
  week: number;
}

export function formatWeekKey({ year, week }: IsoWeek): string {
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/** ISO-год и номер недели по четвергу недели даты (четверговый трюк). */
function isoWeekOfMonday(monday: Date): IsoWeek {
  const thursday = shiftMoscowDays(monday, 3);
  const year = moscowParts(thursday).year;
  const firstMonday = startOfMoscowWeek(fromMoscowWallClock(year, 1, 4));
  const week = Math.round((monday.getTime() - firstMonday.getTime()) / (7 * 86_400_000)) + 1;
  return { year, week };
}

/** Ключ недели «2026-W46» для любой даты/мгновения (по московскому дню). */
export function isoWeekKeyOf(date: Date): string {
  return formatWeekKey(isoWeekOfMonday(startOfMoscowWeek(date)));
}

const WEEK_KEY_RE = /^(\d{4})-W(\d{2})$/;

/**
 * Понедельник 00:00 MSK ISO-недели из ключа URL. null для мусора,
 * W00/W54 и несуществующих W53 (год не 53-недельный) — параметр URL
 * никогда не верит на слово.
 */
export function mondayOfIsoWeekKey(key: string): Date | null {
  const match = WEEK_KEY_RE.exec(key);
  if (!match) return null;
  const year = Number(match[1]);
  const week = Number(match[2]);
  if (week < 1 || week > 53) return null;
  const firstMonday = startOfMoscowWeek(fromMoscowWallClock(year, 1, 4));
  const monday = shiftMoscowDays(firstMonday, (week - 1) * 7);
  const check = isoWeekOfMonday(monday);
  if (check.year !== year || check.week !== week) return null;
  return monday;
}

// ── Подпись недели ───────────────────────────────────────────────────────────

const MONTHS_GENITIVE = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
] as const;

const MONTHS_NOMINATIVE = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
] as const;

/** Подпись диапазона недели: «9 – 15 ноября 2026» (переход месяца/года учтён). */
export function weekLabel(monday: Date): string {
  const start = moscowParts(monday);
  const end = moscowParts(shiftMoscowDays(monday, 6));
  const startDay = `${start.day} ${MONTHS_GENITIVE[start.month - 1]}`;
  const endDay = `${end.day} ${MONTHS_GENITIVE[end.month - 1]} ${end.year}`;
  if (start.year !== end.year) return `${startDay} ${start.year} – ${endDay}`;
  if (start.month !== end.month) return `${startDay} – ${endDay}`;
  return `${start.day} – ${endDay}`;
}

// ── Тип занятия: подпись + цвета дизайн-токенов ──────────────────────────────

export interface LessonKindMeta {
  label: string;
  /** Классы блока в сетке (мягкий фон + цветной левый кант + ink-текст). */
  block: string;
  /** Класс цветного квадратика-чекбокса фильтра (accent-color). */
  checkbox: string;
  /** Класс цветного свотча (фон точки/квадратика). */
  swatch: string;
}

export const LESSON_KIND_META: Record<ScheduleKind, LessonKindMeta> = {
  LECTURE: {
    label: LESSON_KIND_LABELS.LECTURE,
    block: 'bg-lesson-lecture-soft text-lesson-lecture-ink border-l-lesson-lecture',
    checkbox: 'accent-lesson-lecture',
    swatch: 'bg-lesson-lecture',
  },
  SEMINAR: {
    label: LESSON_KIND_LABELS.SEMINAR,
    block: 'bg-lesson-seminar-soft text-lesson-seminar-ink border-l-lesson-seminar',
    checkbox: 'accent-lesson-seminar',
    swatch: 'bg-lesson-seminar',
  },
  LAB: {
    label: LESSON_KIND_LABELS.LAB,
    block: 'bg-lesson-lab-soft text-lesson-lab-ink border-l-lesson-lab',
    checkbox: 'accent-lesson-lab',
    swatch: 'bg-lesson-lab',
  },
  PRACTICE: {
    label: LESSON_KIND_LABELS.PRACTICE,
    block: 'bg-accent-soft text-accent-ink border-l-accent',
    checkbox: 'accent-accent',
    swatch: 'bg-accent',
  },
  CONSULTATION: {
    label: LESSON_KIND_LABELS.CONSULTATION,
    block: 'bg-lesson-exam-soft text-lesson-exam-ink border-l-lesson-exam',
    checkbox: 'accent-lesson-exam',
    swatch: 'bg-lesson-exam',
  },
};

export function lessonKindMeta(kind: ScheduleKind): LessonKindMeta {
  return LESSON_KIND_META[kind];
}

/** Порядок типов в фильтре левой колонки (как в макете). */
export const FILTER_KIND_ORDER: readonly ScheduleKind[] = [
  'LECTURE',
  'SEMINAR',
  'LAB',
  'PRACTICE',
  'CONSULTATION',
];

// ── Модель блока пары ────────────────────────────────────────────────────────

export interface ScheduleEventView {
  id: string;
  /** Московский ключ дня «2026-11-11». */
  dateKey: string;
  /** Минуты от полуночи по Москве. */
  startMinutes: number;
  endMinutes: number;
  /** «11:10–12:30». */
  timeLabel: string;
  kind: ScheduleKind;
  discipline: string;
  teacher: string;
  room: string;
  /** «ауд. 305» или «онлайн». */
  roomLabel: string;
  status: ScheduleStatus;
  /** ROOM_CHANGED | TIME_CHANGED — серая штриховка, пунктир, «Перенос». */
  isMoved: boolean;
  isCancelled: boolean;
  /** «было: ауд. 214». */
  previousRoomLabel: string | null;
  /** «было: 11:10». */
  previousTimeLabel: string | null;
  changeNote: string | null;
  note: string | null;
  /** Понятная подпись для скринридера (блок — кнопка). */
  ariaLabel: string;
}

function roomLabelOf(room: string): string {
  return room.trim().toLowerCase() === 'онлайн' ? 'онлайн' : `ауд. ${room.trim()}`;
}

/** Строки слоя данных → серийализуемая модель блока недели. */
export function toScheduleEventViews(rows: readonly ScheduleEventRow[]): ScheduleEventView[] {
  return rows.map((row) => {
    const start = moscowParts(row.startsAt);
    const end = moscowParts(row.endsAt);
    const startMinutes = start.hour * 60 + start.minute;
    const endMinutes = end.hour * 60 + end.minute;
    const kindLabel = LESSON_KIND_LABELS[row.kind];
    const roomLabel = roomLabelOf(row.room);
    const timeLabel = `${formatMoscowTime(row.startsAt)}–${formatMoscowTime(row.endsAt)}`;
    const isMoved = row.status === 'ROOM_CHANGED' || row.status === 'TIME_CHANGED';
    const isCancelled = row.status === 'CANCELLED';
    const suffix = isMoved ? ', перенос' : isCancelled ? ', отменена' : '';
    return {
      id: row.id,
      dateKey: moscowDateKey(row.startsAt),
      startMinutes,
      endMinutes,
      timeLabel,
      kind: row.kind,
      discipline: row.disciplineName,
      teacher: row.teacherName,
      room: row.room,
      roomLabel,
      status: row.status,
      isMoved,
      isCancelled,
      previousRoomLabel: row.previousRoom ? `было: ауд. ${row.previousRoom}` : null,
      previousTimeLabel: row.previousStartsAt
        ? `было: ${formatMoscowTime(row.previousStartsAt)}`
        : null,
      changeNote: row.changeNote ?? null,
      note: row.note ?? null,
      ariaLabel: `${kindLabel}, ${row.disciplineName}, ${timeLabel}, ${roomLabel}${suffix}`,
    };
  });
}

// ── Раскладка пересечений ────────────────────────────────────────────────────

export interface LaidOutEvent<T> {
  event: T;
  /** 0-базированная колонка внутри кластера пересечений. */
  column: number;
  /** Сколько колонок занял кластер (ширина блока = 1/columns). */
  columns: number;
}

/**
 * Пары одного дня: пересекающиеся делят ширину колонки (кластер — цепочка
 * пересечений), «встык» (start = end соседа) пересечением не считается.
 * Вход может быть неотсортированным — сортируем по началу.
 */
export function layoutDayEvents<T extends { start: number; end: number }>(
  events: readonly T[],
): Array<LaidOutEvent<T>> {
  const sorted = [...events].sort((a, b) => a.start - b.start || a.end - b.end);
  const result: Array<LaidOutEvent<T>> = [];
  let i = 0;
  while (i < sorted.length) {
    const columnEnds: number[] = [];
    const columnOf = new Map<number, number>();
    const members: number[] = [];
    const place = (index: number): number => {
      const item = sorted[index]!;
      let column = columnEnds.findIndex((end) => end <= item.start);
      if (column === -1) {
        column = columnEnds.length;
        columnEnds.push(item.end);
      } else {
        columnEnds[column] = item.end;
      }
      columnOf.set(index, column);
      members.push(index);
      return column;
    };
    let clusterEnd = place(i) === -1 ? 0 : sorted[i]!.end;
    let maxColumn = columnOf.get(i)!;
    let j = i + 1;
    while (j < sorted.length && sorted[j]!.start < clusterEnd) {
      clusterEnd = Math.max(clusterEnd, sorted[j]!.end);
      maxColumn = Math.max(maxColumn, place(j));
      j += 1;
    }
    const columns = maxColumn + 1;
    for (const index of members) {
      result.push({ event: sorted[index]!, column: columnOf.get(index)!, columns });
    }
    i = j;
  }
  return result;
}

// ── Страница недели для /schedule ────────────────────────────────────────────

export interface WeekPage {
  /** Канонический ключ для URL: «2026-W46». */
  weekKey: string;
  weekLabel: string;
  semesterLabel: string;
  /** 6–7 московских полуночей: дни сетки (первая/последняя неделя семестра клампятся). */
  days: Date[];
  from: Date;
  to: Date;
  /** Соседние недели для стрелок ‹ › (null — листание отключено). */
  prevWeekKey: string | null;
  nextWeekKey: string | null;
  /** Отображаемая неделя содержит «сейчас». */
  isCurrent: boolean;
}

/**
 * Страница недели по параметру ?week= (undefined → неделя «сейчас»).
 * Ключ валидируется, страница клампится по границам семестра; за пределами
 * семестра — ближайшая валидная (текущая) неделя; совсем вне семестра — null.
 */
export function resolveWeekPage(rawWeek: string | undefined, now: Date): WeekPage | null {
  const bounds: SemesterBounds = semesterBounds(now);
  const requested = rawWeek ? mondayOfIsoWeekKey(rawWeek) : null;
  const fallback = startOfMoscowWeek(now);
  const page =
    (requested ? pageMoscowWeek(requested, 0, bounds) : null) ??
    pageMoscowWeek(fallback, 0, bounds);
  if (!page) return null;

  const days: Date[] = [];
  for (let day = page.from; day.getTime() < page.to.getTime(); day = shiftMoscowDays(day, 1)) {
    days.push(day);
  }
  const prev = pageMoscowWeek(page.from, -1, bounds);
  const next = pageMoscowWeek(page.from, 1, bounds);
  const dayKeys = new Set(days.map(moscowDateKey));

  return {
    weekKey: isoWeekKeyOf(page.from),
    weekLabel: weekLabel(page.from),
    semesterLabel: bounds.label,
    days,
    from: page.from,
    to: page.to,
    prevWeekKey: prev ? isoWeekKeyOf(prev.from) : null,
    nextWeekKey: next ? isoWeekKeyOf(next.from) : null,
    isCurrent: dayKeys.has(moscowDateKey(now)),
  };
}

// ── Мини-календарь месяца ────────────────────────────────────────────────────

/** Короткие подписи дней недели, понедельник первый (индекс moscowWeekdayIndex). */
export const WEEKDAY_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const;

export interface MiniCalendarCell {
  /** Московский ключ дня «2026-11-09». */
  dateKey: string;
  /** День месяца для отрисовки (1–31). */
  day: number;
  inMonth: boolean;
}

/**
 * Месяц, в котором находится отображаемая неделя (якорь — её четверг,
 * чтобы месяц был стабилен внутри недели), целыми строками Пн–Вс.
 */
export function miniCalendarCells(weekMonday: Date): {
  monthLabel: string;
  weekdays: readonly string[];
  cells: MiniCalendarCell[];
} {
  const anchor = moscowParts(shiftMoscowDays(weekMonday, 3));
  const gridStart = startOfMoscowWeek(fromMoscowWallClock(anchor.year, anchor.month, 1));
  const lastDayStart = startOfMoscowWeek(
    fromMoscowWallClock(anchor.year, anchor.month + 1, 0), // последний день месяца
  );
  const cells: MiniCalendarCell[] = [];
  for (
    let day = gridStart;
    day.getTime() <= lastDayStart.getTime();
    day = shiftMoscowDays(day, 7)
  ) {
    for (let i = 0; i < 7; i += 1) {
      const cell = shiftMoscowDays(day, i);
      const parts = moscowParts(cell);
      cells.push({
        dateKey: moscowDateKey(cell),
        day: parts.day,
        inMonth: parts.month === anchor.month && parts.year === anchor.year,
      });
    }
  }
  return {
    monthLabel: `${MONTHS_NOMINATIVE[anchor.month - 1]} ${anchor.year}`,
    weekdays: WEEKDAY_SHORT,
    cells,
  };
}
