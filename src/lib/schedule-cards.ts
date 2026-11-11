// DIG-23 — вью-логика видов расписания «День», «Месяц» и мобильного вида
// с лентой дат (Figma «04 · Расписание — день / месяц» и вариант 360 px).
//
// Модуль чистый (без серверных импортов): используется и страницей-сервером,
// и клиентским MobileSchedule, детерминирован и покрыт юнит-тестами
// (tests/schedule-cards.test.ts). Всё календарное время — Europe/Moscow
// через src/lib/schedule-time.ts.
//
// Состав:
//  - ScheduleEventCard: серийализуемая модель карточки пары (структурно
//    совместима с моделью блока недели DIG-22 — один сериализатор на оба
//    вида), понятный aria-label («…, перенос» / «…, отменена»);
//  - LESSON_KIND_META: подпись + цветные классы дизайн-токенов DIG-13
//    (пилюля типа, точка месяца, полоса карточки);
//  - форматирование дат: «чт, 12 ноября», «Среда, 11 ноября», «Ноябрь 2026»;
//  - разбор параметров URL (?view / ?date / ?month): мусор не верит на
//    слово — откат к «день/сегодня/текущий месяц»;
//  - neighborDay: листание дней с клампом по границам семестра;
//  - weekWindow: окно данных ±2 недели вокруг выбранного дня (мобильная
//    лента и свайп живут на нём без дополнительных запросов);
//  - monthCellViews: сетка месяца целыми неделями с понедельника, «сегодня»,
//    точки пар (до 4 + «+N»);
//  - ribbonWeekDays: 7 дней недели выбранного дня для ленты;
//  - swipeDirection: горизонтальный свайп → соседний день.

import {
  formatMoscowTime,
  fromMoscowWallClock,
  moscowDateKey,
  moscowParts,
  moscowWeekdayIndex,
  shiftMoscowDays,
  startOfMoscowDay,
  startOfMoscowWeek,
  type SemesterBounds,
} from '@/lib/schedule-time';
import { isoWeekKeyOf, mondayOfIsoWeekKey } from '@/lib/schedule-view';
import { LESSON_KIND_LABELS, pluralRu } from '@/lib/dashboard-format';
import type { ScheduleEventRow, ScheduleKind, ScheduleStatus } from '@/server/data/types';

// ── Виды расписания и параметры URL ──────────────────────────────────────────

export type ScheduleView = 'day' | 'week' | 'month';

const VIEWS: readonly ScheduleView[] = ['day', 'week', 'month'];

/** Вид из ?view=; отсутствие параметра и мусор — фолбэк вызывающей стороны:
 * десктоп открывает недельную сетку (DIG-22), мобильный — «сегодня»
 * (лента дат). Так один URL /schedule честно работает на обоих брейкпоинтах. */
export function resolveScheduleView(raw: string | undefined, fallback: ScheduleView): ScheduleView {
  return VIEWS.includes(raw as ScheduleView) ? (raw as ScheduleView) : fallback;
}

// ── Карточка пары ─────────────────────────────────────────────────────────────

export interface ScheduleEventCard {
  id: string;
  /** Московский ключ дня «2026-11-11». */
  dateKey: string;
  /** Минуты от полуночи по Москве (для сортировок и пересечений). */
  startMinutes: number;
  endMinutes: number;
  /** «10:00» / «11:30» / «10:00–11:30». */
  startLabel: string;
  endLabel: string;
  timeLabel: string;
  kind: ScheduleKind;
  discipline: string;
  teacher: string;
  room: string;
  /** «ауд. 305» или «онлайн». */
  roomLabel: string;
  status: ScheduleStatus;
  /** ROOM_CHANGED | TIME_CHANGED — штриховка, бейдж «Перенос», «было: …». */
  isMoved: boolean;
  isCancelled: boolean;
  /** «было: ауд. 214». */
  previousRoomLabel: string | null;
  /** «было: 11:10». */
  previousTimeLabel: string | null;
  /** Заметка студента к паре (своя, видна только владельцу). */
  note: string | null;
  /** Причина изменения от деканата. */
  changeNote: string | null;
  /** Понятная подпись для скринридера. */
  ariaLabel: string;
}

function roomLabelOf(room: string): string {
  return room.trim().toLowerCase() === 'онлайн' ? 'онлайн' : `ауд. ${room.trim()}`;
}

/** Строки слоя данных → серийализуемые карточки (вход уже отсортирован). */
export function toScheduleEventCards(rows: readonly ScheduleEventRow[]): ScheduleEventCard[] {
  return rows.map((row) => {
    const start = moscowParts(row.startsAt);
    const end = moscowParts(row.endsAt);
    const startMinutes = start.hour * 60 + start.minute;
    const endMinutes = end.hour * 60 + end.minute;
    const kindLabel = LESSON_KIND_LABELS[row.kind];
    const roomLabel = roomLabelOf(row.room);
    const startLabel = formatMoscowTime(row.startsAt);
    const endLabel = formatMoscowTime(row.endsAt);
    const timeLabel = `${startLabel}–${endLabel}`;
    const isMoved = row.status === 'ROOM_CHANGED' || row.status === 'TIME_CHANGED';
    const isCancelled = row.status === 'CANCELLED';
    const suffix = isMoved ? ', перенос' : isCancelled ? ', отменена' : '';
    return {
      id: row.id,
      dateKey: moscowDateKey(row.startsAt),
      startMinutes,
      endMinutes,
      startLabel,
      endLabel,
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
      note: row.note ?? null,
      changeNote: row.changeNote ?? null,
      ariaLabel: `${kindLabel}, ${row.disciplineName}, ${timeLabel}, ${roomLabel}${suffix}`,
    };
  });
}

/** Группировка карточек по московскому ключу дня (порядок внутри сохранён). */
export function groupCardsByDate(
  cards: readonly ScheduleEventCard[],
): Map<string, ScheduleEventCard[]> {
  const byDate = new Map<string, ScheduleEventCard[]>();
  for (const card of cards) {
    const bucket = byDate.get(card.dateKey);
    if (bucket) bucket.push(card);
    else byDate.set(card.dateKey, [card]);
  }
  return byDate;
}

// ── Тип занятия: подпись + цвета дизайн-токенов ──────────────────────────────

export interface LessonKindMeta {
  label: string;
  /** Классы пилюли типа (мягкий фон + ink-текст). */
  pill: string;
  /** Класс цветной точки (сетка месяца, индикатор ленты). */
  dot: string;
  /** Класс цветной полосы карточки (левый кант по типу занятия). */
  stripe: string;
}

export const LESSON_KIND_META: Record<ScheduleKind, LessonKindMeta> = {
  LECTURE: {
    label: LESSON_KIND_LABELS.LECTURE,
    pill: 'bg-lesson-lecture-soft text-lesson-lecture-ink',
    dot: 'bg-lesson-lecture',
    stripe: 'bg-lesson-lecture',
  },
  SEMINAR: {
    label: LESSON_KIND_LABELS.SEMINAR,
    pill: 'bg-lesson-seminar-soft text-lesson-seminar-ink',
    dot: 'bg-lesson-seminar',
    stripe: 'bg-lesson-seminar',
  },
  LAB: {
    label: LESSON_KIND_LABELS.LAB,
    pill: 'bg-lesson-lab-soft text-lesson-lab-ink',
    dot: 'bg-lesson-lab',
    stripe: 'bg-lesson-lab',
  },
  PRACTICE: {
    label: LESSON_KIND_LABELS.PRACTICE,
    pill: 'bg-accent-soft text-accent-ink',
    dot: 'bg-accent',
    stripe: 'bg-accent',
  },
  CONSULTATION: {
    label: LESSON_KIND_LABELS.CONSULTATION,
    pill: 'bg-lesson-exam-soft text-lesson-exam-ink',
    dot: 'bg-lesson-exam',
    stripe: 'bg-lesson-exam',
  },
};

// ── Форматирование дат ───────────────────────────────────────────────────────

export const WEEKDAY_SHORT = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'] as const;

const WEEKDAY_FULL = [
  'Понедельник',
  'Вторник',
  'Среда',
  'Четверг',
  'Пятница',
  'Суббота',
  'Воскресенье',
] as const;

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

/** «чт, 12 ноября» — подпись ближайшего учебного дня (пустой день). */
export function formatDayShort(date: Date): string {
  const p = moscowParts(date);
  const weekday = WEEKDAY_SHORT[moscowWeekdayIndex(date)];
  return `${weekday}, ${p.day} ${MONTHS_GENITIVE[p.month - 1]}`;
}

/** «Среда, 11 ноября» — заголовок вида «День». */
export function formatDayTitle(date: Date): string {
  const p = moscowParts(date);
  const weekday = WEEKDAY_FULL[moscowWeekdayIndex(date)];
  return `${weekday}, ${p.day} ${MONTHS_GENITIVE[p.month - 1]}`;
}

/** «Среда, 11 ноября» по ключу дня (мобильный список листает дни без Date). */
export function formatDayTitleFromKey(dateKey: string): string {
  const date = parseDateKey(dateKey);
  return date ? formatDayTitle(date) : '';
}

/** «Ноябрь 2026» — заголовок вида «Месяц» (month: 1..12). */
export function formatMonthTitle(year: number, month: number): string {
  return `${MONTHS_NOMINATIVE[month - 1]} ${year}`;
}

// ── Ключи дат и месяцев ──────────────────────────────────────────────────────

const DATE_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_KEY_RE = /^(\d{4})-(\d{2})$/;

/** «2026-11-13» → 00:00 московского дня; мусор/вне диапазона → null. */
export function parseDateKey(key: string | undefined): Date | null {
  if (!key) return null;
  const match = DATE_KEY_RE.exec(key);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }
  return fromMoscowWallClock(year, month, day);
}

export interface YearMonth {
  /** 1..12. */
  month: number;
  year: number;
}

/** «2026-11» → { year: 2026, month: 11 }; мусор → null. */
export function parseMonthKey(key: string | undefined): YearMonth | null {
  if (!key) return null;
  const match = MONTH_KEY_RE.exec(key);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return { year, month };
}

export function formatMonthKey({ year, month }: YearMonth): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

/** Арифметический сдвиг месяца (без привязки к семестру). */
export function shiftMonth({ year, month }: YearMonth, delta: number): YearMonth {
  const total = year * 12 + (month - 1) + delta;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

/** Дата по умолчанию — сегодня; ?date= мусорный — тоже сегодня. */
export function resolveSelectedDate(raw: string | undefined, now: Date): Date {
  return parseDateKey(raw) ?? startOfMoscowDay(now);
}

/** Месяц по умолчанию — текущий; ?month= мусорный — тоже текущий. */
export function resolveSelectedMonth(raw: string | undefined, now: Date): YearMonth {
  const parsed = parseMonthKey(raw);
  if (parsed) return parsed;
  const p = moscowParts(now);
  return { year: p.year, month: p.month };
}

// ── Границы семестра: листание дней и месяцев ────────────────────────────────

/**
 * Соседний день (delta = ±1) с клампом по семестру: за границей соседа нет —
 * UI отключает стрелку. null также для любого delta ≠ ±1 вне семестра.
 */
export function neighborDay(date: Date, delta: number, bounds: SemesterBounds): Date | null {
  const target = shiftMoscowDays(startOfMoscowDay(date), delta);
  if (target.getTime() < bounds.start.getTime()) return null;
  if (target.getTime() >= bounds.end.getTime()) return null;
  return target;
}

/** Месяц пересекается с семестром (есть что показывать). */
export function monthVisible({ year, month }: YearMonth, bounds: SemesterBounds): boolean {
  const from = fromMoscowWallClock(year, month, 1);
  const to = fromMoscowWallClock(year, month + 1, 1);
  return from.getTime() < bounds.end.getTime() && to.getTime() > bounds.start.getTime();
}

// ── Окно данных ±2 недели вокруг выбранного дня ──────────────────────────────

export interface WeekWindow {
  /** Понедельник −2 недели, 00:00 MSK (включительно). */
  from: Date;
  /** Понедельник +3 недели, 00:00 MSK (исключительно) — 5 полных недель. */
  to: Date;
  /** Московские ключи всех дней окна (35 строк, с понедельника). */
  dateKeys: string[];
}

/**
 * Окно данных мобильного вида: 5 полных недель вокруг недели выбранного дня.
 * Лента и свайп листают дни внутри окна без дополнительных запросов.
 */
export function weekWindow(date: Date, weeksEachSide = 2): WeekWindow {
  const monday = startOfMoscowWeek(date);
  const from = shiftMoscowDays(monday, -7 * weeksEachSide);
  const to = shiftMoscowDays(monday, 7 * (weeksEachSide + 1));
  const dateKeys: string[] = [];
  for (let i = 0; i < 7 * (2 * weeksEachSide + 1); i += 1) {
    dateKeys.push(moscowDateKey(shiftMoscowDays(from, i)));
  }
  return { from, to, dateKeys };
}

// ── Сетка месяца ─────────────────────────────────────────────────────────────

export interface MonthCellView {
  dateKey: string;
  dayNumber: number;
  /** День отображаемого месяца (иначе — заглушка без ссылки). */
  inMonth: boolean;
  isToday: boolean;
  /** Цвета точек пар (по одной на пару, до 4). */
  dots: ScheduleKind[];
  /** Сколько пар сверх четырёх («+N»). */
  extra: number;
  /** Ссылка на вид «День» (пустая строка у дней вне месяца). */
  href: string;
}

/** Точки пар в ячейке месяца: до 4 точек + «+N». */
export function monthDots(events: readonly ScheduleEventCard[]): {
  dots: ScheduleKind[];
  extra: number;
} {
  const MAX_DOTS = 4;
  const dots = events.slice(0, MAX_DOTS).map((event) => event.kind);
  return { dots, extra: Math.max(0, events.length - MAX_DOTS) };
}

/**
 * Сетка месяца целыми неделями Пн–Вс (5–6 строк): дни соседних месяцев —
 * заглушки, «сегодня» отмечено, у каждого дня месяца — ссылка на вид «День».
 */
export function monthCellViews(
  { year, month }: YearMonth,
  byDate: ReadonlyMap<string, readonly ScheduleEventCard[]>,
  todayKey: string,
): MonthCellView[] {
  const first = fromMoscowWallClock(year, month, 1);
  const gridStart = shiftMoscowDays(first, -moscowWeekdayIndex(first));
  const totalDays = moscowParts(fromMoscowWallClock(year, month + 1, 0)).day;
  const cellsTotal = Math.ceil((moscowWeekdayIndex(first) + totalDays) / 7) * 7;
  const cells: MonthCellView[] = [];
  for (let i = 0; i < cellsTotal; i += 1) {
    const date = shiftMoscowDays(gridStart, i);
    const dateKey = moscowDateKey(date);
    const inMonth = moscowParts(date).month === month;
    const events = byDate.get(dateKey) ?? [];
    const { dots, extra } = monthDots(events);
    cells.push({
      dateKey,
      dayNumber: moscowParts(date).day,
      inMonth,
      isToday: dateKey === todayKey,
      dots,
      extra,
      href: inMonth ? `/schedule?view=day&date=${dateKey}` : '',
    });
  }
  return cells;
}

// ── Лента дат мобильного вида ────────────────────────────────────────────────

/**
 * 7 дней недели выбранного дня из окна данных. У краёв окна — доступный
 * хвост (лента короче недели, но не падает).
 */
export function ribbonWeekDays(dateKeys: readonly string[], selectedKey: string): string[] {
  const index = dateKeys.indexOf(selectedKey);
  if (index === -1) return dateKeys.slice(0, 7);
  const weekday = weekdayIndexOfKey(selectedKey);
  const start = Math.max(0, index - weekday);
  return dateKeys.slice(start, start + 7);
}

/** Индекс дня недели (0 = пн) по ключу «2026-11-11». */
function weekdayIndexOfKey(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

// ── Свайп ────────────────────────────────────────────────────────────────────

export type SwipeDirection = 'next' | 'prev';

/**
 * Направление горизонтального свайпа: влево — «next», вправо — «prev».
 * Вертикальные и короткие (порог 48 px) жесты день не листают.
 */
export function swipeDirection(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  threshold = 48,
): SwipeDirection | null {
  const dx = endX - startX;
  const dy = endY - startY;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return null;
  if (Math.abs(dx) <= Math.abs(dy)) return null;
  return dx < 0 ? 'next' : 'prev';
}

// ── Подписи количества пар ───────────────────────────────────────────────────

const PAIR_FORMS = ['пара', 'пары', 'пар'] as const;

/** «3 пары», «1 пара», «5 пар» — для счётчиков в списке недели. */
export function pairsLabel(count: number): string {
  return `${count} ${pluralRu(count, PAIR_FORMS)}`;
}

// ── Переключатель вида: URL с переносом контекста ────────────────────────────

/**
 * Ссылка переключателя вида с переносом «куда смотрит студент»: день ↔ неделя
 * ↔ месяц обмениваются датой (?date → ключ ISO-недели → ?month). Мусорные
 * параметры игнорируются; без параметров остаются дефолты страницы
 * (десктоп — неделя «сейчас», мобильный — «сегодня»).
 */
export function buildViewHref(current: URLSearchParams, next: ScheduleView, now: Date): string {
  const params = new URLSearchParams({ view: next });

  const date = parseDateKey(current.get('date') ?? undefined);
  const monday = mondayOfIsoWeekKey(current.get('week') ?? '');
  const month = parseMonthKey(current.get('month') ?? undefined);
  const focus = date ?? monday ?? (month ? monthFocusDate(month, now) : null);

  if (next === 'day') {
    if (focus) params.set('date', moscowDateKey(focus));
  } else if (next === 'week') {
    if (focus) params.set('week', isoWeekKeyOf(focus));
  } else {
    const picked =
      month ??
      (focus ? { year: moscowParts(focus).year, month: moscowParts(focus).month } : null);
    if (picked) params.set('month', formatMonthKey(picked));
  }
  return `/schedule?${params.toString()}`;
}

/** Фокус месяца: текущий месяц → «сегодня», другой месяц → 1-е число. */
function monthFocusDate({ year, month }: YearMonth, now: Date): Date {
  const p = moscowParts(now);
  return p.year === year && p.month === month
    ? startOfMoscowDay(now)
    : fromMoscowWallClock(year, month, 1);
}
