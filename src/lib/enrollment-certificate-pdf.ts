// DIG-30 — «Справка об обучении»: PDF мгновенной заявки.
//
// Кириллица рисуется векторным шрифтом (pdf/vector-font.ts), как в
// выписке из зачётки (transcript-pdf.ts): PDF открывается в любом
// просмотрщике без вложенных шрифтов. Документ детерминирован при
// равных входах; все данные вымышленные, на документе плашка
// «Концепт для конкурса». Мгновенная заявка создаётся сразу в READY —
// скачивание идёт через GET /api/requests/[number]/document.
//
// DIG-82 (BUG-01 вар. А): в блоке «Проверка подлинности» печатается
// СКАНИРУЕМЫЙ QR-код со ссылкой на публичную страницу /verify/<код>
// (энкодер pdf/qr.ts — тот же, что у справки заявки DIG-47); пунктирная
// рамка-заглушка и обещание «QR появится» сняты. Код проверки
// регистрируется в реестре справок вызывающим роутом.

import { PdfWriter, type PdfColor } from './pdf/pdf-writer';
import { qrMatrix } from './pdf/qr';

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
  /** Код проверки подлинности (запись реестра справок). */
  code: string;
  /** Номер заявки «ЗД-ГГГГ-NNNNNN» — реквизит документа. */
  requestNumber: string;
  /**
   * Полный URL страницы проверки — кодируется в QR и печатается текстом
   * (`${origin}/verify/${code}`; origin роут берёт из запроса).
   */
  verifyUrl: string;
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
/** Сторона QR-кода в точках (~34 мм) — уверенно сканируется с телефона. */
const QR_SIZE = 96;
/** Ширина текста блока проверки в символах, чтобы не заходить под QR. */
const BLOCK_WRAP_CHARS = 55;

/**
 * Перенос по словам/границе (тот же алгоритм, что у справки DIG-47):
 * URL длиннее ширины блока разбивается на несколько строк.
 */
function wrapLine(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > maxChars) {
    let cut = rest.lastIndexOf(' ', maxChars);
    if (cut <= 0) cut = maxChars;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut).trimStart();
  }
  if (rest.length > 0) chunks.push(rest);
  return chunks;
}

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

  // ── Блок проверки подлинности: код, ссылка и QR (DIG-82) ──────────────────
  // Строки блока переносятся по BLOCK_WRAP_CHARS, чтобы текст не заходил
  // под квадрат QR справа.
  const pushWrapped = (text: string, style: LineStyle = 'body'): void => {
    for (const chunk of wrapLine(text, BLOCK_WRAP_CHARS)) lines.push({ text: chunk, style });
  };
  push('Проверка подлинности документа', 'heading');
  pushWrapped(`Код проверки: ${options.code}`, 'accent');
  pushWrapped(`Проверить по ссылке или QR-коду: ${options.verifyUrl}`, 'small');
  pushWrapped(
    `Электронный документ прототипа. Сформировано: ${formatDateTime(options.now)}`,
    'small',
  );

  return lines;
}

/**
 * Матрица QR страницы проверки (для тестов и писателя). null — URL
 * длиннее ёмкости версии 6 (на практике не встречается).
 */
export function certificateQrMatrix(
  data: EnrollmentCertificateData,
  options: EnrollmentCertificateOptions,
) {
  return qrMatrix(options.verifyUrl);
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

  const headingIndex = lines.findIndex((line) => line.text === 'Проверка подлинности документа');
  let qrTop: number | null = null;
  let y = MARGIN;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    const scale = STYLE_SCALE[line.style];
    const height = writer.textHeight(scale);

    // Блок проверки с QR целиком живёт на одной странице: если заголовку
    // блока не хватает места под квадрат QR — уносим блок на новую.
    if (index === headingIndex && y + QR_SIZE > writer.height - MARGIN) {
      writer.addPage();
      y = MARGIN;
    }
    if (y + height > writer.height - MARGIN) {
      writer.addPage();
      y = MARGIN;
    }
    if (index === headingIndex) qrTop = y;

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

  // Сканируемый QR страницы проверки — справа от блока «Проверка
  // подлинности» (модули-квадраты, детерминированный порядок).
  if (qrTop !== null) {
    const matrix = qrMatrix(options.verifyUrl);
    if (matrix) {
      const modulePt = QR_SIZE / matrix.length;
      const qrX = writer.width - MARGIN - QR_SIZE;
      for (let row = 0; row < matrix.length; row += 1) {
        const cells = matrix[row]!;
        for (let col = 0; col < cells.length; col += 1) {
          if (cells[col]) {
            writer.addRect(qrX + col * modulePt, qrTop + row * modulePt, modulePt, modulePt, INK);
          }
        }
      }
    }
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
