// DIG-47 — QR-энкодер для PDF справки (без внешних зависимостей).
//
// Корректность закреплена тремя уровнями:
//  1. структура матрицы (finder/timing/тёмный модуль, размер по версии);
//  2. round-trip-декодер: из матрицы извлекаются кодовые слова (учитывая
//     маску из format info), синдромы Рида–Соломона обязаны быть нулевыми,
//     сегмент данных разбирается обратно в исходную строку;
//  3. детерминизм и границы ёмкости.
import { describe, expect, it } from 'vitest';

import { qrMatrix } from '@/lib/pdf/qr';

// ── GF(256), α = 2, полином 0x11D ────────────────────────────────────────────
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i += 1) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i += 1) EXP[i] = EXP[i - 255];
})();

const gmul = (a: number, b: number): number => (a === 0 || b === 0 ? 0 : EXP[LOG[a]! + LOG[b]!]!);

// ── Таблицы версий (уровень L, один блок) ────────────────────────────────────
const DATA_CW = [19, 34, 55, 80, 108, 136]; // версия 1..6
const EC_CW = [7, 10, 15, 20, 26, 36];
const CAPACITY_BYTES = [17, 32, 53, 78, 106, 134];

const versionOfSize = (size: number): number => (size - 17) / 4;

// ── Чтение format info (копия 1; раскладка ISO 18004, как у энкодера) ────────
function readFormatBits(m: boolean[][]): { ecc: number; mask: number; bchOk: boolean } {
  const get = (i: number): number => {
    let v: boolean;
    if (i <= 5)
      v = m[i]![8]!; // вертикальная полоса (x=8, y=i)
    else if (i === 6) v = m[7]![8]!;
    else if (i === 7) v = m[8]![8]!;
    else if (i === 8) v = m[8]![7]!;
    else v = m[8]![14 - i]!; // горизонтальная полоса (x=14-i, y=8)
    return v ? 1 : 0;
  };
  let bits = 0;
  for (let i = 0; i < 15; i += 1) bits |= get(i) << i;
  const unmasked = bits ^ 0x5412;
  // BCH-остаток по образующему 0x537 обязан быть нулевым.
  let rem = unmasked;
  for (let i = 14; i >= 10; i -= 1) {
    if ((rem >> i) & 1) rem ^= 0x537 << (i - 10);
  }
  return { ecc: (unmasked >> 13) & 0b11, mask: (unmasked >> 10) & 0b111, bchOk: rem === 0 };
}

// ── Маски (формулы ISO 18004) ────────────────────────────────────────────────
function maskBit(mask: number, x: number, y: number): boolean {
  switch (mask) {
    case 0:
      return (x + y) % 2 === 0;
    case 1:
      return y % 2 === 0;
    case 2:
      return x % 3 === 0;
    case 3:
      return (x + y) % 3 === 0;
    case 4:
      return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
    case 5:
      return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6:
      return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    default:
      return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
  }
}

// Карта функциональных модулей (независимая реконструкция для декодера).
function functionMap(size: number): boolean[][] {
  const fn: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const mark = (x: number, y: number): void => {
    if (y >= 0 && y < size && x >= 0 && x < size) fn[y]![x] = true;
  };
  const finder = (cx: number, cy: number): void => {
    for (let dy = -1; dy <= 7; dy += 1) {
      for (let dx = -1; dx <= 7; dx += 1) mark(cx + dx, cy + dy);
    }
  };
  finder(0, 0);
  finder(size - 7, 0);
  finder(0, size - 7);
  for (let i = 8; i < size - 8; i += 1) {
    mark(6, i);
    mark(i, 6);
  }
  // Позиции выравнивающих шаблонов v1..v6.
  const centers: number[][] = [[], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34]];
  const pos = centers[versionOfSize(size) - 1]!;
  for (const cy of pos) {
    for (const cx of pos) {
      // Пропускаем перекрытия с finder (углы).
      const overlapsFinder =
        (cx <= 8 && cy <= 8) || (cx >= size - 9 && cy <= 8) || (cx <= 8 && cy >= size - 9);
      if (overlapsFinder) continue;
      for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) mark(cx + dx, cy + dy);
      }
    }
  }
  // Резерв format info.
  for (let i = 0; i <= 8; i += 1) {
    if (i !== 6) {
      mark(8, i);
      mark(i, 8);
    }
  }
  for (let i = size - 8; i < size; i += 1) {
    mark(8, i);
    mark(i, 8);
  }
  return fn;
}

// ── Извлечение кодовых слов (зигзаг снизу-справа, как у энкодера) ────────────
function extractCodewords(m: boolean[][]): number[] {
  const size = m.length;
  const fn = functionMap(size);
  const { mask } = readFormatBits(m);
  const bits: number[] = [];
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert += 1) {
      for (let j = 0; j < 2; j += 1) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!fn[y]![x]) {
          const dark = m[y]![x]!;
          const maskOn = maskBit(mask, x, y);
          bits.push(dark !== maskOn ? 1 : 0);
        }
      }
    }
  }
  const words: number[] = [];
  for (let b = 0; b + 8 <= bits.length; b += 8) {
    let w = 0;
    for (let k = 0; k < 8; k += 1) w = (w << 1) | bits[b + k]!;
    words.push(w);
  }
  return words;
}

// ── Синдромы Рида–Соломона: все обязаны быть нулевыми ────────────────────────
function rsSyndromes(codewords: number[], ecLen: number): number[] {
  const syndromes: number[] = [];
  for (let i = 0; i < ecLen; i += 1) {
    let s = 0;
    for (const w of codewords) s = gmul(s, EXP[i]!) ^ w;
    syndromes.push(s);
  }
  return syndromes;
}

// ── Разбор сегмента (byte mode) ──────────────────────────────────────────────
function decodePayload(codewords: number[], capacityBytes: number): string | null {
  let bitPos = 0;
  const readBits = (n: number): number => {
    let v = 0;
    for (let k = 0; k < n; k += 1) {
      const byte = codewords[(bitPos + k) >> 3]!;
      const bit = (byte >> (7 - ((bitPos + k) & 7))) & 1;
      v = (v << 1) | bit;
    }
    bitPos += n;
    return v;
  };
  const mode = readBits(4);
  if (mode !== 0b0100) return null;
  const len = readBits(8);
  if (len > capacityBytes) return null;
  const bytes: number[] = [];
  for (let i = 0; i < len; i += 1) bytes.push(readBits(8));
  return new TextDecoder().decode(new Uint8Array(bytes));
}

function roundTrip(text: string): {
  size: number;
  mask: number;
  payload: string | null;
  rsOk: boolean;
} {
  const m = qrMatrix(text)!;
  const size = m.length;
  const v = versionOfSize(size);
  const { ecc, mask, bchOk } = readFormatBits(m);
  expect(bchOk, 'format info обязан проходить проверку BCH').toBe(true);
  expect(ecc, 'уровень коррекции L').toBe(0b01);
  expect(mask).toBeGreaterThanOrEqual(0);
  expect(mask).toBeLessThanOrEqual(7);
  const words = extractCodewords(m);
  expect(words.length).toBe(DATA_CW[v - 1]! + EC_CW[v - 1]!);
  // Синдромы считаются по ПОЛНОМУ кодовому слову (данные + чётность).
  const syndromes = rsSyndromes(words, EC_CW[v - 1]!);
  const rsOk = syndromes.every((s) => s === 0);
  const payload = decodePayload(words.slice(0, DATA_CW[v - 1]!), CAPACITY_BYTES[v - 1]!);
  return { size, mask, payload, rsOk };
}

describe('qr: границы и детерминизм', () => {
  it('пустая строка и слишком длинная → null', () => {
    expect(qrMatrix('')).toBeNull();
    expect(qrMatrix('x'.repeat(200))).toBeNull();
    expect(qrMatrix('x'.repeat(135))).toBeNull(); //Capacity V6-L = 134
    expect(qrMatrix('x'.repeat(134))).not.toBeNull();
  });

  it('размер матрицы соответствует версии по длине полезной нагрузки', () => {
    expect(qrMatrix('A')!.length).toBe(21); // V1
    expect(qrMatrix('x'.repeat(18))!.length).toBe(25); // V2
    expect(qrMatrix('x'.repeat(33))!.length).toBe(29); // V3
    expect(qrMatrix('x'.repeat(54))!.length).toBe(33); // V4
    expect(qrMatrix('x'.repeat(79))!.length).toBe(37); // V5
    expect(qrMatrix('x'.repeat(107))!.length).toBe(41); // V6
  });

  it('детерминирован: одинаковый вход — одинаковая матрица', () => {
    const text = 'https://du.example/verify/ABCD-EFGH-JKLM-NPQR-STUV-WXYZ-2345-6777';
    const a = qrMatrix(text);
    const b = qrMatrix(text);
    expect(a).toEqual(b);
  });

  it('матрица квадратная из булевых значений', () => {
    const m = qrMatrix('HELLO')!;
    for (const row of m) {
      expect(row).toHaveLength(m.length);
      for (const cell of row) expect(typeof cell).toBe('boolean');
    }
  });
});

describe('qr: функциональные шаблоны', () => {
  it('finder-шаблон в трёх углах (7×7)', () => {
    const m = qrMatrix('HELLO')!;
    const size = m.length;
    const expectFinder = (ox: number, oy: number) => {
      for (let y = 0; y < 7; y += 1) {
        for (let x = 0; x < 7; x += 1) {
          const edge = x === 0 || x === 6 || y === 0 || y === 6;
          const center = x >= 2 && x <= 4 && y >= 2 && y <= 4;
          expect(m[oy + y]![ox + x]).toBe(edge || center);
        }
      }
    };
    expectFinder(0, 0);
    expectFinder(size - 7, 0);
    expectFinder(0, size - 7);
    // Сепараторы вокруг finder — светлые.
    for (let i = 0; i < 8; i += 1) {
      expect(m[7]![i]).toBe(false);
      expect(m[i]![7]).toBe(false);
    }
  });

  it('timing-шаблоны чередуются по строке/столбцу 6 (в зоне между finder)', () => {
    const m = qrMatrix('HELLO')!;
    const size = m.length;
    for (let i = 8; i < size - 8; i += 1) {
      expect(m[6]![i]).toBe(i % 2 === 0);
      expect(m[i]![6]).toBe(i % 2 === 0);
    }
  });

  it('тёмный модуль присутствует (size-8, 8)', () => {
    const m = qrMatrix('HELLO')!;
    expect(m[m.length - 8]![8]).toBe(true);
  });
});

describe('qr: round-trip декодирование', () => {
  it('короткая строка (V1)', () => {
    const result = roundTrip('HELLO');
    expect(result.size).toBe(21);
    expect(result.rsOk).toBe(true);
    expect(result.payload).toBe('HELLO');
  });

  it('URL проверки справки с кодом в группах (реальный случай PDF)', () => {
    const text = 'https://du.example/verify/ABCD-EFGH-JKLM-NPQR-STUV-WXYZ-2345-6777';
    const result = roundTrip(text);
    expect(result.rsOk).toBe(true);
    expect(result.payload).toBe(text);
  });

  it('localhost URL с портом и 32-символьный код без дефисов', () => {
    const text = 'http://localhost:3000/verify/ABCDEFGHIJKLMNOPQRSTUVWX YZ23456777'.replace(
      ' ',
      '',
    );
    const result = roundTrip(text);
    expect(result.rsOk).toBe(true);
    expect(result.payload).toBe(text);
  });

  it('кириллица (UTF-8, byte mode)', () => {
    const result = roundTrip('Справка: проверка подлинности — Цифровой деканат');
    expect(result.rsOk).toBe(true);
    expect(result.payload).toBe('Справка: проверка подлинности — Цифровой деканат');
  });

  it('все версии 1–6 декодируются обратно', () => {
    for (const len of [5, 20, 40, 60, 90, 120]) {
      const text = 'Q'.repeat(len);
      const result = roundTrip(text);
      expect(result.payload, `len=${len}`).toBe(text);
      expect(result.rsOk, `len=${len}`).toBe(true);
    }
  });
});
