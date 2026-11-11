// DIG-19 — RU-подписи типов уведомлений и каналов доставки.
// Чистые словари без React — как request-labels.ts (DIG-12).

import type { NotificationChannel, NotificationType } from '@/server/data/types';

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  SCHEDULE: 'Расписание',
  DEADLINE: 'Дедлайны',
  REQUEST: 'Заявки',
  GRADE: 'Оценки',
  NEWS: 'Объявления',
  SYSTEM: 'Системные',
};

/** Типы, настраиваемые пользователем (SYSTEM не показывается в матрице). */
export const NOTIFICATION_SETTING_TYPES: NotificationType[] = [
  'SCHEDULE',
  'DEADLINE',
  'REQUEST',
  'GRADE',
  'NEWS',
];

export const NOTIFICATION_CHANNEL_LABELS: Record<NotificationChannel, string> = {
  PUSH: 'Push',
  EMAIL: 'Email',
  TELEGRAM: 'Telegram',
};
