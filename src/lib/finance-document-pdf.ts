// DIG-41 — демо-PDF финансового документа (квитанция, договор, акт, счёт).
//
// «Скачать квитанцию» и «Скачать» в списке документов отдают этот PDF:
// роут /api/finance/documents/<id> собирает его на лету по скоупу сессии.
// Кириллица рисуется векторным шрифтом (pdf/vector-font.ts) — документ
// открывается в любом просмотрщике и детерминирован при равных входах.
//
// Критерий приёмки DIG-41: никаких реквизитов банка и платёжных форм —
// на документе плашка «Концепт для конкурса» и пометка «не является
// платёжным документом». Данные только вымышленные.

import { PdfWriter, type PdfColor } from './pdf/pdf-writer';

export interface FinanceDocumentPdfRow {
  label: string;
  value: string;
}

export interface FinanceDocumentPdfInput {
  /** «Квитанция» — вид документа (метка каталога). */
  kindLabel: string;
  /** «Квитанция на оплату по договору» — заголовок документа. */
  title: string;
  number: string;
  date: Date;
  studentName: string;
  groupName: string;
  /** Содержательные строки (договор, период, платёж, статус…). */
  rows: FinanceDocumentPdfRow[];
  /** null — у документа нет суммы (договор). */
  amountLabel: string | null;
  amountValue: string | null;
}

export interface FinanceDocumentPdfOptions {
  now: Date;
}

const INK: PdfColor = [0.09, 0.09, 0.1]; // neutral-900
const MUTED: PdfColor = [0.45, 0.47, 0.5];
const ACCENT: PdfColor = [0.84, 0.3, 0.24]; // коралл бренда (акценты)

const SCALE_BODY = 1.2;
const SCALE_SMALL = 1.1;
const SCALE_HEADING = 1.4;
const SCALE_TITLE = 2;

const MARGIN = 44;
const LINE_GAP = 5;
const LABEL_WIDTH = 22; // моноширинная сетка «метка: значение»

type LineStyle = 'title' | 'heading' | 'body' | 'small' | 'accent';

interface StyledLine {
  text: string;
  style: LineStyle;
}

const pad = (text: string, width: number): string => {
  const clean = text.length > width ? text.slice(0, width) : text;
  return clean.padEnd(width, ' ');
};

/**
 * Приведение строки к глифам векторного шрифта: NBSP → пробел,
 * длинные/средние тире → дефис. Роут передаёт строки каталога —
 * санитизация гарантирует покрытие глифами при любом входе.
 */
function pdfSafe(text: string): string {
  return text
    .replaceAll('\u00A0', ' ')
    .replaceAll('\u202F', ' ')
    .replaceAll('—', '-')
    .replaceAll('–', '-');
}

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

/** «48 000 руб.» с ОБЫЧНЫМИ пробелами — NBSP в векторном шрифте нет. */
export function moneyPlain(amount: number): string {
  const digits = String(Math.round(amount));
  let grouped = '';
  for (let i = 0; i < digits.length; i += 1) {
    if (i > 0 && (digits.length - i) % 3 === 0) grouped += ' ';
    grouped += digits[i];
  }
  return `${grouped} руб.`;
}

/**
 * Полная модель строк документа (те же строки, что рисуются в PDF —
 * моноширинная сетка держит колонки). Экспортируется для тестов.
 */
export function financeDocumentPdfLines(
  data: FinanceDocumentPdfInput,
  options: FinanceDocumentPdfOptions,
): string[] {
  return financeDocumentStyledLines(data, options).map((line) => line.text);
}

function financeDocumentStyledLines(
  data: FinanceDocumentPdfInput,
  options: FinanceDocumentPdfOptions,
): StyledLine[] {
  const lines: StyledLine[] = [];
  const push = (text: string, style: LineStyle = 'body'): void => {
    lines.push({ text: pdfSafe(text), style });
  };
  const blank = (): void => {
    lines.push({ text: '', style: 'small' });
  };

  push(data.title, 'title');
  push('Цифровой деканат (демонстрационный вуз)', 'small');
  push('Концепт для конкурса. Все данные вымышленные.', 'small');
  push('Демонстрационный документ, не является платёжным документом.', 'accent');
  blank();

  push(`Вид документа: ${data.kindLabel}`);
  push(`Студент: ${data.studentName}`);
  push(`Группа: ${data.groupName}`);
  push(`Номер документа: ${data.number}`);
  push(`Дата документа: ${formatDate(data.date)}`);
  blank();

  for (const row of data.rows) {
    push(`${pad(`${row.label}:`, LABEL_WIDTH)}${row.value}`);
  }
  if (data.amountLabel !== null && data.amountValue !== null) {
    push(`${pad(`${data.amountLabel}:`, LABEL_WIDTH)}${data.amountValue}`, 'accent');
  }
  blank();

  push('Реальная оплата через кабинет не проводится, реквизиты не передаются.', 'small');
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

/** Собрать PDF-файл документа (детерминированный при равных входах). */
export function buildFinanceDocumentPdf(
  data: FinanceDocumentPdfInput,
  options: FinanceDocumentPdfOptions,
): Uint8Array {
  const writer = new PdfWriter();
  const lines = financeDocumentStyledLines(data, options);
  const maxWidth = writer.width - MARGIN * 2;

  let y = MARGIN;
  lines.forEach((line) => {
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
  });

  return writer.build();
}

/** ASCII-имя файла для Content-Disposition (кириллица в имени недопустима). */
export function financeDocumentFilename(data: FinanceDocumentPdfInput, now: Date): string {
  const kind = data.kindLabel
    .toLowerCase()
    .replaceAll(' ', '-')
    .replace(/[^a-z0-9-]/g, '');
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `finance-${kind || 'document'}-${get('year')}-${get('month')}-${get('day')}.pdf`;
}
