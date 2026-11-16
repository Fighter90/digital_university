// DIG-39 — чистый модуль обращений в деканат: темы, видимые статусы,
// подписи и форматы времени. Без React и серверных импортов — общий
// источник правды для экрана, слоя данных и тестов (как request-labels).

import type { TicketStatus, TicketSubject } from '@/server/data/types';

/** Темы обращения — фиксированный список из задачи (Figma «17 · Деканат»). */
export const TICKET_SUBJECTS: TicketSubject[] = [
  'CURRICULUM',
  'GRADES',
  'TRANSFER',
  'ACADEMIC_LEAVE',
  'OTHER',
];

export const TICKET_SUBJECT_LABELS: Record<TicketSubject, string> = {
  CURRICULUM: 'Учебный план',
  GRADES: 'Оценки',
  TRANSFER: 'Перевод',
  ACADEMIC_LEAVE: 'Академический отпуск',
  OTHER: 'Другое',
};

/**
 * Видимые статусы обращения — ровно три из задачи. Внутренние статусы
 * канонической схемы (OPEN/IN_PROGRESS/ANSWERED/RESOLVED/CLOSED) маппятся
 * чистой функцией `ticketViewStatus`.
 */
export type TicketViewStatus = 'OPEN' | 'WAITING_STUDENT' | 'RESOLVED';

export const TICKET_VIEW_STATUS_LABELS: Record<TicketViewStatus, string> = {
  OPEN: 'Открыто',
  WAITING_STUDENT: 'Ждём вас',
  RESOLVED: 'Решено',
};

export const TICKET_VIEW_STATUS_TONES: Record<TicketViewStatus, string> = {
  OPEN: 'bg-blue-50 text-blue-700 border-blue-200',
  WAITING_STUDENT: 'bg-amber-50 text-amber-700 border-amber-200',
  RESOLVED: 'bg-green-50 text-green-700 border-green-200',
};

/** OPEN/IN_PROGRESS → «Открыто», ANSWERED → «Ждём вас», RESOLVED/CLOSED → «Решено». */
export function ticketViewStatus(status: TicketStatus): TicketViewStatus {
  switch (status) {
    case 'ANSWERED':
      return 'WAITING_STUDENT';
    case 'RESOLVED':
    case 'CLOSED':
      return 'RESOLVED';
    case 'OPEN':
    case 'IN_PROGRESS':
      return 'OPEN';
  }
}

/** Подпись роли сотрудника в чате (дословно из задачи). */
export const MANAGER_ROLE_LABEL = 'Менеджер программы';

/** Обещание срока ответа — на списке и в чате (дословно из задачи). */
export const RESPONSE_PROMISE = 'Обычно отвечаем в течение 1 рабочего дня';

/** Заголовок блока подсказок FAQ перед отправкой (дословно из задачи). */
export const FAQ_HINT_TITLE = 'Возможно, это ответ на ваш вопрос';

/** Лимиты вложений: до 3 файлов, каждый до 5 МБ (байты не хранятся). */
export const MAX_TICKET_ATTACHMENTS = 3;
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const MAX_ATTACHMENT_NAME_LENGTH = 80;

const timeFormatter = new Intl.DateTimeFormat('ru-RU', {
  hour: '2-digit',
  minute: '2-digit',
});

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
});

const sameCalendarDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const calendarDayBefore = (later: Date, earlier: Date): boolean => {
  const prev = new Date(later);
  prev.setDate(prev.getDate() - 1);
  return sameCalendarDay(prev, earlier);
};

/**
 * Время в списке и чате: сегодня → «ЧЧ:ММ», вчера → «Вчера»,
 * иначе — дата («3 нояб.»).
 */
export function formatTicketTime(value: Date, now: Date = new Date()): string {
  if (sameCalendarDay(value, now)) return timeFormatter.format(value);
  if (calendarDayBefore(now, value)) return 'Вчера';
  return dateFormatter.format(value);
}

/** Свёртка пробелов + обрезка с многоточием (последний ответ в списке). */
export function shortPreview(text: string, max = 64): string {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  if (collapsed.length === 0) return '';
  if (collapsed.length <= max) return collapsed;
  return `${collapsed.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}
