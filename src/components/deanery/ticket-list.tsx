// DIG-39 — список обращений (левая панель): тема, номер, статус, последний
// ответ, время. Непрочитанный ответ менеджера — точкой. Данные приходят из
// getDeaneryPage (owner-scoped): в списке физически не может быть чужого
// обращения. Вариант `variant="aside"` — список в левой панели чата.
import Link from 'next/link';
import { MessageSquarePlus, MessagesSquare } from 'lucide-react';

import { EmptyState } from '@/components/ui/empty-state';
import { TicketStatusBadge } from '@/components/deanery/ticket-status-badge';
import { TICKET_SUBJECT_LABELS, formatTicketTime, shortPreview } from '@/lib/tickets';
import type { TicketListItem } from '@/server/data';

export function TicketList({
  tickets,
  variant = 'page',
}: {
  tickets: TicketListItem[];
  variant?: 'page' | 'aside';
}) {
  if (tickets.length === 0) {
    return (
      <section data-testid="deanery-list" aria-label="Обращения">
        <EmptyState
          icon={MessagesSquare}
          title="Обращений пока нет"
          description="Создайте обращение — менеджер программы ответит здесь, в кабинете."
        />
      </section>
    );
  }

  return (
    <section
      data-testid="deanery-list"
      aria-label="Обращения"
      className={variant === 'aside' ? 'flex min-w-0 flex-col' : 'flex min-w-0 flex-col gap-3'}
    >
      <h2 className={variant === 'aside' ? 'sr-only' : 'text-base font-semibold'}>Мои обращения</h2>
      <ul className="flex flex-col gap-3">
        {tickets.map((ticket) => (
          <li key={ticket.id}>
            <Link
              href={`/deanery/${ticket.number}`}
              data-testid={`deanery-ticket-${ticket.number}`}
              className="relative block rounded-card border border-border bg-card p-4 shadow-soft transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-coral-600"
            >
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-xs text-muted-foreground">{ticket.number}</span>
                <TicketStatusBadge status={ticket.status} />
              </div>
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <span className="min-w-0 truncate">{TICKET_SUBJECT_LABELS[ticket.subject]}</span>
                {ticket.unreadStaffCount > 0 ? (
                  <span
                    data-testid="ticket-unread"
                    role="img"
                    aria-label="Есть непрочитанный ответ"
                    className="size-2 shrink-0 rounded-full bg-coral-500"
                  />
                ) : null}
              </p>
              {ticket.lastMessage ? (
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {ticket.lastMessage.authorRole === 'STAFF' ? 'Менеджер: ' : 'Вы: '}
                  {shortPreview(ticket.lastMessage.body, 48)}
                </p>
              ) : null}
              <p className="mt-1 text-xs text-muted-foreground">
                {formatTicketTime(ticket.lastMessage?.createdAt ?? ticket.updatedAt)}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Кнопка «Новое обращение» левой панели чата (десктоп ≥1024 px). */
export function NewTicketLink() {
  return (
    <Link
      href="/deanery#new-ticket"
      data-testid="deanery-new-ticket"
      className="inline-flex select-none items-center justify-center gap-2 rounded-button border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground shadow-soft transition-colors hover:bg-muted"
    >
      <MessageSquarePlus aria-hidden="true" className="size-4" />
      Новое обращение
    </Link>
  );
}
