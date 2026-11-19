// DIG-101 — юнит-контракт генераторов экспорта расписания (чистые модули):
// резолвер диапазона day/week (+ имена файлов), сборка дней из строк слоя
// данных, markdown-таблица (Время/Дисциплина/Тип/Аудитория/Преподаватель,
// RU/EN), XLSX (валидный OOXML-пакет: ZIP, CRC32, worksheet XML,
// XML-экранирование) и PDF (строки документа + %PDF-вывод).
import { describe, expect, it } from 'vitest';

import {
  buildScheduleExportDays,
  buildScheduleMarkdown,
  buildSchedulePdf,
  buildScheduleXlsx,
  resolveScheduleExportRange,
  scheduleExportFilename,
  scheduleExportRangeLabel,
  schedulePdfLines,
} from '@/lib/schedule-export';
import { crc32 } from '@/lib/xlsx/xlsx-writer';
import { formatDayTitle } from '@/lib/schedule-cards';
import { fromMoscowWallClock, startOfMoscowWeek } from '@/lib/schedule-time';
import type { ScheduleEventRow } from '@/server/data/types';

const MONDAY = fromMoscowWallClock(2026, 11, 16, 10, 0); // понедельник
const TUESDAY = fromMoscowWallClock(2026, 11, 17, 12, 0);
const NEXT_WEEK = fromMoscowWallClock(2026, 11, 24, 10, 0); // вне диапазона недели

const mk = (id: string, startsAt: Date, over: Partial<ScheduleEventRow> = {}): ScheduleEventRow => {
  const duration = (over.endsAt?.getTime() ?? 0) || 90 * 60_000;
  return {
    id,
    groupName: 'ПИ-21',
    disciplineCode: 'PI21-MATH',
    disciplineName: 'Математический анализ',
    date: startsAt,
    startsAt,
    endsAt: over.endsAt ?? new Date(startsAt.getTime() + duration),
    kind: 'SEMINAR',
    room: '305',
    teacherName: 'Кузнецова Ксения Кирилловна',
    status: 'SCHEDULED',
    note: null,
    ...over,
  };
};

const rows = [
  mk('e-lab', TUESDAY, { kind: 'LAB', disciplineName: 'Программирование' }),
  mk('e-lecture', MONDAY, { kind: 'LECTURE', disciplineName: 'Информатика' }),
];

describe('resolveScheduleExportRange (DIG-101)', () => {
  const NOW = MONDAY;

  it('view=day — только московский день даты', () => {
    const range = resolveScheduleExportRange('day', '2026-11-19', NOW);
    expect(range.view).toBe('day');
    expect(range.dateKey).toBe('2026-11-19');
    expect(range.from).toEqual(fromMoscowWallClock(2026, 11, 19, 0, 0));
    expect(range.to).toEqual(fromMoscowWallClock(2026, 11, 20, 0, 0));
  });

  it('view=week — с понедельника по воскресенье недели даты (исключающе)', () => {
    const range = resolveScheduleExportRange('week', '2026-11-19', NOW);
    expect(range.view).toBe('week');
    expect(range.from).toEqual(fromMoscowWallClock(2026, 11, 16, 0, 0));
    expect(range.to).toEqual(fromMoscowWallClock(2026, 11, 23, 0, 0));
  });

  it('мусорные view/date — день «сегодня», без исключений', () => {
    const range = resolveScheduleExportRange('month', 'banana', NOW);
    expect(range.view).toBe('day');
    expect(range.dateKey).toBe('2026-11-16');
    expect(range.from).toEqual(fromMoscowWallClock(2026, 11, 16, 0, 0));
  });

  it('имя файла: schedule-YYYY-MM-DD-day|week.<ext> (ASCII)', () => {
    expect(scheduleExportFilename('2026-11-19', 'day', 'md')).toBe('schedule-2026-11-19-day.md');
    expect(scheduleExportFilename('2026-11-16', 'week', 'xlsx')).toBe(
      'schedule-2026-11-16-week.xlsx',
    );
    expect(scheduleExportFilename('2026-11-16', 'week', 'pdf')).toBe(
      'schedule-2026-11-16-week.pdf',
    );
  });

  it('подпись диапазона: день — «Понедельник, 16 ноября», неделя — «16 – 22 ноября 2026»', () => {
    const day = resolveScheduleExportRange('day', '2026-11-16', NOW);
    expect(scheduleExportRangeLabel(day, 'ru')).toBe(formatDayTitle(day.from, 'ru'));
    const week = resolveScheduleExportRange('week', '2026-11-19', NOW);
    expect(scheduleExportRangeLabel(week, 'ru')).toBe('16 – 22 ноября 2026');
    expect(scheduleExportRangeLabel(week, 'en')).toBe('November 16 – 22, 2026');
  });
});

describe('buildScheduleExportDays', () => {
  it('группировка по дням и сортировка по времени (пн → вт), подписи дней', () => {
    const days = buildScheduleExportDays(rows, 'ru');
    expect(days).toHaveLength(2);
    expect(days[0]!.label).toBe(formatDayTitle(MONDAY, 'ru'));
    expect(days[0]!.rows[0]).toMatchObject({
      time: '10:00–11:30',
      discipline: 'Информатика',
      kind: 'Лекция',
      room: 'ауд. 305',
      teacher: 'Кузнецова Ксения Кирилловна',
    });
    expect(days[1]!.rows[0]).toMatchObject({
      time: '12:00–13:30',
      discipline: 'Программирование',
      kind: 'Лабораторная',
    });
  });

  it('EN: подписи типов и аудитории по словарю, онлайн-пара без аудитории', () => {
    const days = buildScheduleExportDays(
      [mk('e-online', MONDAY, { room: 'Онлайн', kind: 'CONSULTATION' })],
      'en',
    );
    expect(days[0]!.rows[0]).toMatchObject({ kind: 'Consultation', room: 'online' });
  });
});

describe('buildScheduleMarkdown', () => {
  it('день: заголовок, плашка концепта, колонки RU, строка пары', () => {
    const days = buildScheduleExportDays([rows[1]!], 'ru');
    const md = buildScheduleMarkdown(days, { locale: 'ru', rangeLabel: 'Понедельник, 16 ноября' });
    expect(md).toContain('# Расписание');
    expect(md).toContain('Понедельник, 16 ноября');
    expect(md).toContain('Концепт для конкурса');
    expect(md).toContain('| Время | Дисциплина | Тип | Аудитория | Преподаватель |');
    expect(md).toContain('| --- | --- | --- | --- | --- |');
    expect(md).toContain(
      '| 10:00–11:30 | Информатика | Лекция | ауд. 305 | Кузнецова Ксения Кирилловна |',
    );
  });

  it('неделя: секция на каждый день, обе пары на месте', () => {
    const days = buildScheduleExportDays(rows, 'ru');
    const md = buildScheduleMarkdown(days, { locale: 'ru', rangeLabel: '16 – 22 ноября 2026' });
    expect(md).toContain(`## ${formatDayTitle(MONDAY, 'ru')}`);
    expect(md).toContain(`## ${formatDayTitle(TUESDAY, 'ru')}`);
    expect(md).toContain('Информатика');
    expect(md).toContain('Программирование');
  });

  it('EN: колонки Time/Subject/Type/Room/Teacher', () => {
    const md = buildScheduleMarkdown(buildScheduleExportDays([rows[1]!], 'en'), {
      locale: 'en',
      rangeLabel: 'Monday, November 16',
    });
    expect(md).toContain('# Schedule');
    expect(md).toContain('| Time | Subject | Type | Room | Teacher |');
    expect(md).toContain(
      '| 10:00–11:30 | Информатика | Lecture | Room 305 | Кузнецова Ксения Кирилловна |',
    );
  });

  it('пустой диапазон: заголовок и колонки на месте, «Пар нет»', () => {
    const md = buildScheduleMarkdown([], { locale: 'ru', rangeLabel: '16 – 22 ноября 2026' });
    expect(md).toContain('# Расписание');
    expect(md).toContain('| Время | Дисциплина | Тип | Аудитория | Преподаватель |');
    expect(md).toContain('Пар нет');
  });
});

describe('buildScheduleXlsx', () => {
  it('валидный OOXML-пакет: ZIP-сигнатура, обязательные части, CRC32 сходится', () => {
    const bytes = buildScheduleXlsx(buildScheduleExportDays(rows, 'ru'), {
      locale: 'ru',
      sheetName: 'Расписание',
      rangeLabel: '16 – 22 ноября 2026',
    });
    expect(bytes[0]).toBe(0x50); // P
    expect(bytes[1]).toBe(0x4b); // K
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const eocdOffset = bytes.length - 22;
    expect(view.getUint32(eocdOffset, true)).toBe(0x06054b50); // EOCD PK\x05\x06
    const total = view.getUint16(eocdOffset + 10, true);
    expect(total).toBeGreaterThanOrEqual(4);

    // Каждый локальный заголовок: CRC32 содержимого совпадает с записанным.
    let offset = 0;
    while (view.getUint32(offset, true) === 0x04034b50) {
      const crc = view.getUint32(offset + 14, true);
      const compressedSize = view.getUint32(offset + 18, true);
      const nameLength = view.getUint16(offset + 26, true);
      const extraLength = view.getUint16(offset + 28, true);
      const dataStart = offset + 30 + nameLength + extraLength;
      const content = bytes.subarray(dataStart, dataStart + compressedSize);
      expect(crc32(content)).toBe(crc);
      offset = dataStart + compressedSize;
    }
  });

  it('worksheet: строка заголовков RU и строки пар; спецсимволы экранированы', () => {
    const bytes = buildScheduleXlsx(buildScheduleExportDays(rows, 'ru'), {
      locale: 'ru',
      sheetName: 'Расписание',
      rangeLabel: '16 – 22 ноября 2026',
    });
    const decoder = new TextDecoder();
    // Имена частей и содержимое ищем побайтово через хедеры (см. unzip выше).
    const names: string[] = [];
    const xmls: string[] = [];
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let offset = 0;
    while (view.getUint32(offset, true) === 0x04034b50) {
      const compressedSize = view.getUint32(offset + 18, true);
      const nameLength = view.getUint16(offset + 26, true);
      const extraLength = view.getUint16(offset + 28, true);
      names.push(decoder.decode(bytes.subarray(offset + 30, offset + 30 + nameLength)));
      const dataStart = offset + 30 + nameLength + extraLength;
      xmls.push(decoder.decode(bytes.subarray(dataStart, dataStart + compressedSize)));
      offset = dataStart + compressedSize;
    }
    expect(names).toContain('[Content_Types].xml');
    expect(names).toContain('xl/workbook.xml');
    expect(names).toContain('xl/worksheets/sheet1.xml');
    const sheet = xmls[names.indexOf('xl/worksheets/sheet1.xml')]!;
    // Ячейки — inlineStr (с xml:space="preserve"); проверяем содержимое <t>.
    expect(sheet).toContain('>Время</t>');
    expect(sheet).toContain('>Информатика</t>');
    expect(sheet).toContain('>10:00–11:30</t>');

    const tricky = buildScheduleXlsx(
      buildScheduleExportDays([mk('e-x', MONDAY, { disciplineName: 'A<B&"C' })], 'ru'),
      { locale: 'ru', sheetName: 'Расписание', rangeLabel: '16 – 22 ноября 2026' },
    );
    expect(new TextDecoder().decode(tricky)).toContain('A&lt;B&amp;&quot;C');
  });
});

describe('PDF экспорта расписания', () => {
  it('строки документа: заголовок, диапазон, плашка концепта, день, пара', () => {
    const lines = schedulePdfLines(buildScheduleExportDays(rows, 'ru'), {
      locale: 'ru',
      rangeLabel: '16 – 22 ноября 2026',
    });
    const joined = lines.join('\n');
    expect(joined).toContain('Расписание');
    expect(joined).toContain('16 – 22 ноября 2026');
    expect(joined).toContain('Концепт для конкурса');
    expect(joined).toContain('Время');
    expect(joined).toContain('Дисциплина');
    expect(joined).toContain('Информатика');
  });

  it('buildSchedulePdf отдаёт валидный PDF-вывод писателя проекта', () => {
    const pdf = buildSchedulePdf(buildScheduleExportDays(rows, 'ru'), {
      locale: 'ru',
      rangeLabel: '16 – 22 ноября 2026',
    });
    const head = String.fromCharCode(...pdf.subarray(0, 5));
    expect(head).toBe('%PDF-');
  });
});

describe('санити диапазона недели против соседних данных', () => {
  it('пара следующей недели не попадает в week-экспорт текущей', () => {
    const weekFrom = resolveScheduleExportRange('week', '2026-11-19', MONDAY).from;
    const weekTo = resolveScheduleExportRange('week', '2026-11-19', MONDAY).to;
    expect(NEXT_WEEK.getTime()).toBeGreaterThanOrEqual(weekTo.getTime());
    expect(MONDAY.getTime()).toBeGreaterThanOrEqual(weekFrom.getTime());
    expect(startOfMoscowWeek(NEXT_WEEK).getTime()).toBeGreaterThan(MONDAY.getTime());
  });
});
