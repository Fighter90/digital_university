// DIG-82 — тестовый декодер QR-матрицы (зеркало энкодера src/lib/pdf/qr.ts).
//
// Нужен, чтобы юнит- и e2e-тесты могли «отсканировать» QR из PDF:
// из матрицы модулей извлекаются кодовые слова (зигзаг снизу-справа,
// учитывая маску из format info), синдромы Рида–Соломона обязаны быть
// нулевыми, byte-mode сегмент разбирается обратно в исходную строку.
// Логика повторяет round-trip-декодер из tests/qr-code.test.ts, но без
// expect'ов — чистая функция, пригодная и для Playwright-спеков.

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
const CAPACITY_BYTES = [17, 32, 53, 78, 106, 134];
const EC_LEN = [7, 10, 15, 20, 26, 36];

const versionOfSize = (size: number): number => (size - 17) / 4;

// ── Чтение format info (копия 1; раскладка ISO 18004) ────────────────────────
function readFormatBits(m: boolean[][]): { mask: number; bchOk: boolean } {
  const get = (i: number): number => {
    let v: boolean;
    if (i <= 5) v = m[i]![8]!;
    else if (i === 6) v = m[7]![8]!;
    else if (i === 7) v = m[8]![8]!;
    else if (i === 8) v = m[8]![7]!;
    else v = m[8]![14 - i]!;
    return v ? 1 : 0;
  };
  let bits = 0;
  for (let i = 0; i < 15; i += 1) bits |= get(i) << i;
  const unmasked = bits ^ 0x5412;
  let rem = unmasked;
  for (let i = 14; i >= 10; i -= 1) {
    if ((rem >> i) & 1) rem ^= 0x537 << (i - 10);
  }
  return { mask: (unmasked >> 10) & 0b111, bchOk: rem === 0 };
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

// ── Карта функциональных модулей (независимая реконструкция) ─────────────────
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
  const centers: number[][] = [[], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34]];
  const pos = centers[versionOfSize(size) - 1]!;
  for (const cy of pos) {
    for (const cx of pos) {
      const overlapsFinder =
        (cx <= 8 && cy <= 8) || (cx >= size - 9 && cy <= 8) || (cx <= 8 && cy >= size - 9);
      if (overlapsFinder) continue;
      for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) mark(cx + dx, cy + dy);
      }
    }
  }
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
function extractCodewords(m: boolean[][], mask: number): number[] {
  const size = m.length;
  const fn = functionMap(size);
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

// ── Разбор byte-mode сегмента ────────────────────────────────────────────────
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

/**
 * Декодировать QR-матрицу ([y][x], true = тёмный модуль) в исходную строку.
 * null — матрица не проходит проверку BCH/Рида–Соломона или не является
 * byte-mode QR (повреждение, обрезка, неверная реконструкция).
 */
export function decodeQrMatrix(m: boolean[][]): string | null {
  const size = m.length;
  const version = versionOfSize(size);
  if (version < 1 || version > 6 || !Number.isInteger(version)) return null;
  const { mask, bchOk } = readFormatBits(m);
  if (!bchOk) return null;
  const codewords = extractCodewords(m, mask);
  const ecLen = EC_LEN[version - 1]!;
  if (rsSyndromes(codewords, ecLen).some((s) => s !== 0)) return null;
  return decodePayload(codewords, CAPACITY_BYTES[version - 1]!);
}
