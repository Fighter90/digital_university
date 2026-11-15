// DIG-30 — «Заявки и справки»: серверная логика канонических заявок.
//
// IDOR-контракт (как весь слой DIG-12): контекст приходит из живой сессии
// (requireDataCtx), владение проверяется здесь — студент достаёт только
// свои заявки, сотрудник — только заявки студентов своего факультета.
// Чужая заявка и несуществующая неотличимы (null / NOT_FOUND), попытка
// чужой пишется в аудит (denyAccess). Переходы статуса валидируются
// машиной состояний (lib/request-machine.ts): недопустимый переход или
// переход чужой роли отклоняется ошибкой, ничего не меняя.
//
// Каждый переход и каждая подача пишут RequestEvent (кто, когда,
// комментарий) и создают уведомление с конкретикой:
// «Заявка ЗД-2026-000123 «Справка об обучении · для военкомата»:
//  Принята → В работе. Готовность до 20 ноября».

import {
  CANONICAL_REQUEST_STATUS_LABELS,
  checkRequestTransition,
  formatStatusTransition,
  type CanonicalRequestStatus,
  type RequestActor,
} from '../../lib/request-machine';
import {
  parseRequestFormSchema,
  requestTitleFromParams,
  validateRequestForm,
} from '../../lib/request-form-schema';
import { formatReadyBy, slaReadyDate } from '../../lib/request-sla';
import { formatCanonicalRequestNumber } from './canonical-request-number';
import { denyAccess } from './access';
import type { DataDb } from './port';
import type {
  CanonicalRequestEventRow,
  CanonicalRequestRow,
  CanonicalRequestTypeRow,
  DataCtx,
} from './types';

const RESOURCE = 'canonical-request';

/** Окно повторного заказа одной и той же справки (приёмка DIG-30). */
export const REQUEST_DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000;

// ── словарь типов ─────────────────────────────────────────────────────────────

export async function listCanonicalRequestTypes(db: DataDb): Promise<CanonicalRequestTypeRow[]> {
  return db.listCanonicalRequestTypes();
}

// ── подача заявки ─────────────────────────────────────────────────────────────

export interface CreateCanonicalRequestInput {
  typeCode: string;
  params?: Record<string, unknown>;
  now?: Date;
}

export type CreateCanonicalRequestResult =
  | { kind: 'created'; request: CanonicalRequestRow }
  /**
   * Повторный заказ той же справки за 24 часа при уже готовой заявке:
   * новая НЕ создаётся, UI предлагает скачать готовый документ.
   */
  | { kind: 'duplicate'; existing: CanonicalRequestRow; title: string }
  | {
      kind: 'error';
      code: 'ROLE_MISMATCH' | 'UNKNOWN_TYPE' | 'INVALID_FORM';
      message: string;
    };

export async function createCanonicalRequest(
  db: DataDb,
  ctx: DataCtx,
  input: CreateCanonicalRequestInput,
): Promise<CreateCanonicalRequestResult> {
  const now = input.now ?? new Date();

  if (ctx.role !== 'STUDENT' || ctx.studentId === null) {
    await denyAccess(db, {
      ctx,
      resourceType: RESOURCE,
      resourceRef: input.typeCode,
      reason: 'ROLE_MISMATCH',
    });
    return {
      kind: 'error',
      code: 'ROLE_MISMATCH',
      message: 'Заявки подаются из кабинета студента',
    };
  }

  const type = await db.findCanonicalRequestTypeByCode(input.typeCode);
  if (!type) {
    return { kind: 'error', code: 'UNKNOWN_TYPE', message: 'Неизвестный тип заявки' };
  }

  const schema = parseRequestFormSchema(type.formSchema);
  const form = validateRequestForm(type.formSchema, input.params ?? {});
  if (!form.ok) {
    return { kind: 'error', code: 'INVALID_FORM', message: form.error };
  }

  // Повторный заказ за 24 часа: если заявка того же ДОКУМЕНТА (тот же
  // тип и то же значение ключевого поля формы — «справка для банка» и
  // «для военкомата» это разные документы) уже готова (READY) или выдана
  // (ISSUED) — дубликат не заводим, предлагаем скачать.
  const windowStart = new Date(now.getTime() - REQUEST_DUPLICATE_WINDOW_MS);
  const keyField = schema?.keyField ?? null;
  const keyValue = keyField ? (form.data[keyField] ?? '').trim() : null;
  const existing = await db.findLatestCanonicalRequestByStudentAndType(
    ctx.studentId,
    type.code,
    windowStart,
    keyField,
    keyValue,
  );
  if (existing && (existing.status === 'READY' || existing.status === 'ISSUED')) {
    return {
      kind: 'duplicate',
      existing,
      title: requestTitleFromParams(type.name, schema, existing.params),
    };
  }

  const student = await db.findStudentById(ctx.studentId);
  const title = requestTitleFromParams(type.name, schema, form.data);
  const year = now.getFullYear();
  const seq = await db.nextCanonicalRequestSeq(year);
  const number = formatCanonicalRequestNumber(year, seq);
  // Мгновенные типы (справка об обучении, выписка оценок): документ
  // формируется сразу, заявка минует очередь и открывается в READY.
  const status: CanonicalRequestStatus = type.isInstant ? 'READY' : 'SUBMITTED';

  const created = await db.insertCanonicalRequest(
    {
      number,
      studentId: ctx.studentId,
      typeCode: type.code,
      typeName: type.name,
      title,
      params: form.data,
      status,
      createdAt: now,
      updatedAt: now,
    },
    {
      actorUserId: ctx.userId,
      actorRole: 'STUDENT',
      actorName: student?.fullName ?? ctx.login,
      fromStatus: null,
      toStatus: status,
      comment: type.isInstant ? 'Документ сформирован автоматически' : null,
      createdAt: now,
    },
  );

  const readyBy = slaReadyDate(now, type.etaDays);
  await db.appendNotificationToStudent(ctx.studentId, {
    type: 'REQUEST',
    title: `Заявка ${number}`,
    body: type.isInstant
      ? `«${title}»: документ готов к скачиванию.`
      : `«${title}»: заявка подана${readyBy ? `. Готовность до ${formatReadyBy(readyBy)}` : ''}.`,
    link: '/requests',
    createdAt: now,
  });

  return { kind: 'created', request: created };
}

// ── переходы статуса ──────────────────────────────────────────────────────────

export interface TransitionCanonicalRequestInput {
  requestId: string;
  to: CanonicalRequestStatus;
  comment?: string | null;
  now?: Date;
}

export type TransitionCanonicalRequestResult =
  | { kind: 'ok'; request: CanonicalRequestRow }
  | {
      kind: 'error';
      code: TransitionErrorCode;
      message: string;
    };

export type TransitionErrorCode =
  'NOT_FOUND' | 'FORBIDDEN' | 'INVALID_TRANSITION' | 'REASON_REQUIRED' | 'ROLE_MISMATCH';

const err = (code: TransitionErrorCode, message: string): TransitionCanonicalRequestResult => ({
  kind: 'error',
  code,
  message,
});

/**
 * Кто выполняет переход над найденной строкой. Студент — только владелец;
 * сотрудник — только студенты своего факультета (как staff.ts). Чужая
 * строка отвечает NOT_FOUND (без оракула существования) и пишется в аудит.
 */
async function resolveActor(
  db: DataDb,
  ctx: DataCtx,
  request: CanonicalRequestRow,
  resourceRef: string,
): Promise<{ actor: RequestActor; actorName: string } | null> {
  if (ctx.role === 'STUDENT') {
    if (ctx.studentId === null || request.studentId !== ctx.studentId) {
      await denyAccess(db, {
        ctx,
        resourceType: RESOURCE,
        resourceRef,
        reason: ctx.studentId === null ? 'ROLE_MISMATCH' : 'OWNERSHIP_DENIED',
      });
      return null;
    }
    const student = await db.findStudentById(ctx.studentId);
    return { actor: 'STUDENT', actorName: student?.fullName ?? ctx.login };
  }

  const owner = await db.findStudentById(request.studentId);
  if (ctx.faculty === null || !owner || owner.faculty !== ctx.faculty) {
    await denyAccess(db, {
      ctx,
      resourceType: RESOURCE,
      resourceRef,
      reason: ctx.faculty === null ? 'ROLE_MISMATCH' : 'OUTSIDE_FACULTY',
    });
    return null;
  }
  const staff = await db.findStaffByLogin(ctx.login);
  return { actor: 'STAFF', actorName: staff?.fullName ?? ctx.login };
}

/** Текст уведомления о переходе — конкретика из задачи DIG-30. */
function transitionNotificationBody(input: {
  title: string;
  from: CanonicalRequestStatus;
  to: CanonicalRequestStatus;
  comment: string | null;
  readyBy: Date | null;
}): string {
  let body = `«${input.title}»: ${formatStatusTransition(input.from, input.to)}`;
  if (input.to === 'NEEDS_FIX' || input.to === 'REJECTED') {
    body += `. Причина: ${input.comment}`;
  } else if (input.to === 'READY') {
    body += '. Документ готов к скачиванию';
  } else if (input.to === 'ISSUED') {
    body += '. Документ выдан';
  } else if (input.to === 'CANCELLED') {
    body += '. Заявка отменена студентом';
  } else if (input.to === 'SUBMITTED') {
    body += '. Заявка исправлена и подана повторно';
  }
  if (input.readyBy) {
    body += `. Готовность до ${formatReadyBy(input.readyBy)}`;
  }
  return body;
}

export async function transitionCanonicalRequest(
  db: DataDb,
  ctx: DataCtx,
  input: TransitionCanonicalRequestInput,
): Promise<TransitionCanonicalRequestResult> {
  const now = input.now ?? new Date();
  const comment = input.comment?.trim() ? input.comment.trim() : null;

  const request = await db.probeCanonicalRequestById(input.requestId);
  if (!request) {
    await denyAccess(db, {
      ctx,
      resourceType: RESOURCE,
      resourceRef: input.requestId,
      reason: 'NOT_FOUND',
    });
    return err('NOT_FOUND', 'Заявка не найдена');
  }

  const actorResolved = await resolveActor(db, ctx, request, request.id);
  if (!actorResolved) {
    // Чужая (или чужого факультета) заявка неотличима от несуществующей.
    return err('NOT_FOUND', 'Заявка не найдена');
  }

  const check = checkRequestTransition({
    from: request.status,
    to: input.to,
    actor: actorResolved.actor,
    comment,
  });
  if (!check.allowed) {
    switch (check.code) {
      case 'FORBIDDEN_ACTOR':
        return err('FORBIDDEN', check.message);
      case 'REASON_REQUIRED':
        return err('REASON_REQUIRED', check.message);
      default:
        return err('INVALID_TRANSITION', check.message);
    }
  }

  const updated = await db.saveCanonicalRequestStatus(
    request.id,
    { status: input.to, updatedAt: now },
    {
      actorUserId: ctx.userId,
      actorRole: actorResolved.actor,
      actorName: actorResolved.actorName,
      fromStatus: request.status,
      toStatus: input.to,
      comment,
      createdAt: now,
    },
  );
  if (!updated) {
    return err('NOT_FOUND', 'Заявка не найдена');
  }

  // Уведомление владельцу: «Заявка ЗД-… «Справка … · для военкомата»:
  // Принята → В работе. Готовность до 20 ноября».
  const type = await db.findCanonicalRequestTypeByCode(request.typeCode);
  const title =
    request.title ||
    requestTitleFromParams(
      type?.name ?? request.typeName,
      parseRequestFormSchema(type?.formSchema ?? null),
      request.params,
    );
  // SLA обещаем от МОМЕНТА перехода: при позднем ACCEPTED или возврате
  // NEEDS_FIX → SUBMITTED дата, посчитанная от createdAt, оказалась бы
  // в прошлом (ревью DIG-30 — «ложное обещание»).
  const readyBy =
    input.to === 'ACCEPTED' || input.to === 'IN_PROGRESS' || input.to === 'SUBMITTED'
      ? slaReadyDate(now, type?.etaDays ?? null)
      : null;
  await db.appendNotificationToStudent(request.studentId, {
    type: 'REQUEST',
    title: `Заявка ${request.number}`,
    body: transitionNotificationBody({
      title,
      from: request.status,
      to: input.to,
      comment,
      readyBy,
    }),
    link: '/requests',
    createdAt: now,
  });

  return { kind: 'ok', request: updated };
}

// ── чтение (owner-scoped, uniform 404) ────────────────────────────────────────

/**
 * Одна заявка по публичному номеру. Чужой и несуществующий номер → null
 * (вызывающий код отвечает единым 404), попытка чужой — в аудите.
 */
async function scopedCanonicalRequest(
  db: DataDb,
  ctx: DataCtx,
  probed: CanonicalRequestRow | null,
  resourceRef: string,
): Promise<CanonicalRequestRow | null> {
  if (!probed) {
    await denyAccess(db, { ctx, resourceType: RESOURCE, resourceRef, reason: 'NOT_FOUND' });
    return null;
  }
  if (ctx.role === 'STUDENT') {
    if (ctx.studentId === null || probed.studentId !== ctx.studentId) {
      await denyAccess(db, {
        ctx,
        resourceType: RESOURCE,
        resourceRef,
        reason: ctx.studentId === null ? 'ROLE_MISMATCH' : 'OWNERSHIP_DENIED',
      });
      return null;
    }
    return probed;
  }
  const owner = await db.findStudentById(probed.studentId);
  if (ctx.faculty === null || !owner || owner.faculty !== ctx.faculty) {
    await denyAccess(db, {
      ctx,
      resourceType: RESOURCE,
      resourceRef,
      reason: ctx.faculty === null ? 'ROLE_MISMATCH' : 'OUTSIDE_FACULTY',
    });
    return null;
  }
  return probed;
}

export async function getCanonicalRequestByNumber(
  db: DataDb,
  ctx: DataCtx,
  number: string,
): Promise<CanonicalRequestRow | null> {
  const probed = await db.probeCanonicalRequestByNumber(number);
  return scopedCanonicalRequest(db, ctx, probed, number);
}

export async function getCanonicalRequestById(
  db: DataDb,
  ctx: DataCtx,
  requestId: string,
): Promise<CanonicalRequestRow | null> {
  const probed = await db.probeCanonicalRequestById(requestId);
  return scopedCanonicalRequest(db, ctx, probed, requestId);
}

/** Список заявок владельца ctx; сотруднику — пусто с аудитом ROLE_MISMATCH. */
export async function listCanonicalRequestsByStudent(
  db: DataDb,
  ctx: DataCtx,
): Promise<CanonicalRequestRow[]> {
  if (ctx.role !== 'STUDENT' || ctx.studentId === null) {
    await denyAccess(db, {
      ctx,
      resourceType: RESOURCE,
      resourceRef: 'list',
      reason: 'ROLE_MISMATCH',
    });
    return [];
  }
  return db.listCanonicalRequestsByStudent(ctx.studentId);
}

/** История заявки; владение перепроверяется — cuid никогда не доверяется URL. */
export async function listCanonicalRequestEvents(
  db: DataDb,
  ctx: DataCtx,
  requestId: string,
): Promise<CanonicalRequestEventRow[] | null> {
  const probed = await db.probeCanonicalRequestById(requestId);
  const scoped = await scopedCanonicalRequest(db, ctx, probed, requestId);
  if (!scoped) return null;
  return db.listCanonicalRequestEvents(requestId);
}

// Реэкспорт меток для будущего UI (экранная задача переиспользует).
export { CANONICAL_REQUEST_STATUS_LABELS };
