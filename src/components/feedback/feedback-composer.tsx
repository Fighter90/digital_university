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
  FEEDBACK_KINDS,
  FEEDBACK_TARGETS,
  MAX_FEEDBACK_ATTACHMENT_BYTES,
  MAX_FEEDBACK_ATTACHMENTS,
  feedbackAnonymousHint,
  feedbackResponsePromise,
  feedbackTargetLabel,
  feedbackTypeLabel,
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
      aria-label={t(locale, 'feedback.compose.aria')}
      className="flex min-w-0 flex-col gap-3"
    >
      <h2 id="new-feedback" className="text-base font-semibold">
        {t(locale, 'feedback.compose.title')}
      </h2>
      <p className="text-xs text-muted-foreground">{feedbackResponsePromise(locale)}</p>

      <form
        action={formAction}
        data-testid="feedback-composer-form"
        className="flex flex-col gap-3 rounded-card border border-border bg-card p-4 shadow-soft"
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t(locale, 'feedback.compose.type')}</span>
          <select
            name="kind"
            data-testid="feedback-kind"
            defaultValue="SUGGESTION"
            className="rounded-button border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-coral-600"
          >
            {FEEDBACK_KINDS.map((value: FeedbackKind) => (
              <option key={value} value={value}>
                {feedbackTypeLabel(value, locale)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t(locale, 'feedback.compose.target')}</span>
          <select
            name="target"
            data-testid="feedback-target"
            defaultValue="DEANERY"
            className="rounded-button border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-coral-600"
          >
            {FEEDBACK_TARGETS.map((value: FeedbackTarget) => (
              <option key={value} value={value}>
                {feedbackTargetLabel(value, locale)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t(locale, 'feedback.compose.text')}</span>
          <textarea
            name="text"
            data-testid="feedback-text"
            rows={4}
            required
            maxLength={2000}
            placeholder={t(locale, 'feedback.compose.placeholder')}
            className="rounded-button border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-coral-600"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">
            {t(locale, 'feedback.compose.attachments', {
              files: MAX_FEEDBACK_ATTACHMENTS,
              size: Math.round(MAX_FEEDBACK_ATTACHMENT_BYTES / (1024 * 1024)),
            })}
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
            {t(locale, 'feedback.anon.label')}
          </label>
          <p data-testid="feedback-anonymous-note" className="text-xs text-muted-foreground">
            {feedbackAnonymousHint(anonymous, locale)}
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
