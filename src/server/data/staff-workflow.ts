// DIG-48 — кабинет сотрудника деканата: сервисный слой поверх порта.
//
// Контракт DIG-12 сохраняется: скоуп факультета берётся из ctx (Staff-строка
// сессии, никогда из ввода), чужое и несуществующее — одинаковый null/[] с
// записью в аудит, разграничение NOT_FOUND / OUTSIDE_FACULTY — только для
// журнала. Смена статуса проверяет карту разрешённых переходов
// (src/lib/staff-transitions.ts) и выполняется адаптером атомарно:
// строка заявки + событие истории + уведомление студенту (< 60 с).

import {
  isAllowedTransition,
  isReasonValid,
  requiresReason,
  TRANSITION_ACTION_TITLES,
} from '@/lib/staff-transitions';
import { normalizeRequestNumber } from './request-number';
import { normalizeSettings } from './profile';
import { denyAccess } from './access';
import type { DataDb, StaffNotificationInput } from './port';
import type {
  AnnouncementRow,
  AppealMessageRow,
  AppealRow,
  DataCtx,
  RequestEventRow,
  ServiceRequestRow,
  StudentRow,
} from './types';

const REQUEST = 'request';
const APPEAL = 'appeal';

/** Элемент очереди: заявка + профиль владельца (для таблицы и карточки). */
export interface StaffQueueItem {
  request: ServiceRequestRow;
  student: StudentRow;
}

/** Полная карточка заявки сотрудника. */
export interface StaffRequestDetail {
  request: ServiceRequestRow;
  student: StudentRow;
  events: RequestEventRow[];
  /** Контакты с учётом разрешений студента (видимость для сотрудников). */
  contacts: { email: string | null; phone: string | null };
}

/** Элемент списка обращений: обращение + владелец + последняя активность. */
export interface StaffAppealItem {
  appeal: AppealRow;
  student: StudentRow;
  lastAt: Date;
}

/** Чат обращения сотрудника. */
export interface StaffAppealThread {
  appeal: AppealRow;
  student: StudentRow;
  messages: AppealMessageRow[];
}

export interface StaffSummaryData {
  /** Момент выборки данных — база для «заявок сегодня» и SLA сводки. */
  now: Date;
  requests: ServiceRequestRow[];
  eventsByRequestId: Record<string, RequestEventRow[]>;
  appeals: AppealRow[];
}

export type StaffStatusChangeResult =
  | { ok: true; request: ServiceRequestRow }
  | { ok: false; error: 'NOT_FOUND' | 'NOT_ALLOWED' | 'REASON_REQUIRED' };

export type StaffAnnouncementResult = AnnouncementRow | { error: 'UNKNOWN_GROUP' } | null;

/** Роль сотрудника обязательна: студент получает []/null + аудит. */
function staffFacultyOf(ctx: DataCtx): string | null {
  return ctx.role === 'STAFF' ? ctx.faculty : null;
}

async function auditRequestDenial(
  db: DataDb,
  ctx: DataCtx,
  ref: string,
  reason: 'ROLE_MISMATCH' | 'OWNERSHIP_DENIED' | 'OUTSIDE_FACULTY' | 'NOT_FOUND',
): Promise<void> {
  await denyAccess(db, { ctx, resourceType: REQUEST, resourceRef: ref, reason });
}

/** Имя сотрудника для событий и исполнителя (fail-soft → login). */
async function staffDisplayName(db: DataDb, ctx: DataCtx): Promise<string> {
  const staff = await db.findStaffByLogin(ctx.login);
  return staff?.fullName ?? ctx.login;
}

// ── Очередь заявок ───────────────────────────────────────────────────────────

export async function getStaffQueue(db: DataDb, ctx: DataCtx): Promise<StaffQueueItem[]> {
  const faculty = staffFacultyOf(ctx);
  if (faculty === null) {
    await auditRequestDenial(db, ctx, 'staff-queue', 'ROLE_MISMATCH');
    return [];
  }
  const [requests, students] = await Promise.all([
    db.listRequestsByFaculty(faculty),
    db.listStudentsByFaculty(faculty),
  ]);
  const studentById = new Map(students.map((student) => [student.id, student]));
  return requests
    .map((request) => {
      const student = studentById.get(request.studentId);
      return student ? { request, student } : null;
    })
    .filter((item): item is StaffQueueItem => item !== null);
}

/**
 * Разбор ссылки на заявку: probe без скоупа различает «чужой факультет» и
 * «нет такой» ТОЛЬКО для аудита; наружу оба случая дают null (нет оракула).
 */
async function resolveFacultyRequest(
  db: DataDb,
  ctx: DataCtx,
  rawNumber: string,
): Promise<{ request: ServiceRequestRow; student: StudentRow } | null> {
  const faculty = staffFacultyOf(ctx);
  const number = normalizeRequestNumber(rawNumber);
  if (faculty === null) {
    await auditRequestDenial(db, ctx, number, 'ROLE_MISMATCH');
    return null;
  }
  const probed = await db.probeRequestByNumber(number);
  if (!probed) {
    await auditRequestDenial(db, ctx, number, 'NOT_FOUND');
    return null;
  }
  const owner = await db.findStudentById(probed.studentId);
  if (!owner || owner.faculty !== faculty) {
    await auditRequestDenial(db, ctx, number, owner ? 'OUTSIDE_FACULTY' : 'NOT_FOUND');
    return null;
  }
  return { request: probed, student: owner };
}

export async function getStaffRequestDetail(
  db: DataDb,
  ctx: DataCtx,
  rawNumber: string,
): Promise<StaffRequestDetail | null> {
  const resolved = await resolveFacultyRequest(db, ctx, rawNumber);
  if (!resolved) return null;
  const events = await db.listRequestEvents(resolved.request.id);
  // Контакты — только с разрешения студента (DIG-19, emailVisibleToStaff).
  const settings = normalizeSettings(await db.findSettingsByStudent(resolved.student.id));
  return {
    ...resolved,
    events,
    contacts: {
      email: settings?.emailVisibleToStaff === true ? resolved.student.email : null,
      phone: settings?.phoneVisibleToStaff === true ? (settings.phone ?? null) : null,
    },
  };
}

// ── Смена статуса ────────────────────────────────────────────────────────────

function eventMessageFor(to: ServiceRequestRow['status'], note: string | null): string {
  const action = TRANSITION_ACTION_TITLES[to as keyof typeof TRANSITION_ACTION_TITLES] ?? to;
  return note ? `${action}. Причина: ${note}` : `${action}.`;
}

function notificationFor(
  request: ServiceRequestRow,
  to: ServiceRequestRow['status'],
  note: string | null,
): StaffNotificationInput {
  const link = `/requests/${request.number}`;
  const inQuotes = `«${request.title}»`;
  switch (to) {
    case 'IN_PROGRESS':
      return {
        type: 'REQUEST',
        title: 'Заявка в работе',
        body: `Заявка ${inQuotes} (${request.number}) принята в работу специалистом деканата.`,
        link,
      };
    case 'COMPLETED':
      return {
        type: 'REQUEST',
        title: 'Заявка выполнена',
        body: `Заявка ${inQuotes} (${request.number}) выполнена${note ? `: ${note}` : '. Отслеживайте статус в кабинете.'}`,
        link,
      };
    case 'NEEDS_REVISION':
      return {
        type: 'REQUEST',
        title: 'Нужна доработка',
        body: `По заявке ${inQuotes} (${request.number}) нужна доработка: ${note ?? 'уточните данные в деканате'}.`,
        link,
      };
    case 'REJECTED':
      return {
        type: 'REQUEST',
        title: 'Заявка отклонена',
        body: `Заявка ${inQuotes} (${request.number}) отклонена: ${note ?? 'без причины'}.`,
        link,
      };
    default:
      return {
        type: 'REQUEST',
        title: 'Статус заявки обновлён',
        body: `Заявка ${inQuotes} (${request.number}): новый статус.`,
        link,
      };
  }
}

export async function changeStaffRequestStatus(
  db: DataDb,
  ctx: DataCtx,
  rawNumber: string,
  input: { to: ServiceRequestRow['status']; note: string | null; now: Date },
): Promise<StaffStatusChangeResult> {
  const resolved = await resolveFacultyRequest(db, ctx, rawNumber);
  if (!resolved) return { ok: false, error: 'NOT_FOUND' };
  const { request } = resolved;

  if (!isAllowedTransition(request.status, input.to)) {
    return { ok: false, error: 'NOT_ALLOWED' };
  }
  if (requiresReason(input.to) && !isReasonValid(input.note)) {
    return { ok: false, error: 'REASON_REQUIRED' };
  }

  const actorName = await staffDisplayName(db, ctx);
  const updated = await db.updateRequestByStaff(ctx.faculty!, request.number, {
    from: request.status,
    to: input.to,
    note: input.note,
    actorName,
    eventMessage: eventMessageFor(input.to, input.note),
    notification: notificationFor(request, input.to, input.note),
    now: input.now,
  });
  if (!updated) {
    // Гонка (статус изменился параллельно) или строка исчезла — единый отказ.
    await auditRequestDenial(db, ctx, request.number, 'NOT_FOUND');
    return { ok: false, error: 'NOT_FOUND' };
  }
  return { ok: true, request: updated };
}

// ── Обращения ────────────────────────────────────────────────────────────────

async function auditAppealDenial(
  db: DataDb,
  ctx: DataCtx,
  ref: string,
  reason: 'ROLE_MISMATCH' | 'NOT_FOUND' | 'OUTSIDE_FACULTY',
): Promise<void> {
  await denyAccess(db, { ctx, resourceType: APPEAL, resourceRef: ref, reason });
}

export async function getStaffAppeals(db: DataDb, ctx: DataCtx): Promise<StaffAppealItem[]> {
  const faculty = staffFacultyOf(ctx);
  if (faculty === null) {
    await auditAppealDenial(db, ctx, 'staff-appeals', 'ROLE_MISMATCH');
    return [];
  }
  const [appeals, students] = await Promise.all([
    db.listAppealsByFaculty(faculty),
    db.listStudentsByFaculty(faculty),
  ]);
  const studentById = new Map(students.map((student) => [student.id, student]));
  const items = await Promise.all(
    appeals.map(async (appeal) => {
      const student = studentById.get(appeal.studentId);
      if (!student) return null;
      const messages = await db.listAppealMessages(appeal.id);
      const lastAt = messages.reduce(
        (latest, message) =>
          message.createdAt.getTime() > latest.getTime() ? message.createdAt : latest,
        appeal.createdAt,
      );
      return { appeal, student, lastAt };
    }),
  );
  // Сначала открытые (требуют ответа), внутри — по свежей активности.
  const statusWeight = (status: AppealRow['status']): number =>
    status === 'OPEN' ? 0 : status === 'ANSWERED' ? 1 : 2;
  return items
    .filter((item): item is StaffAppealItem => item !== null)
    .sort(
      (a, b) =>
        statusWeight(a.appeal.status) - statusWeight(b.appeal.status) ||
        b.lastAt.getTime() - a.lastAt.getTime(),
    );
}

async function resolveFacultyAppeal(
  db: DataDb,
  ctx: DataCtx,
  appealId: string,
): Promise<AppealRow | null> {
  const faculty = staffFacultyOf(ctx);
  if (faculty === null) {
    await auditAppealDenial(db, ctx, appealId, 'ROLE_MISMATCH');
    return null;
  }
  const found = await db.findAppealByFacultyAndId(faculty, appealId);
  if (!found) {
    const probed = await db.probeAppealById(appealId);
    await auditAppealDenial(db, ctx, appealId, probed ? 'OUTSIDE_FACULTY' : 'NOT_FOUND');
    return null;
  }
  return found;
}

export async function getStaffAppealThread(
  db: DataDb,
  ctx: DataCtx,
  appealId: string,
): Promise<StaffAppealThread | null> {
  const appeal = await resolveFacultyAppeal(db, ctx, appealId);
  if (!appeal) return null;
  const student = await db.findStudentById(appeal.studentId);
  if (!student) return null; // fail closed: нет профиля — нет данных
  const messages = await db.listAppealMessages(appeal.id);
  return { appeal, student, messages };
}

export async function answerStaffAppeal(
  db: DataDb,
  ctx: DataCtx,
  appealId: string,
  input: { body: string; now: Date },
): Promise<AppealRow | null> {
  const appeal = await resolveFacultyAppeal(db, ctx, appealId);
  if (!appeal) return null;
  const body = input.body.trim();
  if (body.length === 0) return null; // пустой ответ — ошибка вызывающего

  const actorName = await staffDisplayName(db, ctx);
  return db.appendAppealMessageByStaff(ctx.faculty!, appealId, {
    authorName: actorName,
    body,
    resolve: false,
    notification: {
      type: 'SYSTEM',
      title: 'Ответ деканата',
      body: `По обращению «${appeal.subject}» появился ответ специалиста деканата.`,
      link: '/deanery',
    },
    now: input.now,
  });
}

export async function resolveStaffAppeal(
  db: DataDb,
  ctx: DataCtx,
  appealId: string,
  input: { note: string | null; now: Date },
): Promise<AppealRow | null> {
  const appeal = await resolveFacultyAppeal(db, ctx, appealId);
  if (!appeal) return null;

  const actorName = await staffDisplayName(db, ctx);
  const note = input.note?.trim() ?? '';
  return db.appendAppealMessageByStaff(ctx.faculty!, appealId, {
    authorName: actorName,
    body: note.length > 0 ? note : '',
    resolve: true,
    notification: {
      type: 'SYSTEM',
      title: 'Обращение решено',
      body: `Обращение «${appeal.subject}» решено и закрыто.`,
      link: '/deanery',
    },
    now: input.now,
  });
}

// ── Объявления ───────────────────────────────────────────────────────────────

export async function listStaffAnnouncements(db: DataDb, ctx: DataCtx): Promise<AnnouncementRow[]> {
  const faculty = staffFacultyOf(ctx);
  if (faculty === null) {
    await denyAccess(db, {
      ctx,
      resourceType: 'announcement',
      resourceRef: 'list',
      reason: 'ROLE_MISMATCH',
    });
    return [];
  }
  return db.listAnnouncementsByFaculty(faculty);
}

/** Группы факультета (для выбора аудитории объявления). */
export async function listFacultyGroups(db: DataDb, ctx: DataCtx): Promise<string[]> {
  const faculty = staffFacultyOf(ctx);
  if (faculty === null) return [];
  const students = await db.listStudentsByFaculty(faculty);
  return [...new Set(students.map((student) => student.groupName))].sort();
}

export async function createStaffAnnouncement(
  db: DataDb,
  ctx: DataCtx,
  input: {
    scope: 'FACULTY' | 'GROUP';
    groupName: string | null;
    title: string;
    body: string;
    now: Date;
  },
): Promise<StaffAnnouncementResult> {
  const faculty = staffFacultyOf(ctx);
  if (faculty === null) {
    await denyAccess(db, {
      ctx,
      resourceType: 'announcement',
      resourceRef: input.title.slice(0, 64),
      reason: 'ROLE_MISMATCH',
    });
    return null;
  }

  let groupName: string | null = null;
  if (input.scope === 'GROUP') {
    const groups = await listFacultyGroups(db, ctx);
    const requested = input.groupName?.trim() ?? '';
    if (!groups.includes(requested)) return { error: 'UNKNOWN_GROUP' };
    groupName = requested;
  }

  const title = input.title.trim();
  const body = input.body.trim();
  if (title.length === 0 || body.length === 0) return null;

  const authorName = await staffDisplayName(db, ctx);
  return db.appendAnnouncementByStaff(faculty, {
    groupName,
    title,
    body,
    authorLogin: ctx.login,
    authorName,
    now: input.now,
  });
}

// ── Сводка ───────────────────────────────────────────────────────────────────

export async function getStaffSummaryData(db: DataDb, ctx: DataCtx): Promise<StaffSummaryData> {
  const faculty = staffFacultyOf(ctx);
  if (faculty === null) {
    await auditRequestDenial(db, ctx, 'staff-summary', 'ROLE_MISMATCH');
    return { now: new Date(), requests: [], eventsByRequestId: {}, appeals: [] };
  }
  const requests = await db.listRequestsByFaculty(faculty);
  const eventsByRequestId: Record<string, RequestEventRow[]> = {};
  await Promise.all(
    requests.map(async (request) => {
      eventsByRequestId[request.id] = await db.listRequestEvents(request.id);
    }),
  );
  const appeals = await db.listAppealsByFaculty(faculty);
  return { now: new Date(), requests, eventsByRequestId, appeals };
}
