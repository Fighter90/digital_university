// DIG-43 — «Мероприятия» (/events): афиша событий вуза и запись на них.
//
// IDOR-контракт (как у msp.ts / feedback.ts): контекст строится из живой
// сессии (requireDataCtx). ЧТЕНИЕ афиши и карточки — любой вошедший
// (студент и сотрудник): афиша по определению общая, публичный ключ —
// slug (msp-slug.ts), карточка события не содержит ничего личного.
// МУТАЦИЯ (запись/отмена) — только студент: скоуп — ctx.studentId
// (никогда ввод), сотруднику отказ с аудитом ROLE_MISMATCH. Запись
// возможна только на СУЩЕСТВУЮЩЕЕ мероприятие (несуществующий
// slug/eventId → отказ NOT_FOUND, единый 404 без оракула существования —
// различие живёт только в AuditLog).
//
// «Осталось N мест» = capacity − занято; при нуле свободных мест запись
// не создаётся (порт возвращает { registered: false, taken }), слой
// возвращает отказ «Мест нет». Связь с расписанием: записанное
// мероприятие НЕ добавляется в /schedule — прототип (см. комментарий в
// server/actions/events.ts).

import { denyAccess } from './access';
import type { DataDb } from './port';
import { normalizeMspSlug } from './msp-slug';
import type { DataCtx, EventRow } from './types';
// Фильтры ленты — клиентский словарь (lib/events), без серверных импортов:
// слой и компоненты используют ОДНИ значения (как lib/msp у каталога).
import type { EventsFilter } from '@/lib/events';

const RESOURCE = 'campus-event';

/** Горизонт фильтра «На этой неделе»: ближайшие 7 дней от «сейчас». */
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Событие в представлении афиши: строка + агрегаты (занято/свободно). */
export interface EventView {
  event: EventRow;
  /** Сколько студентов записано (агрегат, чужие строки наружу не проходят). */
  taken: number;
  /** «Осталось N мест» = capacity − taken (не уходит в минус). */
  spotsLeft: number;
  /** Записан ли ТЕКУЩИЙ владелец сессии (чип «Записан»). */
  registeredByMe: boolean;
}

export interface EventsPageData {
  filter: EventsFilter;
  /** Лента по выбранному фильтру, по дате старта по возрастанию. */
  items: EventView[];
}

export interface EventDetail {
  event: EventRow;
  taken: number;
  spotsLeft: number;
  registeredByMe: boolean;
}

export type ToggleEventRegistrationResult =
  | { ok: true; slug: string; registered: boolean; taken: number; spotsLeft: number }
  | { ok: false; error: string };

/** Парсинг query-параметра фильтра: всё неизвестное — «Все». */
export function parseEventsFilter(raw: string | string[] | undefined): EventsFilter {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === 'week' || value === 'faculty' || value === 'career' || value === 'online'
    ? value
    : 'all';
}

/**
 * Фильтрация афиши (чистая функция над готовыми представлениями):
 * - week — старт в ближайшие 7 дней от `now` (только предстоящие);
 * - faculty — теги содержат факультет контекста (у сотрудника — его
 *   факультет; null — фильтр неприменим, лента без изменений);
 * - career / online — по типу и флагу трансляции.
 */
function applyFilter(
  items: EventView[],
  filter: EventsFilter,
  faculty: string | null,
  now: Date,
): EventView[] {
  switch (filter) {
    case 'week': {
      const from = now.getTime();
      const until = from + WEEK_MS;
      return items.filter((v) => {
        const at = v.event.startsAt.getTime();
        return at >= from && at <= until;
      });
    }
    case 'faculty':
      return faculty === null ? items : items.filter((v) => v.event.tags.includes(faculty));
    case 'career':
      return items.filter((v) => v.event.kind === 'CAREER');
    case 'online':
      return items.filter((v) => v.event.isOnline);
    default:
      return items;
  }
}

/** Строка + агрегаты записи владельца. */
async function toEventView(db: DataDb, ctx: DataCtx, event: EventRow): Promise<EventView> {
  const taken = await db.listEventAttendeeCount(event.id);
  const mine =
    ctx.studentId === null
      ? []
      : (await db.listEventRegistrationsByStudent(ctx.studentId)).filter(
          (r) => r.eventId === event.id,
        );
  return {
    event,
    taken,
    spotsLeft: Math.max(0, event.capacity - taken),
    registeredByMe: mine.length > 0,
  };
}

/**
 * Экран /events: лента с фильтром (?filter=), сортировка по дате старта.
 * Чтение — любой вошедший; запись — отдельный owner-scoped контракт ниже.
 */
export async function getEventsPage(
  db: DataDb,
  ctx: DataCtx,
  filter: EventsFilter,
  now: Date = new Date(),
): Promise<EventsPageData> {
  const events = await db.listEventsByRange();
  const views: EventView[] = [];
  for (const event of events) {
    views.push(await toEventView(db, ctx, event));
  }
  return { filter, items: applyFilter(views, filter, ctx.faculty, now) };
}

// ── DIG-76 — виджет «Мероприятия» на главной ──────────────────────────────────

/** Лимит виджета главной: до трёх ближайших будущих событий. */
export const MAX_DASHBOARD_EVENTS = 3;

/** Блок виджета «Мероприятия» главной: ближайшие будущие события с агрегатами. */
export interface EventsSummary {
  /** Ближайшие будущие события от now, по возрастанию даты старта. */
  items: EventView[];
}

/**
 * Виджет «Мероприятия» главной: до MAX_DASHBOARD_EVENTS ближайших будущих
 * событий от now (порт фильтрует прошедшие и сортирует по дате старта),
 * с агрегатами записи владельца (toEventView — тот же контракт, что лента
 * /events). Чтение — любой вошедший (афиша общая); мутаций здесь нет —
 * запись идёт через существующий owner-scoped toggleEventRegistration
 * (см. ниже), владельцем данных виджет не управляет.
 */
export async function getDashboardEvents(
  db: DataDb,
  ctx: DataCtx,
  now: Date = new Date(),
  limit: number = MAX_DASHBOARD_EVENTS,
): Promise<EventsSummary> {
  const events = await db.listEventsByRange(now);
  const items: EventView[] = [];
  for (const event of events.slice(0, Math.max(0, limit))) {
    items.push(await toEventView(db, ctx, event));
  }
  return { items };
}

/**
 * Карточка мероприятия по публичному slug. Чтение — любой вошедший.
 * Чужой slug в афише отсутствует по определению, поэтому несуществующий
 * slug — всегда NOT_FOUND (аудит попытки), единый 404.
 */
export async function openEventView(
  db: DataDb,
  ctx: DataCtx,
  slug: string,
): Promise<EventDetail | null> {
  const events = await db.listEventsByRange();
  const event = events.find((e) => e.slug === slug) ?? null;
  if (!event) {
    await denyAccess(db, { ctx, resourceType: RESOURCE, resourceRef: slug, reason: 'NOT_FOUND' });
    return null;
  }
  return toEventView(db, ctx, event);
}

/**
 * Переключение записи владельца на существующее мероприятие. Студенту —
 * его запись; сотруднику — отказ (аудит ROLE_MISMATCH); несуществующее
 * мероприятие — отказ (аудит NOT_FOUND); при заполненной вместимости —
 * отказ «Мест нет» (порт не создаёт строку — защита от гонки вкладок).
 */
export async function toggleEventRegistrationForStudent(
  db: DataDb,
  ctx: DataCtx,
  eventId: string,
): Promise<ToggleEventRegistrationResult> {
  if (ctx.studentId === null) {
    await denyAccess(db, {
      ctx,
      resourceType: RESOURCE,
      resourceRef: eventId,
      reason: 'ROLE_MISMATCH',
    });
    return { ok: false, error: 'Записываться могут только студенты' };
  }
  const events = await db.listEventsByRange();
  const event = events.find((e) => e.id === eventId) ?? null;
  if (!event) {
    await denyAccess(db, {
      ctx,
      resourceType: RESOURCE,
      resourceRef: eventId,
      reason: 'NOT_FOUND',
    });
    return { ok: false, error: 'Мероприятие не найдено' };
  }
  const result = await db.toggleEventRegistration(ctx.studentId, eventId);
  if (!result) return { ok: false, error: 'Мероприятие не найдено' };
  if (!result.registered && result.taken >= event.capacity) {
    // Порт не создал строку: мест не осталось. Это отказ вместимости,
    // а не доступа — в аудит не пишется (как ошибка валидации формы).
    return { ok: false, error: 'Мест нет' };
  }
  return {
    ok: true,
    slug: event.slug,
    registered: result.registered,
    taken: result.taken,
    spotsLeft: Math.max(0, event.capacity - result.taken),
  };
}

/**
 * Нормализация slug из URL — тот же контракт, что у каталога «МСП»
 * (msp-slug.ts): trim + нижний регистр, пустой → URIError, который
 * страница превращает в единый контрактный 404.
 */
export const normalizeEventSlug = normalizeMspSlug;
