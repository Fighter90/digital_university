// DIG-30 — машина состояний канонической заявки (чистая логика).
//
// Цепочка: SUBMITTED → ACCEPTED → IN_PROGRESS → READY → ISSUED.
// Ветки: NEEDS_FIX (обязательная причина) и возврат в SUBMITTED после
// исправления; REJECTED (обязательная причина); CANCELLED — только
// студент-владелец и только до IN_PROGRESS. Приёмка DIG-30:
// «недопустимый переход отклоняется с ошибкой», «unit-тесты на все
// переходы и права (студент не может перевести в READY)».
import { describe, expect, it } from 'vitest';
import {
  CANONICAL_REQUEST_STATUSES,
  CANONICAL_REQUEST_STATUS_LABELS,
  MIN_REQUEST_REASON_LENGTH,
  REQUEST_TRANSITIONS,
  allowedRequestTransitions,
  checkRequestTransition,
  formatStatusTransition,
  isTerminalRequestStatus,
  type CanonicalRequestStatus,
} from '@/lib/request-machine';

const GOOD_REASON = 'В заявке указаны неверные данные о группе';

describe('машина состояний: разрешённые переходы (DIG-30)', () => {
  it('основная цепочка SUBMITTED → ACCEPTED → IN_PROGRESS → READY → ISSUED (сотрудник)', () => {
    expect(checkRequestTransition({ from: 'SUBMITTED', to: 'ACCEPTED', actor: 'STAFF' })).toEqual({
      allowed: true,
    });
    expect(
      checkRequestTransition({ from: 'ACCEPTED', to: 'IN_PROGRESS', actor: 'STAFF' }),
    ).toEqual({ allowed: true });
    expect(checkRequestTransition({ from: 'IN_PROGRESS', to: 'READY', actor: 'STAFF' })).toEqual({
      allowed: true,
    });
    expect(checkRequestTransition({ from: 'READY', to: 'ISSUED', actor: 'STAFF' })).toEqual({
      allowed: true,
    });
  });

  it('ветка NEEDS_FIX с обязательной причиной и возврат в SUBMITTED студентом', () => {
    expect(
      checkRequestTransition({ from: 'SUBMITTED', to: 'NEEDS_FIX', actor: 'STAFF', comment: GOOD_REASON }),
    ).toEqual({ allowed: true });
    expect(
      checkRequestTransition({ from: 'NEEDS_FIX', to: 'SUBMITTED', actor: 'STUDENT' }),
    ).toEqual({ allowed: true });
  });

  it('REJECTED с причиной разрешён из SUBMITTED / ACCEPTED / IN_PROGRESS (сотрудник)', () => {
    for (const from of ['SUBMITTED', 'ACCEPTED', 'IN_PROGRESS'] as const) {
      const check = checkRequestTransition({ from, to: 'REJECTED', actor: 'STAFF', comment: 'Не хватает документов' });
      expect(check.allowed, `${from} → REJECTED`).toBe(true);
    }
  });

  it('CANCELLED студент-владелец — только до IN_PROGRESS (SUBMITTED / ACCEPTED / NEEDS_FIX)', () => {
    for (const from of ['SUBMITTED', 'ACCEPTED', 'NEEDS_FIX'] as const) {
      const check = checkRequestTransition({ from, to: 'CANCELLED', actor: 'STUDENT' });
      expect(check.allowed, `${from} → CANCELLED`).toBe(true);
    }
  });

  it('все строки таблицы переходов согласованы с функцией проверки', () => {
    for (const rule of REQUEST_TRANSITIONS) {
      const check = checkRequestTransition({
        from: rule.from,
        to: rule.to,
        actor: rule.actor,
        comment: rule.reasonRequired ? GOOD_REASON : null,
      });
      expect(check.allowed, `${rule.actor}: ${rule.from} → ${rule.to}`).toBe(true);
    }
  });
});

describe('машина состояний: недопустимые переходы отклоняются', () => {
  it('перескок через цепочку отклоняется (SUBMITTED → READY и др.)', () => {
    const invalid: Array<[CanonicalRequestStatus, CanonicalRequestStatus]> = [
      ['SUBMITTED', 'READY'],
      ['SUBMITTED', 'IN_PROGRESS'],
      ['SUBMITTED', 'ISSUED'],
      ['ACCEPTED', 'READY'],
      ['ACCEPTED', 'ISSUED'],
      ['IN_PROGRESS', 'ISSUED'],
      ['IN_PROGRESS', 'ACCEPTED'],
      ['READY', 'CANCELLED'],
      ['READY', 'SUBMITTED'],
    ];
    for (const [from, to] of invalid) {
      const check = checkRequestTransition({ from, to, actor: 'STAFF' });
      expect(check.allowed, `${from} → ${to}`).toBe(false);
      if (!check.allowed) {
        expect(check.code).toBe('INVALID_TRANSITION');
        expect(check.message).toContain('Недопустимый');
      }
    }
  });

  it('терминальные статусы не имеют выходов', () => {
    expect(isTerminalRequestStatus('ISSUED')).toBe(true);
    expect(isTerminalRequestStatus('REJECTED')).toBe(true);
    expect(isTerminalRequestStatus('CANCELLED')).toBe(true);
    expect(isTerminalRequestStatus('READY')).toBe(false);

    for (const from of ['ISSUED', 'REJECTED', 'CANCELLED'] as const) {
      for (const to of CANONICAL_REQUEST_STATUSES) {
        for (const actor of ['STUDENT', 'STAFF'] as const) {
          const check = checkRequestTransition({ from, to, actor, comment: GOOD_REASON });
          expect(check.allowed, `${actor}: ${from} → ${to}`).toBe(false);
        }
      }
    }
  });

  it('причина обязательна только для NEEDS_FIX и REJECTED', () => {
    for (const to of ['NEEDS_FIX', 'REJECTED'] as const) {
      for (const comment of [null, '', '   ', 'ок', 'x'.repeat(MIN_REQUEST_REASON_LENGTH - 1)]) {
        const check = checkRequestTransition({ from: 'SUBMITTED', to, actor: 'STAFF', comment });
        expect(check.allowed, `${to} без причины (${JSON.stringify(comment)})`).toBe(false);
        if (!check.allowed) {
          expect(check.code).toBe('REASON_REQUIRED');
          expect(check.message).toContain('причин');
        }
      }
    }
    // Необязательный комментарий на остальных переходах не мешает.
    expect(
      checkRequestTransition({ from: 'SUBMITTED', to: 'ACCEPTED', actor: 'STAFF', comment: null }).allowed,
    ).toBe(true);
    expect(
      checkRequestTransition({ from: 'SUBMITTED', to: 'CANCELLED', actor: 'STUDENT', comment: 'думаю' }).allowed,
    ).toBe(true);
  });

  it('неизвестный статус отклоняется явно', () => {
    const check = checkRequestTransition({
      from: 'MAGICAL' as CanonicalRequestStatus,
      to: 'ACCEPTED',
      actor: 'STAFF',
    });
    expect(check.allowed).toBe(false);
    if (!check.allowed) expect(check.code).toBe('UNKNOWN_STATUS');
  });
});

describe('машина состояний: права ролей (приёмка DIG-30)', () => {
  it('студент не может перевести в READY (и в другие «сотруднические» статусы)', () => {
    const staffOnly: Array<[CanonicalRequestStatus, CanonicalRequestStatus]> = [
      ['SUBMITTED', 'ACCEPTED'],
      ['ACCEPTED', 'IN_PROGRESS'],
      ['IN_PROGRESS', 'READY'],
      ['READY', 'ISSUED'],
      ['SUBMITTED', 'NEEDS_FIX'],
      ['ACCEPTED', 'NEEDS_FIX'],
      ['IN_PROGRESS', 'NEEDS_FIX'],
      ['SUBMITTED', 'REJECTED'],
    ];
    for (const [from, to] of staffOnly) {
      const check = checkRequestTransition({
        from,
        to,
        actor: 'STUDENT',
        comment: GOOD_REASON,
      });
      expect(check.allowed, `студент: ${from} → ${to}`).toBe(false);
      if (!check.allowed) {
        expect(check.code).toBe('FORBIDDEN_ACTOR');
        expect(check.message).toContain('сотрудник');
      }
    }
  });

  it('сотрудник не может отменить заявку и вернуть её в SUBMITTED', () => {
    const studentOnly: Array<[CanonicalRequestStatus, CanonicalRequestStatus]> = [
      ['SUBMITTED', 'CANCELLED'],
      ['ACCEPTED', 'CANCELLED'],
      ['NEEDS_FIX', 'CANCELLED'],
      ['NEEDS_FIX', 'SUBMITTED'],
    ];
    for (const [from, to] of studentOnly) {
      const check = checkRequestTransition({ from, to, actor: 'STAFF', comment: GOOD_REASON });
      expect(check.allowed, `сотрудник: ${from} → ${to}`).toBe(false);
      if (!check.allowed) {
        expect(check.code).toBe('FORBIDDEN_ACTOR');
        expect(check.message).toContain('студент');
      }
    }
  });

  it('allowedRequestTransitions отражает роли', () => {
    expect(allowedRequestTransitions('SUBMITTED', 'STAFF').sort()).toEqual([
      'ACCEPTED',
      'NEEDS_FIX',
      'REJECTED',
    ]);
    expect(allowedRequestTransitions('SUBMITTED', 'STUDENT')).toEqual(['CANCELLED']);
    expect(allowedRequestTransitions('IN_PROGRESS', 'STAFF')).toEqual(['READY', 'NEEDS_FIX', 'REJECTED'].filter((s) =>
      ['READY', 'NEEDS_FIX', 'REJECTED'].includes(s),
    ));
    expect(allowedRequestTransitions('ISSUED', 'STAFF')).toEqual([]);
  });

  it('метки статусов дают текст вида «Принята → В работе»', () => {
    expect(CANONICAL_REQUEST_STATUS_LABELS.SUBMITTED).toBe('Подана');
    expect(CANONICAL_REQUEST_STATUS_LABELS.ACCEPTED).toBe('Принята');
    expect(CANONICAL_REQUEST_STATUS_LABELS.IN_PROGRESS).toBe('В работе');
    expect(CANONICAL_REQUEST_STATUS_LABELS.READY).toBe('Готова');
    expect(CANONICAL_REQUEST_STATUS_LABELS.ISSUED).toBe('Выдана');
    expect(CANONICAL_REQUEST_STATUS_LABELS.NEEDS_FIX).toBe('Нужна доработка');
    expect(CANONICAL_REQUEST_STATUS_LABELS.REJECTED).toBe('Отклонена');
    expect(CANONICAL_REQUEST_STATUS_LABELS.CANCELLED).toBe('Отменена');
    expect(formatStatusTransition('ACCEPTED', 'IN_PROGRESS')).toBe('Принята → В работе');
  });
});
