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
  // Каноническая схема DIG-30: конвейер справок + ветки доработки.
  SUBMITTED: ['ACCEPTED', 'IN_PROGRESS', 'NEEDS_FIX', 'NEEDS_REVISION', 'REJECTED', 'CANCELLED'],
  ACCEPTED: ['IN_PROGRESS', 'NEEDS_FIX', 'NEEDS_REVISION', 'REJECTED', 'CANCELLED'],
  IN_PROGRESS: ['READY', 'NEEDS_FIX', 'NEEDS_REVISION', 'REJECTED', 'CANCELLED'],
  NEEDS_FIX: ['IN_PROGRESS', 'READY', 'NEEDS_REVISION', 'REJECTED', 'CANCELLED'],
  READY: ['ISSUED', 'NEEDS_REVISION', 'CANCELLED'],
  ISSUED: [],
  NEEDS_REVISION: ['IN_PROGRESS', 'READY', 'REJECTED', 'CANCELLED'],
  COMPLETED: [],
  REJECTED: [],
  CANCELLED: [],
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
  ACCEPTED: 'Принять',
  IN_PROGRESS: 'Взять в работу',
  READY: 'Готова к выдаче',
  ISSUED: 'Выдана',
  NEEDS_FIX: 'Нужна правка данных',
  NEEDS_REVISION: 'Нужна доработка',
  COMPLETED: 'Выполнена',
  REJECTED: 'Отклонить',
  CANCELLED: 'Отменить',
};

/** Подтверждающие формулировки (события истории, aria-метки действий). */
export const TRANSITION_ACTION_TITLES: Record<Exclude<RequestStatus, 'SUBMITTED'>, string> = {
  ACCEPTED: 'Заявка принята',
  IN_PROGRESS: 'Заявка принята в работу',
  READY: 'Заявка готова к выдаче',
  ISSUED: 'Документ выдан',
  NEEDS_FIX: 'Заявка возвращена на правку данных',
  NEEDS_REVISION: 'Заявка возвращена на доработку',
  COMPLETED: 'Заявка выполнена',
  REJECTED: 'Заявка отклонена',
  CANCELLED: 'Заявка отменена',
};
