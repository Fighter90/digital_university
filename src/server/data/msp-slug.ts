// DIG-68 — публичный ключ проекта каталога «МСП»: slug карточки /msp/<slug>.
//
// В духе Product Hunt ключ человекочитаемый: «транслит заголовка + суффикс»
// («Конспект-бот» → `konspekt-bot-a1b2`), никакого cuid. Суффикс
// ДЕТЕРМИНИРОВАН (FNV-1a от нормализованного заголовка, не random):
// одинаковый заголовок даёт одинаковый slug — ссылки стабильны между
// перезапусками и тестами, а редкая коллизия с уже занятым slug'ом снимается
// числовым суффиксом (-2, -3, …) по списку занятых, который передаёт слой.
// Нормализация ввода оборонительная: слой данных всё равно проверяет
// существование проекта и возвращает единый 404.

export const MSP_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Максимальная длина транслит-базы slug (суффикс добавляется сверх неё). */
export const MSP_SLUG_BASE_MAX = 40;

// Транслит заголовка (RU → EN, нижний регистр) — таблица без двусмысленностей:
// сочетания (zh, kh, ts, ch, sh, shch, yu, ya) и одиночные буквы.
const RU_EN: Record<string, string> = {
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
  й: 'i',
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
  х: 'kh',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'shch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
};

/** FNV-1a (32 бита) — стабильный хэш без зависимостей; >>> 0 — без знака. */
function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Транслит-база slug: нижний регистр, RU → EN, пробелы и прочие разделители
 * → «-», повторы дефисов схлопываются, обрезка по краям и по длине.
 * Пустой результат («///») → «project» — вызов всё равно валиден по форме.
 */
export function mspSlugBase(title: string): string {
  const lowered = title.trim().toLowerCase();
  let out = '';
  for (const char of lowered) {
    if (RU_EN[char] !== undefined) {
      out += RU_EN[char];
    } else if (/[a-z0-9]/.test(char)) {
      out += char;
    } else {
      out += '-';
    }
  }
  const collapsed = out
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MSP_SLUG_BASE_MAX);
  const trimmed = collapsed.replace(/-+$/g, '');
  return trimmed.length > 0 ? trimmed : 'project';
}

/** Детерминированный суффикс (4 символа base36) от нормализованного заголовка. */
export function mspSlugSuffix(title: string): string {
  return fnv1a(title.trim().toLowerCase()).toString(36).padStart(4, '0').slice(0, 4);
}

/**
 * Полный slug проекта: «база-суффикс». Если уже занят (taken — существующие
 * slug'и каталога), добавляется числовой суффикс `-2`, `-3`, … — результат
 * остаётся детерминированным при одинаковом наборе занятых.
 */
export function newMspSlug(title: string, taken: readonly string[] = []): string {
  const base = mspSlugBase(title);
  const suffix = mspSlugSuffix(title);
  let candidate = `${base}-${suffix}`;
  let counter = 2;
  while (taken.includes(candidate)) {
    candidate = `${base}-${suffix}-${counter}`;
    counter += 1;
  }
  return candidate;
}

/**
 * Нормализация slug из URL: trim + нижний регистр. Пустой результат бросает
 * URIError — страница карточки превращает его в тот же контрактный 404
 * (см. /deanery/[number] про единый notFound()).
 */
export function normalizeMspSlug(raw: string): string {
  const slug = raw.trim().toLowerCase();
  if (slug.length === 0) throw new URIError('empty msp slug');
  return slug;
}
