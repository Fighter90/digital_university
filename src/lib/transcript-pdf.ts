// DIG-27 — выписка из зачётной книжки: модель строк + сборка PDF.
//
// Приёмка задачи: «Выписка PDF скачивается без заявки и очереди» —
// GET /api/grades/transcript собирает этот документ на лету по скоупу
// сессии. Кириллица рисуется векторным шрифтом (pdf/vector-font.ts),
// поэтому PDF открывается в любом просмотрщике без вложенных шрифтов.
//
// DIG-82 (BUG-01 вар. А): в блоке «Проверка подлинности» печатается
// СКАНИРУЕМЫЙ QR-код со ссылкой на /verify/<код> (энкодер pdf/qr.ts,
// тот же, что у справки DIG-47); пунктирная рамка-заглушка и обещание
// «QR появится» сняты. Код проверки регистрируется в реестре справок
// вызывающим роутом. Данные в выписке — только вымышленные, на
// документе плашка «Концепт для конкурса».

import { PdfWriter, type PdfColor } from './pdf/pdf-writer';
import { qrMatrix } from './pdf/qr';
import { t, type Locale } from '@/lib/i18n';

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
  /** Код проверки подлинности (запись реестра справок). */
  code: string;
  /**
   * Полный URL страницы проверки — кодируется в QR и печатается текстом
   * (`${origin}/verify/${code}`; origin роут берёт из запроса).
   */
  verifyUrl: string;
  /**
   * DIG-84 — язык документа (cookie локали сессии; дефолт 'ru' — прежний
   * документ байт-в-байт). Демо-контент (ФИО, дисциплины) не переводится,
   * семестры и типы контроля локализует вызывающий роут.
   */
  locale?: Locale;
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
/** Сторона QR-кода в точках (~34 мм) — уверенно сканируется с телефона. */
const QR_SIZE = 96;
/** Ширина текста блока проверки в символах, чтобы не заходить под QR. */
const BLOCK_WRAP_CHARS = 55;

// Ширины колонок таблицы (в пикселях шрифта; шрифт моноширинный).
const COL_NAME = 40;
const COL_CONTROL = 12;
const COL_CREDITS = 4;
const COL_GRADE = 5;

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
  const locale = options.locale ?? 'ru';
  const tr = (key: Parameters<typeof t>[1], vars?: Record<string, string | number>): string =>
    t(locale, key, vars);
  const lines: StyledLine[] = [];
  const push = (text: string, style: LineStyle = 'body'): void => {
    lines.push({ text, style });
  };
  const blank = (): void => {
    lines.push({ text: '', style: 'small' });
  };

  push(tr('transcript.title'), 'title');
  push(tr('transcript.university'), 'small');
  push(tr('transcript.concept'), 'small');
  blank();

  if (data.student) {
    push(tr('transcript.student', { name: data.student.fullName }));
    push(
      tr('transcript.groupCourse', { group: data.student.groupName, course: data.student.course }),
    );
    push(tr('transcript.program', { program: data.student.program }));
    push(tr('transcript.gradebookNo', { number: data.student.gradebookNumber }));
  } else {
    push(tr('transcript.studentMissing'));
  }
  push(tr('transcript.issueDate', { date: formatDate(options.now) }));
  blank();

  for (const semester of data.semesters) {
    push(semester.label, 'heading');
    push(
      pad(tr('transcript.col.discipline'), COL_NAME) +
        pad(tr('transcript.col.control'), COL_CONTROL) +
        pad(tr('transcript.col.credits'), COL_CREDITS) +
        pad(tr('transcript.col.final'), COL_GRADE) +
        tr('transcript.col.date'),
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
      tr('transcript.semesterLine', {
        average: fmt2(semester.average),
        earned: semester.creditsEarned,
        total: semester.creditsTotal,
      }),
      'accent',
    );
    blank();
  }

  if (data.semesters.length === 0) {
    push(tr('transcript.noGrades'), 'accent');
    blank();
  }

  push(tr('transcript.overallAverage', { average: fmt2(data.overallAverage) }));
  push(
    tr('transcript.creditsEarned', {
      earned: data.creditsEarned,
      required: data.creditsRequired,
    }),
  );
  blank();

  // ── Подпись документа: код, ссылка и QR (DIG-82) ──────────────────────────
  // Строки блока переносятся по BLOCK_WRAP_CHARS, чтобы текст не заходил
  // под квадрат QR справа.
  const pushWrapped = (text: string, style: LineStyle = 'body'): void => {
    for (const chunk of wrapLine(text, BLOCK_WRAP_CHARS)) lines.push({ text: chunk, style });
  };
  const verifyTitle = tr('transcript.verifyTitle');
  push(verifyTitle, 'heading');
  pushWrapped(tr('transcript.verifyCode', { code: options.code }), 'accent');
  pushWrapped(tr('transcript.verifyLink', { url: options.verifyUrl }), 'small');
  pushWrapped(tr('transcript.generated', { datetime: formatDateTime(options.now) }), 'small');

  return lines;
}

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

/**
 * Матрица QR страницы проверки (для тестов и писателя). null — URL
 * длиннее ёмкости версии 6 (на практике не встречается).
 */
export function transcriptQrMatrix(data: TranscriptData, options: TranscriptOptions) {
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

/** Собрать PDF-файл выписки (детерминированный при равных входах). */
export function buildTranscriptPdf(data: TranscriptData, options: TranscriptOptions): Uint8Array {
  const writer = new PdfWriter();
  const lines = transcriptStyledLines(data, options);
  const maxWidth = writer.width - MARGIN * 2;

  // Заголовок блока проверки ищется по локализованной строке (DIG-84).
  const locale = options.locale ?? 'ru';
  const headingIndex = lines.findIndex((line) => line.text === t(locale, 'transcript.verifyTitle'));
  let qrTop: number | null = null;

  // Верх каждой строки; блок проверки с QR целиком живёт на одной странице.
  let y = MARGIN;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    const scale = STYLE_SCALE[line.style];
    const height = writer.textHeight(scale);

    // Если заголовку блока не хватает места под квадрат QR — уносим блок
    // на новую страницу (QR не должен пересекать нижнее поле).
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
