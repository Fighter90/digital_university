// DIG-19 — RU-подписи типов уведомлений и каналов доставки.
// Чистые словари без React — как request-labels.ts (DIG-12).
// DIG-39 — тип TICKET («Обращения») — уведомление о новом сообщении
// менеджера в чате обращения; настраивается в матрице как остальные типы.

import type { NotificationChannel, NotificationType } from '@/server/data/types';
import { t, type Locale } from '@/lib/i18n';

// DIG-89 — подписи по словарю: RU — канон байт-в-байт, EN — английский словарь.
// Прежние литералы перенесены в словарь без изменений (notif.type.*, notif.channel.*).

/** Канонические RU-подписи типов уведомлений (значения из словаря). */
export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  SCHEDULE: t('ru', 'notif.type.SCHEDULE'),
  DEADLINE: t('ru', 'notif.type.DEADLINE'),
  REQUEST: t('ru', 'notif.type.REQUEST'),
  GRADE: t('ru', 'notif.type.GRADE'),
  NEWS: t('ru', 'notif.type.NEWS'),
  TICKET: t('ru', 'notif.type.TICKET'),
  SYSTEM: t('ru', 'notif.type.SYSTEM'),
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
  PUSH: t('ru', 'notif.channel.PUSH'),
  EMAIL: t('ru', 'notif.channel.EMAIL'),
  TELEGRAM: t('ru', 'notif.channel.TELEGRAM'),
};

/** Тип уведомления: «Оценки» / «Grades». */
export function notificationTypeLabel(type: NotificationType, locale: Locale = 'ru'): string {
  if (locale === 'en') return t('en', `notif.type.${type}` as const);
  return NOTIFICATION_TYPE_LABELS[type];
}

/** Канал доставки: «В кабинете» / «In the cabinet». */
export function notificationChannelLabel(channel: NotificationChannel, locale: Locale = 'ru'): string {
  if (locale === 'en') return t('en', `notif.channel.${channel}` as const);
  return NOTIFICATION_CHANNEL_LABELS[channel];
}
