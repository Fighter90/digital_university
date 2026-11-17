// DIG-32 — чистая логика экрана «Мои заявки». Без серверных импортов:
// используется агрегатором слоя данных (сборка карточек), клиентским
// браузером (фильтры/поиск) и тестируется напрямую.
//
// Единый словарь статусов — канон из lib/request-machine (8 значений).
// Тип слоя данных `RequestStatus` — надмножество канона с двумя легаси
// значениями (COMPLETED, NEEDS_REVISION — мир prisma-сидов DIG-10);
// `unifyRequestStatus` отображает их на канон на входе в экран, поэтому
// UI никогда не рендерит ничего вне единого словаря.

import type { RequestStatus, RequestType } from '@/server/data/types';
import type { CanonicalRequestStatus } from '@/lib/request-machine';
import { formatReadyBy } from '@/lib/request-sla';
import { formatDate, t } from '@/lib/i18n';

export type UnifiedRequestStatus = CanonicalRequestStatus;

/** Легаси-значения → канон (карта миграции DIG-49: COMPLETED→ISSUED, NEEDS_REVISION→NEEDS_FIX). */
export function unifyRequestStatus(status: RequestStatus): UnifiedRequestStatus {
  if (status === 'COMPLETED') return 'ISSUED';
  if (status === 'NEEDS_REVISION') return 'NEEDS_FIX';
  return status;
}

// ── фильтры-корзины ──────────────────────────────────────────────────────────

export type RequestFilterKey = 'ALL' | 'IN_WORK' | 'NEEDS_ACTION' | 'READY' | 'ARCHIVE';

export const REQUEST_FILTERS: ReadonlyArray<{ key: RequestFilterKey; label: string }> = [
  { key: 'ALL', label: 'Все' },
  { key: 'IN_WORK', label: 'В работе' },
  { key: 'NEEDS_ACTION', label: 'Нужно действие' },
  { key: 'READY', label: 'Готовы' },
  { key: 'ARCHIVE', label: 'Архив' },
];

const FILTER_BUCKETS: Record<RequestFilterKey, readonly UnifiedRequestStatus[] | null> = {
  ALL: null,
  IN_WORK: ['SUBMITTED', 'ACCEPTED', 'IN_PROGRESS'],
  NEEDS_ACTION: ['NEEDS_FIX'],
  READY: ['READY'],
  ARCHIVE: ['ISSUED', 'REJECTED', 'CANCELLED'],
};

// ── карточка (сериализуемый вид для клиента: только строки) ──────────────────

export type RequestIconKind =
  'certificate' | 'statement' | 'grades' | 'diploma' | 'practice' | 'dormitory' | 'other';

export type RequestCardAction = 'DOWNLOAD' | 'FIX' | 'CANCEL';

export interface RequestCardView {
  id: string;
  /** Публичный номер: «ЗД-2026-000123» или «SR-2026-A1B2C». */
  number: string;
  /** Название с ключевым параметром («Справка об обучении · для военкомата»). */
  title: string;
  typeName: string;
  iconKind: RequestIconKind;
  /** Статус из ЕДИНОГО словаря (после unifyRequestStatus). */
  status: UnifiedRequestStatus;
  createdAtISO: string;
  createdAtLabel: string;
  readyByISO: string | null;
  readyByLabel: string | null;
  updatedAtISO: string;
  action: RequestCardAction | null;
  /** 1..5 — текущий шаг конвейера; null — вне конвейера (REJECTED/CANCELLED). */
  pipelineStep: number | null;
  nextAction: string;
  /** Причина доработки/отказа (из последнего события с комментарием). */
  reason: string | null;
  isFix: boolean;
}

export type RequestStepperStepState = 'done' | 'current' | 'pending' | 'ready';

/** Конвейер «Подана → Принята → В работе → Готова → Выдана» (метки канона). */
export const REQUEST_PIPELINE_STEPS: ReadonlyArray<{
  status: CanonicalRequestStatus;
  label: string;
}> = [
  { status: 'SUBMITTED', label: 'Подана' },
  { status: 'ACCEPTED', label: 'Принята' },
  { status: 'IN_PROGRESS', label: 'В работе' },
  { status: 'READY', label: 'Готова' },
  { status: 'ISSUED', label: 'Выдана' },
];

/**
 * Текущий шаг конвейера «Подана → Принята → В работе → Готова → Выдана».
 * Вход сужается unify'ом: легаси-значение никогда не даёт «undefined»-шаг.
 */
export function requestPipelineStep(status: RequestStatus): number | null {
  switch (unifyRequestStatus(status)) {
    case 'SUBMITTED':
    case 'NEEDS_FIX': // вернулась к студенту: после исправления снова «Подана»
      return 1;
    case 'ACCEPTED':
      return 2;
    case 'IN_PROGRESS':
      return 3;
    case 'READY':
      return 4;
    case 'ISSUED':
      return 5;
    case 'REJECTED':
    case 'CANCELLED':
      return null;
  }
}

const PENDING_STEPS: readonly RequestStepperStepState[] = [
  'pending',
  'pending',
  'pending',
  'pending',
  'pending',
];

/**
 * Состояния пяти шагов степпера для статуса. Защита от утечки легаси-
 * значения во время выполнения: шаг считается по КАНОНУ (unify внутри),
 * вне конвейера — все шаги неактивны.
 */
export function requestStepperStates(status: RequestStatus): RequestStepperStepState[] {
  const step = requestPipelineStep(status);
  if (step === null) return [...PENDING_STEPS];
  const states = [...PENDING_STEPS] as RequestStepperStepState[];
  for (let i = 0; i < step - 1; i += 1) states[i] = 'done';
  // READY: шаг «Готова» подсвечен состоянием ready (иконка скачивания).
  states[step - 1] = unifyRequestStatus(status) === 'READY' ? 'ready' : 'current';
  if (status === 'ISSUED') states[4] = 'done';
  return states;
}

/** Кнопка действия карточки — только то, что разрешает машина состояний DIG-30. */
export function requestAction(status: RequestStatus): RequestCardAction | null {
  switch (unifyRequestStatus(status)) {
    case 'READY':
      return 'DOWNLOAD';
    case 'NEEDS_FIX':
      return 'FIX';
    case 'SUBMITTED':
    case 'ACCEPTED':
      return 'CANCEL';
    default:
      return null;
  }
}

// ── строка следующего действия ───────────────────────────────────────────────

const issuedAtFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
});

export function nextActionLine(input: {
  status: RequestStatus;
  readyBy: Date | null;
  reason: string | null;
  updatedAt: Date;
}): string {
  // Единый словарь на входе: легаси-значение не даёт «undefined»-строки.
  const { status, readyBy, reason, updatedAt } = input;
  switch (unifyRequestStatus(status)) {
    case 'NEEDS_FIX':
      return reason ? `Нужна доработка: ${reason}` : 'Нужна доработка';
    case 'REJECTED':
      return reason ? `Отклонено: ${reason}` : 'Отклонено деканатом';
    case 'READY':
      return 'Документ готов к скачиванию';
    case 'ISSUED':
      return `Выдан ${issuedAtFormatter.format(updatedAt)}`;
    case 'CANCELLED':
      return `Отменена ${issuedAtFormatter.format(updatedAt)}`;
    case 'ACCEPTED':
      return readyBy ? `Готовность до ${formatReadyBy(readyBy)}` : 'Заявка принята деканатом';
    case 'IN_PROGRESS':
      return readyBy ? `Готовность до ${formatReadyBy(readyBy)}` : 'Деканат готовит документ';
    case 'SUBMITTED':
      return readyBy ? `Готовность до ${formatReadyBy(readyBy)}` : 'Ожидает приёма деканатом';
  }
}

// DIG-69 — локализованная строка следующего действия. RU — байт-в-байт
// прежняя nextActionLine (агрегатор слоя данных продолжает собирать её
// серверно); EN — те же состояния по словарю i18n и en-US-датам.
export function nextActionLineLocalized(
  input: {
    status: RequestStatus;
    readyBy: Date | null;
    reason: string | null;
    updatedAt: Date;
  },
  locale: 'ru' | 'en',
): string {
  if (locale === 'ru') return nextActionLine(input);
  const { status, readyBy, reason, updatedAt } = input;
  const until = readyBy ? formatDate('en', readyBy) : null;
  switch (unifyRequestStatus(status)) {
    case 'NEEDS_FIX':
      return reason ? t('en', 'next.NEEDS_FIX', { reason }) : t('en', 'next.NEEDS_FIX_BARE');
    case 'REJECTED':
      return reason ? t('en', 'next.REJECTED', { reason }) : t('en', 'next.REJECTED_BARE');
    case 'READY':
      return t('en', 'next.READY');
    case 'ISSUED':
      return t('en', 'next.ISSUED', { date: formatDate('en', updatedAt) });
    case 'CANCELLED':
      return t('en', 'next.CANCELLED', { date: formatDate('en', updatedAt) });
    case 'ACCEPTED':
      return until
        ? t('en', 'next.ACCEPTED_UNTIL', { date: until })
        : t('en', 'next.ACCEPTED_BARE');
    case 'IN_PROGRESS':
      return until
        ? t('en', 'next.IN_PROGRESS_UNTIL', { date: until })
        : t('en', 'next.IN_PROGRESS_BARE');
    case 'SUBMITTED':
      return until
        ? t('en', 'next.SUBMITTED_UNTIL', { date: until })
        : t('en', 'next.SUBMITTED_BARE');
  }
}

/** DIG-69 — подпись фильтра-корзины по локали (RU — прежняя метка). */
export function requestFilterLabel(locale: 'ru' | 'en', key: RequestFilterKey): string {
  return t(locale, `filter.${key}`);
}

/** DIG-69 — подпись шага конвейера по локали (RU — прежние метки канона). */
export function pipelineStepLabel(locale: 'ru' | 'en', status: UnifiedRequestStatus): string {
  return t(locale, `status.${status}`);
}

// ── иконки типов ─────────────────────────────────────────────────────────────

/** Иконка канонического типа — по префиксу кода словаря (CERT_…, GRADES_…). */
export function requestIconKindForTypeCode(typeCode: string): RequestIconKind {
  if (typeCode.startsWith('GRADES')) return 'grades';
  if (typeCode.startsWith('DIPLOMA')) return 'diploma';
  if (typeCode.startsWith('ACADEMIC') || typeCode.startsWith('STMT')) return 'statement';
  // DIG-41 — заявление на материальную помощь: тоже заявление, не справка.
  if (typeCode.startsWith('MATERIAL')) return 'statement';
  if (typeCode.startsWith('DORM')) return 'dormitory';
  return 'certificate';
}

/** Иконка легаси-типа (enum RequestType сидов DIG-10). */
export function legacyTypeIcon(type: RequestType): RequestIconKind {
  switch (type) {
    case 'CERTIFICATE':
      return 'certificate';
    case 'STATEMENT':
      return 'statement';
    case 'PRACTICE':
      return 'practice';
    case 'DORMITORY':
      return 'dormitory';
    case 'OTHER':
      return 'other';
  }
}

// ── фильтрация + поиск + сортировка ─────────────────────────────────────────

/** Нормализация поискового запроса: нижний регистр, схлопнутые пробелы. */
export function normalizeRequestQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Сопоставление карточки запросу: номер (фрагмент) или название. */
export function matchRequest(card: RequestCardView, query: string): boolean {
  const q = normalizeRequestQuery(query);
  if (q === '') return true;
  return card.number.toLowerCase().includes(q) || card.title.toLowerCase().includes(q);
}

export function requestFilterCounts(
  cards: readonly RequestCardView[],
): Record<RequestFilterKey, number> {
  const counts: Record<RequestFilterKey, number> = {
    ALL: cards.length,
    IN_WORK: 0,
    NEEDS_ACTION: 0,
    READY: 0,
    ARCHIVE: 0,
  };
  for (const card of cards) {
    for (const { key } of REQUEST_FILTERS) {
      const bucket = FILTER_BUCKETS[key];
      if (bucket && bucket.includes(card.status)) counts[key] += 1;
    }
  }
  return counts;
}

/**
 * Видимый список для корзины и запроса. «Нужна доработка» всегда наверху
 * (требование задачи), остальные — по свежести подачи.
 */
export function filterRequests(
  cards: readonly RequestCardView[],
  filter: RequestFilterKey,
  query: string,
): RequestCardView[] {
  const bucket = FILTER_BUCKETS[filter];
  return cards
    .filter(
      (card) => (bucket === null || bucket.includes(card.status)) && matchRequest(card, query),
    )
    .sort((a, b) => {
      const fixDelta = Number(b.status === 'NEEDS_FIX') - Number(a.status === 'NEEDS_FIX');
      if (fixDelta !== 0) return fixDelta;
      return b.createdAtISO.localeCompare(a.createdAtISO);
    });
}
