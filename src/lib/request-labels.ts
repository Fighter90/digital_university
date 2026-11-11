// DIG-12 — human-readable labels for request fields (RU) and badge tones.
// Pure mapping, no React — shared by the list page, the detail page and the
// future staff screens.

import type { RequestStatus, RequestType } from '@/server/data/types';

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  SUBMITTED: 'Подана',
  IN_PROGRESS: 'В работе',
  NEEDS_REVISION: 'Требует правок',
  COMPLETED: 'Выполнена',
  REJECTED: 'Отклонена',
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
  IN_PROGRESS: 'bg-amber-50 text-amber-700 border-amber-200',
  NEEDS_REVISION: 'bg-orange-50 text-orange-700 border-orange-200',
  COMPLETED: 'bg-green-50 text-green-700 border-green-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
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
