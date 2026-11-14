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
  it('SUBMITTED → в работу / доработка / отказ', () => {
    expect(STAFF_ALLOWED_TRANSITIONS.SUBMITTED).toEqual([
      'IN_PROGRESS',
      'NEEDS_REVISION',
      'REJECTED',
    ]);
  });

  it('IN_PROGRESS → выполнена / доработка / отказ', () => {
    expect(STAFF_ALLOWED_TRANSITIONS.IN_PROGRESS).toEqual([
      'COMPLETED',
      'NEEDS_REVISION',
      'REJECTED',
    ]);
  });

  it('NEEDS_REVISION → в работу / отказ; COMPLETED и REJECTED — терминальные', () => {
    expect(STAFF_ALLOWED_TRANSITIONS.NEEDS_REVISION).toEqual(['IN_PROGRESS', 'REJECTED']);
    expect(STAFF_ALLOWED_TRANSITIONS.COMPLETED).toEqual([]);
    expect(STAFF_ALLOWED_TRANSITIONS.REJECTED).toEqual([]);
  });

  it('isAllowedTransition', () => {
    expect(isAllowedTransition('SUBMITTED', 'IN_PROGRESS')).toBe(true);
    expect(isAllowedTransition('COMPLETED', 'IN_PROGRESS')).toBe(false);
    expect(isAllowedTransition('REJECTED', 'SUBMITTED')).toBe(false);
    expect(isAllowedTransition('IN_PROGRESS', 'COMPLETED')).toBe(true);
  });

  it('карта покрывает все статусы словаря', () => {
    const all: RequestStatus[] = [
      'SUBMITTED',
      'IN_PROGRESS',
      'NEEDS_REVISION',
      'COMPLETED',
      'REJECTED',
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
