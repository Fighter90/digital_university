// DIG-48 — SLA очереди заявок сотрудника (чистые функции, без Next/React):
// срок ответа по типу заявки, дедлайн, просрочка и «скоро срок», парсинг и
// применение фильтров очереди (тип заявки + срок). Используется страницей
// очереди /staff/requests и сводкой /staff; тестируется staff-sla.test.ts.

import type { RequestStatus, RequestType, ServiceRequestRow } from '@/server/data/types';

/** Рабочие дни на первый ответ по типу заявки (правило деканата прототипа). */
export const REQUEST_SLA_DAYS: Record<RequestType, number> = {
  CERTIFICATE: 3,
  STATEMENT: 5,
  PRACTICE: 7,
  DORMITORY: 7,
  OTHER: 5,
};

/** Статусы, в которых заявка ещё ждёт действий сотрудника. */
export const OPEN_REQUEST_STATUSES: RequestStatus[] = [
  'SUBMITTED',
  'IN_PROGRESS',
  'NEEDS_REVISION',
];

export function isOpenStatus(status: RequestStatus): boolean {
  return OPEN_REQUEST_STATUSES.includes(status);
}

/** Момент, когда ответ по заявке считается просроченным (подача + SLA). */
export function slaDeadline(request: Pick<ServiceRequestRow, 'type' | 'createdAt'>): Date {
  const deadline = new Date(request.createdAt);
  deadline.setDate(deadline.getDate() + REQUEST_SLA_DAYS[request.type]);
  return deadline;
}

/** Часов до дедлайна; отрицательное — просрочка. */
export function slaHoursLeft(
  request: Pick<ServiceRequestRow, 'type' | 'createdAt'>,
  now: Date,
): number {
  return (slaDeadline(request).getTime() - now.getTime()) / (60 * 60 * 1000);
}

/** Просрочена по SLA: открытый статус и дедлайн в прошлом. */
export function isSlaOverdue(
  request: Pick<ServiceRequestRow, 'type' | 'createdAt' | 'status'>,
  now: Date,
): boolean {
  return isOpenStatus(request.status) && slaDeadline(request).getTime() < now.getTime();
}

/** «Скоро срок»: открытая заявка с дедлайном в ближайшие 24 часа (не просрочка). */
export function isDueSoon(
  request: Pick<ServiceRequestRow, 'type' | 'createdAt' | 'status'>,
  now: Date,
): boolean {
  if (!isOpenStatus(request.status)) return false;
  const hours = slaHoursLeft(request, now);
  return hours >= 0 && hours <= 24;
}

// ── Фильтры очереди ──────────────────────────────────────────────────────────

const DUE_FILTERS = ['all', 'overdue', 'today', 'week'] as const;
export type QueueDueFilter = (typeof DUE_FILTERS)[number];

/** Белый список значения фильтра срока; всё прочее — «все». */
export function parseQueueDueFilter(value: string | null | undefined): QueueDueFilter {
  return DUE_FILTERS.includes(value as QueueDueFilter) ? (value as QueueDueFilter) : 'all';
}

const REQUEST_TYPES: RequestType[] = ['CERTIFICATE', 'STATEMENT', 'PRACTICE', 'DORMITORY', 'OTHER'];

/** Белый список типа заявки; всё прочее (и подмена) — «все типы». */
export function parseQueueTypeFilter(value: string | null | undefined): RequestType | 'all' {
  return REQUEST_TYPES.includes(value as RequestType) ? (value as RequestType) : 'all';
}

export interface QueueFilters {
  type: RequestType | 'all';
  due: QueueDueFilter;
}

/** Применяет фильтры очереди: по типу и по сроку дедлайна SLA. */
export function filterQueue<T extends ServiceRequestRow>(
  rows: readonly T[],
  filters: QueueFilters,
  now: Date,
): T[] {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);
  const weekEnd = new Date(now);
  weekEnd.setDate(weekEnd.getDate() + 7);

  return rows.filter((row) => {
    if (filters.type !== 'all' && row.type !== filters.type) return false;
    switch (filters.due) {
      case 'overdue':
        return isSlaOverdue(row, now);
      case 'today': {
        if (!isOpenStatus(row.status)) return false;
        const deadline = slaDeadline(row);
        return deadline >= startOfToday && deadline < endOfToday;
      }
      case 'week':
        if (!isOpenStatus(row.status)) return false;
        return slaDeadline(row).getTime() > now.getTime() && slaDeadline(row) <= weekEnd;
      default:
        return true;
    }
  });
}

// ── Единая очередь (DIG-126): канон «ЗД-…» + легаси «ЗС/SR-…» ────────────────
//
// Канонический мир DIG-30 живёт в той же очереди сотрудника: дедлайн —
// etaDays типа РАБОЧИМИ днями (request-sla.slaReadyDate), открытые статусы
// шире легаси-набора (ACCEPTED и NEEDS_FIX канона тоже ждут действий).

/** Статусы открытой очереди (канон + легаси): заявка ещё ждёт действий. */
export const QUEUE_OPEN_STATUSES: RequestStatus[] = [
  'SUBMITTED',
  'ACCEPTED',
  'IN_PROGRESS',
  'NEEDS_FIX',
  'NEEDS_REVISION',
];

export function isQueueStatusOpen(status: RequestStatus): boolean {
  return QUEUE_OPEN_STATUSES.includes(status);
}

/** Что SLA-функциям единой очереди нужно от строки поверх статуса. */
export interface UnifiedQueueSlaRow {
  status: RequestStatus;
  /** Готовый дедлайн SLA строки (канон: рабочие дни; легаси: календарные). */
  slaDeadline: Date;
}

/** Часов до дедлайна строки; отрицательное — просрочка. */
export function unifiedSlaHoursLeft(row: UnifiedQueueSlaRow, now: Date): number {
  return (row.slaDeadline.getTime() - now.getTime()) / (60 * 60 * 1000);
}

/** Просрочена по SLA: открытый статус и дедлайн в прошлом. */
export function isQueueRowOverdue(row: UnifiedQueueSlaRow, now: Date): boolean {
  return isQueueStatusOpen(row.status) && row.slaDeadline.getTime() < now.getTime();
}

/** Строка единой очереди с классом типа (нужен фильтру «по типу»). */
export interface UnifiedQueueFilterRow extends UnifiedQueueSlaRow {
  type: RequestType;
}

/** Фильтры очереди (тип + срок) для строк единой очереди — семантика filterQueue. */
export function filterUnifiedQueue<T extends UnifiedQueueFilterRow>(
  rows: readonly T[],
  filters: QueueFilters,
  now: Date,
): T[] {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);
  const weekEnd = new Date(now);
  weekEnd.setDate(weekEnd.getDate() + 7);

  return rows.filter((row) => {
    if (filters.type !== 'all' && row.type !== filters.type) return false;
    switch (filters.due) {
      case 'overdue':
        return isQueueRowOverdue(row, now);
      case 'today': {
        if (!isQueueStatusOpen(row.status)) return false;
        return (
          row.slaDeadline >= startOfToday &&
          row.slaDeadline < endOfToday
        );
      }
      case 'week':
        if (!isQueueStatusOpen(row.status)) return false;
        return row.slaDeadline.getTime() > now.getTime() && row.slaDeadline <= weekEnd;
      default:
        return true;
    }
  });
}
