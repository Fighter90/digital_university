// DIG-27 — выписка из зачётной книжки: модель строк + сборка PDF.
//
// Приёмка задачи: «Выписка PDF скачивается без заявки и очереди» —
// GET /api/grades/transcript собирает этот документ на лету по скоупу
// сессии. Кириллица рисуется векторным шрифтом (pdf/vector-font.ts),
// поэтому PDF открывается в любом просмотрщике без вложенных шрифтов.
//
// «Механизм справок с QR»: сейчас печатается код проверки (160 бит,
// base32) и пунктирная рамка под QR; сканируемый QR и публичная страница
// /verify/<код> — задача DIG-47, формат документа при её запуске не
// меняется. Данные в выписке — только вымышленные, на документе плашка
// «Концепт для конкурса».

import { PdfWriter, type PdfColor } from './pdf/pdf-writer';

export interface TranscriptStudent {
  fullName: string;
  groupName: string;
  course: number;
  program: string;
  gradebookNumber: string;
}

export interface TranscriptDiscipline {
  name: string;
  /** Метка типа контроля («Экзамен» / «Диф. зачёт» / «Зачёт»). */
  controlType: string;
  credits: number;
  /** Итоговая оценка (завершённая дисциплина); null — ещё идёт. */
  grade: number | null;
  /** Дата выставления итога (последняя оценка); null — оценок нет. */
  completedAt: Date | null;
}

export interface TranscriptSemester {
  label: string;
  /** Средний балл семестра (взвешенный кредитами); null — нет значений. */
  average: number | null;
  creditsEarned: number;
  creditsTotal: number;
  disciplines: TranscriptDiscipline[];
}

export interface TranscriptData {
  student: TranscriptStudent | null;
  semesters: TranscriptSemester[];
  overallAverage: number | null;
  creditsEarned: number;
  creditsRequired: number;
}

export interface TranscriptOptions {
  now: Date;
  code: string;
}

const INK: PdfColor = [0.09, 0.09, 0.1]; // neutral-900
const MUTED: PdfColor = [0.45, 0.47, 0.5];
const ACCENT: PdfColor = [0.84, 0.3, 0.24]; // коралл бренда (рамки/акценты)

const SCALE_BODY = 1.2;
const SCALE_SMALL = 1.1;
const SCALE_HEADING = 1.6;
const SCALE_TITLE = 2.1;

const MARGIN = 44;
const LINE_GAP = 5;

// Ширины колонок таблицы (в пикселях шрифта; шрифт моноширинный).
const COL_NAME = 40;
const COL_CONTROL = 12;
const COL_CREDITS = 4;
const COL_GRADE = 5;
const COL_DATE = 12;

type LineStyle = 'title' | 'heading' | 'body' | 'small' | 'accent';

interface StyledLine {
  text: string;
  style: LineStyle;
}

const pad = (text: string, width: number): string => {
  const clean = text.length > width ? text.slice(0, width) : text;
  return clean.padEnd(width, ' ');
};

const fmt2 = (value: number | null, dash = '-'): string =>
  value === null ? dash : String(Math.round(value * 100) / 100);

const formatDate = (date: Date): string => {
  const parts = new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('day')}.${get('month')}.${get('year')}`;
};

const formatDateTime = (date: Date): string => {
  const parts = new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('day')}.${get('month')}.${get('year')} ${get('hour')}:${get('minute')}`;
};

/**
 * Полная модель строк выписки (те же строки, что рисуются в PDF —
 * моноширинная сетка держит колонки). Экспортируется для тестов.
 */
export function transcriptLines(data: TranscriptData, options: TranscriptOptions): string[] {
  return transcriptStyledLines(data, options).map((line) => line.text);
}

function transcriptStyledLines(data: TranscriptData, options: TranscriptOptions): StyledLine[] {
  const lines: StyledLine[] = [];
  const push = (text: string, style: LineStyle = 'body'): void => {
    lines.push({ text, style });
  };
  const blank = (): void => {
    lines.push({ text: '', style: 'small' });
  };

  push('Выписка из зачётной книжки', 'title');
  push('Цифровой деканат (демонстрационный вуз)', 'small');
  push('Концепт для конкурса. Все данные вымышленные.', 'small');
  blank();

  if (data.student) {
    push(`Студент: ${data.student.fullName}`);
    push(`Группа: ${data.student.groupName}   Курс: ${data.student.course}`);
    push(`Программа: ${data.student.program}`);
    push(`Номер зачётной книжки: ${data.student.gradebookNumber}`);
  } else {
    push('Студент: —');
  }
  push(`Дата выдачи: ${formatDate(options.now)}`);
  blank();

  for (const semester of data.semesters) {
    push(semester.label, 'heading');
    push(
      pad('Дисциплина', COL_NAME) +
        pad('Контроль', COL_CONTROL) +
        pad('Кр', COL_CREDITS) +
        pad('Итог', COL_GRADE) +
        'Дата',
      'small',
    );
    for (const discipline of semester.disciplines) {
      push(
        pad(discipline.name, COL_NAME) +
          pad(discipline.controlType, COL_CONTROL) +
          pad(String(discipline.credits), COL_CREDITS) +
          pad(discipline.grade === null ? '-' : String(discipline.grade), COL_GRADE) +
          (discipline.completedAt ? formatDate(discipline.completedAt) : '-'),
      );
    }
    push(
      `Средний балл семестра: ${fmt2(semester.average)}   Кредиты: ${semester.creditsEarned} из ${semester.creditsTotal}`,
      'accent',
    );
    blank();
  }

  if (data.semesters.length === 0) {
    push('Оценки в зачётной книжке отсутствуют.', 'accent');
    blank();
  }

  push(`Средний балл за всё время: ${fmt2(data.overallAverage)}`);
  push(`Кредиты набрано: ${data.creditsEarned} из ${data.creditsRequired}`);
  blank();

  // ── Подпись документа: код проверки + рамка под QR (DIG-47) ──────────────
  push('Проверка подлинности документа', 'heading');
  push(`Код проверки: ${options.code}`, 'accent');
  push('Сканируемый QR-код появится вместе с запуском проверки справок.', 'small');
  push(`Электронный документ прототипа. Сформировано: ${formatDateTime(options.now)}`, 'small');

  return lines;
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

/** Собрать PDF-файл выписки (детерминированный при равных входах). */
export function buildTranscriptPdf(data: TranscriptData, options: TranscriptOptions): Uint8Array {
  const writer = new PdfWriter();
  const lines = transcriptStyledLines(data, options);
  const maxWidth = writer.width - MARGIN * 2;
  const qrSize = 72;

  // Верх каждой строки — чтобы привязать рамку QR к подписному блоку.
  const lineTops: number[] = [];

  let y = MARGIN;
  lines.forEach((line) => {
    const scale = STYLE_SCALE[line.style];
    const height = writer.textHeight(scale);

    if (y + height > writer.height - MARGIN) {
      writer.addPage();
      y = MARGIN;
    }

    lineTops.push(y);

    if (line.text.length > 0) {
      if (line.style === 'title') {
        const x = MARGIN + Math.max(0, (maxWidth - writer.textWidth(line.text, scale)) / 2);
        writer.drawText(line.text, x, y, scale, STYLE_COLOR[line.style]);
      } else {
        writer.drawText(line.text, MARGIN, y, scale, STYLE_COLOR[line.style]);
      }
    }
    y += height + LINE_GAP;
  });

  // Рамка под QR — справа от блока «Проверка подлинности» (DIG-47
  // положит сюда сканируемый QR со ссылкой на /verify/<код>).
  const headingIndex = lines.findIndex((line) => line.text === 'Проверка подлинности документа');
  if (headingIndex >= 0) {
    const top = lineTops[headingIndex] ?? MARGIN;
    const bottom = Math.min(y - LINE_GAP, top + qrSize);
    writer.addDashedRect(writer.width - MARGIN - qrSize, top, qrSize, bottom - top, ACCENT);
  }

  return writer.build();
}

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Код проверки выписки: 32 символа base32 (160 бит энтропии, приёмка
 * DIG-47 требует ≥128 бит), группы по 4 символа. Генератор передаётся
 * явно — тесты фиксируют детерминизм и формат.
 */
export function newVerificationCode(rng: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < 32; i += 1) {
    code += BASE32[Math.min(BASE32.length - 1, Math.floor(rng() * BASE32.length))];
  }
  return code.match(/.{4}/g)!.join('-');
}

/** ASCII-имя файла для Content-Disposition (кириллица в имени недопустима). */
export function transcriptFilename(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `transcript-${get('year')}-${get('month')}-${get('day')}.pdf`;
}
