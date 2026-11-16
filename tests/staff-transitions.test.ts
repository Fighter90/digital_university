// DIG-48 — разрешённые переходы статуса заявки в руках сотрудника
// (чистая карта + подписи кнопок + обязательная причина доработки).
import { describe, expect, it } from 'vitest';
import type { RequestStatus } from '@/server/data/types';
import {
  STAFF_ALLOWED_TRANSITIONS,
  isAllowedTransition,
  requiresReason,
  TRANSITION_ACTION_LABELS,
  TRANSITION_ACTION_TITLES,
} from '@/lib/staff-transitions';

describe('карта разрешённых переходов', () => {
  it('SUBMITTED → принять / в работу / правка / доработка / отказ / отмена', () => {
    expect(STAFF_ALLOWED_TRANSITIONS.SUBMITTED).toEqual([
      'ACCEPTED',
      'IN_PROGRESS',
      'NEEDS_FIX',
      'NEEDS_REVISION',
      'REJECTED',
      'CANCELLED',
    ]);
  });

  it('IN_PROGRESS → готова к выдаче / правка / доработка / отказ / отмена', () => {
    expect(STAFF_ALLOWED_TRANSITIONS.IN_PROGRESS).toEqual([
      'READY',
      'NEEDS_FIX',
      'NEEDS_REVISION',
      'REJECTED',
      'CANCELLED',
    ]);
  });

  it('NEEDS_REVISION → в работу / готова; терминальные: ISSUED, COMPLETED, REJECTED, CANCELLED', () => {
    expect(STAFF_ALLOWED_TRANSITIONS.NEEDS_REVISION).toEqual([
      'IN_PROGRESS',
      'READY',
      'REJECTED',
      'CANCELLED',
    ]);
    expect(STAFF_ALLOWED_TRANSITIONS.COMPLETED).toEqual([]);
    expect(STAFF_ALLOWED_TRANSITIONS.REJECTED).toEqual([]);
    expect(STAFF_ALLOWED_TRANSITIONS.CANCELLED).toEqual([]);
    expect(STAFF_ALLOWED_TRANSITIONS.ISSUED).toEqual([]);
  });

  it('isAllowedTransition', () => {
    expect(isAllowedTransition('SUBMITTED', 'IN_PROGRESS')).toBe(true);
    expect(isAllowedTransition('SUBMITTED', 'ACCEPTED')).toBe(true);
    expect(isAllowedTransition('IN_PROGRESS', 'READY')).toBe(true);
    expect(isAllowedTransition('READY', 'ISSUED')).toBe(true);
    expect(isAllowedTransition('COMPLETED', 'IN_PROGRESS')).toBe(false);
    expect(isAllowedTransition('REJECTED', 'SUBMITTED')).toBe(false);
    expect(isAllowedTransition('IN_PROGRESS', 'COMPLETED')).toBe(false); // канон: через READY
  });

  it('карта покрывает все статусы канонического словаря DIG-30', () => {
    const all: RequestStatus[] = [
      'SUBMITTED',
      'ACCEPTED',
      'IN_PROGRESS',
      'READY',
      'ISSUED',
      'NEEDS_FIX',
      'REJECTED',
      'CANCELLED',
      'NEEDS_REVISION',
      'COMPLETED',
    ];
    for (const status of all) expect(STAFF_ALLOWED_TRANSITIONS[status]).toBeDefined();
  });
});

describe('причина доработки/отказа', () => {
  it('requiresReason только для NEEDS_REVISION и REJECTED', () => {
    expect(requiresReason('NEEDS_REVISION')).toBe(true);
    expect(requiresReason('REJECTED')).toBe(true);
    expect(requiresReason('IN_PROGRESS')).toBe(false);
    expect(requiresReason('COMPLETED')).toBe(false);
  });

  it('TRANSITION_ACTION_LABELS — подписи кнопок, IN_PROGRESS = «Взять в работу»', () => {
    expect(TRANSITION_ACTION_LABELS.IN_PROGRESS).toBe('Взять в работу');
    expect(TRANSITION_ACTION_LABELS.COMPLETED).toBe('Выполнена');
    expect(TRANSITION_ACTION_LABELS.NEEDS_REVISION).toBe('Нужна доработка');
    expect(TRANSITION_ACTION_LABELS.REJECTED).toBe('Отклонить');
    // Заголовки (для событий истории) — те же ключи.
    expect(TRANSITION_ACTION_TITLES.COMPLETED).toContain('выполнена');
  });
});
