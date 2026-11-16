// DIG-34 — presentation-слой экрана «Задачи»: метки источников, кнопки
// действия и метки сроков. Чистые функции БЕЗ серверных импортов —
// переиспользуются экраном /tasks и виджетом «Что от меня ждут» на главной.
import type { TaskSource } from '@/server/data/tasks';

/** Откуда пришла задача — подпись рядом с иконкой источника. */
export const TASK_SOURCE_LABELS: Record<TaskSource, string> = {
  REQUEST: 'Заявка',
  COURSE: 'Дисциплина',
  SESSION: 'Сессия',
  RETAKE: 'Сессия',
  DEANERY: 'Деканат',
  MANUAL: 'Деканат',
};

/** Кнопка действия: «ровно туда, где задачу выполнить». Ручные — отметка. */
export const TASK_ACTION_LABELS: Record<Exclude<TaskSource, 'MANUAL'>, string> = {
  REQUEST: 'Открыть',
  COURSE: 'Открыть',
  SESSION: 'Что сдать',
  RETAKE: 'К записи',
  DEANERY: 'Ответить',
};

const MONTHS_GENITIVE = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
] as const;

/** «16 ноября» — срок в группе «На этой неделе»/«Позже». */
export function formatTaskDate(date: Date): string {
  return `${date.getDate()} ${MONTHS_GENITIVE[date.getMonth()]}`;
}

const timeFormatter = new Intl.DateTimeFormat('ru-RU', {
  hour: '2-digit',
  minute: '2-digit',
});

/** «23:59» — время внутри дня. */
export function formatTaskTime(date: Date): string {
  return timeFormatter.format(date);
}

/**
 * Метка срока строки задачи (тон задаёт компонент):
 *  - просрочено — «Просрочено · до 9 ноября»;
 *  - сегодня/завтра — «Сегодня · до 23:59» / «Завтра · до 09:00»;
 *  - позже — «до 16 ноября»;
 *  - срок не назначен — «Срок не назначен» (задача живёт в «Сегодня»).
 */
export function dueLabel(daysLeft: number | null, dueAt: Date | null): string {
  if (daysLeft === null || dueAt === null) return 'Срок не назначен';
  if (daysLeft < 0) return `Просрочено · до ${formatTaskDate(dueAt)}`;
  if (daysLeft === 0) return `Сегодня · до ${formatTaskTime(dueAt)}`;
  if (daysLeft === 1) return `Завтра · до ${formatTaskTime(dueAt)}`;
  return `до ${formatTaskDate(dueAt)}`;
}
