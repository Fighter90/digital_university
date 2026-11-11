// DIG-21 — арифметика времени расписания в часовом поясе Europe/Moscow.
//
// Заметка задачи: «Не хранить локальное время без пояса». Механика:
//  - чтение «настенных» компонент (Y/M/D h:m:s) — через Intl.DateTimeFormat
//    с timeZone (без зависимостей: date-fns-tz не подключаем);
//  - построение мгновения из московских настенных компонент — стандартный
//    двупроходный алгоритм (offset → ts → повторный offset) на том же Intl;
//  - наружу время отдаётся ISO 8601 с офсетом (`2026-11-11T10:00:00+03:00`).
//
// Москва с 2014 года живёт без перехода на летнее время (+03:00), но все
// функции написаны зона-независимо — офсет вычисляется, а не захардкожен.
// Модуль чистый (без серверных импортов) — используется и данными, и UI,
// и покрыт юнит-тестами (tests/schedule.test.ts).

export const MOSCOW_TZ = 'Europe/Moscow';

export interface MoscowParts {
  year: number;
  /** 1..12 (не 0-базированный месяц JS Date). */
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export interface DateRange {
  /** Включительно. */
  from: Date;
  /** Исключительно — полуинтервал [from, to). */
  to: Date;
}

export interface SemesterBounds {
  /** 1 сентября 00:00 MSK (включительно) — или 9 февраля для весны. */
  start: Date;
  /** Граница семестра (исключительно): 25 января / 30 июня. */
  end: Date;
  /** «Осенний семестр 2026/27». */
  label: string;
}

type PartsFormatter = Intl.DateTimeFormat;

const formatterCache = new Map<string, PartsFormatter>();

function zoneFormatter(tz: string): PartsFormatter {
  let fmt = formatterCache.get(tz);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatterCache.set(tz, fmt);
  }
  return fmt;
}

function zoneParts(tz: string, date: Date): MoscowParts {
  const parts = zoneFormatter(tz).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes): number => {
    const raw = parts.find((p) => p.type === type)?.value ?? '0';
    return Number(raw);
  };
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour') % 24, // некоторые ICU выдают «24» для полуночи
    minute: get('minute'),
    second: get('second'),
  };
}

/** Офсет зоны в миллисекундах в момент `date` (вычисляется, не константа). */
export function timeZoneOffsetMs(tz: string, date: Date): number {
  const p = zoneParts(tz, date);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - date.getTime();
}

/** Офсет зоны в виде «±HH:MM» (для ISO-строк). */
export function timeZoneOffsetLabel(tz: string, date: Date): string {
  const minutes = Math.round(timeZoneOffsetMs(tz, date) / 60_000);
  const sign = minutes < 0 ? '-' : '+';
  const abs = Math.abs(minutes);
  return `${sign}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`;
}

export function moscowOffsetLabel(date: Date): string {
  return timeZoneOffsetLabel(MOSCOW_TZ, date);
}

export function moscowParts(date: Date): MoscowParts {
  return zoneParts(MOSCOW_TZ, date);
}

/** Дата (фрагмент ISO) московского календарного дня: «2026-11-11». */
export function moscowDateKey(date: Date): string {
  const p = moscowParts(date);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

/** «09:05» московского времени. */
export function formatMoscowTime(date: Date): string {
  const p = moscowParts(date);
  return `${pad2(p.hour)}:${pad2(p.minute)}`;
}

/** ISO 8601 с офсетом пояса: «2026-11-11T10:00:00+03:00». */
export function toMoscowIso(date: Date): string {
  const p = moscowParts(date);
  return (
    `${p.year}-${pad2(p.month)}-${pad2(p.day)}` +
    `T${pad2(p.hour)}:${pad2(p.minute)}:${pad2(p.second)}${moscowOffsetLabel(date)}`
  );
}

/**
 * Мгновение из московских настенных компонент (месяц 1-базированный; day
 * может выходить за пределы месяца — нормализуется как в Date.UTC).
 * Двупроходный алгоритм устойчив к сдвигам офсета (DST-зоны).
 */
export function fromMoscowWallClock(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute, second);
  let ts = guess - timeZoneOffsetMs(MOSCOW_TZ, new Date(guess));
  const secondOffset = timeZoneOffsetMs(MOSCOW_TZ, new Date(ts));
  if (guess - secondOffset !== ts) {
    ts = guess - secondOffset;
  }
  return new Date(ts);
}

/** 00:00:00 московского календарного дня, содержащего `date`. */
export function startOfMoscowDay(date: Date): Date {
  const p = moscowParts(date);
  return fromMoscowWallClock(p.year, p.month, p.day, 0, 0, 0);
}

/**
 * Сдвиг на настенные дни (сохраняет московское время суток): 23:40 + 1 день =
 * 23:40 следующего дня, независимо от офсетов на границе.
 */
export function shiftMoscowDays(date: Date, days: number): Date {
  const p = moscowParts(date);
  return fromMoscowWallClock(p.year, p.month, p.day + days, p.hour, p.minute, p.second);
}

/** Индекс дня недели в Москве: 0 = понедельник … 6 = воскресенье. */
export function moscowWeekdayIndex(date: Date): number {
  const p = moscowParts(date);
  const jsDay = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay(); // 0 = Sun
  return (jsDay + 6) % 7;
}

/** Понедельник 00:00 московской недели, содержащей `date`. */
export function startOfMoscowWeek(date: Date): Date {
  const p = moscowParts(date);
  return fromMoscowWallClock(p.year, p.month, p.day - moscowWeekdayIndex(date), 0, 0, 0);
}

/** Московская неделя: [понедельник 00:00, следующий понедельник 00:00). */
export function weekRange(date: Date): DateRange {
  const from = startOfMoscowWeek(date);
  return { from, to: shiftMoscowDays(from, 7) };
}

/** Московские сутки: [00:00, 00:00 следующего дня). */
export function dayRange(date: Date): DateRange {
  const from = startOfMoscowDay(date);
  return { from, to: shiftMoscowDays(from, 1) };
}

/** Московский календарный месяц (month: 1..12): [1-е число, 1-е следующего). */
export function monthRange(year: number, month: number): DateRange {
  return {
    from: fromMoscowWallClock(year, month, 1),
    to: fromMoscowWallClock(year, month + 1, 1),
  };
}

/**
 * Границы текущего семестра по московской дате `now` (учебный календарь
 * прототипа, вымышленный): осень 1 сентября — 25 января, весна 9 февраля —
 * 30 июня; июль/август относятся к предстоящей осени.
 */
export function semesterBounds(now: Date): SemesterBounds {
  const p = moscowParts(now);
  const padYear = (y: number) => String(y % 100).padStart(2, '0');
  if (p.month >= 9) {
    return {
      label: `Осенний семестр ${p.year}/${padYear(p.year + 1)}`,
      start: fromMoscowWallClock(p.year, 9, 1),
      end: fromMoscowWallClock(p.year + 1, 1, 25),
    };
  }
  if (p.month >= 2 && p.month <= 6) {
    return {
      label: `Весенний семестр ${p.year - 1}/${padYear(p.year)}`,
      start: fromMoscowWallClock(p.year, 2, 9),
      end: fromMoscowWallClock(p.year, 6, 30),
    };
  }
  if (p.month >= 7) {
    return {
      label: `Осенний семестр ${p.year}/${padYear(p.year + 1)}`,
      start: fromMoscowWallClock(p.year, 9, 1),
      end: fromMoscowWallClock(p.year + 1, 1, 25),
    };
  }
  // Январь: хвост осеннего семестра предыдущей осени.
  return {
    label: `Осенний семестр ${p.year - 1}/${padYear(p.year)}`,
    start: fromMoscowWallClock(p.year - 1, 9, 1),
    end: fromMoscowWallClock(p.year, 1, 25),
  };
}

/**
 * Страница-неделя для листания расписания: неделя, отстоящая на `delta`
 * недель от недели, содержащей `date`, обрезанная по границам семестра.
 * Неделя целиком вне семестра → null (страницы нет — UI отключает «листать»).
 */
export function pageMoscowWeek(
  date: Date,
  delta: number,
  bounds: SemesterBounds,
): DateRange | null {
  const target = shiftMoscowDays(startOfMoscowWeek(date), delta * 7);
  const to = shiftMoscowDays(target, 7);
  if (to.getTime() <= bounds.start.getTime()) return null;
  if (target.getTime() >= bounds.end.getTime()) return null;
  return {
    from: target < bounds.start ? bounds.start : target,
    to: to > bounds.end ? bounds.end : to,
  };
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}
