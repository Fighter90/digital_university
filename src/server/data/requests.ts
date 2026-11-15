// DIG-12 — requests: the flagship entity of the isolation contract.
//
// Public key is the request NUMBER (never the id, never sequential), and even
// a correctly guessed number is useless without the owner's session: both a
// foreign and a missing number produce the same null → the caller answers 404.
// The distinction (OWNERSHIP_DENIED vs NOT_FOUND) exists only in the audit log.

import { denyAccess } from './access';
import { newRequestNumber } from './request-number';
import type { DataDb } from './port';
import type { DataCtx, RequestEventRow, ServiceRequestRow, StudentRow } from './types';

import {
  buildOrderSummary,
  normalizeDraft,
  validateWizardInput,
  wizardDocFor,
  formatWizardDate,
  expectedDateFor,
  type WizardDelivery,
  type WizardDraftInput,
  type WizardLanguage,
} from '@/lib/request-wizard';

const RESOURCE = 'request';

/** All requests of the ctx owner (STUDENT); staff gets [] + audited ROLE_MISMATCH. */
export async function listRequests(db: DataDb, ctx: DataCtx): Promise<ServiceRequestRow[]> {
  if (ctx.studentId === null) {
    await denyAccess(db, {
      ctx,
      resourceType: RESOURCE,
      resourceRef: 'list',
      reason: 'ROLE_MISMATCH',
    });
    return [];
  }
  return db.listRequestsByStudent(ctx.studentId);
}

/**
 * One request by its public number. Returns null for a foreign AND for a
 * missing number — the only difference is the audit reason. The caller must
 * answer with an identical 404 in both cases.
 */
export async function getRequestByNumber(
  db: DataDb,
  ctx: DataCtx,
  number: string,
): Promise<ServiceRequestRow | null> {
  const probed = await db.probeRequestByNumber(number);
  if (!probed) {
    await denyAccess(db, { ctx, resourceType: RESOURCE, resourceRef: number, reason: 'NOT_FOUND' });
    return null;
  }
  if (ctx.studentId === null || probed.studentId !== ctx.studentId) {
    await denyAccess(db, {
      ctx,
      resourceType: RESOURCE,
      resourceRef: number,
      reason: ctx.studentId === null ? 'ROLE_MISMATCH' : 'OWNERSHIP_DENIED',
    });
    return null;
  }
  return db.findRequestByStudentAndNumber(ctx.studentId, number);
}

/**
 * Timeline of a request addressed by its cuid (detail page data). Ownership is
 * re-verified here — the cuid is never trusted from the URL alone.
 */
export async function listRequestEvents(
  db: DataDb,
  ctx: DataCtx,
  requestId: string,
): Promise<RequestEventRow[] | null> {
  const probed = await db.probeRequestById(requestId);
  if (!probed) {
    await denyAccess(db, {
      ctx,
      resourceType: RESOURCE,
      resourceRef: requestId,
      reason: 'NOT_FOUND',
    });
    return null;
  }
  if (ctx.studentId === null || probed.studentId !== ctx.studentId) {
    await denyAccess(db, {
      ctx,
      resourceType: RESOURCE,
      resourceRef: requestId,
      reason: ctx.studentId === null ? 'ROLE_MISMATCH' : 'OWNERSHIP_DENIED',
    });
    return null;
  }
  return db.listRequestEvents(requestId);
}

// ── DIG-31 — мастер заказа справки/заявления ────────────────────────────────

/** Данные страницы «Мои заявки»: список владельца + профиль для мастера. */
export interface RequestsPageData {
  requests: ServiceRequestRow[];
  /** Профиль владельца (префикс мастера «Данные студента»); сотрудник — null. */
  student: StudentRow | null;
}

export async function getRequestsPage(db: DataDb, ctx: DataCtx): Promise<RequestsPageData> {
  const requests = await listRequests(db, ctx);
  const student = ctx.studentId === null ? null : await db.findStudentById(ctx.studentId);
  return { requests, student };
}

/** Вход мастера: id сервиса каталога + поля шагов 2–3 (имена вложений). */
export interface WizardRequestInput {
  serviceId: string;
  destination: string;
  language: WizardLanguage;
  copies: number;
  delivery: WizardDelivery;
  comment: string;
  consent: boolean;
  /** Имена вложений (сами файлы в прототипе не сохраняются — DIG-31). */
  attachmentNames: string[];
}

export interface CreateWizardRequestOptions {
  now?: Date;
  random?: () => number;
}

/**
 * Заявка из мастера заказа. Контракт DIG-12: контекст — единственный ключ
 * владельца; сотрудник получает отказ с аудитом ROLE_MISMATCH; неизвестный
 * или не-ORDER сервис — null без записи (некорректный ввод). Валидатор
 * вызывается ЗДЕСЬ ещё раз: обход клиентской проверки невозможен.
 * Мгновенный документ рождается COMPLETED с результат-заметкой (PDF готов).
 */
export async function createWizardRequest(
  db: DataDb,
  ctx: DataCtx,
  input: WizardRequestInput,
  options: CreateWizardRequestOptions = {},
): Promise<ServiceRequestRow | null> {
  const now = options.now ?? new Date();

  if (ctx.studentId === null) {
    await denyAccess(db, {
      ctx,
      resourceType: RESOURCE,
      resourceRef: input.serviceId,
      reason: 'ROLE_MISMATCH',
    });
    return null;
  }

  const doc = wizardDocFor(input.serviceId);
  if (!doc) return null; // не-ORDER/неизвестный id — ввод, не доступ-попытка

  const draft: WizardDraftInput = {
    destination: input.destination,
    language: input.language,
    copies: input.copies,
    delivery: input.delivery,
    comment: input.comment,
    consent: input.consent,
    // Размеры уже проверил server action; здесь проверяются количество,
    // имена и запрет вложений у справок.
    attachments: input.attachmentNames.map((name) => ({ name, size: 0 })),
  };
  const clean = normalizeDraft(doc, draft);
  const errors = validateWizardInput(doc, clean);
  if (Object.keys(errors).length > 0) return null;

  const number = newRequestNumber(options.random, now);
  const instant = doc.instant;
  const request = await db.appendRequestByStudent(ctx.studentId, {
    type: doc.config.requestType,
    title: doc.title,
    number,
    createdAt: now,
    eventMessage: buildOrderSummary(doc, clean),
    actorName: ctx.login,
    status: instant ? 'COMPLETED' : 'SUBMITTED',
    resultNote: instant ? 'Документ готов — PDF доступен в кабинете' : null,
  });

  const expected = expectedDateFor(doc.eta, now);
  await db.appendNotificationToStudent(ctx.studentId, {
    type: 'REQUEST',
    title: instant ? 'Справка готова' : 'Заявка принята',
    body: instant
      ? `«${doc.title}» (${number}) готова — скачайте PDF в кабинете.`
      : `Заявка ${number} «${doc.title}» принята. Ожидаемая дата: ${formatWizardDate(expected)}.`,
    createdAt: now,
    link: `/requests/${number}`,
  });

  return request;
}
