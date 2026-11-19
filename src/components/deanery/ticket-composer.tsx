'use client';

// DIG-39 — композер нового обращения: тема из фиксированного списка,
// текст, вложения (до 3 файлов, до 5 МБ), привязка к своей заявке и
// дисциплине своей группы. Пока студент набирает текст — подсказки статей
// FAQ: «Возможно, это ответ на ваш вопрос» (подбор в src/lib/faq-suggest,
// чистая функция без сервера). Server action createTicketAction при успехе
// делает redirect в чат нового обращения.

import { useActionState, useMemo, useState } from 'react';
import { t, type Locale } from '@/lib/i18n';

import { createTicketAction, type TicketActionState } from '@/server/actions/deanery';
import {
  MAX_ATTACHMENT_BYTES,
  MAX_TICKET_ATTACHMENTS,
  RESPONSE_PROMISE,
  TICKET_SUBJECTS,
  responsePromise,
  ticketSubjectLabel,
} from '@/lib/tickets';
import { suggestFaqArticles } from '@/lib/faq-suggest';
import type { TicketSubject } from '@/server/data/types';

export interface TicketComposerProps {
  requests: Array<{ number: string; title: string }>;
  disciplines: Array<{ code: string; name: string }>;
  /** Стартовый текст — используется в тестах контракта подсказок. */
  initialBody?: string;
  initialSubject?: TicketSubject;
  /** DIG-69 — локаль интерфейса (cookie du-locale, дефолт ru). */
  locale?: Locale;
}

const buttonClass =
  'inline-flex select-none items-center justify-center gap-2 rounded-button bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground shadow-soft transition-colors hover:bg-accent-strong disabled:pointer-events-none disabled:opacity-50';

export function TicketComposer({
  requests = [],
  disciplines = [],
  initialBody = '',
  initialSubject,
  locale = 'ru',
}: TicketComposerProps) {
  const [state, formAction, isPending] = useActionState<TicketActionState, FormData>(
    createTicketAction,
    null,
  );
  const [body, setBody] = useState(initialBody);
  const [subject, setSubject] = useState<TicketSubject>(initialSubject ?? 'OTHER');

  const hints = useMemo(() => suggestFaqArticles(body, subject), [body, subject]);

  return (
    <section
      data-testid="deanery-composer"
      aria-label={t(locale, 'deanery.compose.aria')}
      className="flex min-w-0 flex-col gap-3"
    >
      <h2 id="new-ticket" className="text-base font-semibold">
        {t(locale, 'deanery.compose.title')}
      </h2>
      <p className="text-xs text-muted-foreground">{responsePromise(locale)}</p>

      <form
        action={formAction}
        data-testid="deanery-composer-form"
        className="flex flex-col gap-3 rounded-card border border-border bg-card p-4 shadow-soft"
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t(locale, 'deanery.compose.subject')}</span>
          <select
            name="subject"
            data-testid="ticket-subject"
            value={subject}
            onChange={(event) => setSubject(event.target.value as TicketSubject)}
            className="rounded-button border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-coral-600"
          >
            {TICKET_SUBJECTS.map((value) => (
              <option key={value} value={value}>
                {ticketSubjectLabel(value, locale)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t(locale, 'deanery.compose.message')}</span>
          <textarea
            name="body"
            data-testid="ticket-body"
            rows={4}
            required
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder={t(locale, 'deanery.compose.placeholder')}
            className="rounded-button border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-coral-600"
          />
        </label>

        {/* Подсказки FAQ по набранному тексту (до трёх статей). */}
        {hints.length > 0 ? (
          <div
            data-testid="faq-hints"
            role="note"
            className="rounded-card border border-amber-200 bg-amber-50 p-3"
          >
            <p className="text-sm font-semibold text-amber-900">
              {t(locale, 'deanery.faqHintTitle')}
            </p>
            <ul className="mt-1.5 flex flex-col gap-1">
              {hints.map((hint) => (
                <li key={hint.id} data-testid="faq-hint" className="text-sm text-amber-900">
                  {hint.title}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">
            {t(locale, 'deanery.compose.attachments', {
              files: MAX_TICKET_ATTACHMENTS,
              size: Math.round(MAX_ATTACHMENT_BYTES / (1024 * 1024)),
            })}
          </span>
          <input
            type="file"
            name="attachments"
            multiple
            data-testid="ticket-attachments"
            className="rounded-button border border-border bg-card px-3 py-2 text-sm file:mr-3 file:rounded-button file:border-0 file:bg-muted file:px-3 file:py-1 file:text-sm"
          />
        </label>

        {requests.length > 0 ? (
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{t(locale, 'deanery.compose.attachRequest')}</span>
            <select
              name="requestNumber"
              data-testid="ticket-request"
              className="rounded-button border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-coral-600"
            >
              <option value="">{t(locale, 'deanery.compose.noLink')}</option>
              {requests.map((request) => (
                <option key={request.number} value={request.number}>
                  {request.number} — {request.title}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {disciplines.length > 0 ? (
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{t(locale, 'deanery.compose.attachDiscipline')}</span>
            <select
              name="disciplineCode"
              data-testid="ticket-discipline"
              className="rounded-button border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-coral-600"
            >
              <option value="">{t(locale, 'deanery.compose.noLink')}</option>
              {disciplines.map((discipline) => (
                <option key={discipline.code} value={discipline.code}>
                  {discipline.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <button type="submit" disabled={isPending} className={buttonClass}>
          {isPending ? t(locale, 'btn.submitting') : t(locale, 'btn.createTicket')}
        </button>
        {state?.error ? (
          <p role="alert" className="text-sm font-medium text-error-ink">
            {state.error}
          </p>
        ) : null}
      </form>
    </section>
  );
}
