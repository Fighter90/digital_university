// DIG-40 — «Обратная связь руководству»: предложения, жалобы и благодарности
// (/feedback, Figma «18 · Предложения»).
//
// Тот же IDOR-контракт, что у deanery.ts / requests.ts: каждая функция
// получает DataCtx, построенный из живой сессии, подписанные обращения
// скоупятся ctx.studentId, публичный ключ — номер FB-ГГГГ-XXXXX (никогда
// cuid). Чужой и несуществующий номер дают одинаковый null (единый 404 без
// оракула существования), различие живёт только в AuditLog.
//
// АНОНИМНОСТЬ (приёмка DIG-40): анонимное обращение хранится с
// studentId = null — связи с пользователем нет НИГДЕ (в хранилище, на
// клиенте и в ответах API). Оно не попадает ни в чей список, а его карточка
// /feedback/<номер> отвечает 404 всем — включая автора сессии (попытка
// пишется в аудит как OWNERSHIP_DENIED). После отправки автор видит
// страницу подтверждения /feedback/sent/<номер> — минимальное публичное
// представление по номеру (тип, адресат, статус, даты, признак
// анонимности), БЕЗ текста, вложений и любых пользовательских полей.
//
// Два осознанных исключения из owner-scope (по образцу findCertificateByCode,
// см. port.ts): публичная лента решённых предложений (listPublishedFeedback-
// Outcomes — общая по определению, наружу уходит представление без автора) и
// страница подтверждения по номеру (getFeedbackSentView — номер несёт
// ~25 бит случайности, пользовательских данных в представлении нет).
//
// Сотруднику студенческие функции отказывают с аудитом ROLE_MISMATCH
// (интерфейс разбора обращений руководством — вне скоупа этой задачи).

import {
  FEEDBACK_KINDS,
  FEEDBACK_RESPONSE_DAYS,
  FEEDBACK_TARGETS,
  MAX_FEEDBACK_ATTACHMENTS,
  MAX_FEEDBACK_ATTACHMENT_NAME_LENGTH,
} from '@/lib/feedback';
import { addWorkingDays } from '@/lib/request-sla';

import { denyAccess } from './access';
import type { DataDb } from './port';
import { newFeedbackNumber } from './feedback-number';
import type { DataCtx, FeedbackKind, FeedbackRow, FeedbackStatus, FeedbackTarget } from './types';

const RESOURCE = 'feedback';

/** Границы текста обращения (едины для action и слоя данных). */
export const MIN_FEEDBACK_TEXT_LENGTH = 1;
export const MAX_FEEDBACK_TEXT_LENGTH = 2000;

export interface FeedbackOutcomeView {
  /** Публичный номер FB-… (id наружу не выходит). */
  number: string;
  kind: FeedbackKind;
  target: FeedbackTarget;
  /** Суть предложения (текст обращения). */
  suggestion: string;
  /** Что изменилось — опубликованный результат. */
  outcome: string;
  resolvedAt: Date;
}

export interface FeedbackPageData {
  /** Подписанные обращения владельца (свежие сверху); анонимных тут нет. */
  items: FeedbackRow[];
  /** Публичная лента «Что мы изменили по вашим предложениям». */
  feed: FeedbackOutcomeView[];
}

export interface FeedbackSentView {
  number: string;
  kind: FeedbackKind;
  target: FeedbackTarget;
  status: FeedbackStatus;
  createdAt: Date;
  dueAt: Date;
  isAnonymous: boolean;
  publishedOutcome: string | null;
}

export type CreateFeedbackResult =
  { ok: true; feedback: FeedbackRow } | { ok: false; error: string };

export interface CreateFeedbackInput {
  kind: FeedbackKind;
  target: FeedbackTarget;
  text: string;
  attachments: string[];
  isAnonymous: boolean;
  now?: Date;
}

const isKnownKind = (value: unknown): value is FeedbackKind =>
  (FEEDBACK_KINDS as string[]).includes(value as FeedbackKind);

const isKnownTarget = (value: unknown): value is FeedbackTarget =>
  (FEEDBACK_TARGETS as string[]).includes(value as FeedbackTarget);

function validateText(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.length < MIN_FEEDBACK_TEXT_LENGTH) return 'Напишите текст обращения';
  if (trimmed.length > MAX_FEEDBACK_TEXT_LENGTH) {
    return `Текст длиннее ${MAX_FEEDBACK_TEXT_LENGTH} символов`;
  }
  return null;
}

/** Лента решённых предложений: представление без автора и пользовательских полей. */
function toOutcomeView(row: FeedbackRow): FeedbackOutcomeView {
  return {
    number: row.number,
    kind: row.kind,
    target: row.target,
    suggestion: row.text,
    outcome: row.publishedOutcome ?? '',
    resolvedAt: row.updatedAt,
  };
}

/** Экран /feedback: свои обращения + публичная лента (студенту). */
export async function getFeedbackPage(db: DataDb, ctx: DataCtx): Promise<FeedbackPageData> {
  if (ctx.studentId === null) {
    await denyAccess(db, {
      ctx,
      resourceType: RESOURCE,
      resourceRef: 'list',
      reason: 'ROLE_MISMATCH',
    });
    return { items: [], feed: [] };
  }

  const [items, published] = await Promise.all([
    db.listFeedbackByStudent(ctx.studentId),
    db.listPublishedFeedbackOutcomes(),
  ]);

  return {
    items,
    feed: published.map(toOutcomeView),
  };
}

/**
 * Создание обращения: тип и адресат из белых списков, текст 1–2000,
 * вложения ≤ 3 × 5 МБ (имена). Анонимное обращение записывается БЕЗ
 * владельца (studentId = null) — связь с пользователем не хранится нигде.
 * Номер и срок ответа (3 рабочих дня) генерирует слой данных.
 */
export async function createFeedback(
  db: DataDb,
  ctx: DataCtx,
  input: CreateFeedbackInput,
): Promise<CreateFeedbackResult> {
  if (ctx.studentId === null) {
    await denyAccess(db, {
      ctx,
      resourceType: RESOURCE,
      resourceRef: input.kind,
      reason: 'ROLE_MISMATCH',
    });
    return { ok: false, error: 'Раздел доступен студентам' };
  }
  if (!isKnownKind(input.kind)) {
    return { ok: false, error: 'Выберите тип обращения из списка' };
  }
  if (!isKnownTarget(input.target)) {
    return { ok: false, error: 'Выберите адресата из списка' };
  }
  const textError = validateText(input.text);
  if (textError) return { ok: false, error: textError };

  const attachments = input.attachments;
  // Лимиты количества/имён проверяет и action (до 3 × 5 МБ); здесь —
  // контракт хранилища: ≤ 3 файлов, имена непустые и не длиннее 80 символов.
  if (attachments.length > MAX_FEEDBACK_ATTACHMENTS) {
    return { ok: false, error: `Можно приложить не более ${MAX_FEEDBACK_ATTACHMENTS} файлов` };
  }
  for (const name of attachments) {
    if (name.trim().length === 0) return { ok: false, error: 'У вложения пустое имя файла' };
    if (name.length > MAX_FEEDBACK_ATTACHMENT_NAME_LENGTH) {
      return {
        ok: false,
        error: `Имя файла длиннее ${MAX_FEEDBACK_ATTACHMENT_NAME_LENGTH} символов`,
      };
    }
  }

  const now = input.now ?? new Date();
  const row = await db.appendFeedbackByStudent(input.isAnonymous ? null : ctx.studentId, {
    number: newFeedbackNumber(Math.random, now),
    kind: input.kind,
    target: input.target,
    status: 'NEW' satisfies FeedbackStatus,
    text: input.text.trim(),
    attachments,
    isAnonymous: input.isAnonymous,
    dueAt: addWorkingDays(now, FEEDBACK_RESPONSE_DAYS),
    createdAt: now,
  });
  return { ok: true, feedback: row };
}

/**
 * Карточка СВОЕГО подписанного обращения по публичному номеру. Анонимные
 * обращения (studentId = null) не открываются никому — включая автора
 * сессии: связь с пользователем не хранится (приёмка DIG-40). Чужой,
 * анонимный и несуществующий номер дают одинаковый null; различие — только
 * в аудите (OWNERSHIP_DENIED / ROLE_MISMATCH / NOT_FOUND).
 */
export async function openFeedbackCard(
  db: DataDb,
  ctx: DataCtx,
  number: string,
): Promise<FeedbackRow | null> {
  const probed = await db.probeFeedbackByNumber(number);
  if (!probed) {
    await denyAccess(db, { ctx, resourceType: RESOURCE, resourceRef: number, reason: 'NOT_FOUND' });
    return null;
  }
  if (ctx.studentId === null || probed.studentId === null || probed.studentId !== ctx.studentId) {
    await denyAccess(db, {
      ctx,
      resourceType: RESOURCE,
      resourceRef: number,
      reason: ctx.studentId === null ? 'ROLE_MISMATCH' : 'OWNERSHIP_DENIED',
    });
    return null;
  }
  return db.findFeedbackByStudentAndNumber(ctx.studentId, number);
}

/**
 * Минимальное публичное представление по номеру для страницы подтверждения
 /feedback/sent/<номер> — осознанное исключение из owner-scope (как лента
 выше): номер несёт случайный суффикс, а представление НЕ содержит текста,
 вложений и каких-либо пользовательских полей (приёмка DIG-40: анонимное
 обращение не раскрывает содержимое и связь с пользователем).
 */
export async function getFeedbackSentView(
  db: DataDb,
  number: string,
): Promise<FeedbackSentView | null> {
  const row = await db.probeFeedbackByNumber(number);
  if (!row) return null;
  return {
    number: row.number,
    kind: row.kind,
    target: row.target,
    status: row.status,
    createdAt: row.createdAt,
    dueAt: row.dueAt,
    isAnonymous: row.isAnonymous,
    publishedOutcome: row.publishedOutcome,
  };
}
