// DIG-12 — human-readable labels for request fields (RU) and badge tones.
// Pure mapping, no React — shared by the list page, the detail page and the
// future staff screens.
//
// DIG-32 — единый словарь статусов: метки канона берутся напрямую из
// машины состояний (lib/request-machine — один источник правды), экраны
// DIG-32+ рендерят только их. Легаси-метки (NEEDS_REVISION / COMPLETED,
// мир prisma-сидов DIG-10) остаются в записи для старых экранов, но в
// экран «Мои заявки» эти значения не попадают: unifyRequestStatus
// отображает их на канон (lib/requests-view.ts).

import { CANONICAL_REQUEST_STATUS_LABELS } from '@/lib/request-machine';
import type { RequestStatus, RequestType } from '@/server/data/types';

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  ...CANONICAL_REQUEST_STATUS_LABELS,
  // Легаси-значения — только для миров до DIG-32 (prisma-сиды).
  NEEDS_REVISION: 'Требует правок',
  COMPLETED: 'Выполнена',
};

export const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  CERTIFICATE: 'Справка',
  STATEMENT: 'Заявление',
  PRACTICE: 'Практика',
  DORMITORY: 'Общежитие',
  OTHER: 'Другое',
};

export const REQUEST_STATUS_TONES: Record<RequestStatus, string> = {
  SUBMITTED: 'bg-blue-50 text-blue-700 border-blue-200',
  ACCEPTED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  IN_PROGRESS: 'bg-amber-50 text-amber-700 border-amber-200',
  READY: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  ISSUED: 'bg-green-50 text-green-700 border-green-200',
  NEEDS_FIX: 'bg-orange-50 text-orange-700 border-orange-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
  CANCELLED: 'bg-neutral-100 text-neutral-600 border-neutral-200',
  // Легаси-тона (см. выше) — до миграции старых экранов.
  NEEDS_REVISION: 'bg-orange-50 text-orange-700 border-orange-200',
  COMPLETED: 'bg-green-50 text-green-700 border-green-200',
};

const dateTimeFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatRequestDate(value: Date): string {
  return dateTimeFormatter.format(value);
}
