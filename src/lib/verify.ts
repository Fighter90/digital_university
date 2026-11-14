// DIG-47 — чистые помощники проверки подлинности справок.
//
// Код проверки: 32 символа base32 (A–Z, 2–7) в группах по 4 — 160 бит
// энтропии (приёмка задачи: ≥ 128 бит). Генерация — ТОЛЬКО через
// crypto.getRandomValues: Math.random не криптографический и для
// неугадываемого кода не годится (формат кода совпадает с выпиской
// DIG-27, но там код печатается без записи в реестр).
//
// Страница /verify/<код> публична, поэтому вход нормализуется
// (дефисы, пробелы, регистр) и строго валидируется: неверный формат
// неотличим от отсутствующего кода (без «оракулов» формата).

export const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** 8 групп по 4 символа base32, разделённые дефисом. */
export const VERIFICATION_CODE_PATTERN = /^[A-Z2-7]{4}(-[A-Z2-7]{4}){7}$/;

/** 32 символа × 5 бит = 160 бит энтропии. */
export const VERIFICATION_CODE_BITS = 160;

/** Сколько символов в группе при печати кода. */
const GROUP_SIZE = 4;

/**
 * Каноническое начертание кода: 32 символа base32 группами по 4.
 * Принимает «человеческие» начертания с дефисами и пробелами в любом
 * регистре. null — после снятия разделителей ввод не является кодом
 * (неверная длина или символ вне алфавита: чужие символы не выбрасываются,
 * чтобы мangle-ввод не мог «склеиться» в чужой код).
 */
export function normalizeVerificationCode(raw: string): string | null {
  const compact = raw.toUpperCase().replace(/[\s-]+/g, '');
  if (!/^[A-Z2-7]{32}$/.test(compact)) return null;
  const groups: string[] = [];
  for (let i = 0; i < compact.length; i += GROUP_SIZE) {
    groups.push(compact.slice(i, i + GROUP_SIZE));
  }
  return groups.join('-');
}

/**
 * Новый код проверки из криптографического ГСЧ. Node 18+/браузеры
 * предоставляют crypto.getRandomValues глобально.
 */
export function generateVerificationCode(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let code = '';
  for (let i = 0; i < bytes.length; i += 1) {
    // Отбрасывание по модулю не требуется: 256 = 32 × 8, остаток равномерен.
    code += BASE32_ALPHABET[bytes[i]! % BASE32_ALPHABET.length];
  }
  return normalizeVerificationCode(code)!;
}

/**
 * ФИО для публичной страницы: фамилия + инициалы («Смирнова А. В.»).
 * В официальных документах фамилия — ПЕРВОЕ слово, поэтому фамилией
 * считается первый токен, инициалы — первые буквы остальных (не более
 * двух: меньше утечки при составных именах).
 */
export function maskFullName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0]!;
  const surname = parts[0]!;
  const initials = parts.slice(1, 3).map((p) => `${p[0]!.toUpperCase()}.`);
  return `${surname} ${initials.join(' ')}`.trim();
}

/** Статус справки на момент проверки (истёкшая на странице = «не найден»). */
export type CertificateStatus = 'VALID' | 'REVOKED' | 'EXPIRED';

export function certificateStatusFor(
  row: Pick<CertificateValidity, 'revokedAt' | 'expiresAt'>,
  now: Date,
): CertificateStatus {
  if (row.revokedAt) return 'REVOKED';
  return row.expiresAt > now ? 'VALID' : 'EXPIRED';
}

/** Минимальный набор полей справки для вычисления статуса. */
export interface CertificateValidity {
  revokedAt: Date | null;
  expiresAt: Date;
}
