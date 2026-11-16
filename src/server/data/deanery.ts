// DIG-39 — «Обращения в деканат»: тикеты с перепиской (список + чат).
//
// Тот же IDOR-контракт, что у requests.ts / appeals.ts (DIG-12): каждая
// функция получает DataCtx, построенный из живой сессии, студент скоупится
// ctx.studentId, публичный ключ — номер TS-ГГГГ-XXXXX (никогда cuid).
// Чужой и несуществующий номер дают одинаковый null (единый 404 без оракула
// существования), различие живёт только в AuditLog. Сотруднику студенческие
// функции отказывают с аудитом ROLE_MISMATCH; appendManagerMessage —
// серверная точка ответа менеджера (интерфейс сотрудника подключит DIG-48):
// студент своего факультета, статус «Ждём вас» + уведомление TICKET с учётом
// матрицы PUSH (тип «Обращения» выключен — записи в фиде нет).

import { TICKET_SUBJECTS } from '@/lib/tickets';

import { denyAccess } from './access';
import { defaultSettingsFor } from './profile';
import type { DataDb } from './port';
import { normalizeRequestNumber } from './request-number';
import { newTicketNumber } from './ticket-number';
import type {
  ActorRole,
  DataCtx,
  ServiceRequestRow,
  TicketMessageRow,
  TicketRow,
  TicketStatus,
  TicketSubject,
} from './types';

const RESOURCE = 'ticket';

/** Лимит вложений обращения (имена файлов; байты не хранятся). */
export const MAX_TICKET_ATTACHMENTS = 3;

/** Максимальная длина имени вложения. */
export const MAX_ATTACHMENT_NAME_LENGTH = 80;

/** Границы текста обращения/сообщения. */
export const MIN_TICKET_BODY_LENGTH = 1;
export const MAX_TICKET_BODY_LENGTH = 2000;

/** Элемент списка обращений: тикет + последний ответ + точка непрочитанного. */
export interface TicketListItem extends TicketRow {
  /** Последнее сообщение чата (предпросмотр в списке); null — ещё нет. */
  lastMessage: { authorRole: ActorRole; body: string; createdAt: Date } | null;
  /** Непрочитанные студентом ответы менеджера (точка в списке). */
  unreadStaffCount: number;
}

export interface DeaneryPageData {
  tickets: TicketListItem[];
  /** Свои заявки для привязки в композере (номер + заголовок). */
  requests: Array<Pick<ServiceRequestRow, 'number' | 'title'>>;
  /** Дисциплины СВОЕЙ группы для привязки в композере (код + название). */
  disciplines: Array<{ code: string; name: string }>;
}

export interface TicketChatData {
  ticket: TicketRow;
  messages: TicketMessageRow[];
}

export type CreateTicketResult = { ok: true; ticket: TicketRow } | { ok: false; error: string };

export type ReplyResult = { ok: true; ticket: TicketRow } | { ok: false; error: string };

function isTicketSubject(value: unknown): value is TicketSubject {
  return TICKET_SUBJECTS.includes(value as TicketSubject);
}

function validAttachments(attachments: string[]): string | null {
  if (attachments.length > MAX_TICKET_ATTACHMENTS) {
    return `Можно приложить не более ${MAX_TICKET_ATTACHMENTS} файлов`;
  }
  for (const name of attachments) {
    if (name.trim().length === 0) return 'У вложения пустое имя файла';
    if (name.length > MAX_ATTACHMENT_NAME_LENGTH) {
      return `Имя файла длиннее ${MAX_ATTACHMENT_NAME_LENGTH} символов`;
    }
  }
  return null;
}

/** Валидация текста обращения/сообщения (общая для создания и ответа). */
function validateBody(body: string): string | null {
  const trimmed = body.trim();
  if (trimmed.length < MIN_TICKET_BODY_LENGTH) return 'Напишите текст обращения';
  if (trimmed.length > MAX_TICKET_BODY_LENGTH) {
    return `Текст длиннее ${MAX_TICKET_BODY_LENGTH} символов`;
  }
  return null;
}

/** Список обращений студента (свежие сверху) + данные композера. */
export async function getDeaneryPage(db: DataDb, ctx: DataCtx): Promise<DeaneryPageData> {
  if (ctx.studentId === null) {
    await denyAccess(db, {
      ctx,
      resourceType: RESOURCE,
      resourceRef: 'list',
      reason: 'ROLE_MISMATCH',
    });
    return { tickets: [], requests: [], disciplines: [] };
  }

  const [tickets, requests, disciplines] = await Promise.all([
    db.listTicketsByStudent(ctx.studentId),
    db.listRequestsByStudent(ctx.studentId),
    db.listDisciplinesByGroup(ctx.groupName ?? ''),
  ]);

  const items: TicketListItem[] = [];
  for (const ticket of tickets) {
    const messages = await db.listTicketMessages(ticket.id);
    const last = messages[messages.length - 1] ?? null;
    items.push({
      ...ticket,
      lastMessage: last
        ? { authorRole: last.authorRole, body: last.body, createdAt: last.createdAt }
        : null,
      unreadStaffCount: messages.filter((m) => m.authorRole === 'STAFF' && !m.readAt).length,
    });
  }

  return {
    tickets: items,
    requests: requests.map((r) => ({ number: r.number, title: r.title })),
    disciplines: disciplines.map((d) => ({ code: d.disciplineCode, name: d.disciplineName })),
  };
}

/**
 * Чат обращения по публичному номеру. Чужой и несуществующий номер →
 * одинаковый null (страница отвечает общим 404); различие — только в аудите.
 * Успешное открытие помечает сообщения менеджера прочитанными.
 */
export async function openTicketChat(
  db: DataDb,
  ctx: DataCtx,
  number: string,
): Promise<TicketChatData | null> {
  const probed = await db.probeTicketByNumber(number);
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

  const ticket = await db.findTicketByStudentAndNumber(ctx.studentId, number);
  if (!ticket) return null;

  // Студент открыл чат → ответы менеджера прочитаны (точка в списке гаснет).
  await db.markTicketMessagesRead(ticket.id, 'STAFF', new Date());
  const messages = await db.listTicketMessages(ticket.id);
  return { ticket, messages };
}

export interface CreateTicketInput {
  subject: TicketSubject;
  body: string;
  attachments: string[];
  /** Привязка к СВОЕЙ заявке (публичный номер SR-…). */
  requestNumber?: string | null;
  /** Привязка к дисциплине СВОЕЙ группы (код). */
  disciplineCode?: string | null;
  now?: Date;
}

/**
 * Создание обращения: тема из белого списка, вложения ≤ 3, привязка
 * только к своим сущностям. Номер генерирует слой данных; первое сообщение
 * студента пишется атомарно с тикетом.
 */
export async function createTicket(
  db: DataDb,
  ctx: DataCtx,
  input: CreateTicketInput,
): Promise<CreateTicketResult> {
  if (ctx.studentId === null) {
    await denyAccess(db, {
      ctx,
      resourceType: RESOURCE,
      resourceRef: input.subject,
      reason: 'ROLE_MISMATCH',
    });
    return { ok: false, error: 'Раздел доступен студентам' };
  }
  if (!isTicketSubject(input.subject)) {
    return { ok: false, error: 'Выберите тему из списка' };
  }
  const bodyError = validateBody(input.body);
  if (bodyError) return { ok: false, error: bodyError };
  const attachmentsError = validAttachments(input.attachments);
  if (attachmentsError) return { ok: false, error: attachmentsError };

  let requestNumber: string | null = null;
  const rawRequestNumber = normalizeRequestNumber(input.requestNumber ?? '');
  if (rawRequestNumber.length > 0) {
    const request = await db.findRequestByStudentAndNumber(ctx.studentId, rawRequestNumber);
    if (!request) {
      return { ok: false, error: 'Привязать можно только свою заявку' };
    }
    requestNumber = request.number;
  }

  let disciplineCode: string | null = null;
  const rawDiscipline = input.disciplineCode?.trim().toUpperCase() ?? '';
  if (rawDiscipline.length > 0) {
    const discipline = await db.probeDisciplineByCode(rawDiscipline);
    if (!discipline || discipline.groupName !== ctx.groupName) {
      return { ok: false, error: 'Привязать можно только дисциплину своей группы' };
    }
    disciplineCode = discipline.disciplineCode;
  }

  const student = await db.findStudentById(ctx.studentId);
  const now = input.now ?? new Date();
  const ticket = await db.appendTicketByStudent(ctx.studentId, {
    number: newTicketNumber(Math.random, now),
    subject: input.subject,
    body: input.body.trim(),
    attachments: input.attachments,
    authorName: student?.fullName ?? ctx.login,
    requestNumber,
    disciplineCode,
    createdAt: now,
  });
  return { ok: true, ticket };
}

export interface ReplyInput {
  body: string;
  attachments: string[];
  now?: Date;
}

/**
 * Ответ студента в чате СВОЕГО обращения. Ответ возвращает статус в
 * «Открыто» — менеджер снова должен ответить (даже из «Решено»).
 */
export async function replyToTicket(
  db: DataDb,
  ctx: DataCtx,
  number: string,
  input: ReplyInput,
): Promise<ReplyResult> {
  if (ctx.studentId === null) {
    await denyAccess(db, {
      ctx,
      resourceType: RESOURCE,
      resourceRef: number,
      reason: 'ROLE_MISMATCH',
    });
    return { ok: false, error: 'Раздел доступен студентам' };
  }
  const bodyError = validateBody(input.body);
  if (bodyError) return { ok: false, error: bodyError };
  const attachmentsError = validAttachments(input.attachments);
  if (attachmentsError) return { ok: false, error: attachmentsError };

  const ticket = await db.findTicketByStudentAndNumber(ctx.studentId, number);
  if (!ticket) {
    const probed = await db.probeTicketByNumber(number);
    await denyAccess(db, {
      ctx,
      resourceType: RESOURCE,
      resourceRef: number,
      reason: probed ? 'OWNERSHIP_DENIED' : 'NOT_FOUND',
    });
    return { ok: false, error: 'Обращение недоступно' };
  }

  const student = await db.findStudentById(ctx.studentId);
  const now = input.now ?? new Date();
  const message = await db.appendTicketMessage(ticket.id, {
    authorRole: 'STUDENT',
    authorName: student?.fullName ?? ctx.login,
    body: input.body.trim(),
    attachments: input.attachments,
    createdAt: now,
    status: 'OPEN' satisfies TicketStatus,
  });
  if (!message) return { ok: false, error: 'Обращение недоступно' };
  return { ok: true, ticket: { ...ticket, status: 'OPEN', updatedAt: now } };
}

export interface ManagerReplyInput {
  body: string;
  attachments?: string[];
  now?: Date;
}

/**
 * Ответ менеджера (сотрудника) в обращение студента СВОЕГО факультета.
 * Статус → ANSWERED («Ждём вас»), исполнитель = сотрудник, реплики студента
 * помечаются прочитанными, студенту уходит уведомление TICKET со ссылкой на
 * чат — если тип «Обращения» включён в матрице PUSH его настроек.
 */
export async function appendManagerMessage(
  db: DataDb,
  ctx: DataCtx,
  number: string,
  input: ManagerReplyInput,
): Promise<ReplyResult> {
  if (ctx.role !== 'STAFF') {
    await denyAccess(db, {
      ctx,
      resourceType: RESOURCE,
      resourceRef: number,
      reason: 'ROLE_MISMATCH',
    });
    return { ok: false, error: 'Ответ доступен сотрудникам деканата' };
  }
  const bodyError = validateBody(input.body);
  if (bodyError) return { ok: false, error: bodyError };
  const attachments = input.attachments ?? [];
  const attachmentsError = validAttachments(attachments);
  if (attachmentsError) return { ok: false, error: attachmentsError };

  const ticket = await db.probeTicketByNumber(number);
  if (!ticket) {
    await denyAccess(db, { ctx, resourceType: RESOURCE, resourceRef: number, reason: 'NOT_FOUND' });
    return { ok: false, error: 'Обращение недоступно' };
  }
  const student = await db.findStudentById(ticket.studentId);
  if (!student || student.faculty !== ctx.faculty) {
    await denyAccess(db, {
      ctx,
      resourceType: RESOURCE,
      resourceRef: number,
      reason: 'OUTSIDE_FACULTY',
    });
    return { ok: false, error: 'Обращение недоступно' };
  }

  const staff = await db.findStaffByLogin(ctx.login);
  const now = input.now ?? new Date();
  const message = await db.appendTicketMessage(ticket.id, {
    authorRole: 'STAFF',
    authorName: staff?.fullName ?? ctx.login,
    body: input.body.trim(),
    attachments,
    createdAt: now,
    status: 'ANSWERED',
    assigneeUserId: ctx.userId,
  });
  if (!message) return { ok: false, error: 'Обращение недоступно' };

  // Менеджер увидел реплики студента → статус «Прочитано» в чате.
  await db.markTicketMessagesRead(ticket.id, 'STUDENT', now);

  // Уведомление о новом сообщении менеджера (матрица PUSH типа TICKET).
  const settings = (await db.findSettingsByStudent(student.id)) ?? defaultSettingsFor(student.id);
  if (settings.notificationChannels.TICKET?.PUSH) {
    await db.appendNotificationToStudent(student.id, {
      type: 'TICKET',
      title: 'Ответ по обращению',
      body: `${staff?.fullName ?? 'Менеджер'} ответил в обращении №${ticket.number}.`,
      createdAt: now,
      link: `/deanery/${ticket.number}`,
    });
  }

  return {
    ok: true,
    ticket: { ...ticket, status: 'ANSWERED', assigneeUserId: ctx.userId, updatedAt: now },
  };
}
