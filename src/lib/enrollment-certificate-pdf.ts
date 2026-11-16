// DIG-30 — «Справка об обучении»: PDF мгновенной заявки.
//
// Кириллица рисуется векторным шрифтом (pdf/vector-font.ts), как в
// выписке из зачётки (transcript-pdf.ts): PDF открывается в любом
// просмотрщике без вложенных шрифтов. Документ детерминирован при
// равных входах; все данные вымышленные, на документе плашка
// «Концепт для конкурса». Мгновенная заявка создаётся сразу в READY —
// скачивание идёт через GET /api/requests/[number]/document.
//
// Код проверки печатается текстом (160 бит, base32, формат DIG-47);
// сканируемый QR и публичная страница /verify/<код> — задача DIG-47,
// формат документа при её запуске не меняется.

import { PdfWriter, type PdfColor } from './pdf/pdf-writer';

export interface CertificateStudent {
  fullName: string;
  groupName: string;
  course: number;
  faculty: string;
  program: string;
  studyForm: string;
  gradebookNumber: string;
}

export interface EnrollmentCertificateData {
  student: CertificateStudent;
  /** Ключевой параметр заявки («для банка», «для военкомата», …). */
  purpose: string;
}

export interface EnrollmentCertificateOptions {
  now: Date;
  /** Код проверки подлинности (newVerificationCode). */
  code: string;
  /** Номер заявки «ЗД-ГГГГ-NNNNNN» — реквизит документа. */
  requestNumber: string;
}

const INK: PdfColor = [0.09, 0.09, 0.1]; // neutral-900
const MUTED: PdfColor = [0.45, 0.47, 0.5];
const ACCENT: PdfColor = [0.84, 0.3, 0.24]; // коралл бренда

const SCALE_BODY = 1.2;
const SCALE_SMALL = 1.1;
const SCALE_HEADING = 1.6;
const SCALE_TITLE = 2.1;
const MARGIN = 44;
const LINE_GAP = 5;
/** Срок действия справки по умолчанию — 30 календарных дней. */
export const CERTIFICATE_VALIDITY_DAYS = 30;

type LineStyle = 'title' | 'heading' | 'body' | 'small' | 'accent';

interface StyledLine {
  text: string;
  style: LineStyle;
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

export function certificateValidUntil(now: Date): Date {
  return new Date(now.getTime() + CERTIFICATE_VALIDITY_DAYS * 24 * 3600 * 1000);
}

/**
 * Полная модель строк документа (те же строки, что рисуются в PDF —
 * моноширинная сетка). Экспортируется для тестов.
 */
export function certificateLines(
  data: EnrollmentCertificateData,
  options: EnrollmentCertificateOptions,
): string[] {
  return certificateStyledLines(data, options).map((line) => line.text);
}

function certificateStyledLines(
  data: EnrollmentCertificateData,
  options: EnrollmentCertificateOptions,
): StyledLine[] {
  const lines: StyledLine[] = [];
  const push = (text: string, style: LineStyle = 'body'): void => {
    lines.push({ text, style });
  };
  const blank = (): void => {
    lines.push({ text: '', style: 'small' });
  };

  push('Справка об обучении', 'title');
  push('Цифровой деканат (демонстрационный вуз)', 'small');
  push('Концепт для конкурса. Все данные вымышленные.', 'small');
  blank();

  const { student } = data;
  const surname = student.fullName.split(' ')[0] ?? student.fullName;
  push(`Настоящая справка выдана ${student.fullName},`, 'body');
  push(`студенту(ке) ${student.course} курса группы ${student.groupName},`, 'body');
  push(`обучающемуся(ейся) по программе ${student.program} (${student.studyForm} форма),`, 'body');
  push(`факультет ${student.faculty}, номер зачётной книжки ${student.gradebookNumber},`, 'body');
  push(`в том, что ${surname} действительно является студентом`, 'body');
  push('демонстрационного вуза по состоянию на текущую дату.', 'body');
  blank();

  push(`Назначение справки: ${data.purpose}`, 'heading');
  push(`Дата выдачи: ${formatDate(options.now)}`);
  push(`Срок действия: до ${formatDate(certificateValidUntil(options.now))}`);
  push(`Номер заявки: ${options.requestNumber}`, 'accent');
  blank();

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

/** Собрать PDF-файл справки (детерминированный при равных входах). */
export function buildEnrollmentCertificatePdf(
  data: EnrollmentCertificateData,
  options: EnrollmentCertificateOptions,
): Uint8Array {
  const writer = new PdfWriter();
  const lines = certificateStyledLines(data, options);
  const maxWidth = writer.width - MARGIN * 2;
  const qrSize = 72;

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

  // Рамка под QR — справа от блока «Проверка подлинности» (DIG-47).
  const headingIndex = lines.findIndex((line) => line.text === 'Проверка подлинности документа');
  if (headingIndex >= 0) {
    const top = lineTops[headingIndex] ?? MARGIN;
    const bottom = Math.min(y - LINE_GAP, top + qrSize);
    writer.addDashedRect(writer.width - MARGIN - qrSize, top, qrSize, bottom - top, ACCENT);
  }

  return writer.build();
}

/** ASCII-имя файла для Content-Disposition (кириллица в имени недопустима). */
export function certificateFilename(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `certificate-${get('year')}-${get('month')}-${get('day')}.pdf`;
}
