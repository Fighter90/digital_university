// DIG-21 — серверная часть расписания: день, неделя, месяц, изменения.
//
// Контракты (поверх изолированного порта данных, тот же стиль, что
// requests.ts / notifications.ts — каждый вызов несёт свой скоуп):
//  - `getSchedule(db, ctx, { from, to })` — пары группы студента за период
//    (полуинтервал [from, to)), с преподавателем, аудиторией и статусом
//    (SCHEDULED / ROOM_CHANGED / TIME_CHANGED / CANCELLED + previousRoom /
//    previousStartsAt для переносов);
//  - `getDay` / `getToday` / `getWeek` / `getMonth` / `getNextStudyDay` —
//    готовые срезы в часовом поясе Europe/Moscow (src/lib/schedule-time.ts),
//    неделя и месяц обрезаются по границам семестра (листание — pageMoscowWeek);
//  - `getEventDetails(db, ctx, id)` — детали пары с проверкой, что пара
//    относится к группе студента: чужая группа и несуществующий id дают
//    ОДИНАКОВЫЙ ответ (null → uniform 404), причина — только в AuditLog;
//  - заметки студента к паре: создать/изменить/удалить — только свои
//    (уникальность (studentId, eventId) + проверка группы пары);
//  - `applyScheduleChange(db, ctx, …)` — только сотрудник: фиксирует событие
//    изменения на самой паре (статус/previousRoom/previousStartsAt/changeNote)
//    и рассылает уведомление (kind SCHEDULE) всем студентам группы, уважая
//    PUSH-матрицу настроек каждого студента (DIG-19).
//
// Время: наружу ISO 8601 с офсетом пояса (+03:00) — преобразование делает
// toMoscowIso() из src/lib/schedule-time.ts; строки Date внутри слоя.

import {
  dayRange,
  formatMoscowTime,
  monthRange,
  moscowDateKey,
  pageMoscowWeek,
  semesterBounds,
  startOfMoscowDay,
  shiftMoscowDays,
} from '@/lib/schedule-time';
import { denyAccess } from './access';
import type { DataDb, ScheduleChangePatch } from './port';
import type { DataCtx, ExamSessionRow, ScheduleEventRow, StudentNoteRow } from './types';

const RESOURCE = 'schedule';
const EVENT_RESOURCE = 'schedule-event';

/** Максимальная длина заметки к паре (defensive-лимит слоя данных). */
export const MAX_NOTE_LENGTH = 500;

export interface ScheduleRangeInput {
  from: Date;
  to: Date;
}

export interface ScheduleEventDetails {
  event: ScheduleEventRow;
  /** Собственная заметка студента к этой паре (чужие заметки не существуют). */
  note: StudentNoteRow | null;
}

export interface NextStudyDayView {
  /** Московский ключ дня: «2026-11-12». */
  dateKey: string;
  /** 00:00 московского дня (инстант). */
  date: Date;
  count: number;
  events: ScheduleEventRow[];
}

export type StaffChangeStatus = 'ROOM_CHANGED' | 'TIME_CHANGED' | 'CANCELLED';

export interface ScheduleChangeInput {
  status: StaffChangeStatus;
  /** ROOM_CHANGED: новая аудитория. */
  room?: string;
  /** TIME_CHANGED: новое время начала (длительность пары сохраняется). */
  startsAt?: Date;
  /** Причина изменения — попадает на пару и в уведомления. */
  changeNote?: string | null;
}

/**
 * Пары группы студента за период [from, to), отсортированные по времени
 * начала. Сотрудник (без группы) получает пусто + запись в аудите.
 */
export async function getSchedule(
  db: DataDb,
  ctx: DataCtx,
  range: ScheduleRangeInput,
): Promise<ScheduleEventRow[]> {
  if (ctx.groupName === null) {
    await denyAccess(db, {
      ctx,
      resourceType: RESOURCE,
      resourceRef: 'list',
      reason: 'ROLE_MISMATCH',
    });
    return [];
  }
  if (range.from.getTime() >= range.to.getTime()) return [];
  return db.listScheduleByGroupRange(ctx.groupName, { from: range.from, to: range.to });
}

/**
 * DIG-12 — все пары группы студента (без ограничения по периоду). Историческая
 * точка входа (dashboard/e2e); периодные выборки — через getSchedule.
 */
export async function listSchedule(db: DataDb, ctx: DataCtx): Promise<ScheduleEventRow[]> {
  if (ctx.groupName === null) {
    await denyAccess(db, {
      ctx,
      resourceType: RESOURCE,
      resourceRef: 'list',
      reason: 'ROLE_MISMATCH',
    });
    return [];
  }
  return db.listScheduleByGroup(ctx.groupName);
}

/** DIG-12 — сессии группы (см. заголовок файла). Scoped как listSchedule. */
export async function listExams(db: DataDb, ctx: DataCtx): Promise<ExamSessionRow[]> {
  if (ctx.groupName === null) {
    await denyAccess(db, {
      ctx,
      resourceType: 'exams',
      resourceRef: 'list',
      reason: 'ROLE_MISMATCH',
    });
    return [];
  }
  return db.listExamsByGroup(ctx.groupName);
}

/** Пары одного московского календарного дня. */
export async function getDay(
  db: DataDb,
  ctx: DataCtx,
  date: Date,
  now: Date = new Date(),
): Promise<ScheduleEventRow[]> {
  const bounds = semesterBounds(now);
  const range = dayRange(date);
  if (
    range.from.getTime() >= bounds.end.getTime() ||
    range.to.getTime() <= bounds.start.getTime()
  ) {
    return [];
  }
  return getSchedule(db, ctx, range);
}

/** Пары «сегодня» по Москве. */
export async function getToday(
  db: DataDb,
  ctx: DataCtx,
  now: Date = new Date(),
): Promise<ScheduleEventRow[]> {
  return getDay(db, ctx, now, now);
}

/**
 * Учебная неделя, содержащая `date` (понедельник–воскресенье по Москве),
 * обрезанная по границам семестра. Неделя вне семестра — пусто.
 */
export async function getWeek(
  db: DataDb,
  ctx: DataCtx,
  date: Date,
  now: Date = new Date(),
): Promise<ScheduleEventRow[]> {
  const page = pageMoscowWeek(date, 0, semesterBounds(now));
  if (!page) return [];
  return getSchedule(db, ctx, page);
}

/** Календарный месяц по Москве (month: 1..12), обрезанный по семестру. */
export async function getMonth(
  db: DataDb,
  ctx: DataCtx,
  input: { year: number; month: number },
  now: Date = new Date(),
): Promise<ScheduleEventRow[]> {
  const bounds = semesterBounds(now);
  const range = monthRange(input.year, input.month);
  const from = range.from < bounds.start ? bounds.start : range.from;
  const to = range.to > bounds.end ? bounds.end : range.to;
  if (from.getTime() >= to.getTime()) return [];
  return getSchedule(db, ctx, { from, to });
}

/**
 * Ближайший учебный день после «сегодня» (по Москве, в пределах семестра):
 * пустые дни пропускаются. Пар впереди нет → null.
 */
export async function getNextStudyDay(
  db: DataDb,
  ctx: DataCtx,
  now: Date = new Date(),
): Promise<NextStudyDayView | null> {
  if (ctx.groupName === null) {
    await denyAccess(db, {
      ctx,
      resourceType: RESOURCE,
      resourceRef: 'next-study-day',
      reason: 'ROLE_MISMATCH',
    });
    return null;
  }
  const bounds = semesterBounds(now);
  const from = shiftMoscowDays(startOfMoscowDay(now), 1);
  if (from.getTime() >= bounds.end.getTime()) return null;
  const rows = await db.listScheduleByGroupRange(ctx.groupName, { from, to: bounds.end });
  if (rows.length === 0) return null;
  // Строки отсортированы по startsAt — первая задаёт ближайший день.
  const dateKey = moscowDateKey(rows[0]!.startsAt);
  const events = rows.filter((r) => moscowDateKey(r.startsAt) === dateKey);
  return {
    dateKey,
    date: startOfMoscowDay(events[0]!.startsAt),
    count: events.length,
    events,
  };
}

/**
 * Детали пары с проверкой, что пара относится к группе студента.
 * Чужая группа / несуществующий id / сотрудник — ОДИНАКОВЫЙ null
 * (uniform 404), причина различима только в AuditLog.
 */
export async function getEventDetails(
  db: DataDb,
  ctx: DataCtx,
  id: string,
): Promise<ScheduleEventDetails | null> {
  if (ctx.studentId === null || ctx.groupName === null) {
    await denyAccess(db, {
      ctx,
      resourceType: EVENT_RESOURCE,
      resourceRef: id,
      reason: 'ROLE_MISMATCH',
    });
    return null;
  }
  const probed = await db.probeScheduleEventById(id);
  if (!probed) {
    await denyAccess(db, {
      ctx,
      resourceType: EVENT_RESOURCE,
      resourceRef: id,
      reason: 'NOT_FOUND',
    });
    return null;
  }
  if (probed.groupName !== ctx.groupName) {
    await denyAccess(db, {
      ctx,
      resourceType: EVENT_RESOURCE,
      resourceRef: id,
      reason: 'OWNERSHIP_DENIED',
    });
    return null;
  }
  const note = await db.findNoteByStudentAndEvent(ctx.studentId, id);
  return { event: probed, note };
}

/**
 * Создать/изменить заметку студента к паре (upsert по паре студент+пара).
 * Текст обрезается; пустой или > MAX_NOTE_LENGTH — отказ (null) без записи.
 * Пара должна принадлежать группе студента — иначе null + аудит.
 */
export async function saveEventNote(
  db: DataDb,
  ctx: DataCtx,
  eventId: string,
  text: string,
  now: Date = new Date(),
): Promise<StudentNoteRow | null> {
  if (ctx.studentId === null || ctx.groupName === null) {
    await denyAccess(db, {
      ctx,
      resourceType: EVENT_RESOURCE,
      resourceRef: eventId,
      reason: 'ROLE_MISMATCH',
    });
    return null;
  }
  const trimmed = text.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_NOTE_LENGTH) return null;
  const gate = await requireOwnGroupEvent(db, ctx, eventId);
  if (!gate) return null;
  return db.saveNoteByStudent(ctx.studentId, eventId, { text: trimmed, createdAt: now });
}

/**
 * Удалить СВОЮ заметку к паре. false (единообразно) для чужой пары, чужой
 * заметки и отсутствующей — причина в аудите.
 */
export async function deleteEventNote(db: DataDb, ctx: DataCtx, eventId: string): Promise<boolean> {
  if (ctx.studentId === null || ctx.groupName === null) {
    await denyAccess(db, {
      ctx,
      resourceType: EVENT_RESOURCE,
      resourceRef: eventId,
      reason: 'ROLE_MISMATCH',
    });
    return false;
  }
  const deleted = await db.deleteNoteByStudent(ctx.studentId, eventId);
  if (deleted) return true;
  const probed = await db.probeScheduleEventById(eventId);
  await denyAccess(db, {
    ctx,
    resourceType: EVENT_RESOURCE,
    resourceRef: eventId,
    reason:
      probed === null
        ? 'NOT_FOUND'
        : probed.groupName !== ctx.groupName
          ? 'OWNERSHIP_DENIED'
          : 'NOT_FOUND', // своя пара, но заметки нет
  });
  return false;
}

/**
 * Событие изменения пары (только сотрудник деканата): патчит саму пару
 * (статус + previousRoom / previousStartsAt + changeNote) и рассылает
 * уведомление kind=SCHEDULE всем студентам группы пары. Кабинет сотрудника
 * (DIG-44+) вызывает это вместо прямой записи в БД.
 */
export async function applyScheduleChange(
  db: DataDb,
  ctx: DataCtx,
  eventId: string,
  input: ScheduleChangeInput,
  now: Date = new Date(),
): Promise<ScheduleEventRow | null> {
  if (ctx.role !== 'STAFF') {
    await denyAccess(db, {
      ctx,
      resourceType: EVENT_RESOURCE,
      resourceRef: eventId,
      reason: 'ROLE_MISMATCH',
    });
    return null;
  }
  const probed = await db.probeScheduleEventById(eventId);
  if (!probed) {
    await denyAccess(db, {
      ctx,
      resourceType: EVENT_RESOURCE,
      resourceRef: eventId,
      reason: 'NOT_FOUND',
    });
    return null;
  }
  // Валидация ввода: смена аудитории требует аудиторию, времени — новый старт.
  if (input.status === 'ROOM_CHANGED' && !input.room) return null;
  if (input.status === 'TIME_CHANGED' && !input.startsAt) return null;

  const patch: ScheduleChangePatch = {
    status: input.status,
    changeNote: input.changeNote ?? null,
  };
  if (input.status === 'ROOM_CHANGED') {
    patch.room = input.room!;
    patch.previousRoom = probed.room;
  } else if (input.status === 'TIME_CHANGED') {
    const newStartsAt = input.startsAt!;
    const deltaMs = newStartsAt.getTime() - probed.startsAt.getTime();
    patch.startsAt = newStartsAt;
    patch.endsAt = new Date(probed.endsAt.getTime() + deltaMs);
    patch.previousStartsAt = probed.startsAt;
    patch.date = startOfMoscowDay(newStartsAt);
  }

  const saved = await db.saveScheduleEventChange(eventId, patch);
  if (!saved) {
    await denyAccess(db, {
      ctx,
      resourceType: EVENT_RESOURCE,
      resourceRef: eventId,
      reason: 'NOT_FOUND',
    });
    return null;
  }
  await notifyGroupAboutChange(db, saved, now);
  return saved;
}

/** Единый гейт «пара существует и относится к группе ctx» → null + аудит. */
async function requireOwnGroupEvent(
  db: DataDb,
  ctx: DataCtx,
  eventId: string,
): Promise<ScheduleEventRow | null> {
  const probed = await db.probeScheduleEventById(eventId);
  if (!probed) {
    await denyAccess(db, {
      ctx,
      resourceType: EVENT_RESOURCE,
      resourceRef: eventId,
      reason: 'NOT_FOUND',
    });
    return null;
  }
  // Вызывающие функции (getEventDetails / saveEventNote) уже сузили ctx:
  // studentId и groupName здесь гарантированно не null.
  if (probed.groupName !== ctx.groupName!) {
    await denyAccess(db, {
      ctx,
      resourceType: EVENT_RESOURCE,
      resourceRef: eventId,
      reason: 'OWNERSHIP_DENIED',
    });
    return null;
  }
  return probed;
}

/**
 * Fan-out уведомления об изменении пары всем студентам группы. Матрица
 * каналов каждого студента уважается (DIG-19): PUSH по SCHEDULE выключен —
 * в фид событие не попадает. Сами события изменения живут на паре
 * (статус/previousRoom/previousStartsAt/changeNote), уведомление — их вестник.
 */
async function notifyGroupAboutChange(
  db: DataDb,
  event: ScheduleEventRow,
  now: Date,
): Promise<void> {
  const students = await db.listStudentsByGroup(event.groupName);
  const message = scheduleChangeMessage(event);
  await Promise.all(
    students.map(async (student) => {
      const settings = await db.findSettingsByStudent(student.id);
      if (settings?.notificationChannels?.SCHEDULE?.PUSH === false) return;
      await db.appendNotificationToStudent(student.id, {
        type: 'SCHEDULE',
        title: message.title,
        body: message.body,
        link: '/schedule',
        createdAt: now,
      });
    }),
  );
}

/** Детерминированный текст уведомления по статусу изменённой пары. */
function scheduleChangeMessage(event: ScheduleEventRow): { title: string; body: string } {
  const subject = `${event.disciplineName} (${event.groupName}`;
  const reason = event.changeNote ? ` Причина: ${event.changeNote}` : '';
  switch (event.status) {
    case 'ROOM_CHANGED':
      return {
        title: 'Пара перенесена',
        body: `${subject}, ${formatMoscowTime(event.startsAt)}): ауд. ${event.previousRoom ?? '—'} → ${event.room}.${reason}`,
      };
    case 'TIME_CHANGED':
      return {
        title: 'Изменено время пары',
        body: `${subject}): время изменено — было ${formatMoscowTime(event.previousStartsAt ?? event.startsAt)}, стало ${formatMoscowTime(event.startsAt)}.${reason}`,
      };
    default:
      return {
        title: 'Пара отменена',
        body: `${subject}, ${formatMoscowTime(event.startsAt)}) отменена.${reason}`,
      };
  }
}
