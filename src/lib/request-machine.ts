// DIG-30 — машина состояний канонической заявки (чистая функция, без
// серверных импортов: юнит-тестируется напрямую и переиспользуется UI).
//
// Основная цепочка:  SUBMITTED → ACCEPTED → IN_PROGRESS → READY → ISSUED.
// Ветки:
//   • NEEDS_FIX — только сотрудником и ТОЛЬКО с непустой причиной;
//     студент после исправления возвращает заявку в SUBMITTED;
//   • REJECTED — только сотрудником и ТОЛЬКО с причиной (терминальный);
//   • CANCELLED — только студент-владелец и только до IN_PROGRESS
//     (из SUBMITTED / ACCEPTED / NEEDS_FIX).
// Статусы ISSUED / REJECTED / CANCELLED — терминальные.
// Подача заявки (создание строки) — не переход: мгновенные типы
// создаются сразу в READY сервисом (см. canonical-requests.ts).
//
// Названия статусов — пользовательские метки для событий и уведомлений
// («Принята → В работе»); формат текста уведомления собирает сервис.

export type CanonicalRequestStatus =
  | 'SUBMITTED'
  | 'ACCEPTED'
  | 'IN_PROGRESS'
  | 'READY'
  | 'ISSUED'
  | 'NEEDS_FIX'
  | 'REJECTED'
  | 'CANCELLED';

/** Кто выполняет переход: студент-владелец или сотрудник деканата. */
export type RequestActor = 'STUDENT' | 'STAFF';

export const CANONICAL_REQUEST_STATUSES: readonly CanonicalRequestStatus[] = [
  'SUBMITTED',
  'ACCEPTED',
  'IN_PROGRESS',
  'READY',
  'ISSUED',
  'NEEDS_FIX',
  'REJECTED',
  'CANCELLED',
];

export const CANONICAL_REQUEST_STATUS_LABELS: Record<CanonicalRequestStatus, string> = {
  SUBMITTED: 'Подана',
  ACCEPTED: 'Принята',
  IN_PROGRESS: 'В работе',
  READY: 'Готова',
  ISSUED: 'Выдана',
  NEEDS_FIX: 'Нужна доработка',
  REJECTED: 'Отклонена',
  CANCELLED: 'Отменена',
};

export const TERMINAL_REQUEST_STATUSES: readonly CanonicalRequestStatus[] = [
  'ISSUED',
  'REJECTED',
  'CANCELLED',
];

export function isTerminalRequestStatus(status: CanonicalRequestStatus): boolean {
  return TERMINAL_REQUEST_STATUSES.includes(status);
}

/** Причина доработки/отказа: короче — считаем формальностью и отклоняем. */
export const MIN_REQUEST_REASON_LENGTH = 4;

export interface RequestTransitionRule {
  from: CanonicalRequestStatus;
  to: CanonicalRequestStatus;
  actor: RequestActor;
  /** Переход требует непустой причины (комментария). */
  reasonRequired?: boolean;
}

/**
 * Полная таблица разрешённых переходов. Пары, отсутствующие в таблице,
 * запрещены для ВСЕХ ролей (перескок через цепочку, выход из
 * терминальных статусов, отмена после IN_PROGRESS и т.п.).
 */
export const REQUEST_TRANSITIONS: readonly RequestTransitionRule[] = [
  // Основная цепочка (сотрудник).
  { from: 'SUBMITTED', to: 'ACCEPTED', actor: 'STAFF' },
  { from: 'ACCEPTED', to: 'IN_PROGRESS', actor: 'STAFF' },
  { from: 'IN_PROGRESS', to: 'READY', actor: 'STAFF' },
  { from: 'READY', to: 'ISSUED', actor: 'STAFF' },
  // Доработка (сотрудник, с причиной) и возврат после исправления (студент).
  { from: 'SUBMITTED', to: 'NEEDS_FIX', actor: 'STAFF', reasonRequired: true },
  { from: 'ACCEPTED', to: 'NEEDS_FIX', actor: 'STAFF', reasonRequired: true },
  { from: 'IN_PROGRESS', to: 'NEEDS_FIX', actor: 'STAFF', reasonRequired: true },
  { from: 'NEEDS_FIX', to: 'SUBMITTED', actor: 'STUDENT' },
  // Отказ (сотрудник, с причиной).
  { from: 'SUBMITTED', to: 'REJECTED', actor: 'STAFF', reasonRequired: true },
  { from: 'ACCEPTED', to: 'REJECTED', actor: 'STAFF', reasonRequired: true },
  { from: 'IN_PROGRESS', to: 'REJECTED', actor: 'STAFF', reasonRequired: true },
  // Отмена студентом — только до начала работы (до IN_PROGRESS).
  { from: 'SUBMITTED', to: 'CANCELLED', actor: 'STUDENT' },
  { from: 'ACCEPTED', to: 'CANCELLED', actor: 'STUDENT' },
  { from: 'NEEDS_FIX', to: 'CANCELLED', actor: 'STUDENT' },
];

export type RequestTransitionErrorCode =
  | 'UNKNOWN_STATUS'
  | 'INVALID_TRANSITION'
  | 'FORBIDDEN_ACTOR'
  | 'REASON_REQUIRED';

export type RequestTransitionCheck =
  | { allowed: true }
  | { allowed: false; code: RequestTransitionErrorCode; message: string };

export interface RequestTransitionInput {
  from: CanonicalRequestStatus;
  to: CanonicalRequestStatus;
  actor: RequestActor;
  comment?: string | null;
}

const isStatus = (value: CanonicalRequestStatus): value is CanonicalRequestStatus =>
  CANONICAL_REQUEST_STATUSES.includes(value);

const cleanReason = (comment: string | null | undefined): string => (comment ?? '').trim();

/**
 * Единственная точка правды о допустимости перехода. Недопустимый
 * переход отклоняется структурированной ошибкой (приёмка DIG-30),
 * а не молчаливой заменой статуса.
 */
export function checkRequestTransition(input: RequestTransitionInput): RequestTransitionCheck {
  const { from, to, actor } = input;
  if (!isStatus(from) || !isStatus(to)) {
    return { allowed: false, code: 'UNKNOWN_STATUS', message: 'Неизвестный статус заявки' };
  }
  if (from === to) {
    return {
      allowed: false,
      code: 'INVALID_TRANSITION',
      message: 'Недопустимый переход статуса',
    };
  }

  const matched = REQUEST_TRANSITIONS.filter((rule) => rule.from === from && rule.to === to);
  if (matched.length === 0) {
    return {
      allowed: false,
      code: 'INVALID_TRANSITION',
      message: `Недопустимый переход статуса: «${CANONICAL_REQUEST_STATUS_LABELS[from]}» → «${CANONICAL_REQUEST_STATUS_LABELS[to]}»`,
    };
  }
  if (!matched.some((rule) => rule.actor === actor)) {
    return {
      allowed: false,
      code: 'FORBIDDEN_ACTOR',
      message:
        actor === 'STUDENT'
          ? 'Это действие выполняет только сотрудник деканата'
          : 'Это действие выполняет только студент-владелец заявки',
    };
  }
  const rule = matched.find((rule) => rule.actor === actor)!;
  if (rule.reasonRequired && cleanReason(input.comment).length < MIN_REQUEST_REASON_LENGTH) {
    return {
      allowed: false,
      code: 'REASON_REQUIRED',
      message: `Укажите причину (минимум ${MIN_REQUEST_REASON_LENGTH} символа)`,
    };
  }
  return { allowed: true };
}

/** Целевые статусы, доступные актёру из данного статуса (для UI). */
export function allowedRequestTransitions(
  from: CanonicalRequestStatus,
  actor: RequestActor,
): CanonicalRequestStatus[] {
  return REQUEST_TRANSITIONS.filter((rule) => rule.from === from && rule.actor === actor).map(
    (rule) => rule.to,
  );
}

/** «Принята → В работе» — ядро текста события и уведомления. */
export function formatStatusTransition(
  from: CanonicalRequestStatus,
  to: CanonicalRequestStatus,
): string {
  return `${CANONICAL_REQUEST_STATUS_LABELS[from]} → ${CANONICAL_REQUEST_STATUS_LABELS[to]}`;
}
