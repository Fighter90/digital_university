// DIG-33 — чистая логика карточки заявки «ЗД-…» (Figma «06 · Заявки —
// карточка»). Без серверных импортов: страница, клиентские формы и
// юнит-тесты используют одни и те же правила.
//
// Контракт:
//  • «Ведёт» — автор последнего STAFF-события истории (кто реально
//    взял заявку; до первого касания — безымянный «сотрудник деканата»);
//  • ожидаемая дата — SLA типа от момента последнего «вперёд»-перехода
//    (SUBMITTED/ACCEPTED/IN_PROGRESS): после доработки даты нет —
//    обещание от непроверенных данных было бы ложью (урок DIG-30);
//  • параметры — labels из JSON-схемы типа, мета мастера (wizard —
//    JSON-строка в params) — человекочитаемые строки + вложения.

import {
  CANONICAL_REQUEST_STATUS_LABELS,
  formatStatusTransition,
  type CanonicalRequestStatus,
} from '@/lib/request-machine';
import { formatReadyBy, slaReadyDate } from '@/lib/request-sla';
import { parseRequestFormSchema } from '@/lib/request-form-schema';
import {
  WIZARD_DELIVERY_LABELS,
  WIZARD_DELIVERY_LABELS_EN,
  WIZARD_LANGUAGE_LABELS,
  validateWizardMeta,
} from '@/lib/request-wizard-schema';
import { requestStatusLabel, t, type Locale } from '@/lib/i18n';

/** Событие истории, необходимое таймлайну (строка слоя данных уже «плоская»). */
export interface RequestTimelineEvent {
  id: string;
  actorRole: 'STUDENT' | 'STAFF' | null;
  actorName: string;
  fromStatus: CanonicalRequestStatus | null;
  toStatus: CanonicalRequestStatus;
  comment: string | null;
  createdAt: Date;
}

/** «Ведёт: …» — последний сотрудник, касавшийся заявки; null — ещё никто. */
export function lastStaffActorName(events: readonly RequestTimelineEvent[]): string | null {
  let name: string | null = null;
  for (const event of events) {
    if (event.actorRole === 'STAFF') name = event.actorName;
  }
  return name;
}

/** Статусы «конвейера», для которых ещё честно обещать срок готовности. */
const PIPELINE_STATUSES: readonly CanonicalRequestStatus[] = [
  'SUBMITTED',
  'ACCEPTED',
  'IN_PROGRESS',
];

/**
 * «Готовность до <дата>» от последнего «вперёд»-перехода (подача,
 * приём, в работу, возврат после исправления). NEEDS_FIX и терминальные
 * статусы срока не обещают — null.
 */
export function expectedReadyLabelFromEvents(
  events: readonly RequestTimelineEvent[],
  etaDays: number | null | undefined,
  locale: Locale = 'ru',
): string | null {
  if (etaDays === null || etaDays === undefined) return null;
  // Текущий статус = статус последнего события (каждый переход пишет
  // событие). Срок обещаем только пока заявка в конвейере.
  const current = events.at(-1)?.toStatus;
  if (!current || !PIPELINE_STATUSES.includes(current)) return null;
  let transitionedAt: Date | null = null;
  for (const event of events) {
    if (PIPELINE_STATUSES.includes(event.toStatus)) transitionedAt = event.createdAt;
  }
  if (!transitionedAt) return null;
  const readyBy = slaReadyDate(transitionedAt, etaDays);
  return readyBy ? t(locale, 'requests.readyBy', { date: formatReadyBy(readyBy, locale) }) : null;
}

/** Текст события таймлайна: «Подана → Нужна доработка» или просто статус. */
export function timelineEventText(event: RequestTimelineEvent, locale: Locale = 'ru'): string {
  if (locale === 'en') {
    const to = requestStatusLabel('en', event.toStatus);
    return event.fromStatus ? `${requestStatusLabel('en', event.fromStatus)} → ${to}` : to;
  }
  return event.fromStatus
    ? formatStatusTransition(event.fromStatus, event.toStatus)
    : CANONICAL_REQUEST_STATUS_LABELS[event.toStatus];
}

// ── параметры заявки ────────────────────────────────────────────────────────

export interface RequestParamRow {
  label: string;
  value: string;
}

const WIZARD_PARAM_KEY = 'wizard';

/** Поля формы типа (labels из JSON-схемы); служебный ключ wizard не показываем. */
export function requestParamsRows(
  params: Record<string, string>,
  formSchema: unknown,
): RequestParamRow[] {
  const schema = parseRequestFormSchema(formSchema);
  const rows: RequestParamRow[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (key === WIZARD_PARAM_KEY) continue;
    const label = schema?.fields.find((field) => field.key === key)?.label ?? key;
    rows.push({ label, value });
  }
  return rows;
}

export interface RequestWizardView {
  rows: RequestParamRow[];
  attachments: Array<{ name: string; sizeLabel: string }>;
}

/**
 * Мета мастера заказа (params.wizard, JSON-строка) в человекочитаемом
 * виде. null — мастера не было (или мета не прошла валидацию): секция
 * не показывается, никаких «дефолтных» строк-заглушек.
 */
export function requestWizardView(
  params: Record<string, string>,
  locale: Locale = 'ru',
): RequestWizardView | null {
  const raw = params[WIZARD_PARAM_KEY];
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const meta = validateWizardMeta(parsed);
  if (!meta.ok) return null;

  // DIG-84 — подписи полей мастера по локали (RU — прежние байт-в-байт);
  // язык — имя языка (демо-контент), способ получения — интерфейс.
  const deliveryLabel =
    locale === 'en'
      ? WIZARD_DELIVERY_LABELS_EN[meta.data.delivery]
      : WIZARD_DELIVERY_LABELS[meta.data.delivery];
  const rows: RequestParamRow[] = [
    {
      label: t(locale, 'requests.param.language'),
      value: WIZARD_LANGUAGE_LABELS[meta.data.language],
    },
  ];
  if (meta.data.destination) {
    rows.push({ label: t(locale, 'requests.param.destination'), value: meta.data.destination });
  }
  rows.push({ label: t(locale, 'requests.param.copies'), value: String(meta.data.copies) });
  rows.push({ label: t(locale, 'requests.param.delivery'), value: deliveryLabel });
  if (meta.data.comment) {
    rows.push({ label: t(locale, 'requests.param.comment'), value: meta.data.comment });
  }
  return {
    rows,
    attachments: meta.data.attachments.map((file) => ({
      name: file.name,
      sizeLabel: formatAttachmentSize(file.size),
    })),
  };
}

/** «512 Б» / «2 КБ» / «1,2 МБ» — размер вложения для карточки. */
export function formatAttachmentSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} МБ`;
}

// ── вопрос по заявке (лимиты формы «Задать вопрос», клиент и сервер) ─────────

export const MIN_QUESTION_LENGTH = 4;
export const MAX_QUESTION_LENGTH = 500;
