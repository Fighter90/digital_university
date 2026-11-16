// DIG-19 — RU-подписи типов уведомлений и каналов доставки.
// Чистые словари без React — как request-labels.ts (DIG-12).
// DIG-39 — тип TICKET («Обращения») — уведомление о новом сообщении
// менеджера в чате обращения; настраивается в матрице как остальные типы.

import type { NotificationChannel, NotificationType } from '@/server/data/types';

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  SCHEDULE: 'Расписание',
  DEADLINE: 'Дедлайны',
  REQUEST: 'Заявки',
  GRADE: 'Оценки',
  NEWS: 'Объявления',
  TICKET: 'Обращения',
  SYSTEM: 'Системные',
};

/** Типы, настраиваемые пользователем (SYSTEM не показывается в матрице). */
export const NOTIFICATION_SETTING_TYPES: NotificationType[] = [
  'SCHEDULE',
  'DEADLINE',
  'REQUEST',
  'GRADE',
  'NEWS',
  'TICKET',
];

export const NOTIFICATION_CHANNEL_LABELS: Record<NotificationChannel, string> = {
  PUSH: 'В кабинете',
  EMAIL: 'Email',
  TELEGRAM: 'Telegram',
};
