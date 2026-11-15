// DIG-30 — JSON-схема полей формы заявки (RequestType.formSchema) и
// серверная валидация ввода zod'ом.
//
// Схема хранится в БД как Json и описывает форму заказа документа:
//
//   {
//     "keyField": "purpose",               // чьё значение попадает в название
//     "fields": [
//       { "key": "purpose", "label": "Назначение", "type": "enum",
//         "required": true, "options": ["для банка", ...] },
//       { "key": "period", "label": "Период", "type": "text", "maxLength": 60 },
//       { "key": "from",   "label": "Дата начала", "type": "date" }
//     ]
//   }
//
// Модуль чистый (только zod): используется сервисом заявок на сервере
// и тестируется напрямую.

import { z } from 'zod';

export type RequestFormFieldType = 'text' | 'enum' | 'date';

export interface RequestFormFieldSchema {
  /** Имя поля ввода (latin/цифры/подчёркивание, с буквы). */
  key: string;
  /** Пользовательская метка — попадает в сообщения об ошибках. */
  label: string;
  type: RequestFormFieldType;
  required?: boolean;
  /** Список допустимых значений (обязателен для type: 'enum'). */
  options?: string[];
  /** Максимум символов для text (по умолчанию 200). */
  maxLength?: number;
}

export interface RequestFormSchema {
  /** Ключ поля, значение которого строит название заявки («тип · значение»). */
  keyField?: string;
  fields: RequestFormFieldSchema[];
}

/** О洛граничение длины названия заявки (анти-абуз: гигантские значения). */
export const MAX_REQUEST_TITLE_LENGTH = 140;

const FIELD_KEY_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]{0,31}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_TEXT_MAX_LENGTH = 200;

const fieldSchemaZ = z
  .object({
    key: z.string().regex(FIELD_KEY_PATTERN, 'Некорректный ключ поля формы'),
    label: z.string().min(1).max(120),
    type: z.enum(['text', 'enum', 'date']),
    required: z.boolean().optional(),
    options: z.array(z.string().min(1).max(120)).min(1).max(50).optional(),
    maxLength: z.number().int().min(1).max(500).optional(),
  })
  // enum без списка опций — сломанная схема.
  .refine((field) => field.type !== 'enum' || (field.options?.length ?? 0) > 0, {
    message: 'enum-поле без списка опций',
  });

const formSchemaZ = z
  .object({
    keyField: z.string().regex(FIELD_KEY_PATTERN).optional(),
    fields: z.array(fieldSchemaZ).max(30),
  })
  .refine((schema) => schema.keyField === undefined || schema.fields.some((f) => f.key === schema.keyField), {
    message: 'keyField не найден среди полей формы',
  });

/** Разобрать JSON-схему формы; null — схема сломана (тип не готов к приёму заявок). */
export function parseRequestFormSchema(json: unknown): RequestFormSchema | null {
  const parsed = formSchemaZ.safeParse(json);
  return parsed.success ? (parsed.data as RequestFormSchema) : null;
}

function buildFieldZod(field: RequestFormFieldSchema): z.ZodType<string> {
  if (field.type === 'enum') {
    const options = field.options ?? [];
    const enumZ = z.enum(options as [string, ...string[]], `Выберите значение поля «${field.label}»`);
    return field.required
      ? enumZ
      : z.union([z.literal(''), enumZ], `Проверьте поле «${field.label}»`);
  }
  if (field.type === 'date') {
    const dateZ = z
      .string()
      .regex(DATE_PATTERN, `Некорректная дата в поле «${field.label}» (формат ГГГГ-ММ-ДД)`);
    return field.required ? dateZ : z.union([z.literal(''), dateZ]);
  }
  const max = field.maxLength ?? DEFAULT_TEXT_MAX_LENGTH;
  const textZ = z
    .string()
    .trim()
    .max(max, `Слишком длинное значение в поле «${field.label}» (максимум ${max} символов)`);
  return field.required
    ? textZ.min(1, `Заполните поле «${field.label}»`)
    : textZ;
}

export type RequestFormValidation =
  | { ok: true; data: Record<string, string> }
  | { ok: false; error: string };

/**
 * Валидация ввода студента по JSON-схеме типа. Схема null/undefined —
 * «форма без полей» (типу заявки нечего спрашивать), а не ошибка.
 * Чужие ключи отбрасываются, строки триммируются; ответ — первое
 * нарушение человеческим языком.
 */
export function validateRequestForm(
  schemaJson: unknown,
  data: unknown,
): RequestFormValidation {
  const schema =
    schemaJson === null || schemaJson === undefined ? { fields: [] } : parseRequestFormSchema(schemaJson);
  if (!schema) return { ok: false, error: 'Некорректная схема формы заявки' };
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, error: 'Некорректные параметры формы' };
  }

  const input = data as Record<string, unknown>;
  const prepared: Record<string, string> = {};
  const shape: Record<string, z.ZodType<string>> = {};
  for (const field of schema.fields) {
    // Отсутствующее значение приводим к '' — чтобы обязательность давала
    // человеческое сообщение («Заполните поле …»), а не «Invalid input».
    const raw = input[field.key];
    prepared[field.key] = typeof raw === 'string' ? raw : '';
    shape[field.key] = buildFieldZod(field);
  }
  // z.object по умолчанию отбрасывает неизвестные ключи (анти-инъекция
  // лишних параметров в params заявки).
  const parsed = z.object(shape).safeParse(prepared);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Проверьте поля формы' };
  }
  return { ok: true, data: parsed.data as Record<string, string> };
}

/**
 * Название заявки — «тип · ключевой параметр» («Справка об обучении ·
 * для банка»); без ключевого поля (или без значения) — просто тип.
 * Никогда не обезличенное.
 */
export function requestTitleFromParams(
  typeName: string,
  schema: RequestFormSchema | null,
  params: Record<string, string>,
): string {
  const key = schema?.keyField;
  const value = key ? (params[key] ?? '').trim() : '';
  if (!value) return typeName;
  const title = `${typeName} · ${value}`;
  if (title.length <= MAX_REQUEST_TITLE_LENGTH) return title;
  return `${title.slice(0, MAX_REQUEST_TITLE_LENGTH - 1)}…`;
}
