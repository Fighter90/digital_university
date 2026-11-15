// DIG-64 — форматирование ответов инструментов демо-MCP-сервера деканата.
//
// Чистый модуль: строки типов из data-слоя (type-only import, как в
// schedule-cards.ts), детерминированы и покрыты юнит-тестами. Текст —
// человекочитаемый, на русском: его читает ассистент (ChatGPT/Claude) и
// пересказывает студенту. Время — Europe/Moscow (schedule-time).

import { formatMoscowTime, moscowParts, moscowWeekdayIndex } from '@/lib/schedule-time';
import { formatDayTitle } from '@/lib/schedule-cards';
import { LESSON_KIND_LABELS } from '@/lib/dashboard-format';
import { NOTIFICATION_TYPE_LABELS } from '@/lib/notification-labels';
import type { GradeRow, NotificationRow, ScheduleEventRow } from '@/server/data/types';

const MAX_GRADES = 20;
const MAX_UNREAD = 10;

const WEEKDAY_SHORT = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'] as const;

const pad2 = (value: number): string => String(value).padStart(2, '0');

/** «15.11.2026» — дата по Москве. */
function formatMoscowDate(date: Date): string {
  const p = moscowParts(date);
  return `${p.day}.${pad2(p.month)}.${p.year}`;
}

/** «15.11 21:05» — дата и время по Москве (для уведомлений). */
function formatMoscowDateTime(date: Date): string {
  const p = moscowParts(date);
  return `${p.day}.${pad2(p.month)} ${pad2(p.hour)}:${pad2(p.minute)}`;
}

/** Человекочитаемая пометка изменения пары (перенос/отмена). */
function scheduleStatusSuffix(event: ScheduleEventRow): string {
  const parts: string[] = [];
  if (event.status === 'CANCELLED') {
    parts.push('ОТМЕНЕНА');
  }
  if (event.status === 'ROOM_CHANGED' && event.previousRoom) {
    parts.push(`перенос аудитории (было: ${event.previousRoom})`);
  }
  if (event.status === 'TIME_CHANGED' && event.previousStartsAt) {
    parts.push(`перенос времени (было: ${formatMoscowTime(event.previousStartsAt)})`);
  }
  if (event.changeNote) {
    parts.push(`причина: ${event.changeNote}`);
  }
  return parts.length > 0 ? ` — ${parts.join(', ')}` : '';
}

/**
 * «Расписание на сегодня»: заголовок с датой, пары по времени начала,
 * счётчик. Пустой день — честное «пар нет».
 */
export function formatScheduleToday(events: readonly ScheduleEventRow[], now: Date): string {
  const header = `Расписание на сегодня (${formatDayTitle(now)}, Москва):`;
  if (events.length === 0) {
    return `${header}\nСегодня пар нет — можно отдохнуть.`;
  }
  const sorted = [...events].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const lines = sorted.map((event, index) => {
    const kind = LESSON_KIND_LABELS[event.kind]?.toLowerCase() ?? 'занятие';
    const room = event.room ? `ауд. ${event.room}` : 'онлайн';
    return (
      `${index + 1}. ${formatMoscowTime(event.startsAt)}–${formatMoscowTime(event.endsAt)}` +
      ` — ${event.disciplineName} (${kind}), ${room}, преподаватель: ${event.teacherName}` +
      scheduleStatusSuffix(event)
    );
  });
  const weekday = WEEKDAY_SHORT[moscowWeekdayIndex(now)];
  const footer = `Пар сегодня: ${events.length}. Расписание группы — во вкладке «Расписание» (${weekday}).`;
  return [header, ...lines, footer].join('\n');
}

/**
 * «Мои оценки»: до 20 свежих, каждая — дисциплина, элемент, балл из
 * максимума, вес, дата; общий счётчик.
 */
export function formatGrades(grades: readonly GradeRow[]): string {
  if (grades.length === 0) {
    return 'Оценок пока нет — как только деканат выставит, они появятся здесь.';
  }
  const sorted = [...grades].sort((a, b) => b.gradedAt.getTime() - a.gradedAt.getTime());
  const shown = sorted.slice(0, MAX_GRADES);
  const lines = shown.map((grade, index) => {
    const weight = Math.round(grade.weight * 100);
    return (
      `${index + 1}. ${grade.disciplineName} — ${grade.elementName}: ` +
      `${grade.score} из ${grade.maxScore}` +
      (Number.isFinite(weight) && weight > 0 ? ` (вес ${weight}%)` : '') +
      ` — ${formatMoscowDate(grade.gradedAt)}`
    );
  });
  const header = `Мои оценки (последние ${shown.length} из ${grades.length}):`;
  return [header, ...lines].join('\n');
}

/**
 * «Непрочитанные»: до 10 свежих непрочитанных, каждая — категория,
 * заголовок, текст, время; счётчик непрочитанных.
 */
export function formatUnread(rows: readonly NotificationRow[]): string {
  const unread = rows
    .filter((row) => !row.isRead)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  if (unread.length === 0) {
    return 'Непрочитанных уведомлений нет — всё прочитано.';
  }
  const shown = unread.slice(0, MAX_UNREAD);
  const lines = shown.map((row, index) => {
    const kind = NOTIFICATION_TYPE_LABELS[row.type] ?? 'Уведомление';
    return `${index + 1}. [${kind}] ${row.title} — ${row.body} (${formatMoscowDateTime(row.createdAt)})`;
  });
  const header = `Непрочитанные уведомления (${shown.length} из ${unread.length}):`;
  const footer =
    unread.length > shown.length
      ? 'Остальные — во вкладке «Уведомления» кабинета.'
      : 'Полный список — во вкладке «Уведомления» кабинета.';
  return [header, ...lines, footer].join('\n');
}
