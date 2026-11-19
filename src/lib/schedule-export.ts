// DIG-101 — экспорт расписания (MD / XLSX / PDF): чистые генераторы.
//
// Все три формата строятся из одной модели дней (buildScheduleExportDays):
// пары по московским дням, внутри дня — по времени начала, колонки
// «Время / Дисциплина / Тип / Аудитория / Преподаватель» по локали
// (RU-канон, EN по словарю). Скоуп данных здесь не решается: роуты
// (src/app/api/export/*) читают пары только через requireDataCtx →
// getSchedule, IDOR невозможен по построению.
//
// MD — markdown-таблица по дням (копипаста в конспект/чат).
// XLSX — собственный минимальный OOXML-писатель (src/lib/xlsx/xlsx-writer.ts),
//   новых зависимостей нет (та же философия, что у PDF DIG-27).
// PDF — векторный шрифт проекта (src/lib/pdf/pdf-writer.ts, кириллица),
//   моноширинная сетка колонок как у выписки/справок.

import { formatDayTitle, formatDayTitleFromKey, parseDateKey } from '@/lib/schedule-cards';
import { weekLabel } from '@/lib/schedule-view';
import {
  formatMoscowTime,
  moscowDateKey,
  shiftMoscowDays,
  startOfMoscowDay,
  startOfMoscowWeek,
} from '@/lib/schedule-time';
import { lessonKindLabel } from '@/lib/dashboard-format';
import { t, type Locale } from '@/lib/i18n';
import { PdfWriter, type PdfColor } from '@/lib/pdf/pdf-writer';
import { buildXlsx } from '@/lib/xlsx/xlsx-writer';
import type { ScheduleEventRow } from '@/server/data/types';

// ── Диапазон экспорта ────────────────────────────────────────────────────────

export type ScheduleExportView = 'day' | 'week';

export interface ScheduleExportRange {
  view: ScheduleExportView;
  /** Ключ запрошенной даты «2026-11-19» (день фокуса; не понедельник). */
  dateKey: string;
  /** Полуночь MSK: сам день (day) или понедельник недели (week). */
  from: Date;
  /** Исключающая полуночь следующего дня / понедельника. */
  to: Date;
  /** Понедельник недели даты (для подписи диапазона недели). */
  monday: Date;
}

/**
 * ?view=day|week + ?date=YYYY-MM-DD → диапазон выгрузки. Мусорные
 * параметры (как и на странице расписания) откатываются к дефолтам:
 * view — «день», дата — «сегодня».
 */
export function resolveScheduleExportRange(
  rawView: string | undefined,
  rawDate: string | undefined,
  now: Date,
): ScheduleExportRange {
  const view: ScheduleExportView = rawView === 'week' ? 'week' : 'day';
  const day = parseDateKey(rawDate) ?? startOfMoscowDay(now);
  const monday = startOfMoscowWeek(day);
  const from = view === 'week' ? monday : startOfMoscowDay(day);
  const to = shiftMoscowDays(from, view === 'week' ? 7 : 1);
  return { view, dateKey: moscowDateKey(day), from, to, monday };
}

/** ASCII-имя файла для Content-Disposition: schedule-YYYY-MM-DD-day|week.ext */
export function scheduleExportFilename(
  dateKey: string,
  view: ScheduleExportView,
  ext: 'md' | 'xlsx' | 'pdf',
): string {
  return `schedule-${dateKey}-${view}.${ext}`;
}

/** Подпись диапазона: «Понедельник, 16 ноября» / «16 – 22 ноября 2026». */
export function scheduleExportRangeLabel(range: ScheduleExportRange, locale: Locale): string {
  return range.view === 'week'
    ? weekLabel(range.monday, locale)
    : formatDayTitle(range.from, locale);
}

// ── Модель дней экспорта ─────────────────────────────────────────────────────

export interface ScheduleExportRow {
  /** «10:00–11:30» (московское время). */
  time: string;
  discipline: string;
  /** «Лекция» / «Lecture» — по локали. */
  kind: string;
  /** «ауд. 305» / «онлайн» (EN: «Room 305» / «online»). */
  room: string;
  teacher: string;
}

export interface ScheduleExportDay {
  /** «Среда, 19 ноября» — заголовок секции дня. */
  label: string;
  rows: ScheduleExportRow[];
}

function exportRoomLabel(room: string, locale: Locale): string {
  return room.trim().toLowerCase() === 'онлайн'
    ? t(locale, 'schedule.room.online')
    : t(locale, 'schedule.room.label', { room: room.trim() });
}

/** Строки слоя данных → дни экспорта (по московским дням, по времени). */
export function buildScheduleExportDays(
  rows: readonly ScheduleEventRow[],
  locale: Locale,
): ScheduleExportDay[] {
  const byDay = new Map<string, ScheduleEventRow[]>();
  for (const row of [...rows].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())) {
    const key = moscowDateKey(row.startsAt);
    const bucket = byDay.get(key);
    if (bucket) bucket.push(row);
    else byDay.set(key, [row]);
  }
  return [...byDay.entries()].map(([dateKey, dayRows]) => ({
    label: formatDayTitleFromKey(dateKey, locale),
    rows: dayRows.map((row) => ({
      time: `${formatMoscowTime(row.startsAt)}–${formatMoscowTime(row.endsAt)}`,
      discipline: row.disciplineName,
      kind: lessonKindLabel(row.kind, locale),
      room: exportRoomLabel(row.room, locale),
      teacher: row.teacherName,
    })),
  }));
}

/** Заголовки колонок по локали: «Время | Дисциплина | Тип | Аудитория | Преподаватель». */
export function scheduleExportColumns(locale: Locale): string[] {
  return [
    t(locale, 'schedule.export.col.time'),
    t(locale, 'schedule.export.col.subject'),
    t(locale, 'schedule.export.col.type'),
    t(locale, 'schedule.export.col.room'),
    t(locale, 'schedule.export.col.teacher'),
  ];
}

interface ScheduleExportDocOptions {
  locale: Locale;
  /** Подпись диапазона (scheduleExportRangeLabel вызывающего роута). */
  rangeLabel: string;
}

const docTitle = (locale: Locale): string => t(locale, 'schedule.export.docTitle');
const conceptLine = (locale: Locale): string => t(locale, 'concept.banner');

// ── Markdown ─────────────────────────────────────────────────────────────────

const mdCell = (value: string): string => value.replace(/\|/g, '\\|').replace(/\n/g, ' ');

const mdTable = (rows: readonly ScheduleExportRow[], locale: Locale): string[] => {
  const columns = scheduleExportColumns(locale);
  const lines = [`| ${columns.join(' | ')} |`, '| --- | --- | --- | --- | --- |'];
  for (const row of rows) {
    lines.push(
      `| ${[row.time, row.discipline, row.kind, row.room, row.teacher].map(mdCell).join(' | ')} |`,
    );
  }
  return lines;
};

/** Markdown-документ: заголовок, диапазон, плашка концепта, секции дней. */
export function buildScheduleMarkdown(
  days: readonly ScheduleExportDay[],
  options: ScheduleExportDocOptions,
): string {
  const { locale, rangeLabel } = options;
  const lines: string[] = [
    `# ${docTitle(locale)}`,
    '',
    rangeLabel,
    '',
    `> ${conceptLine(locale)}`,
    '',
  ];
  if (days.length === 0) {
    lines.push(...mdTable([], locale), '', t(locale, 'schedule.export.empty'), '');
    return lines.join('\n');
  }
  for (const day of days) {
    lines.push(`## ${day.label}`, '');
    lines.push(...mdTable(day.rows, locale));
    lines.push('');
  }
  return lines.join('\n').trimEnd() + '\n';
}

// ── XLSX ─────────────────────────────────────────────────────────────────────

/** XLSX: лист «Расписание», строка 1 — заголовки колонок, по секции на день. */
export function buildScheduleXlsx(
  days: readonly ScheduleExportDay[],
  options: ScheduleExportDocOptions & { sheetName?: string },
): Uint8Array {
  const { locale } = options;
  const table: string[][] = [scheduleExportColumns(locale)];
  if (days.length === 0) {
    table.push([t(locale, 'schedule.export.empty')]);
  }
  for (const day of days) {
    table.push([day.label]);
    for (const row of day.rows) {
      table.push([row.time, row.discipline, row.kind, row.room, row.teacher]);
    }
  }
  return buildXlsx([{ name: options.sheetName ?? docTitle(locale), rows: table }]);
}

// ── PDF (механизм справок/выписки: векторный шрифт, моноширинная сетка) ─────

const INK: PdfColor = [0.09, 0.09, 0.1]; // neutral-900
const MUTED: PdfColor = [0.45, 0.47, 0.5];
const ACCENT: PdfColor = [0.84, 0.3, 0.24]; // коралл бренда

const SCALE_BODY = 1.2;
const SCALE_SMALL = 1.1;
const SCALE_HEADING = 1.6;
const SCALE_TITLE = 2.1;

const MARGIN = 36;
const LINE_GAP = 5;

// Ширины колонок в символах моноширинной сетки (SCALE_SMALL: 79×6.6pt = 521pt
// влезает в A4 с полями 36pt). Длинные значения подрезаются с «...».
const COL_TIME = 11;
const COL_DISCIPLINE = 22;
const COL_KIND = 13;
const COL_ROOM = 10;
const COL_TEACHER = 23;

type LineStyle = 'title' | 'heading' | 'body' | 'small' | 'accent';

interface StyledLine {
  text: string;
  style: LineStyle;
}

const pad = (text: string, width: number): string => {
  const clean = text.length > width ? text.slice(0, width) : text;
  return clean.padEnd(width, ' ');
};

/** Подрезка длинных значений под ширину колонки (глифа «…» в шрифте нет). */
const clip = (text: string, width: number): string =>
  text.length > width ? `${text.slice(0, width - 3).trimEnd()}...` : text;

const exportRowText = (row: ScheduleExportRow): string =>
  pad(clip(row.time, COL_TIME), COL_TIME) +
  pad(clip(row.discipline, COL_DISCIPLINE), COL_DISCIPLINE) +
  pad(clip(row.kind, COL_KIND), COL_KIND) +
  pad(clip(row.room, COL_ROOM), COL_ROOM) +
  clip(row.teacher, COL_TEACHER);

/** Модель строк PDF (те же строки, что рисуются — моносетка держит колонки). */
function schedulePdfStyledLines(
  days: readonly ScheduleExportDay[],
  options: ScheduleExportDocOptions,
): StyledLine[] {
  const { locale, rangeLabel } = options;
  const lines: StyledLine[] = [];
  const push = (text: string, style: LineStyle = 'body'): void => {
    lines.push({ text, style });
  };
  const blank = (): void => {
    lines.push({ text: '', style: 'small' });
  };

  push(docTitle(locale), 'title');
  push(rangeLabel, 'small');
  push(conceptLine(locale), 'small');
  blank();

  if (days.length === 0) {
    push(t(locale, 'schedule.export.empty'), 'accent');
    return lines;
  }
  days.forEach((day, index) => {
    if (index > 0) blank();
    push(day.label, 'heading');
    push(
      pad(clip(t(locale, 'schedule.export.col.time'), COL_TIME), COL_TIME) +
        pad(clip(t(locale, 'schedule.export.col.subject'), COL_DISCIPLINE), COL_DISCIPLINE) +
        pad(clip(t(locale, 'schedule.export.col.type'), COL_KIND), COL_KIND) +
        pad(clip(t(locale, 'schedule.export.col.room'), COL_ROOM), COL_ROOM) +
        t(locale, 'schedule.export.col.teacher'),
      'small',
    );
    for (const row of day.rows) push(exportRowText(row));
  });
  return lines;
}

/** Полная модель строк PDF (для юнит-тестов состава документа). */
export function schedulePdfLines(
  days: readonly ScheduleExportDay[],
  options: ScheduleExportDocOptions,
): string[] {
  return schedulePdfStyledLines(days, options).map((line) => line.text);
}

const STYLE_SCALE: Record<LineStyle, number> = {
  title: SCALE_TITLE,
  heading: SCALE_HEADING,
  body: SCALE_BODY,
  small: SCALE_SMALL,
  accent: SCALE_BODY,
};

const STYLE_COLOR: Record<LineStyle, PdfColor> = {
  title: INK,
  heading: INK,
  body: INK,
  small: MUTED,
  accent: ACCENT,
};

/** Собрать PDF-файл экспорта (детерминированный при равных входах). */
export function buildSchedulePdf(
  days: readonly ScheduleExportDay[],
  options: ScheduleExportDocOptions,
): Uint8Array {
  const writer = new PdfWriter();
  const lines = schedulePdfStyledLines(days, options);
  const maxWidth = writer.width - MARGIN * 2;

  let y = MARGIN;
  for (const line of lines) {
    const scale = STYLE_SCALE[line.style];
    const height = writer.textHeight(scale);
    if (y + height > writer.height - MARGIN) {
      writer.addPage();
      y = MARGIN;
    }
    if (line.text.length > 0) {
      if (line.style === 'title') {
        const x = MARGIN + Math.max(0, (maxWidth - writer.textWidth(line.text, scale)) / 2);
        writer.drawText(line.text, x, y, scale, STYLE_COLOR[line.style]);
      } else {
        writer.drawText(line.text, MARGIN, y, scale, STYLE_COLOR[line.style]);
      }
    }
    y += height + LINE_GAP;
  }

  return writer.build();
}
