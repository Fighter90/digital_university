// DIG-48 — агрегаты сводки деканата (чистые функции): «заявок сегодня»,
// среднее время ответа по событиям сотрудников, просрочено по SLA,
// счётчики открытых статусов и открытых обращений. Тестируется
// staff-summary.test.ts; страницы вызывают через getStaffSummaryData.

import type { AppealRow, RequestEventRow, ServiceRequestRow } from '@/server/data/types';
import { isSlaOverdue, OPEN_REQUEST_STATUSES } from '@/lib/staff-sla';

/** Начало текущих суток (00:00 локального времени сервера). */
export function startOfToday(now: Date): Date {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return start;
}

export interface StaffSummaryInput {
  now: Date;
  requests: readonly ServiceRequestRow[];
  /** События по каждой заявке (для среднего времени первого ответа). */
  eventsByRequestId: Readonly<Record<string, readonly RequestEventRow[]>>;
  appeals: readonly AppealRow[];
}

export interface StaffSummary {
  /** Заявки, поданные с начала текущих суток. */
  todayCount: number;
  /** Среднее время первого ответа сотрудника в часах; null — данных нет. */
  avgResponseHours: number | null;
  /** Открытые заявки, просроченные по SLA своего типа. */
  overdueCount: number;
  submittedCount: number;
  inProgressCount: number;
  needsRevisionCount: number;
  /** Все открытые заявки (три открытых статуса). */
  totalOpenCount: number;
  /** Обращения в статусах OPEN и ANSWERED — ещё в работе деканата. */
  openAppealsCount: number;
}

/** Первое событие сотрудника по заявке (первый ответ деканата). */
function firstStaffEvent(events: readonly RequestEventRow[]): RequestEventRow | null {
  return events.find((event) => event.actorRole === 'STAFF') ?? null;
}

export function computeStaffSummary(input: StaffSummaryInput): StaffSummary {
  const { now, requests, eventsByRequestId, appeals } = input;
  const todayStart = startOfToday(now).getTime();

  let todayCount = 0;
  let overdueCount = 0;
  let submittedCount = 0;
  let inProgressCount = 0;
  let needsRevisionCount = 0;

  const responseHours: number[] = [];
  for (const request of requests) {
    if (request.createdAt.getTime() >= todayStart) todayCount += 1;
    if (isSlaOverdue(request, now)) overdueCount += 1;
    if (request.status === 'SUBMITTED') submittedCount += 1;
    if (request.status === 'IN_PROGRESS') inProgressCount += 1;
    if (request.status === 'NEEDS_REVISION') needsRevisionCount += 1;
    const firstAnswer = firstStaffEvent(eventsByRequestId[request.id] ?? []);
    if (firstAnswer) {
      const hours = (firstAnswer.createdAt.getTime() - request.createdAt.getTime()) / 3600000;
      if (hours >= 0) responseHours.push(hours);
    }
  }

  return {
    todayCount,
    avgResponseHours:
      responseHours.length > 0
        ? responseHours.reduce((sum, hours) => sum + hours, 0) / responseHours.length
        : null,
    overdueCount,
    submittedCount,
    inProgressCount,
    needsRevisionCount,
    totalOpenCount: requests.filter((request) => OPEN_REQUEST_STATUSES.includes(request.status))
      .length,
    openAppealsCount: appeals.filter(
      (appeal) => appeal.status === 'OPEN' || appeal.status === 'ANSWERED',
    ).length,
  };
}
