// DIG-48 — карта разрешённых переходов статуса заявки в руках сотрудника
// (чистая функция + подписи кнопок). «Нужна доработка» и «Отклонить»
// требуют причину — это продуктовое правило карточки заявки сотрудника.

import type { RequestStatus } from '@/server/data/types';

/**
 * Разрешённые переходы по текущему статусу. COMPLETED и REJECTED —
 * терминальные: сотрудник не переигрывает финальные решения (студент
 * подаёт новую заявку). Целевой статус никогда — SUBMITTED.
 */
export const STAFF_ALLOWED_TRANSITIONS: Record<
  RequestStatus,
  Exclude<RequestStatus, 'SUBMITTED'>[]
> = {
  SUBMITTED: ['IN_PROGRESS', 'NEEDS_REVISION', 'REJECTED'],
  IN_PROGRESS: ['COMPLETED', 'NEEDS_REVISION', 'REJECTED'],
  NEEDS_REVISION: ['IN_PROGRESS', 'REJECTED'],
  COMPLETED: [],
  REJECTED: [],
};

export function isAllowedTransition(from: RequestStatus, to: RequestStatus): boolean {
  return (
    STAFF_ALLOWED_TRANSITIONS[from]?.includes(to as Exclude<RequestStatus, 'SUBMITTED'>) ?? false
  );
}

/** «Нужна доработка» и «Отклонить» невозможны без причины. */
export function requiresReason(to: RequestStatus): boolean {
  return to === 'NEEDS_REVISION' || to === 'REJECTED';
}

/** Минимальная длина причины после трима (осмысленный текст, не точка). */
export const MIN_REASON_LENGTH = 5;

export function isReasonValid(reason: string | null | undefined): boolean {
  return typeof reason === 'string' && reason.trim().length >= MIN_REASON_LENGTH;
}

/** Подпись кнопки действия (короткая, для формы карточки и очереди). */
export const TRANSITION_ACTION_LABELS: Record<Exclude<RequestStatus, 'SUBMITTED'>, string> = {
  IN_PROGRESS: 'Взять в работу',
  NEEDS_REVISION: 'Нужна доработка',
  COMPLETED: 'Выполнена',
  REJECTED: 'Отклонить',
};

/** Подтверждающие формулировки (события истории, aria-метки действий). */
export const TRANSITION_ACTION_TITLES: Record<Exclude<RequestStatus, 'SUBMITTED'>, string> = {
  IN_PROGRESS: 'Заявка принята в работу',
  NEEDS_REVISION: 'Заявка возвращена на доработку',
  COMPLETED: 'Заявка выполнена',
  REJECTED: 'Заявка отклонена',
};
