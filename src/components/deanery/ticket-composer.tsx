'use client';

// DIG-39 — композер нового обращения: тема из фиксированного списка,
// текст, вложения (до 3 файлов, до 5 МБ), привязка к своей заявке и
// дисциплине своей группы. Пока студент набирает текст — подсказки статей
// FAQ: «Возможно, это ответ на ваш вопрос» (подбор в src/lib/faq-suggest,
// чистая функция без сервера). Server action createTicketAction при успехе
// делает redirect в чат нового обращения.

import { useActionState, useMemo, useState } from 'react';

import { createTicketAction, type TicketActionState } from '@/server/actions/deanery';
import {
  FAQ_HINT_TITLE,
  MAX_ATTACHMENT_BYTES,
  MAX_TICKET_ATTACHMENTS,
  RESPONSE_PROMISE,
  TICKET_SUBJECT_LABELS,
  TICKET_SUBJECTS,
} from '@/lib/tickets';
import { suggestFaqArticles } from '@/lib/faq-suggest';
import type { TicketSubject } from '@/server/data/types';

export interface TicketComposerProps {
  requests: Array<{ number: string; title: string }>;
  disciplines: Array<{ code: string; name: string }>;
  /** Стартовый текст — используется в тестах контракта подсказок. */
  initialBody?: string;
  initialSubject?: TicketSubject;
}

const buttonClass =
  'inline-flex select-none items-center justify-center gap-2 rounded-button bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground shadow-soft transition-colors hover:bg-accent-strong disabled:pointer-events-none disabled:opacity-50';

export function TicketComposer({
  requests,
  disciplines,
  initialBody = '',
  initialSubject,
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
      aria-label="Новое обращение"
      className="flex min-w-0 flex-col gap-3"
    >
      <h2 id="new-ticket" className="text-base font-semibold">
        Новое обращение
      </h2>
      <p className="text-xs text-muted-foreground">{RESPONSE_PROMISE}</p>

      <form
        action={formAction}
        data-testid="deanery-composer-form"
        className="flex flex-col gap-3 rounded-card border border-border bg-card p-4 shadow-soft"
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Тема</span>
          <select
            name="subject"
            data-testid="ticket-subject"
            value={subject}
            onChange={(event) => setSubject(event.target.value as TicketSubject)}
            className="rounded-button border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-coral-600"
          >
            {TICKET_SUBJECTS.map((value) => (
              <option key={value} value={value}>
                {TICKET_SUBJECT_LABELS[value]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Сообщение</span>
          <textarea
            name="body"
            data-testid="ticket-body"
            rows={4}
            required
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Опишите вопрос — чем подробнее, тем быстрее ответ"
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
            <p className="text-sm font-semibold text-amber-900">{FAQ_HINT_TITLE}</p>
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
            Вложения (до {MAX_TICKET_ATTACHMENTS} файлов, каждый до{' '}
            {Math.round(MAX_ATTACHMENT_BYTES / (1024 * 1024))} МБ)
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
            <span className="font-medium">Привязать к заявке (необязательно)</span>
            <select
              name="requestNumber"
              data-testid="ticket-request"
              className="rounded-button border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-coral-600"
            >
              <option value="">Без привязки</option>
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
            <span className="font-medium">Привязать к дисциплине (необязательно)</span>
            <select
              name="disciplineCode"
              data-testid="ticket-discipline"
              className="rounded-button border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-coral-600"
            >
              <option value="">Без привязки</option>
              {disciplines.map((discipline) => (
                <option key={discipline.code} value={discipline.code}>
                  {discipline.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <button type="submit" disabled={isPending} className={buttonClass}>
          {isPending ? 'Отправляем…' : 'Создать обращение'}
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
