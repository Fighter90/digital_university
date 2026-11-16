// DIG-39 — статус обращения: ровно три видимых значения из задачи
// («Открыто» / «Ждём вас» / «Решено»); маппинг канонической схемы — в
// lib/tickets (чистая функция, закреплена тестом).
import type { TicketStatus } from '@/server/data/types';
import {
  TICKET_VIEW_STATUS_LABELS,
  TICKET_VIEW_STATUS_TONES,
  ticketViewStatus,
} from '@/lib/tickets';

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  const view = ticketViewStatus(status);
  return (
    <span
      data-testid="ticket-status"
      className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${TICKET_VIEW_STATUS_TONES[view]}`}
    >
      {TICKET_VIEW_STATUS_LABELS[view]}
    </span>
  );
}
