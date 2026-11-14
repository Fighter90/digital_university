// DIG-47 — PDF-шаблон справки об обучении (с QR и проверкой подлинности).
//
// Собирается тем же минимальным писателем, что и выписка DIG-27
// (pdf/pdf-writer.ts + векторный шрифт pdf/vector-font.ts): кириллица
// рисуется глифами-прямоугольниками, документ открывается в любом
// просмотрщике без вложенных шрифтов. Ключевое отличие от выписки:
// справка несёт СКАНИРУЕМЫЙ QR-код со ссылкой на публичную страницу
// /verify/<код> (энкодер pdf/qr.ts) и код проверки текстом.
//
// Данные — только вымышленные, на документе плашка «Концепт для
// конкурса». Вывод детерминирован при равных входах (проверяется тестом).

import { PdfWriter, type PdfColor } from './pdf/pdf-writer';
import { qrMatrix } from './pdf/qr';

export interface CertificatePdfData {
  /** Тип документа, например «Справка об обучении». */
  documentType: string;
  /** Номер справки, например «СП-2026-000412». */
  number: string;
  issuedAt: Date;
  fullName: string;
  program: string;
  course: number;
  /** «очная» / «очно-заочная» / «заочная». */
  studyForm: string;
  /** Назначение справки; null → «по месту требования». */
  purpose: string | null;
  /** Канонический код проверки (группами по 4). */
  verificationCode: string;
  /** Полный URL страницы проверки (кодируется в QR и печатается текстом). */
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
/** Ширина текстового блока в символах моноширинной сетки при SCALE_BODY. */
const WRAP_CHARS = 66;

type LineStyle = 'title' | 'heading' | 'body' | 'small' | 'accent';

interface StyledLine {
  text: string;
  style: LineStyle;
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

/** Перенос по словам под WRAP_CHARS символов сетки. */
function wrapText(text: string): string[] {
  if (text.length <= WRAP_CHARS) return [text];
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > WRAP_CHARS) {
    let cut = rest.lastIndexOf(' ', WRAP_CHARS);
    if (cut <= 0) cut = WRAP_CHARS;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut).trimStart();
  }
  if (rest.length > 0) chunks.push(rest);
  return chunks;
}

/**
 * Полная модель строк справки — экспортируется для тестов (та же сетка,
 * что рисуется в PDF; переносы длинных реквизитов уже применены).
 */
export function certificateLines(data: CertificatePdfData): string[] {
  return certificateStyledLines(data).map((line) => line.text);
}

function certificateStyledLines(data: CertificatePdfData): StyledLine[] {
  const lines: StyledLine[] = [];
  const push = (text: string, style: LineStyle = 'body'): void => {
    for (const chunk of wrapText(text)) lines.push({ text: chunk, style });
  };
  const blank = (): void => {
    lines.push({ text: '', style: 'small' });
  };

  // ── Шапка вымышленного вуза ───────────────────────────────────────────────
  push('ЦИФРОВОЙ ДЕКАНАТ', 'heading');
  push('Демонстрационный университет (вымышленный)', 'small');
  push('Концепт для конкурса. Все данные вымышленные.', 'small');
  blank();

  // ── Заголовок документа ───────────────────────────────────────────────────
  push(data.documentType.toUpperCase(), 'title');
  blank();

  // ── Реквизиты и персональные данные ───────────────────────────────────────
  push(`Номер: ${data.number}`);
  push(`Дата выдачи: ${formatDate(data.issuedAt)}`);
  push(`Кому: ${data.fullName}`);
  push(`Программа: ${data.program}`);
  push(`Курс: ${data.course}   Форма обучения: ${data.studyForm}`);
  push(`Назначение: ${data.purpose ?? 'по месту требования'}`);
  blank();

  // ── Текст документа ───────────────────────────────────────────────────────
  push(
    `Документ подтверждает, что ${data.fullName} является студентом ` +
      `${data.course} курса программы ${data.program} (форма обучения: ` +
      `${data.studyForm}) по состоянию на ${formatDate(data.issuedAt)} год.`,
  );
  blank();

  // ── Статус электронного документа ─────────────────────────────────────────
  push('Электронный документ прототипа, подпись не требуется.', 'small');
  blank();

  // ── Проверка подлинности ──────────────────────────────────────────────────
  push('Проверка подлинности документа', 'heading');
  push(`Код проверки: ${data.verificationCode}`, 'accent');
  push(`Проверить по ссылке или QR-коду: ${data.verifyUrl}`, 'small');
  push('Отсканируйте QR-код камерой телефона или откройте ссылку.', 'small');
  push(
    'Получатель (банк, ведомство) видит только тип документа, дату, статус и фамилию с инициалами.',
    'small',
  );

  return lines;
}

/**
 * Матрица QR страницы проверки (для тестов и для писателя). null — URL
 * длиннее ёмкости версии 6 (на практике не встречается).
 */
export function certificateQrMatrix(data: CertificatePdfData) {
  return qrMatrix(data.verifyUrl);
}

/** Собрать PDF-файл справки (детерминированный при равных входах). */
export function buildCertificatePdf(data: CertificatePdfData): Uint8Array {
  const writer = new PdfWriter();
  const qrSize = 108; // точки (~38 мм) — уверенно сканируется с телефона

  // QR в правом верхнем углу; шапка печатается левее блока.
  const qr = certificateQrMatrix(data);
  const qrX = writer.width - MARGIN - qrSize;
  const qrY = MARGIN;
  if (qr) {
    const modulePt = qrSize / qr.length;
    for (let y = 0; y < qr.length; y += 1) {
      const row = qr[y]!;
      for (let x = 0; x < row.length; x += 1) {
        if (row[x]) {
          writer.addRect(qrX + x * modulePt, qrY + y * modulePt, modulePt, modulePt, INK);
        }
      }
    }
  }

  // Первые три строки (шапка) — левее QR; остальной текст — на всю ширину.
  const lines = certificateStyledLines(data);
  const HEADER_LINES = 3;
  let y = MARGIN;

  lines.forEach((line, index) => {
    const scale = STYLE_SCALE[line.style];
    const height = writer.textHeight(scale);
    const indent = index < HEADER_LINES ? MARGIN : MARGIN;
    const available =
      index < HEADER_LINES ? writer.width - indent * 2 - qrSize - 12 : writer.width - MARGIN * 2;

    for (const chunk of wrapForWidth(line.text, writer, scale, Math.max(available, 200))) {
      if (y + height > writer.height - MARGIN) {
        writer.addPage();
        y = MARGIN;
      }
      writer.drawText(chunk, indent, y, scale, STYLE_COLOR[line.style]);
      y += height + LINE_GAP;
    }
  });

  return writer.build();
}

/** Разбиение строки на чанки под доступную ширину (моноширинный шрифт). */
function wrapForWidth(text: string, writer: PdfWriter, scale: number, maxWidth: number): string[] {
  if (text.length === 0 || writer.textWidth(text, scale) <= maxWidth) return [text];
  const maxChars = Math.max(8, Math.floor(maxWidth / (6 * scale)));
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

/** ASCII-имя файла для Content-Disposition (кириллица недопустима). */
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
