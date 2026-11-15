// DIG-63 — живая ICS-подписка: расписание и дедлайны студента в системный
// календарь (Google/Apple Calendar по URL-подписке).
//
// Контракты (каждый закреплён tests/calendar-subscription.test.ts):
//
//  1. getOrCreateCalendarSubscription — выдача личной ссылки студенту.
//     Одна активная подписка на студента: повторный вызов возвращает ТУ ЖЕ
//     ссылку (календарь подписчика не ломается). Сотрудник — null + аудит
//     ROLE_MISMATCH (тот же контракт, что session.ts / certificates.ts).
//
//  2. resolveCalendarFeed — публичное чтение фида ПОДПИСАННОЙ ссылкой,
//     без входа (календарные клиенты не умеют cookies): tokenId проверяется
//     HMAC-подписью (lib/calendar-token) до обращения к хранилищу, активная
//     строка ищется по tokenId (осознанное исключение из owner-scope,
//     port.findCalendarSubscriptionByTokenId). Наружу — только фид: имя
//     календаря (группа) и события; studentId/email/fullName через этот
//     контракт не проходят. Мусор/подделка/отозванная ссылка — единый null
//     (нет оракула существования).
//
//  3. revokeCalendarSubscriptionOfLogin — отзыв при выходе из кабинета:
//     строка удаляется, прежняя ссылка умирает навсегда; новый вход
//     получает новый tokenId. login приходит из живой сессии.
//
//  4. buildCalendarFeed — состав фида: пары группы студента за ТЕКУЩИЙ
//     семестр (включая отменённые — с пометкой «Отменена» и причиной в
//     описании) и ВСЕ контрольные точки сессии группы (экзамены, зачёты,
//     пересдачи — это «дедлайны» главной). Фид живой: любые изменения
//     расписания деканатом попадают в календарь при следующем обновлении
//     подписки клиентом.
//
//  Секрет подписки — ICS_TOKEN_SECRET (.env.example); пустой секрет —
//  fail closed: ссылки не выдаются, фид не отвечает (URL не mint-ится).

import { mintCalendarToken, newCalendarTokenId, parseCalendarToken } from '@/lib/calendar-token';
import { EXAM_KIND_LABELS } from '@/lib/session-format';
import { LESSON_KIND_LABELS } from '@/lib/dashboard-format';
import { formatMoscowTime, semesterBounds } from '@/lib/schedule-time';
import type { IcsEventInput } from '@/lib/ics';
import { denyAccess } from './access';
import type { DataDb } from './port';
import type { CalendarSubscriptionRow, DataCtx, ExamSessionRow, ScheduleEventRow } from './types';

const RESOURCE = 'calendar-subscription';

/**
 * Секрет подписанных ссылок (только сервер). Приоритет — выделенный
 * ICS_TOKEN_SECRET (.env.example, DIG-7); в локальной разработке и e2e,
 * где гарантирован только AUTH_SECRET (от него зависит /staff-gate),
 * используется он — модель угрозы та же (секрет никогда не покидает
 * сервер). Пусто — fail closed: ссылки не выдаются, фид не отвечает.
 */
export function icsTokenSecret(): string {
  return process.env.ICS_TOKEN_SECRET?.trim() || process.env.AUTH_SECRET?.trim() || '';
}

export interface SubscriptionOptions {
  now?: Date;
  /** По умолчанию — ICS_TOKEN_SECRET из окружения. */
  secret?: string;
  /** Инъекция случайности для тестов (как random у newRequestNumber). */
  random?: (size: number) => Buffer;
}

export interface FeedOptions {
  now?: Date;
  secret?: string;
}

/** Что видит владелец ссылки: подписанный URL и момент выдачи. */
export interface CalendarSubscriptionView {
  token: string;
  createdAt: Date;
}

/** Фид календаря: имя (X-WR-CALNAME) и события; сборка ICS — на границе HTTP. */
export interface CalendarFeedData {
  name: string;
  events: IcsEventInput[];
}

/** Минимальный скоуп фида: владелец и его группа. */
interface FeedOwner {
  groupName: string;
}

const EXAM_DURATION_MS = 90 * 60_000;

/**
 * Активная ссылка студента: существующая строка не пересоздаётся (URL
 * стабилен между визитами). Сотрудник / пустой секрет — null (+ аудит
 * ROLE_MISMATCH для сотрудника).
 */
export async function getOrCreateCalendarSubscription(
  db: DataDb,
  ctx: DataCtx,
  options: SubscriptionOptions = {},
): Promise<CalendarSubscriptionView | null> {
  const secret = options.secret ?? icsTokenSecret();
  const now = options.now ?? new Date();
  if (ctx.studentId === null || secret.length === 0) {
    await denyAccess(db, {
      ctx,
      resourceType: RESOURCE,
      resourceRef: 'self',
      reason: 'ROLE_MISMATCH',
    });
    return null;
  }

  const existing = await db.findCalendarSubscriptionByStudent(ctx.studentId);
  const row =
    existing ??
    (await db.saveCalendarSubscriptionForStudent(ctx.studentId, {
      tokenId: newCalendarTokenId(options.random),
      createdAt: now,
      rotatedAt: null,
    }));
  return { token: mintCalendarToken(secret, row.tokenId), createdAt: row.createdAt };
}

/**
 * Отзыв подписки при выходе из кабинета. login — из живой сессии
 * (server actions signOutAction / signOutAllDevicesAction), не из ввода.
 * Идемпотентен: false — у логина нет студента или активной подписки.
 */
export async function revokeCalendarSubscriptionOfLogin(
  db: DataDb,
  login: string,
): Promise<boolean> {
  return db.deleteCalendarSubscriptionByLogin(login);
}

/**
 * Публичный фид по подписанной ссылке. Вернуть фид можно только для
 * АКТИВНОЙ строки: после отзыва (выход) прежняя ссылка отвечает null
 * навсегда. Владелец строки определяет группу — скоуп изоляции фида.
 */
export async function resolveCalendarFeed(
  db: DataDb,
  rawToken: string,
  options: FeedOptions = {},
): Promise<CalendarFeedData | null> {
  const secret = options.secret ?? icsTokenSecret();
  const now = options.now ?? new Date();
  const parsed = secret.length === 0 ? null : parseCalendarToken(secret, rawToken ?? '');
  if (!parsed) return null;
  const row: CalendarSubscriptionRow | null = await db.findCalendarSubscriptionByTokenId(
    parsed.tokenId,
  );
  if (!row) return null;
  const owner = await db.findStudentById(row.studentId);
  if (!owner) return null; // fail closed: нет студента — нет фида
  return buildCalendarFeed(db, { groupName: owner.groupName }, now);
}

/**
 * Состав фида группы: пары семестра + контрольные точки сессии, отсортированные
 * по времени начала. Пары берутся окном семестра (listScheduleByGroupRange) —
 * прямое чтение группового скоупа, как во всём слое данных.
 */
export async function buildCalendarFeed(
  db: DataDb,
  owner: FeedOwner,
  now: Date,
): Promise<CalendarFeedData> {
  const bounds = semesterBounds(now);
  const [schedule, exams] = await Promise.all([
    db.listScheduleByGroupRange(owner.groupName, { from: bounds.start, to: bounds.end }),
    db.listExamsByGroup(owner.groupName),
  ]);

  const events = [...schedule.map(lessonToIcsEvent), ...exams.map(examToIcsEvent)].sort(
    (a, b) => a.startsAt.getTime() - b.startsAt.getTime(),
  );

  return { name: `Цифровой деканат · ${owner.groupName}`, events };
}

/** Пара расписания → VEVENT (отменённые — с пометкой и причиной в описании). */
function lessonToIcsEvent(row: ScheduleEventRow): IcsEventInput {
  const cancelled = row.status === 'CANCELLED';
  const kindLabel = LESSON_KIND_LABELS[row.kind];
  const title = cancelled
    ? `Отменена: ${row.disciplineName}`
    : `${kindLabel}: ${row.disciplineName}`;
  const online = row.room.trim().toLowerCase() === 'онлайн';
  const descriptionParts = [
    `Преподаватель: ${row.teacherName}`,
    row.status === 'ROOM_CHANGED' && row.previousRoom
      ? `Перенос: ауд. ${row.previousRoom} → ${row.room}`
      : null,
    row.status === 'TIME_CHANGED' && row.previousStartsAt
      ? `Время изменено: было ${formatMoscowTime(row.previousStartsAt)}`
      : null,
    row.changeNote ? `Причина: ${row.changeNote}` : null,
    row.note ?? null,
  ].filter(Boolean);
  return {
    uid: `lesson-${row.id}@digital-deanery`,
    title,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    location: online ? 'Онлайн' : `каб. ${row.room}`,
    description: descriptionParts.length > 0 ? descriptionParts.join('. ') : null,
  };
}

/** Контрольная точка сессии (экзамен/зачёт/пересдача) → VEVENT на 90 минут. */
function examToIcsEvent(row: ExamSessionRow): IcsEventInput {
  return {
    uid: `exam-${row.id}@digital-deanery`,
    title: `${EXAM_KIND_LABELS[row.kind]}: ${row.disciplineName}`,
    startsAt: row.startsAt,
    endsAt: new Date(row.startsAt.getTime() + EXAM_DURATION_MS),
    location: `каб. ${row.room}`,
    description: row.note,
  };
}
