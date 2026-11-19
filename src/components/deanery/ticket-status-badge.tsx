// DIG-39 — статус обращения: ровно три видимых значения из задачи
// («Открыто» / «Ждём вас» / «Решено»); маппинг канонической схемы — в
// lib/tickets (чистая функция, закреплена тестом).
import type { TicketStatus } from '@/server/data/types';
import {
  TICKET_VIEW_STATUS_TONES,
  ticketViewStatus,
  ticketViewStatusLabel,
} from '@/lib/tickets';
import type { Locale } from '@/lib/i18n';

export function TicketStatusBadge({
  status,
  locale = 'ru',
}: {
  status: TicketStatus;
  /** DIG-89 — локаль интерфейса (cookie du-locale, дефолт ru). */
  locale?: Locale;
}) {
  const view = ticketViewStatus(status);
  return (
    <span
      data-testid="ticket-status"
      className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${TICKET_VIEW_STATUS_TONES[view]}`}
    >
      {ticketViewStatusLabel(view, locale)}
    </span>
  );
}
