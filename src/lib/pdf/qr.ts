// DIG-47 — минимальный QR-энкодер для PDF справки.
//
// Зачем свой: зависимость в прототип не добавляется, а вывод обязан быть
// детерминированным (тот же контракт, что у всего PDF DIG-27).
//
// Покрытие: byte mode (UTF-8), версии 1–6, уровень коррекции L — на этих
// версиях документ состоит из ОДНОГО блока Рида–Соломона, поэтому
// таблицы блоков не нужны. Ёмкости L: v1 17, v2 32, v3 53, v4 78,
// v5 106, v6 134 байта — URL страницы проверки (≤ ~110 байт) помещается.
//
// Реализация по ISO/IEC 18004:
//  - сегмент: mode 0100 + счётчик 8 бит + байты;
//  - терминатор, добивка до байта, пады 0xEC 0x11;
//  - Рид–Соломон в GF(256) (α=2, полином 0x11D);
//  - функциональные шаблоны (finder/сепараторы/timing/alignment/тёмный
//    модуль), зигзаг-размещение данных снизу-справа;
//  - формат info: BCH(15,5), образующий 0x537, маска 0x5412;
//  - все 8 масок с полным подсчётом штрафа N1–N4 (выбор детерминирован:
//    при равном штрафе — маска с меньшим номером).
//
// Корректность закреплена round-trip-тестом (tests/qr-code.test.ts):
// синдромы Рида–Соломона извлечённых кодовых слов обязаны быть нулевыми,
// сегмент разбирается обратно в исходную строку.

export type QrMatrix = boolean[][]; // [y][x], true = тёмный модуль

// ── Таблицы версий (уровень L) ───────────────────────────────────────────────
const TOTAL_DATA_CW = [19, 34, 55, 80, 108, 136];
const TOTAL_EC_CW = [7, 10, 15, 20, 26, 36];
const BYTE_CAPACITY = [17, 32, 53, 78, 106, 134];
/** Позиции центров выравнивающих шаблонов (v1 — нет). */
const ALIGNMENT_CENTERS: number[][] = [[], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34]];
/** Биты остатка после кодовых слов (v1 — 0, v2–v6 — 7). */
const REMAINDER_BITS = [0, 7, 7, 7, 7, 7];

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

/** Образующий полynomial степени ecLen: g(x) = Π (x − α^i), i = 0..ecLen-1. */
function rsGenerator(ecLen: number): number[] {
  let poly = [1];
  for (let i = 0; i < ecLen; i += 1) {
    const next = new Array<number>(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j += 1) {
      next[j] ^= poly[j]!; // умножение на x
      next[j + 1] ^= gmul(poly[j]!, EXP[i]!); // умножение на α^i
    }
    poly = next;
  }
  return poly; // старшая степень — индекс 0
}

/** Остаток data * x^ecLen mod g(x) — EC-кодовые слова. */
function rsEncode(data: number[], ecLen: number): number[] {
  const gen = rsGenerator(ecLen);
  const rem = new Array<number>(ecLen).fill(0);
  for (const byte of data) {
    const factor = byte ^ rem[0]!;
    rem.shift();
    rem.push(0);
    if (factor !== 0) {
      for (let i = 0; i < ecLen; i += 1) {
        rem[i]! ^= gmul(gen[i + 1]!, factor);
      }
    }
  }
  return rem;
}

// ── Сборка потока данных ─────────────────────────────────────────────────────

function buildCodewords(bytes: Uint8Array, version: number): number[] {
  const dataLen = TOTAL_DATA_CW[version - 1]!;
  const ecLen = TOTAL_EC_CW[version - 1]!;
  const bits: number[] = [];
  const pushBits = (value: number, count: number): void => {
    for (let i = count - 1; i >= 0; i -= 1) bits.push((value >> i) & 1);
  };
  pushBits(0b0100, 4); // byte mode
  pushBits(bytes.length, 8); // счётчик символов (v1–v9: 8 бит)
  for (const byte of bytes) pushBits(byte, 8);

  const capacityBits = dataLen * 8;
  // Терминатор (до 4 нулей), добивка до границы байта.
  for (let i = 0; i < 4 && bits.length < capacityBits; i += 1) bits.push(0);
  while (bits.length % 8 !== 0 && bits.length < capacityBits) bits.push(0);

  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let k = 0; k < 8; k += 1) byte = (byte << 1) | bits[i + k]!;
    data.push(byte);
  }
  // Пады 0xEC 0x11 до полной ёмкости.
  const pads = [0xec, 0x11];
  for (let i = 0; data.length < dataLen; i += 1) data.push(pads[i % 2]!);

  return [...data, ...rsEncode(data, ecLen)];
}

// ── Функциональные шаблоны ───────────────────────────────────────────────────

interface QrBoard {
  modules: boolean[][];
  functions: boolean[][];
  size: number;
}

const setModule = (board: QrBoard, x: number, y: number, dark: boolean): void => {
  board.modules[y]![x] = dark;
  board.functions[y]![x] = true;
};

function drawFunctionPatterns(board: QrBoard): void {
  const { size } = board;
  const finder = (ox: number, oy: number): void => {
    for (let y = -1; y <= 7; y += 1) {
      for (let x = -1; x <= 7; x += 1) {
        if (oy + y < 0 || oy + y >= size || ox + x < 0 || ox + x >= size) continue;
        const inRing = x >= 0 && x <= 6 && y >= 0 && y <= 6;
        const dark =
          inRing &&
          (x === 0 || x === 6 || y === 0 || y === 6 || (x >= 2 && x <= 4 && y >= 2 && y <= 4));
        setModule(board, ox + x, oy + y, dark);
      }
    }
  };
  finder(0, 0);
  finder(size - 7, 0);
  finder(0, size - 7);

  const version = (size - 17) / 4;
  const centers = ALIGNMENT_CENTERS[version - 1]!;
  for (const cy of centers) {
    for (const cx of centers) {
      const overlapsFinder =
        (cx <= 8 && cy <= 8) || (cx >= size - 9 && cy <= 8) || (cx <= 8 && cy >= size - 9);
      if (overlapsFinder) continue;
      for (let y = -2; y <= 2; y += 1) {
        for (let x = -2; x <= 2; x += 1) {
          const dark = Math.max(Math.abs(x), Math.abs(y)) !== 1;
          setModule(board, cx + x, cy + y, dark);
        }
      }
    }
  }

  // Timing.
  for (let i = 8; i < size - 8; i += 1) {
    setModule(board, 6, i, i % 2 === 0);
    setModule(board, i, 6, i % 2 === 0);
  }

  // Тёмный модуль.
  setModule(board, 8, size - 8, true);

  // Резерв под format info (значения рисуются после выбора маски).
  for (let i = 0; i <= 8; i += 1) {
    if (i !== 6) {
      board.functions[8]![i] = true;
      board.functions[i]![8] = true;
    }
  }
  for (let i = size - 8; i < size; i += 1) {
    board.functions[8]![i] = true;
    board.functions[i]![8] = true;
  }
}

// ── Размещение данных ────────────────────────────────────────────────────────

function drawCodewords(board: QrBoard, codewords: number[], version: number): void {
  const { size } = board;
  const totalBits = codewords.length * 8 + REMAINDER_BITS[version - 1]!;
  let bitIndex = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert += 1) {
      for (let j = 0; j < 2; j += 1) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!board.functions[y]![x] && bitIndex < totalBits) {
          const byte = codewords[bitIndex >> 3]!;
          const bit = (byte >> (7 - (bitIndex & 7))) & 1;
          board.modules[y]![x] = bit === 1;
          bitIndex += 1;
        }
      }
    }
  }
}

// ── Маски и формат info ──────────────────────────────────────────────────────

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

const formatBits = (ecc: number, mask: number): number => {
  const data = (ecc << 3) | mask;
  let rem = data << 10;
  for (let i = 14; i >= 10; i -= 1) {
    if ((rem >> i) & 1) rem ^= 0x537 << (i - 10);
  }
  return ((data << 10) | rem) ^ 0x5412;
};

const getBit = (value: number, index: number): number => (value >> index) & 1;

function drawFormatInfo(board: QrBoard, ecc: number, mask: number): void {
  const { size } = board;
  const bits = formatBits(ecc, mask);
  // Копия 1 — вокруг верхнего левого finder (ISO 18004: вертикальная
  // полоса несёт биты 0–7, горизонтальная — 0–5 и 8–14).
  for (let i = 0; i <= 5; i += 1) {
    const bit = getBit(bits, i) === 1;
    board.modules[i]![8] = bit; // (x=8, y=i)
    board.modules[8]![i] = bit; // (x=i, y=8)
  }
  board.modules[7]![8] = getBit(bits, 6) === 1; // (x=8, y=7)
  board.modules[8]![8] = getBit(bits, 7) === 1; // (8, 8)
  board.modules[8]![7] = getBit(bits, 8) === 1; // (7, 8)
  for (let i = 9; i < 15; i += 1) {
    board.modules[8]![14 - i] = getBit(bits, i) === 1; // (x=14-i, y=8)
  }
  // Копия 2 — правый верх / левый низ.
  for (let i = 0; i < 8; i += 1) {
    board.modules[8]![size - 1 - i] = getBit(bits, i) === 1; // (x=size-1-i, y=8)
  }
  for (let i = 8; i < 15; i += 1) {
    board.modules[size - 15 + i]![8] = getBit(bits, i) === 1; // (x=8, y=size-15+i)
  }
  board.modules[8]![size - 8] = true; // всегда тёмный модуль
}

// ── Штрафы маскировки (N1–N4, ISO 18004) ─────────────────────────────────────

function maskPenalty(board: QrBoard, mask: number): number {
  const { size } = board;
  const value = (x: number, y: number): boolean => board.modules[y]![x] !== maskBit(mask, x, y); // functions уже замаскированы в calc
  let penalty = 0;

  // N1: серии одинаковых цветов ≥ 5 (строки и столбцы).
  for (let y = 0; y < size; y += 1) {
    let runColor = value(0, y);
    let runLen = 1;
    for (let x = 1; x < size; x += 1) {
      const c = value(x, y);
      if (c === runColor) {
        runLen += 1;
        if (runLen === 5) penalty += 3;
        else if (runLen > 5) penalty += 1;
      } else {
        runColor = c;
        runLen = 1;
      }
    }
  }
  for (let x = 0; x < size; x += 1) {
    let runColor = value(x, 0);
    let runLen = 1;
    for (let y = 1; y < size; y += 1) {
      const c = value(x, y);
      if (c === runColor) {
        runLen += 1;
        if (runLen === 5) penalty += 3;
        else if (runLen > 5) penalty += 1;
      } else {
        runColor = c;
        runLen = 1;
      }
    }
  }

  // N2: блоки 2×2 одного цвета.
  for (let y = 0; y < size - 1; y += 1) {
    for (let x = 0; x < size - 1; x += 1) {
      const c = value(x, y);
      if (value(x + 1, y) === c && value(x, y + 1) === c && value(x + 1, y + 1) === c) {
        penalty += 3;
      }
    }
  }

  // N3: паттерн finder 1011101 с 4 светлыми по краю (строки и столбцы).
  const pattern = [true, false, true, true, true, false, true];
  const hasPattern = (get: (i: number) => boolean): number => {
    let count = 0;
    for (let start = 0; start + 11 <= size; start += 1) {
      const window: boolean[] = [];
      for (let i = 0; i < 11; i += 1) window.push(get(start + i));
      const light = (i: number): boolean => !window[i];
      const match =
        light(0) &&
        light(1) &&
        light(2) &&
        light(3) &&
        pattern.every((p, i) => window[i + 4] === p) &&
        light(8) &&
        light(9) &&
        light(10);
      if (match) count += 1;
    }
    return count;
  };
  for (let y = 0; y < size; y += 1) penalty += hasPattern((i) => value(i, y)) * 40;
  for (let x = 0; x < size; x += 1) penalty += hasPattern((i) => value(x, i)) * 40;

  // N4: доля тёмных модулей.
  let dark = 0;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) if (value(x, y)) dark += 1;
  }
  const total = size * size;
  const percent = (dark * 100) / total;
  penalty += Math.floor(Math.abs(percent - 50) / 5) * 10;

  return penalty;
}

// ── Публичный API ────────────────────────────────────────────────────────────

/**
 * Матрица QR-кода для текста (UTF-8, byte mode, уровень L).
 * null — текст пустой или длиннее ёмкости версии 6.
 */
export function qrMatrix(text: string): QrMatrix | null {
  if (text.length === 0) return null;
  const bytes = new TextEncoder().encode(text);
  const version = BYTE_CAPACITY.findIndex((capacity) => bytes.length <= capacity) + 1;
  if (version === 0) return null; // длиннее ёмкости v6-L

  const size = 17 + version * 4;
  const board: QrBoard = {
    size,
    modules: Array.from({ length: size }, () => new Array<boolean>(size).fill(false)),
    functions: Array.from({ length: size }, () => new Array<boolean>(size).fill(false)),
  };
  drawFunctionPatterns(board);
  drawCodewords(board, buildCodewords(bytes, version), version);

  // Выбор маски: минимум штрафа, при равенстве — меньший номер (детерминизм).
  let bestMask = 0;
  let bestPenalty = Number.POSITIVE_INFINITY;
  for (let mask = 0; mask < 8; mask += 1) {
    const penalty = maskPenalty(board, mask);
    if (penalty < bestPenalty) {
      bestPenalty = penalty;
      bestMask = mask;
    }
  }

  // Применяем выбранную маску ко всем НЕфункциональным модулям.
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (!board.functions[y]![x]) {
        board.modules[y]![x] = board.modules[y]![x] !== maskBit(bestMask, x, y);
      }
    }
  }
  // Format info (уровень L = 0b01) — не маскируется, рисуется поверх.
  drawFormatInfo(board, 0b01, bestMask);

  return board.modules;
}
