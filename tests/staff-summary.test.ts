// DIG-48 — агрегаты сводки сотрудника (чистые функции): заявок сегодня,
// среднее время ответа по событиям сотрудников, просрочено по SLA,
// счётчики статусов, открытые обращения.
import { describe, expect, it } from 'vitest';
import type { AppealRow, RequestEventRow, ServiceRequestRow } from '@/server/data/types';
import { computeStaffSummary, startOfToday } from '@/lib/staff-summary';

const DAY = 24 * 60 * 60 * 1000;
const now = new Date('2026-11-14T15:00:00');
const CREATED = new Date('2026-11-12T10:00:00');

function request(overrides: Partial<ServiceRequestRow> = {}): ServiceRequestRow {
  return {
    id: 'req-1',
    studentId: 'st-anna',
    number: 'SR-2026-A1B2C',
    type: 'CERTIFICATE',
    title: 'Справка об обучении',
    status: 'SUBMITTED',
    assignee: null,
    resultNote: null,
    createdAt: CREATED,
    updatedAt: CREATED,
    ...overrides,
  };
}

function event(requestId: string, actorRole: 'STAFF' | 'STUDENT', at: Date): RequestEventRow {
  return {
    id: `${requestId}-${actorRole}-${at.getTime()}`,
    requestId,
    actorRole,
    actorName: actorRole === 'STAFF' ? 'Мария Петрова' : 'Анна Ковалёва',
    statusFrom: null,
    statusTo: 'SUBMITTED',
    message: 'Событие',
    createdAt: at,
  };
}

function appeal(status: AppealRow['status'], id = 'apl-1'): AppealRow {
  return {
    id,
    studentId: 'st-anna',
    subject: 'Вопрос',
    status,
    createdAt: new Date(now.getTime() - DAY),
  };
}

describe('startOfToday', () => {
  it('начало текущих суток (00:00 локального времени)', () => {
    const start = startOfToday(new Date('2026-11-14T15:27:00'));
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(start.getSeconds()).toBe(0);
    expect(start.getDate()).toBe(14);
  });
});

describe('computeStaffSummary', () => {
  const requests = [
    request({ id: 'today-1', createdAt: new Date('2026-11-14T09:40:00'), type: 'STATEMENT' }),
    request({ id: 'yesterday-1', type: 'CERTIFICATE' }), // подана 12-го
    request({ id: 'old-1', type: 'CERTIFICATE', createdAt: new Date('2026-11-01T10:00:00') }),
    request({
      id: 'done-1',
      status: 'COMPLETED',
      type: 'CERTIFICATE',
      createdAt: new Date('2026-11-01T10:00:00'),
    }),
    request({
      id: 'wip-1',
      status: 'IN_PROGRESS',
      type: 'PRACTICE',
      createdAt: new Date('2026-11-05T10:00:00'),
    }),
  ];
  const eventsByRequestId: Record<string, RequestEventRow[]> = {
    // время ответа: done-1 — 20 ч, yesterday-1 — 4 ч (события сотрудника)
    'done-1': [
      event('done-1', 'STUDENT', new Date('2026-11-01T10:00:00')),
      event(
        'done-1',
        'STAFF',
        new Date(new Date('2026-11-01T10:00:00').getTime() + 20 * 60 * 60 * 1000),
      ),
    ],
    'yesterday-1': [
      event('yesterday-1', 'STUDENT', CREATED),
      event('yesterday-1', 'STAFF', new Date(CREATED.getTime() + 4 * 60 * 60 * 1000)),
    ],
    // old-1 без события сотрудника — не входит в среднее
    'wip-1': [event('wip-1', 'STUDENT', new Date('2026-11-05T10:00:00'))],
  };
  const appeals = [appeal('OPEN', 'apl-1'), appeal('ANSWERED', 'apl-2'), appeal('CLOSED', 'apl-3')];

  it('заявок сегодня — только поданные с начала текущих суток', () => {
    const summary = computeStaffSummary({ now, requests, eventsByRequestId, appeals });
    expect(summary.todayCount).toBe(1);
  });

  it('среднее время ответа — среднее по заявкам с событием сотрудника (20+4)/2 = 12 ч', () => {
    const summary = computeStaffSummary({ now, requests, eventsByRequestId, appeals });
    expect(summary.avgResponseHours).toBeCloseTo(12, 5);
  });

  it('без событий сотрудников — прочерк (null)', () => {
    const summary = computeStaffSummary({
      now,
      requests: [request({ id: 'x' })],
      eventsByRequestId: {},
      appeals: [],
    });
    expect(summary.avgResponseHours).toBeNull();
  });

  it('просрочено — только открытые за SLA типа', () => {
    const summary = computeStaffSummary({ now, requests, eventsByRequestId, appeals });
    // old-1 (CERTIFICATE, подан 1-го, SLA 3 дн) просрочена; done-1 закрыт — нет;
    // wip-1 (PRACTICE, SLA 7 дн, 5-го → до 12-го) просрочена.
    expect(summary.overdueCount).toBe(2);
  });

  it('счётчики статусов и открытых обращений', () => {
    const summary = computeStaffSummary({ now, requests, eventsByRequestId, appeals });
    expect(summary.submittedCount).toBe(3);
    expect(summary.inProgressCount).toBe(1);
    expect(summary.needsRevisionCount).toBe(0);
    expect(summary.openAppealsCount).toBe(2);
    expect(summary.totalOpenCount).toBe(4);
  });
});
