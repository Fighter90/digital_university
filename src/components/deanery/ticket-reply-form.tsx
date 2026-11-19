'use client';

// DIG-39 — форма ответа в чате обращения. Номер тикета едет скрытым полем,
// владелец перепроверяется в слое данных (replyToTicket): чужой чат не
// отвечает, а пишет отказ в аудит. Прогрессивное улучшение: форма работает
// и без JS (server action).

import { useActionState } from 'react';
import { t, type Locale } from '@/lib/i18n';

import { replyToTicketAction, type TicketActionState } from '@/server/actions/deanery';
import { MAX_ATTACHMENT_BYTES, MAX_TICKET_ATTACHMENTS } from '@/lib/tickets';

export function TicketReplyForm({
  ticketNumber,
  locale = 'ru',
}: {
  ticketNumber: string;
  /** DIG-69 — локаль интерфейса (cookie du-locale, дефолт ru). */
  locale?: Locale;
}) {
  const [state, formAction, isPending] = useActionState<TicketActionState, FormData>(
    replyToTicketAction,
    null,
  );

  return (
    <form
      action={formAction}
      data-testid="ticket-reply"
      className="mt-4 flex flex-col gap-2 rounded-card border border-border bg-card p-4 shadow-soft"
    >
      {/* Номер обращения уходит в action; скоуп владельца проверяет слой данных. */}
      <input type="hidden" name="ticketNumber" value={ticketNumber} />
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">{t(locale, 'deanery.reply.message')}</span>
        <textarea
          name="body"
          rows={3}
          required
          placeholder={t(locale, 'deanery.reply.placeholder')}
          className="rounded-button border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-coral-600"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        <span>
          {t(locale, 'deanery.reply.attachments', {
            files: MAX_TICKET_ATTACHMENTS,
            size: Math.round(MAX_ATTACHMENT_BYTES / (1024 * 1024)),
          })}
        </span>
        <input
          type="file"
          name="attachments"
          multiple
          data-testid="ticket-reply-attachments"
          className="rounded-button border border-border bg-card px-3 py-2 text-sm file:mr-3 file:rounded-button file:border-0 file:bg-muted file:px-3 file:py-1 file:text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={isPending}
        className="inline-flex select-none items-center justify-center gap-2 rounded-button bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground shadow-soft transition-colors hover:bg-accent-strong disabled:pointer-events-none disabled:opacity-50"
      >
        {isPending ? t(locale, 'btn.submitting') : t(locale, 'btn.submit')}
      </button>
      {state?.error ? (
        <p role="alert" className="text-sm font-medium text-error-ink">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
