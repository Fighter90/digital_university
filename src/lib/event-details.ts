// DIG-24 — вью-модель панели «Детали пары» (Figma «04 · Расписание — детали
// пары»). Чистый модуль без серверных импортов: страницу-сервер и клиентскую
// панель кормит одной сериализуемой моделью, ICS-роут — сборщиком входа
// одного события (тот же стиль, что src/lib/ics.ts у сессии DIG-28).
//
// Контракт состава панели:
//  - шапка: цветная полоса типа, тип, название дисциплины, «Среда, 11 ноября»,
//    «12:00–13:30»;
//  - перенос (ROOM_CHANGED / TIME_CHANGED): «Было: ауд. 214, 11:10 →
//    Стало: ауд. 305, 11:10», причина (changeNote) и кто изменил
//    (changeAuthor; вносила изменения только деканат — дефолт «деканат»);
//  - отмена (CANCELLED): причина (note) и «что делать» (changeNote — когда/чем
//    занятие восполнат);
//  - аудитория и корпус («Главный корпус» — фолбэк, онлайн-пара — «онлайн»);
//  - преподаватель: имя со ссылкой на карточку справочника, email, «Написать»;
//  - онлайн-ссылка, домашнее задание и материалы — если заданы;
//  - примечание деканата обычной пары (note) — info-строка панели.

import { formatMoscowTime } from '@/lib/schedule-time';
import { lessonKindLabel } from '@/lib/dashboard-format';
import { LESSON_KIND_META, formatDayTitle } from '@/lib/schedule-cards';
import { t, type Locale } from '@/lib/i18n';
import { type IcsEventInput } from '@/lib/ics';
import type { ScheduleEventRow } from '@/server/data/types';

/** Аудитория «Онлайн» (любой регистр) — пары без аудитории. */
function isOnlineRoom(room: string): boolean {
  return room.trim().toLowerCase() === 'онлайн';
}

function roomLabelOf(room: string, locale: Locale = 'ru'): string {
  return isOnlineRoom(room)
    ? t(locale, 'schedule.room.online')
    : t(locale, 'schedule.room.label', { room: room.trim() });
}

/** Корпус по умолчанию (в демо-данных здания деканата не ведутся отдельно). */
const DEFAULT_BUILDING_KEY = 'schedule.building.main' as const;

/** Ссылка на карточку преподавателя в справочнике (экран «Справочник» DIG-37). */
const DIRECTORY_HREF = '/directory';

export interface EventMoveInfo {
  /** «ауд. 214, 11:10» · «ауд. 214» · «11:10» · null (нет данных «было»). */
  wasLabel: string | null;
  /** «ауд. 305, 12:00» — текущие аудитория и время. */
  nowLabel: string;
  /** Причина переноса от деканата (changeNote). */
  reason: string | null;
  /** Кто изменил; изменения вносит только деканат — дефолт «деканат». */
  authorLabel: string;
}

export interface EventCancelInfo {
  /** Причина отмены (note пары). */
  reason: string | null;
  /** «Что делать»: когда/чем занятие будет восполнено (changeNote). */
  makeupLabel: string | null;
}

/** Статус панели: ROOM_CHANGED/TIME_CHANGED схлопываются в «MOVED». */
export type EventDetailsStatus = 'SCHEDULED' | 'MOVED' | 'CANCELLED';

export interface EventDetailsView {
  id: string;
  /** Статус панели: перенесённые ROOM_CHANGED/TIME_CHANGED — «MOVED». */
  status: EventDetailsStatus;
  isMoved: boolean;
  isCancelled: boolean;
  /** Подпись типа занятия («Лабораторная»). */
  kindLabel: string;
  /** Класс цветной полосы типа (bg-lesson-lab и т.п.). */
  stripeClass: string;
  discipline: string;
  disciplineCode: string;
  /** «Среда, 11 ноября». */
  dateLabel: string;
  /** «12:00–13:30». */
  timeLabel: string;
  /** «ауд. 305» или «онлайн». */
  roomLabel: string;
  /** Корпус; фолбэк — «Главный корпус». */
  buildingLabel: string;
  /** Ссылка на онлайн-встречу, если пара идёт онлайн. */
  onlineUrl: string | null;
  teacherName: string;
  teacherEmail: string | null;
  /** Карточка преподавателя в справочнике. */
  teacherCardHref: string;
  /** mailto-ссылка «Написать» (null — email не заведён). */
  mailtoHref: string | null;
  homework: string | null;
  materials: string | null;
  /** Примечание деканата обычной пары (у переноса/отмены note = причина). */
  deaneryNote: string | null;
  /** Жёлтый блок переноса («Было: … → Стало: …»). */
  move: EventMoveInfo | null;
  /** Красный блок отмены (причина + «Что делать»). */
  cancel: EventCancelInfo | null;
  /** «Добавить в календарь» — ICS одной пары. */
  icsHref: string;
  startsAt: Date;
  endsAt: Date;
}

/** Строка слоя данных → сериализуемая вью-модель панели деталей. */
export function toEventDetailsView(row: ScheduleEventRow, locale: Locale = 'ru'): EventDetailsView {
  const isMoved = row.status === 'ROOM_CHANGED' || row.status === 'TIME_CHANGED';
  const isCancelled = row.status === 'CANCELLED';

  const wasParts: string[] = [];
  if (row.previousRoom) wasParts.push(t(locale, 'schedule.room.was', { room: row.previousRoom }));
  if (row.previousStartsAt) wasParts.push(formatMoscowTime(row.previousStartsAt));

  return {
    id: row.id,
    status: isMoved ? 'MOVED' : isCancelled ? 'CANCELLED' : 'SCHEDULED',
    isMoved,
    isCancelled,
    kindLabel: lessonKindLabel(row.kind, locale),
    stripeClass: LESSON_KIND_META[row.kind].stripe,
    discipline: row.disciplineName,
    disciplineCode: row.disciplineCode,
    dateLabel: formatDayTitle(row.startsAt, locale),
    timeLabel: `${formatMoscowTime(row.startsAt)}–${formatMoscowTime(row.endsAt)}`,
    roomLabel: roomLabelOf(row.room, locale),
    buildingLabel: row.building ?? t(locale, DEFAULT_BUILDING_KEY),
    onlineUrl: row.onlineUrl ?? null,
    teacherName: row.teacherName,
    teacherEmail: row.teacherEmail ?? null,
    teacherCardHref: DIRECTORY_HREF,
    mailtoHref: row.teacherEmail ? `mailto:${row.teacherEmail}` : null,
    homework: row.homework ?? null,
    materials: row.materials ?? null,
    deaneryNote: isMoved || isCancelled ? null : (row.note ?? null),
    move: isMoved
      ? {
          wasLabel: wasParts.length > 0 ? wasParts.join(', ') : null,
          nowLabel: `${roomLabelOf(row.room, locale)}, ${formatMoscowTime(row.startsAt)}`,
          reason: row.changeNote ?? null,
          authorLabel: row.changeAuthor?.trim()
            ? row.changeAuthor.trim()
            : t(locale, 'schedule.author.deanery'),
        }
      : null,
    cancel: isCancelled ? { reason: row.note ?? null, makeupLabel: row.changeNote ?? null } : null,
    icsHref: `/api/schedule/${encodeURIComponent(row.id)}/ics`,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
  };
}

/** Вью-модель → вход сборщика ICS одного события (RFC 5545 делает ics.ts). */
export function toEventIcsInput(view: EventDetailsView): IcsEventInput {
  const base = `Преподаватель: ${view.teacherName}`;
  let description = base;
  if (view.isMoved) {
    description = [base, `Пара перенесена${view.move?.reason ? `: ${view.move.reason}` : ''}`]
      .filter(Boolean)
      .join('. ');
  } else if (view.isCancelled) {
    description = [base, `Пара отменена${view.cancel?.reason ? `: ${view.cancel.reason}` : ''}`]
      .filter(Boolean)
      .join('. ');
  }
  return {
    uid: `event-${view.id}@digital-deanery`,
    title: `${view.kindLabel}: ${view.discipline}`,
    startsAt: view.startsAt,
    endsAt: view.endsAt,
    location:
      view.onlineUrl || ['онлайн', 'online'].includes(view.roomLabel.trim().toLowerCase())
        ? 'Онлайн'
        : `${view.roomLabel}, ${view.buildingLabel}`,
    description,
  };
}

/**
 * Ссылка на панель деталей пары с сохранением контекста вида: база уже несёт
 * ?view/?date/?week (или пуста) — параметр ?event= досоединяется корректно.
 */
export function eventDetailsHref(base: string | undefined, eventId: string): string {
  const prefix = base && base.length > 0 ? base : '/schedule';
  const sep = prefix.includes('?') ? '&' : '?';
  return `${prefix}${sep}event=${encodeURIComponent(eventId)}`;
}
