// DIG-34 — presentation-слой экрана «Задачи»: метки источников, кнопки
// действия и метки сроков. Чистые функции БЕЗ серверных импортов —
// переиспользуются экраном /tasks и виджетом «Что от меня ждут» на главной.
//
// DIG-87 — функции получили необязательный locale (дефолт 'ru' — прежние
// байт-в-байт строки); RU-канон остался в константах (tests/tasks-page).
import { t, type Locale } from '@/lib/i18n';
import type { TaskSource } from '@/server/data/tasks';

/** Откуда пришла задача — подпись рядом с иконкой источника (RU-канон). */
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

/** Метка источника по локали: «Заявка» / «Request» (DIG-87). */
export function taskSourceLabel(source: TaskSource, locale: Locale = 'ru'): string {
  if (locale === 'en') return t(locale, `tasks.source.${source}` as const);
  return TASK_SOURCE_LABELS[source];
}

/** Метка действия по локали: «К записи» / «Sign up» (DIG-87). */
export function taskActionLabel(
  source: Exclude<TaskSource, 'MANUAL'>,
  locale: Locale = 'ru',
): string {
  if (locale === 'en') return t(locale, `tasks.action.${source}` as const);
  return TASK_ACTION_LABELS[source];
}

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

const shortDateFormatterEn = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Europe/Moscow',
  month: 'short',
  day: 'numeric',
});

/** «16 ноября» — срок в группе «На этой неделе»/«Позже» / «Nov 16» (EN). */
export function formatTaskDate(date: Date, locale: Locale = 'ru'): string {
  if (locale === 'en') return shortDateFormatterEn.format(date);
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
 * DIG-87 — по локали (дефолт 'ru' — прежние байт-в-байт строки).
 */
export function dueLabel(
  daysLeft: number | null,
  dueAt: Date | null,
  locale: Locale = 'ru',
): string {
  if (daysLeft === null || dueAt === null) return t(locale, 'tasks.due.none');
  if (daysLeft < 0) {
    return t(locale, 'tasks.due.overdue', { date: formatTaskDate(dueAt, locale) });
  }
  if (daysLeft === 0) return t(locale, 'tasks.due.today', { time: formatTaskTime(dueAt) });
  if (daysLeft === 1) return t(locale, 'tasks.due.tomorrow', { time: formatTaskTime(dueAt) });
  return t(locale, 'tasks.due.date', { date: formatTaskDate(dueAt, locale) });
}
