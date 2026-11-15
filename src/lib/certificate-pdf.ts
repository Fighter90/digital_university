// DIG-31 — PDF мгновенной справки: модель строк + сборка.
//
// Приёмка задачи: «для мгновенных — сразу кнопка „Скачать PDF"». Документ
// собирается писателем DIG-27 (PdfWriter + векторный шрифт — кириллица без
// вложенных файлов шрифтов). Данные только вымышленные, на документе
// плашка «Концепт для конкурса». Код проверки — тот же формат, что у
// выписки (160 бит base32); сканируемый QR и страница /verify/<код> —
// задача DIG-47, рамка под QR уже на месте.
import { PdfWriter, type PdfColor } from './pdf/pdf-writer';

export interface CertificateStudent {
  fullName: string;
  groupName: string;
  course: number;
  program: string;
  gradebookNumber: string;
}

export interface CertificateData {
  /** Название документа (заголовок заявки, например «Справка об обучении»). */
  title: string;
  /** Публичный номер заявки SR-… — печатается в документе. */
  number: string;
  issuedAt: Date;
  /** Код проверки (формат DIG-47); рамка под QR уже на месте. */
  code: string;
  student: CertificateStudent | null;
}

const INK: PdfColor = [0.09, 0.09, 0.1]; // neutral-900
const MUTED: PdfColor = [0.45, 0.47, 0.5];
const ACCENT: PdfColor = [0.84, 0.3, 0.24]; // коралл бренда

const SCALE_BODY = 1.2;
const SCALE_SMALL = 1.1;
const SCALE_HEADING = 1.6;
const SCALE_TITLE = 2.1;

const MARGIN = 44;
const LINE_GAP = 6;

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

/**
 * Полная модель строк справки (те же строки, что рисуются в PDF).
 * Экспортируется для тестов: покрытие глифов и текстов контракта.
 */
export function certificateLines(data: CertificateData): string[] {
  return certificateStyledLines(data).map((line) => line.text);
}

function certificateStyledLines(data: CertificateData): StyledLine[] {
  const lines: StyledLine[] = [];
  const push = (text: string, style: LineStyle = 'body'): void => {
    lines.push({ text, style });
  };
  const blank = (): void => {
    lines.push({ text: '', style: 'small' });
  };

  push('Цифровой деканат (демонстрационный вуз)', 'small');
  push(data.title, 'title');
  push('Концепт для конкурса. Все данные вымышленные.', 'small');
  blank();

  push(`Документ: ${data.title}`, 'heading');
  if (data.student) {
    push(`Студент: ${data.student.fullName}`);
    push(`Группа: ${data.student.groupName}   Курс: ${data.student.course}`);
    push(`Программа: ${data.student.program}`);
    push(`Номер зачётной книжки: ${data.student.gradebookNumber}`);
  } else {
    push('Студент: —');
  }
  push(`Номер заявки: ${data.number}`);
  push(`Дата выдачи: ${formatDate(data.issuedAt)}`);
  blank();

  push('Документ выдан деканатом в электронном виде и действует на территории', 'small');
  push('Российской Федерации без печати (демонстрационный прототип).', 'small');
  blank();

  // ── Подпись документа: код проверки + рамка под QR (DIG-47) ──────────────
  push('Проверка подлинности документа', 'heading');
  push(`Код проверки: ${data.code}`, 'accent');
  push('Сканируемый QR-код появится вместе с запуском проверки справок.', 'small');
  push(`Электронный документ прототипа. Сформировано: ${formatDate(data.issuedAt)}`, 'small');

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
export function buildCertificatePdf(data: CertificateData): Uint8Array {
  const writer = new PdfWriter();
  const lines = certificateStyledLines(data);
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

  // Рамка под QR — справа от блока «Проверка подлинности» (DIG-47 положит
  // сюда сканируемый QR со ссылкой на /verify/<код>).
  const headingIndex = lines.findIndex((line) => line.text === 'Проверка подлинности документа');
  if (headingIndex >= 0) {
    const top = lineTops[headingIndex] ?? MARGIN;
    const bottom = Math.min(y - LINE_GAP, top + qrSize);
    writer.addDashedRect(writer.width - MARGIN - qrSize, top, qrSize, bottom - top, ACCENT);
  }

  return writer.build();
}

/** ASCII-имя файла для Content-Disposition (кириллица в имени недопустима). */
export function certificateFilename(number: string): string {
  const safe = number.replace(/[^A-Za-z0-9-]/g, '');
  return `certificate-${safe}.pdf`;
}
