// DIG-27 — минимальный писатель PDF (векторные прямоугольники + невидимый
// текстовый слой).
//
// Зачем: в PDF нет стандартного шрифта с кириллицей, а вкладывать шрифт
// в репозиторий нельзя. Выписка из зачётки (и позже справка DIG-47)
// рисуется глифами-прямоугольниками (см. vector-font.ts), поэтому от
// PDF-писателя нужны только страницы, `re f`-операции и корректная
// xref-таблица. DIG-85 (BUG-16): каждая видимая строка дублируется
// невидимым текстом (Helvetica, `3 Tr`, кириллица транслитерацией) —
// скринридеры читают документ, код проверки и ссылка копируются.
// Вывод полностью детерминирован (проверяется тестом).
//
// Координаты: ТОЧКИ (1/72 дюйма), страница A4 595×842. API принимает
// верхний левый угол прямоугольника в «экранных» координатах (y вниз),
// перевод в систему PDF (y вверх) — внутри.

import { GLYPH_ADVANCE, GLYPH_HEIGHT, glyphRows, textWidthPx } from './vector-font';

export type PdfColor = readonly [number, number, number];

const A4_WIDTH = 595;
const A4_HEIGHT = 842;

const fmt = (x: number): string => String(Math.round(x * 100) / 100);
const colorOps = (c: PdfColor): string => `${fmt(c[0])} ${fmt(c[1])} ${fmt(c[2])} rg`;

interface RectOp {
  x: number;
  y: number;
  w: number;
  h: number;
  color: PdfColor;
}

/**
 * Невидимая текстовая строка (DIG-85 / BUG-16): дублирует видимую строку
 * из глифов-прямоугольников текстом стандартного Helvetica (WinAnsi,
 * без вложенных файлов шрифтов) в режиме отрисовки `3 Tr` — скринридеры
 * читают документ, а код проверки/ссылка копируются посимвольно.
 */
interface TextOp {
  /** Текст ПОСЛЕ транслитерации и PDF-экранирования (готовая строка Tj). */
  literal: string;
  x: number;
  /** Базовая линия в системе PDF (y вверх). */
  y: number;
  size: number;
}

/**
 * Транслитерация кириллицы латиницей для текстового слоя: в PDF нет
 * стандартного шрифта с кириллицей, а вкладывать TTF в прототип нельзя
 * (см. шапку vector-font.ts). ASCII проходит байт-в-байт (код проверки,
 * URL, даты), кириллица — читаемая транслитерация, прочие символы
 * опускаются (они рисуются видимой рамкой-заглушкой).
 */
const CYRILLIC_LATIN: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'j',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'c',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
};

function latinForTextLayer(text: string): string {
  let out = '';
  for (const ch of text) {
    const lower = ch.toLowerCase();
    const mapped = CYRILLIC_LATIN[lower];
    if (mapped !== undefined) {
      out += mapped === '' ? '' : ch === lower ? mapped : mapped.toUpperCase();
    } else if (ch >= ' ' && ch <= '~') {
      out += ch; // ASCII — без изменений (код проверки, URL, цифры, пунктуация)
    }
  }
  return out;
}

/** Экранирование строки в литерале PDF `( … ) Tj`. */
function pdfStringEscape(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

export class PdfWriter {
  readonly width: number;
  readonly height: number;
  private pages: RectOp[][] = [];
  private texts: TextOp[][] = [];

  constructor(options: { width?: number; height?: number } = {}) {
    this.width = options.width ?? A4_WIDTH;
    this.height = options.height ?? A4_HEIGHT;
    this.pages.push([]);
    this.texts.push([]);
  }

  /** Начать новую страницу (контент последующих `add*` уйдёт на неё). */
  addPage(): void {
    this.pages.push([]);
    this.texts.push([]);
  }

  get pageCount(): number {
    return this.pages.length;
  }

  /**
   * Прямоугольник; `y` — ВЕРХ в экранных координатах (вниз от верхнего
   * края страницы). Детерминизм: цвета и координаты округляются до сотых.
   */
  addRect(x: number, y: number, w: number, h: number, color: PdfColor): void {
    if (w <= 0 || h <= 0) return;
    this.pages[this.pages.length - 1]!.push({ x, y, w, h, color });
  }

  /** Пунктирная рамка (QR-заготовка и разделители выписки). */
  addDashedRect(
    x: number,
    y: number,
    w: number,
    h: number,
    color: PdfColor,
    options: { dash?: number; gap?: number; thickness?: number } = {},
  ): void {
    const dash = options.dash ?? 4;
    const gap = options.gap ?? 3;
    const t = options.thickness ?? 1;
    const rowLen = (len: number, offset: number): void => {
      let cursor = offset;
      while (cursor < offset + len) {
        const segment = Math.min(dash, offset + len - cursor);
        this.addRect(cursor, y, segment, t, color); // верхняя грань
        this.addRect(cursor, y + h - t, segment, t, color); // нижняя грань
        cursor += dash + gap;
      }
    };
    const colLen = (len: number, offset: number): void => {
      let cursor = offset;
      while (cursor < offset + len) {
        const segment = Math.min(dash, offset + len - cursor);
        this.addRect(x, cursor, t, segment, color); // левая грань
        this.addRect(x + w - t, cursor, t, segment, color); // правая грань
        cursor += dash + gap;
      }
    };
    rowLen(w, x);
    colLen(h, y);
  }

  /**
   * Текст векторным шрифтом. `y` — верх глифов в экранных координатах.
   * Незнакомые символы рисуются рамкой-заглушкой (тесты следят, чтобы
   * таких не было в тексте выписки).
   */
  drawText(
    text: string,
    x: number,
    y: number,
    scale: number,
    color: PdfColor,
    fallbackColor: PdfColor = color,
  ): void {
    // Текстовый слой (BUG-16): та же геометрия, невидимый режим `3 Tr`.
    const latin = latinForTextLayer(text);
    if (latin.length > 0) {
      this.texts[this.texts.length - 1]!.push({
        literal: pdfStringEscape(latin),
        x,
        y: this.height - (y + GLYPH_HEIGHT * scale),
        size: GLYPH_HEIGHT * scale,
      });
    }
    let cursor = x;
    for (const ch of text) {
      const rows = glyphRows(ch);
      if (!rows) {
        // Заглушка: рамка размером с глиф (видна при проверке покрытия).
        this.addDashedRect(cursor, y, 5 * scale, 8 * scale, fallbackColor, {
          dash: scale,
          gap: scale,
          thickness: scale,
        });
      } else {
        for (let r = 0; r < rows.length; r += 1) {
          const bits = rows[r]!;
          let runStart = -1;
          for (let b = 0; b <= 5; b += 1) {
            const set = b < 5 && ((bits >> (4 - b)) & 1) === 1;
            if (set && runStart === -1) runStart = b;
            if (!set && runStart !== -1) {
              this.addRect(
                cursor + runStart * scale,
                y + r * scale,
                (b - runStart) * scale,
                scale,
                color,
              );
              runStart = -1;
            }
          }
        }
      }
      cursor += GLYPH_ADVANCE * scale;
    }
  }

  /** Ширина текста в точках при данном масштабе (для центрирования). */
  textWidth(text: string, scale: number): number {
    return textWidthPx(text) * scale;
  }

  /** Высота строки шрифта в точках при данном масштабе. */
  textHeight(scale: number): number {
    return GLYPH_HEIGHT * scale;
  }

  /** Собрать PDF (Uint8Array, latin1-совместимые байты). */
  build(): Uint8Array {
    const objects: string[] = [];
    const pageCount = this.pages.length;
    // 1 = Catalog, 2 = Pages, дальше пары (Page, Contents) по страницам.
    const kids = this.pages.map((_, i) => `${3 + i * 2} 0 R`).join(' ');

    // /Lang (ru-RU) — подсказка скринридеру выбирать русский голос (BUG-16).
    objects.push(`<< /Type /Catalog /Pages 2 0 R /Lang (ru-RU) >>`);
    objects.push(`<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>`);
    this.pages.forEach((ops, i) => {
      const pageObj = 3 + i * 2;
      const contentObj = pageObj + 1;
      objects.push(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${this.width} ${this.height}] ` +
          `/Contents ${contentObj} 0 R /Resources << /Font << /F1 ` +
          `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >> ` +
          `>> >> >>`,
      );
      const rects = ops
        .map(
          (op) =>
            `q\n${colorOps(op.color)}\n${fmt(op.x)} ${fmt(this.height - op.y - op.h)} ${fmt(op.w)} ${fmt(op.h)} re\nf\nQ`,
        )
        .join('\n');
      // Невидимый текстовый слой: 3 Tr — не заливать, не обводить, не клипать.
      const texts = this.texts[i]!.map(
        (op) =>
          `BT\n/F1 ${fmt(op.size)} Tf\n3 Tr\n${fmt(op.x)} ${fmt(op.y)} Td\n(${op.literal}) Tj\nET`,
      ).join('\n');
      const stream = texts.length > 0 ? `${rects}\n${texts}` : rects;
      objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    });

    let out = '%PDF-1.4\n';
    const offsets: number[] = [];
    objects.forEach((body, i) => {
      offsets.push(out.length);
      out += `${i + 1} 0 obj\n${body}\nendobj\n`;
    });

    const xrefOffset = out.length;
    out += `xref\n0 ${objects.length + 1}\n`;
    out += '0000000000 65535 f\r\n';
    for (const offset of offsets) {
      out += `${String(offset).padStart(10, '0')} 00000 n\r\n`;
    }
    out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

    const bytes = new Uint8Array(out.length);
    for (let i = 0; i < out.length; i += 1) {
      bytes[i] = out.charCodeAt(i) & 0xff;
    }
    return bytes;
  }
}
