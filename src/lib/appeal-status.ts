// DIG-48 — единые подписи и цвета статусов обращения для экранов
// сотрудника: список (/staff/appeals) и чат (/staff/appeals/[id]),
// чтобы «Отвечено» выглядело одинаково во всех местах кабинета.
import type { AppealStatus } from '@/server/data/types';

export const APPEAL_STATUS_BADGES: Record<AppealStatus, { label: string; cls: string }> = {
  OPEN: { label: 'Новое', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  ANSWERED: { label: 'Отвечено', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  CLOSED: { label: 'Закрыто', cls: 'bg-green-50 text-green-700 border-green-200' },
};
