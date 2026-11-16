// DIG-48 — SLA очереди заявок сотрудника (чистые функции, без React/Next):
// срок по типу заявки, просрочка/«скоро срок», парсинг фильтров очереди
// (тип и срок) и сама фильтрация. Используется страницей очереди и сводкой.
import { describe, expect, it } from 'vitest';
import type { ServiceRequestRow } from '@/server/data/types';
import {
  REQUEST_SLA_DAYS,
  slaDeadline,
  slaHoursLeft,
  isSlaOverdue,
  isDueSoon,
  parseQueueDueFilter,
  parseQueueTypeFilter,
  filterQueue,
  OPEN_REQUEST_STATUSES,
} from '@/lib/staff-sla';

const DAY = 24 * 60 * 60 * 1000;

function request(overrides: Partial<ServiceRequestRow> = {}): ServiceRequestRow {
  const createdAt = new Date('2026-11-10T10:15:00');
  return {
    id: 'req-1',
    studentId: 'st-anna',
    number: 'SR-2026-A1B2C',
    type: 'CERTIFICATE',
    title: 'Справка об обучении',
    status: 'SUBMITTED',
    assignee: null,
    resultNote: null,
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

describe('REQUEST_SLA_DAYS и дедлайн', () => {
  it('SLA по типам: справка 3, заявление 5, практика 7, общежитие 7, прочее 5', () => {
    expect(REQUEST_SLA_DAYS.CERTIFICATE).toBe(3);
    expect(REQUEST_SLA_DAYS.STATEMENT).toBe(5);
    expect(REQUEST_SLA_DAYS.PRACTICE).toBe(7);
    expect(REQUEST_SLA_DAYS.DORMITORY).toBe(7);
    expect(REQUEST_SLA_DAYS.OTHER).toBe(5);
  });

  it('дедлайн = подача + SLA-дни типа', () => {
    const created = new Date('2026-11-10T10:15:00');
    expect(slaDeadline({ type: 'CERTIFICATE', createdAt: created }).getTime()).toBe(
      created.getTime() + 3 * DAY,
    );
    expect(slaDeadline({ type: 'PRACTICE', createdAt: created }).getTime()).toBe(
      created.getTime() + 7 * DAY,
    );
  });
});

describe('просрочка и «скоро срок»', () => {
  it('открытая заявка старше SLA — просрочена', () => {
    const now = new Date('2026-11-14T12:00:00'); // подача 10-го, SLA 3 дня → 13-го
    expect(isSlaOverdue(request(), now)).toBe(true);
    expect(isSlaOverdue(request({ type: 'STATEMENT' }), now)).toBe(false); // SLA 5 дней
  });

  it('закрытые статусы никогда не просрочены', () => {
    const now = new Date('2026-11-20T12:00:00');
    expect(isSlaOverdue(request({ status: 'COMPLETED' }), now)).toBe(false);
    expect(isSlaOverdue(request({ status: 'REJECTED' }), now)).toBe(false);
    expect(OPEN_REQUEST_STATUSES).toEqual(['SUBMITTED', 'IN_PROGRESS', 'NEEDS_REVISION']);
  });

  it('дедлайн в пределах 24 часов — «скоро срок», без пересечения с просрочкой', () => {
    const now = new Date('2026-11-13T00:00:00'); // до дедлайна 13T10:15 осталось ~10ч
    expect(isSlaOverdue(request(), now)).toBe(false);
    expect(isDueSoon(request(), now)).toBe(true);
    expect(isDueSoon(request({ type: 'PRACTICE' }), now)).toBe(false); // 7 дней → далеко
  });

  it('slaHoursLeft — положительное до дедлайна, отрицательное после', () => {
    const now = new Date('2026-11-13T00:00:00');
    expect(slaHoursLeft(request(), now)).toBeCloseTo(10.25, 1);
    const later = new Date('2026-11-14T10:15:00');
    expect(slaHoursLeft(request(), later)).toBeLessThan(0);
  });
});

describe('парсинг фильтров очереди', () => {
  it('срок: только белый список, иначе all', () => {
    expect(parseQueueDueFilter('overdue')).toBe('overdue');
    expect(parseQueueDueFilter('today')).toBe('today');
    expect(parseQueueDueFilter('week')).toBe('week');
    expect(parseQueueDueFilter('all')).toBe('all');
    expect(parseQueueDueFilter('hacker')).toBe('all');
    expect(parseQueueDueFilter(null)).toBe('all');
  });

  it('тип: только значения словаря, иначе all', () => {
    expect(parseQueueTypeFilter('CERTIFICATE')).toBe('CERTIFICATE');
    expect(parseQueueTypeFilter('DORMITORY')).toBe('DORMITORY');
    expect(parseQueueTypeFilter('CERTIFICATE; DROP')).toBe('all');
    expect(parseQueueTypeFilter(null)).toBe('all');
  });
});

describe('filterQueue', () => {
  const now = new Date('2026-11-14T12:00:00');
  const rows = [
    request({ id: 'r1', type: 'CERTIFICATE', status: 'SUBMITTED' }), // просрочена (13-го дедлайн)
    request({ id: 'r2', type: 'PRACTICE', status: 'SUBMITTED' }), // далеко (17-го)
    request({ id: 'r3', type: 'STATEMENT', status: 'IN_PROGRESS' }), // 15-го дедлайн
    request({ id: 'r4', type: 'CERTIFICATE', status: 'COMPLETED' }), // закрыта
    request({ id: 'r5', type: 'CERTIFICATE', status: 'SUBMITTED' }), // просрочена
    request({ id: 'r6', type: 'DORMITORY', status: 'SUBMITTED' }), // 17-го
  ];

  it('без фильтров — все заявки', () => {
    expect(filterQueue(rows, { type: 'all', due: 'all' }, now)).toHaveLength(6);
  });

  it('фильтр по типу', () => {
    const result = filterQueue(rows, { type: 'CERTIFICATE', due: 'all' }, now);
    expect(result.map((r) => r.id)).toEqual(['r1', 'r4', 'r5']);
  });

  it('фильтр «просроченные» — только открытые за SLA', () => {
    const result = filterQueue(rows, { type: 'all', due: 'overdue' }, now);
    expect(result.map((r) => r.id)).toEqual(['r1', 'r5']);
  });

  it('фильтр «сегодня» — дедлайн в текущих сутках', () => {
    // r3 (STATEMENT, подан 10-го 10:15) имеет дедлайн 15-го 10:15 — не «сегодня».
    const today = new Date('2026-11-15T09:00:00');
    const result = filterQueue(rows, { type: 'all', due: 'today' }, today);
    expect(result.map((r) => r.id)).toEqual(['r3']);
  });

  it('фильтр «неделя» — дедлайн в ближайшие 7 дней (без просроченных повторов смысла нет: входят все с будущим дедлайном)', () => {
    const result = filterQueue(rows, { type: 'all', due: 'week' }, now);
    expect(result.map((r) => r.id)).toEqual(['r2', 'r3', 'r6']);
  });

  it('закрытые заявки отфильтровываются фильтрами срока всегда', () => {
    expect(
      filterQueue(rows, { type: 'CERTIFICATE', due: 'overdue' }, now).map((r) => r.id),
    ).toEqual(['r1', 'r5']);
  });
});
