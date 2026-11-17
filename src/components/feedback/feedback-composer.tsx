'use client';

// DIG-40 — композер нового обращения канала «Обратная связь»: тип
// (Предложение / Жалоба / Благодарность), адресат (Деканат / Учебный офис /
// Руководство программы / Руководство вуза), текст, вложения (до 3 файлов,
// до 5 МБ) и переключатель «Анонимно» с объяснением, что увидит адресат.
// Server action createFeedbackAction при успехе делает redirect: подписанное
// обращение — в карточку с номером и сроком ответа, анонимное — на
// подтверждение по номеру (без связи с пользователем, приёмка DIG-40).

import { useActionState, useState } from 'react';
import { t, type Locale } from '@/lib/i18n';

import { createFeedbackAction, type FeedbackActionState } from '@/server/actions/feedback';
import {
  ANONYMOUS_EXPLANATION_OFF,
  ANONYMOUS_EXPLANATION_ON,
  FEEDBACK_KINDS,
  FEEDBACK_KIND_LABELS,
  FEEDBACK_RESPONSE_PROMISE,
  FEEDBACK_TARGETS,
  FEEDBACK_TARGET_LABELS,
  MAX_FEEDBACK_ATTACHMENT_BYTES,
  MAX_FEEDBACK_ATTACHMENTS,
} from '@/lib/feedback';
import type { FeedbackKind, FeedbackTarget } from '@/server/data/types';

const buttonClass =
  'inline-flex select-none items-center justify-center gap-2 rounded-button bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground shadow-soft transition-colors hover:bg-accent-strong disabled:pointer-events-none disabled:opacity-50';

export function FeedbackComposer({ locale = 'ru' }: { locale?: Locale }) {
  const [state, formAction, isPending] = useActionState<FeedbackActionState, FormData>(
    createFeedbackAction,
    null,
  );
  const [anonymous, setAnonymous] = useState(false);

  return (
    <section
      data-testid="feedback-composer"
      aria-label="Новое обращение"
      className="flex min-w-0 flex-col gap-3"
    >
      <h2 id="new-feedback" className="text-base font-semibold">
        Новое обращение
      </h2>
      <p className="text-xs text-muted-foreground">{FEEDBACK_RESPONSE_PROMISE}</p>

      <form
        action={formAction}
        data-testid="feedback-composer-form"
        className="flex flex-col gap-3 rounded-card border border-border bg-card p-4 shadow-soft"
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Тип обращения</span>
          <select
            name="kind"
            data-testid="feedback-kind"
            defaultValue="SUGGESTION"
            className="rounded-button border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-coral-600"
          >
            {FEEDBACK_KINDS.map((value: FeedbackKind) => (
              <option key={value} value={value}>
                {FEEDBACK_KIND_LABELS[value]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Кому</span>
          <select
            name="target"
            data-testid="feedback-target"
            defaultValue="DEANERY"
            className="rounded-button border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-coral-600"
          >
            {FEEDBACK_TARGETS.map((value: FeedbackTarget) => (
              <option key={value} value={value}>
                {FEEDBACK_TARGET_LABELS[value]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Текст обращения</span>
          <textarea
            name="text"
            data-testid="feedback-text"
            rows={4}
            required
            maxLength={2000}
            placeholder="Что предложить, что исправить или за что поблагодарить — чем конкретнее, тем быстрее решение"
            className="rounded-button border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-coral-600"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">
            Вложения (до {MAX_FEEDBACK_ATTACHMENTS} файлов, каждый до{' '}
            {Math.round(MAX_FEEDBACK_ATTACHMENT_BYTES / (1024 * 1024))} МБ)
          </span>
          <input
            type="file"
            name="attachments"
            multiple
            data-testid="feedback-attachments"
            className="rounded-button border border-border bg-card px-3 py-2 text-sm file:mr-3 file:rounded-button file:border-0 file:bg-muted file:px-3 file:py-1 file:text-sm"
          />
        </label>

        {/* Переключатель «Анонимно»: чекбокс формы — работает и без JS.
            Рядом объяснение, что увидит адресат (меняется по состоянию). */}
        <div className="flex flex-col gap-1">
          <label
            htmlFor="feedback-anonymous-switch"
            className="flex cursor-pointer items-center gap-3 text-sm font-medium"
          >
            <input
              id="feedback-anonymous-switch"
              type="checkbox"
              name="anonymous"
              data-testid="feedback-anonymous"
              checked={anonymous}
              onChange={(event) => setAnonymous(event.target.checked)}
              className="sr-only"
            />
            <span
              aria-hidden="true"
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-pill border transition-colors has-focus-visible:outline-2 has-focus-visible:outline-coral-600 ${
                anonymous ? 'gradient-brand border-transparent' : 'border-border bg-muted'
              }`}
            >
              <span
                className={`inline-block size-4 rounded-pill border bg-white shadow-soft transition-transform ${
                  anonymous ? 'translate-x-6 border-transparent' : 'translate-x-1 border-border'
                }`}
              />
            </span>
            Анонимно
          </label>
          <p data-testid="feedback-anonymous-note" className="text-xs text-muted-foreground">
            {anonymous ? ANONYMOUS_EXPLANATION_ON : ANONYMOUS_EXPLANATION_OFF}
          </p>
        </div>

        <button type="submit" disabled={isPending} className={buttonClass}>
          {isPending ? t(locale, 'btn.submitting') : t(locale, 'btn.sendFeedback')}
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
