// DIG-12 — status badge for service requests.
import type { RequestStatus } from '@/server/data/types';
import { REQUEST_STATUS_LABELS, REQUEST_STATUS_TONES } from '@/lib/request-labels';

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  return (
    <span
      className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${REQUEST_STATUS_TONES[status]}`}
    >
      {REQUEST_STATUS_LABELS[status]}
    </span>
  );
}
