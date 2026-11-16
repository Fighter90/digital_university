// DIG-39 — чат обращения: сообщения студента и менеджера (аватар, ФИО,
// подпись «Менеджер программы»), вложения (имена файлов), время каждого
// сообщения и статус «Прочитано» на репликах студента, увиденных
// менеджером. Серверный компонент — данные из openTicketChat (owner-scoped).
import { Paperclip } from 'lucide-react';

import { Avatar } from '@/components/ui/avatar';
import { TicketStatusBadge } from '@/components/deanery/ticket-status-badge';
import {
  MANAGER_ROLE_LABEL,
  RESPONSE_PROMISE,
  TICKET_SUBJECT_LABELS,
  formatTicketTime,
} from '@/lib/tickets';
import type { TicketChatData } from '@/server/data';

function MessageAttachments({ names }: { names: string[] }) {
  if (names.length === 0) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-2">
      {names.map((name) => (
        <li
          key={name}
          data-testid="ticket-attachment"
          className="inline-flex max-w-full items-center gap-1.5 rounded-pill border border-border bg-muted px-2.5 py-1 text-xs text-muted-foreground"
        >
          <Paperclip aria-hidden="true" className="size-3 shrink-0" />
          <span className="truncate">{name}</span>
        </li>
      ))}
    </ul>
  );
}

export function TicketChat({ chat }: { chat: TicketChatData }) {
  const { ticket, messages } = chat;
  const now = new Date();

  return (
    <section aria-label={`Обращение ${ticket.number}`} className="flex min-w-0 flex-col">
      <header className="mb-4">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-xs text-muted-foreground">{ticket.number}</span>
          <span data-testid="ticket-chat-status">
            <TicketStatusBadge status={ticket.status} />
          </span>
        </div>
        <h1 className="text-xl font-bold tracking-heading sm:text-2xl">
          {TICKET_SUBJECT_LABELS[ticket.subject]}
        </h1>
        <p data-testid="deanery-chat-sla" className="mt-1 text-sm text-muted-foreground">
          {RESPONSE_PROMISE}
        </p>
        {ticket.requestNumber ? (
          <p className="mt-0.5 text-xs text-muted-foreground">
            Заявка: <span className="font-mono">{ticket.requestNumber}</span>
          </p>
        ) : null}
        {ticket.disciplineCode ? (
          <p className="mt-0.5 text-xs text-muted-foreground">
            Дисциплина: <span className="font-mono">{ticket.disciplineCode}</span>
          </p>
        ) : null}
      </header>

      <ol data-testid="ticket-chat" className="flex flex-col gap-4">
        {messages.map((message) => {
          const isStaff = message.authorRole === 'STAFF';
          return (
            <li
              key={message.id}
              data-testid={`ticket-message-${message.id}`}
              className={isStaff ? 'flex gap-3' : 'flex flex-row-reverse gap-3'}
            >
              <Avatar name={message.authorName} size="sm" className="mt-1 shrink-0" />
              <div
                className={`min-w-0 max-w-[85%] rounded-card border p-3 sm:max-w-[75%] ${
                  isStaff ? 'border-border bg-card' : 'border-accent-soft bg-accent-soft/40'
                }`}
              >
                <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <span className="text-sm font-semibold text-foreground">
                    {message.authorName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatTicketTime(message.createdAt, now)}
                  </span>
                </div>
                {isStaff ? (
                  <p className="mb-1 text-xs font-medium text-accent-ink">{MANAGER_ROLE_LABEL}</p>
                ) : null}
                <p className="whitespace-pre-line text-sm text-foreground">{message.body}</p>
                <MessageAttachments names={message.attachments} />
                {!isStaff ? (
                  <p
                    data-testid={message.readAt ? 'message-read' : 'message-sent'}
                    className={`mt-1.5 text-right text-xs ${
                      message.readAt ? 'text-accent-ink' : 'text-muted-foreground'
                    }`}
                  >
                    {message.readAt ? 'Прочитано' : 'Отправлено'}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
