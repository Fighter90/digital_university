// DIG-31 — общие поля мастера заказа справки или заявления: язык, куда
// предоставляется, количество экземпляров, способ получения, комментарий
// и вложения. Модуль чистый (без серверных и React-импортов): одна zod-схема
// правил для клиента и для сервера (тот же подход, что request-form-schema
// из DIG-30).
//
// Сервер получает ТОЛЬКО метаданные вложений (имя, размер) — файлы в
// прототипе не передаются (см. proposal DIG-31): клиент валидирует файлы
// до отправки, сервер повторно валидирует мету validateWizardMeta
// (защита в глубину).

import { z } from 'zod';

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

/** DIG-84 — EN-метки способа получения (значения формы не локализуются). */
export const WIZARD_DELIVERY_LABELS_EN: Record<WizardDelivery, string> = {
  PDF_ONLINE: 'PDF in the cabinet',
  PICKUP: 'Pick up at the deanery',
  MAIL: 'By mail',
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

/** Строки триммим, не-строки трактуем как пустые (поля необязательные). */
function asTrimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

const LANGUAGE_ERROR = 'Выберите язык справки (русский или английский)';
const DELIVERY_ERROR = 'Выберите способ получения документа';
const COPIES_ERROR = `Количество экземпляров — от 1 до ${MAX_WIZARD_COPIES}`;
const NAME_ERROR = 'Некорректное имя файла вложения';

// Правила вложений — отдельные zod-схемы, чтобы сообщения о размере файла
// ссылались на имя (superRefine видит уже разобранное name) и чтобы лимит
// количества проверялся ДО разбора элементов (нужен порядок ошибок:
// «не больше 5 файлов» важнее ошибки конкретного файла).
const wizardAttachmentZ = z
  .object(
    {
      name: z.preprocess(
        asTrimmed,
        z.string().min(1, NAME_ERROR).max(MAX_WIZARD_ATTACHMENT_NAME_LENGTH, NAME_ERROR),
      ),
      // Размер валидирует superRefine — сообщение зависит от имени файла.
      // .optional(): ключ может отсутствовать, superRefine даст человеческое
      // сообщение вместо zod'овского «expected nonoptional».
      size: z.unknown().optional(),
    },
    // Не-объект вместо вложения — общее сообщение (анти-мусор от клиента).
    { error: 'Некорректное вложение' },
  )
  .superRefine((value, ctx) => {
    const size = value.size;
    if (typeof size !== 'number' || !Number.isInteger(size) || size < 0) {
      ctx.addIssue({ code: 'custom', message: `Некорректный размер файла «${value.name}»` });
      return;
    }
    if (size > MAX_WIZARD_FILE_SIZE_BYTES) {
      ctx.addIssue({
        code: 'custom',
        message: `Файл «${value.name}» больше ${MAX_WIZARD_FILE_SIZE_MB} МБ`,
      });
    }
  })
  .transform((value) => ({ name: value.name, size: value.size as number }));

const wizardAttachmentsZ = z.preprocess(
  // Вложения необязательны: отсутствует поле — пустой список.
  (value) => (value === undefined ? [] : value),
  z
    .array(z.unknown(), 'Некорректный список вложений')
    .max(MAX_WIZARD_FILES, `Можно приложить не больше ${MAX_WIZARD_FILES} файлов`)
    .transform((list, ctx) => {
      // Лимит количества уже проверен (.max выше) — здесь остаются элементы.
      const parsed = z.array(wizardAttachmentZ).safeParse(list);
      if (!parsed.success) {
        ctx.addIssue({
          code: 'custom',
          message: parsed.error.issues[0]?.message ?? 'Некорректное вложение',
        });
        return z.NEVER;
      }
      return parsed.data;
    }),
);

/**
 * zod-схема меты мастера. Человек читает первую ошибку (как validateRequestForm
 * в DIG-30), поэтому каждое правило несёт своё сообщение; порядок ключей —
 * порядок первых ошибок: язык → экземпляры → способ → текстовые поля → вложения.
 */
const wizardMetaZ = z
  .object(
    {
      language: z.enum(WIZARD_LANGUAGES as [WizardLanguage, ...WizardLanguage[]], LANGUAGE_ERROR),
      copies: z
        .number(COPIES_ERROR)
        .int(COPIES_ERROR)
        .min(1, COPIES_ERROR)
        .max(MAX_WIZARD_COPIES, COPIES_ERROR),
      delivery: z.enum(WIZARD_DELIVERIES as [WizardDelivery, ...WizardDelivery[]], DELIVERY_ERROR),
      destination: z.preprocess(
        asTrimmed,
        z
          .string()
          .max(
            MAX_WIZARD_DESTINATION_LENGTH,
            `Поле «Куда предоставляется» — максимум ${MAX_WIZARD_DESTINATION_LENGTH} символов`,
          ),
      ),
      comment: z.preprocess(
        asTrimmed,
        z
          .string()
          .max(
            MAX_WIZARD_COMMENT_LENGTH,
            `Комментарий — максимум ${MAX_WIZARD_COMMENT_LENGTH} символов`,
          ),
      ),
      attachments: wizardAttachmentsZ,
    },
    // Не-объект вообще (null/строка/массив) — общее сообщение.
    { error: 'Некорректные параметры заказа' },
  )
  .transform((meta) => ({
    // Результат — в порядке полей интерфейса WizardMeta: мету сохраняют в
    // заявке строкой JSON, порядок ключей не должен зависеть от порядка
    // схемы (он задаёт порядок первых ошибок).
    destination: meta.destination,
    language: meta.language,
    copies: meta.copies,
    delivery: meta.delivery,
    comment: meta.comment,
    attachments: meta.attachments,
  }));

/**
 * Строгая серверная валидация меты мастера (zod-схема выше). Ответ — первая
 * нарушенная правило человеческим языком (как validateRequestForm в DIG-30).
 */
export type WizardMetaValidation = { ok: true; data: WizardMeta } | { ok: false; error: string };

export function validateWizardMeta(input: unknown): WizardMetaValidation {
  const result = wizardMetaZ.safeParse(input);
  return result.success
    ? { ok: true, data: result.data }
    : { ok: false, error: result.error.issues[0]?.message ?? 'Некорректные параметры заказа' };
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
 * дефолтом (zod .catch), валидные сохраняются, вложения черновика не
 * восстанавливаются. Используется клиентом мастера.
 */
const wizardDraftZ = z.object({
  destination: z.preprocess(
    asTrimmed,
    z.string().transform((value) => value.slice(0, MAX_WIZARD_DESTINATION_LENGTH)),
  ),
  language: z
    .enum(WIZARD_LANGUAGES as [WizardLanguage, ...WizardLanguage[]])
    .catch(DEFAULT_WIZARD_META.language),
  copies: z.number().int().min(1).max(MAX_WIZARD_COPIES).catch(DEFAULT_WIZARD_META.copies),
  delivery: z
    .enum(WIZARD_DELIVERIES as [WizardDelivery, ...WizardDelivery[]])
    .catch(DEFAULT_WIZARD_META.delivery),
  comment: z.preprocess(
    asTrimmed,
    z.string().transform((value) => value.slice(0, MAX_WIZARD_COMMENT_LENGTH)),
  ),
});

export function normalizeWizardMeta(input: unknown): WizardMeta {
  const strict = validateWizardMeta(input);
  if (strict.ok) return strict.data;
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return { ...DEFAULT_WIZARD_META };
  }
  return { ...wizardDraftZ.parse(input), attachments: [] };
}
