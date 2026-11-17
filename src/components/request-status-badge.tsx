// DIG-12 — status badge for service requests.
// DIG-69 — подпись статуса по локали (RU — прежние метки байт-в-байт).
import type { RequestStatus } from '@/server/data/types';
import { REQUEST_STATUS_LABELS, REQUEST_STATUS_TONES } from '@/lib/request-labels';
import { requestStatusLabel } from '@/lib/i18n';

export function RequestStatusBadge({
  status,
  locale = 'ru',
}: {
  status: RequestStatus;
  locale?: 'ru' | 'en';
}) {
  return (
    <span
      className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${REQUEST_STATUS_TONES[status]}`}
    >
      {locale === 'en' ? requestStatusLabel(locale, status) : REQUEST_STATUS_LABELS[status]}
    </span>
  );
}
