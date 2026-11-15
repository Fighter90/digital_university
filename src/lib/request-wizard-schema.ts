// DIG-31 — общие поля мастера заказа справки или заявления: язык, куда
// предоставляется, количество экземпляров, способ получения, комментарий
// и вложения. Модуль чистый (без серверных и React-импортов): один словарь
// правил для клиента и для сервера.
//
// Сервер получает ТОЛЬКО метаданные вложений (имя, размер) — файлы в
// прототипе не передаются (см. proposal DIG-31): клиент валидирует файлы
// до отправки, сервер повторно валидирует мету validateWizardMeta
// (защита в глубину).

export const MAX_WIZARD_FILES = 5;
export const MAX_WIZARD_FILE_SIZE_MB = 10;
export const MAX_WIZARD_FILE_SIZE_BYTES = MAX_WIZARD_FILE_SIZE_MB * 1024 * 1024;
export const MAX_WIZARD_COMMENT_LENGTH = 500;
export const MAX_WIZARD_DESTINATION_LENGTH = 200;
export const MAX_WIZARD_ATTACHMENT_NAME_LENGTH = 200;
export const MAX_WIZARD_COPIES = 5;

export type WizardLanguage = 'RU' | 'EN';
export type WizardDelivery = 'PDF_ONLINE' | 'PICKUP' | 'MAIL';

export const WIZARD_LANGUAGE_LABELS: Record<WizardLanguage, string> = {
  RU: 'Русский',
  EN: 'English',
};

export const WIZARD_DELIVERY_LABELS: Record<WizardDelivery, string> = {
  PDF_ONLINE: 'PDF в кабинете',
  PICKUP: 'Забрать в деканате',
  MAIL: 'Почтой',
};

export const WIZARD_DELIVERIES: WizardDelivery[] = ['PDF_ONLINE', 'PICKUP', 'MAIL'];
export const WIZARD_LANGUAGES: WizardLanguage[] = ['RU', 'EN'];

export interface WizardAttachmentMeta {
  /** Имя файла как выбрал студент (обрезается до 200 символов). */
  name: string;
  /** Размер в байтах. */
  size: number;
}

/** Мета мастера — сохраняется в заявке под ключом «wizard» (JSON-строка). */
export interface WizardMeta {
  destination: string;
  language: WizardLanguage;
  copies: number;
  delivery: WizardDelivery;
  comment: string;
  attachments: WizardAttachmentMeta[];
}

export const DEFAULT_WIZARD_META: WizardMeta = {
  destination: '',
  language: 'RU',
  copies: 1,
  delivery: 'PDF_ONLINE',
  comment: '',
  attachments: [],
};

const DELIVERIES: readonly string[] = WIZARD_DELIVERIES;
const LANGUAGES: readonly string[] = WIZARD_LANGUAGES;

function asTrimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Строгая серверная валидация меты мастера. Ответ — первая нарушенная
 * правило человеческим языком (как validateRequestForm в DIG-30).
 */
export type WizardMetaValidation =
  | { ok: true; data: WizardMeta }
  | { ok: false; error: string };

export function validateWizardMeta(input: unknown): WizardMetaValidation {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'Некорректные параметры заказа' };
  }
  const raw = input as Record<string, unknown>;

  const language = raw.language;
  if (typeof language !== 'string' || !LANGUAGES.includes(language)) {
    return { ok: false, error: 'Выберите язык справки (русский или английский)' };
  }

  const copies = raw.copies;
  if (
    typeof copies !== 'number' ||
    !Number.isInteger(copies) ||
    copies < 1 ||
    copies > MAX_WIZARD_COPIES
  ) {
    return {
      ok: false,
      error: `Количество экземпляров — от 1 до ${MAX_WIZARD_COPIES}`,
    };
  }

  const delivery = raw.delivery;
  if (typeof delivery !== 'string' || !DELIVERIES.includes(delivery)) {
    return { ok: false, error: 'Выберите способ получения документа' };
  }

  const destination = asTrimmed(raw.destination);
  if (destination.length > MAX_WIZARD_DESTINATION_LENGTH) {
    return {
      ok: false,
      error: `Поле «Куда предоставляется» — максимум ${MAX_WIZARD_DESTINATION_LENGTH} символов`,
    };
  }

  const comment = asTrimmed(raw.comment);
  if (comment.length > MAX_WIZARD_COMMENT_LENGTH) {
    return {
      ok: false,
      error: `Комментарий — максимум ${MAX_WIZARD_COMMENT_LENGTH} символов`,
    };
  }

  const rawAttachments = raw.attachments;
  if (rawAttachments !== undefined && !Array.isArray(rawAttachments)) {
    return { ok: false, error: 'Некорректный список вложений' };
  }
  const list = rawAttachments ?? [];
  if (list.length > MAX_WIZARD_FILES) {
    return { ok: false, error: `Можно приложить не больше ${MAX_WIZARD_FILES} файлов` };
  }
  const attachments: WizardAttachmentMeta[] = [];
  for (const item of list) {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      return { ok: false, error: 'Некорректное вложение' };
    }
    const name = asTrimmed((item as Record<string, unknown>).name);
    if (name === '' || name.length > MAX_WIZARD_ATTACHMENT_NAME_LENGTH) {
      return { ok: false, error: 'Некорректное имя файла вложения' };
    }
    const size = (item as Record<string, unknown>).size;
    if (typeof size !== 'number' || !Number.isInteger(size) || size < 0) {
      return { ok: false, error: `Некорректный размер файла «${name}»` };
    }
    if (size > MAX_WIZARD_FILE_SIZE_BYTES) {
      return { ok: false, error: `Файл «${name}» больше ${MAX_WIZARD_FILE_SIZE_MB} МБ` };
    }
    attachments.push({ name, size });
  }

  return {
    ok: true,
    data: {
      destination,
      language: language as WizardLanguage,
      copies,
      delivery: delivery as WizardDelivery,
      comment,
      attachments,
    },
  };
}

/**
 * Ошибка лимитов вложений для выбранных файлов (клиент мастера) или null.
 * Один источник правил с сервером (validateWizardMeta): ≤5 файлов,
 * каждый ≤10 МБ.
 */
export function wizardFilesError(
  newFiles: WizardAttachmentMeta[],
  currentCount: number,
): string | null {
  if (newFiles.length + currentCount > MAX_WIZARD_FILES) {
    return `Можно приложить не больше ${MAX_WIZARD_FILES} файлов`;
  }
  const oversized = newFiles.find((file) => file.size > MAX_WIZARD_FILE_SIZE_BYTES);
  if (oversized) {
    return `Файл «${oversized.name}» больше ${MAX_WIZARD_FILE_SIZE_MB} МБ`;
  }
  return null;
}

/**
 * Терпимый разбор значения из состояния черновика: битые поля замещаются
 * дефолтом, валидные сохраняются. Используется клиентом мастера.
 */
export function normalizeWizardMeta(input: unknown): WizardMeta {
  const strict = validateWizardMeta(input);
  if (strict.ok) return strict.data;
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return { ...DEFAULT_WIZARD_META };
  }
  const raw = input as Record<string, unknown>;
  const fallbackLanguage = DEFAULT_WIZARD_META.language;
  const fallbackDelivery = DEFAULT_WIZARD_META.delivery;
  const language = LANGUAGES.includes(String(raw.language))
    ? (raw.language as WizardLanguage)
    : fallbackLanguage;
  const delivery = DELIVERIES.includes(String(raw.delivery))
    ? (raw.delivery as WizardDelivery)
    : fallbackDelivery;
  const copies =
    typeof raw.copies === 'number' && Number.isInteger(raw.copies) &&
    raw.copies >= 1 && raw.copies <= MAX_WIZARD_COPIES
      ? raw.copies
      : DEFAULT_WIZARD_META.copies;
  return {
    destination: asTrimmed(raw.destination).slice(0, MAX_WIZARD_DESTINATION_LENGTH),
    language,
    copies,
    delivery,
    comment: asTrimmed(raw.comment).slice(0, MAX_WIZARD_COMMENT_LENGTH),
    attachments: [],
  };
}
