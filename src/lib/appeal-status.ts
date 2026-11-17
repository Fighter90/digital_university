// DIG-48 — единые подписи и цвета статусов обращения для экранов
// сотрудника: список (/staff/appeals) и чат (/staff/appeals/[id]),
// чтобы «Отвечено» выглядело одинаково во всех местах кабинета.
import type { AppealStatus } from '@/server/data/types';
import { t } from '@/lib/i18n';

export const APPEAL_STATUS_BADGES: Record<AppealStatus, { label: string; cls: string }> = {
  OPEN: { label: 'Новое', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  ANSWERED: { label: 'Отвечено', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  CLOSED: { label: 'Закрыто', cls: 'bg-green-50 text-green-700 border-green-200' },
};

/**
 * DIG-69 — бейдж статуса обращения по локали. RU — прежние метки и цвета
 * байт-в-байт; EN — словарь i18n, цвета те же.
 */
export function appealStatusBadge(
  locale: 'ru' | 'en',
  status: AppealStatus,
): { label: string; cls: string } {
  const base = APPEAL_STATUS_BADGES[status];
  if (locale === 'ru') return base;
  return { label: t('en', `appeal.${status}`), cls: base.cls };
}
