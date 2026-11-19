// DIG-39 — список обращений (левая панель): тема, номер, статус, последний
// ответ, время. Непрочитанный ответ менеджера — точкой. Данные приходят из
// getDeaneryPage (owner-scoped): в списке физически не может быть чужого
// обращения. Вариант `variant="aside"` — список в левой панели чата.
import Link from 'next/link';
import { MessageSquarePlus, MessagesSquare } from 'lucide-react';

import { EmptyState } from '@/components/ui/empty-state';
import { TicketStatusBadge } from '@/components/deanery/ticket-status-badge';
import {
  TICKET_SUBJECT_LABELS,
  formatTicketTime,
  shortPreview,
  ticketSubjectLabel,
} from '@/lib/tickets';
import { enTicketMessage } from '@/lib/en-demo-content';
import { t, type Locale } from '@/lib/i18n';
import type { TicketListItem } from '@/server/data';

// DIG-89 — время сообщения по локали: RU — канон formatTicketTime
// (байт-в-байт прежний рендер), EN — те же правила на английском:
// сегодня → «HH:MM», вчера → Yesterday, иначе короткая дата «Nov 16».
const EN_TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  hour: '2-digit',
  minute: '2-digit',
});

const EN_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'short',
});

const sameCalendarDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const calendarDayBefore = (later: Date, earlier: Date): boolean => {
  const prev = new Date(later);
  prev.setDate(prev.getDate() - 1);
  return sameCalendarDay(prev, earlier);
};

function formatTicketTimeLocalized(value: Date, locale: Locale, now?: Date): string {
  if (locale === 'ru') return formatTicketTime(value, now);
  const current = now ?? new Date();
  if (sameCalendarDay(value, current)) return EN_TIME_FORMATTER.format(value);
  if (calendarDayBefore(current, value)) return t(locale, 'deanery.time.yesterday');
  return EN_DATE_FORMATTER.format(value);
}

export function TicketList({
  tickets,
  variant = 'page',
  locale = 'ru',
}: {
  tickets: TicketListItem[];
  variant?: 'page' | 'aside';
  /** DIG-89 — локаль интерфейса (cookie du-locale, дефолт ru). */
  locale?: Locale;
}) {
  if (tickets.length === 0) {
    return (
      <section data-testid="deanery-list" aria-label={t(locale, 'deanery.list.aria')}>
        <EmptyState
          icon={MessagesSquare}
          title={t(locale, 'deanery.list.emptyTitle')}
          description={t(locale, 'deanery.list.emptyDesc')}
        />
      </section>
    );
  }

  return (
    <section
      data-testid="deanery-list"
      aria-label={t(locale, 'deanery.list.aria')}
      className={variant === 'aside' ? 'flex min-w-0 flex-col' : 'flex min-w-0 flex-col gap-3'}
    >
      <h2 className={variant === 'aside' ? 'sr-only' : 'text-base font-semibold'}>
        {t(locale, 'deanery.list.title')}
      </h2>
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
                <TicketStatusBadge status={ticket.status} locale={locale} />
              </div>
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <span className="min-w-0 truncate">{ticketSubjectLabel(ticket.subject, locale)}</span>
                {ticket.unreadStaffCount > 0 ? (
                  <span
                    data-testid="ticket-unread"
                    role="img"
                    aria-label={t(locale, 'deanery.list.unreadAria')}
                    className="size-2 shrink-0 rounded-full bg-coral-500"
                  />
                ) : null}
              </p>
              {ticket.lastMessage ? (
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {ticket.lastMessage.authorRole === 'STAFF'
                    ? `${t(locale, 'deanery.managerRole')}: `
                    : t(locale, 'deanery.list.youPrefix')}
                  {/* DIG-93 — текст сообщения сида по id (TICKET_MESSAGES_EN);
                      runtime-сообщения студента — как есть. */}
                  {shortPreview(
                    locale === 'en'
                      ? (enTicketMessage(ticket.lastMessage.id) ?? ticket.lastMessage.body)
                      : ticket.lastMessage.body,
                    48,
                  )}
                </p>
              ) : null}
              <p className="mt-1 text-xs text-muted-foreground">
                {formatTicketTimeLocalized(ticket.lastMessage?.createdAt ?? ticket.updatedAt, locale)}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Кнопка «Новое обращение» левой панели чата (десктоп ≥1024 px). */
export function NewTicketLink({ locale = 'ru' }: { locale?: Locale }) {
  return (
    <Link
      href="/deanery#new-ticket"
      data-testid="deanery-new-ticket"
      className="inline-flex select-none items-center justify-center gap-2 rounded-button border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground shadow-soft transition-colors hover:bg-muted"
    >
      <MessageSquarePlus aria-hidden="true" className="size-4" />
      {t(locale, 'deanery.compose.title')}
    </Link>
  );
}
