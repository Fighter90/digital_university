// DIG-33 — «Задать вопрос по заявке»: обращение в деканат с привязкой
// к номеру (тема строит слой данных: «Вопрос по заявке ЗД-…», вопрос —
// в первом сообщении). <details> работает и без JS (прогрессивное
// улучшение, как формы профиля); владение проверяет сервер.
'use client';

import { useActionState } from 'react';
import { t, type Locale } from '@/lib/i18n';
import { MessageCircleQuestion } from 'lucide-react';

import type { RequestQuestionState } from '@/server/actions/requests';

export function RequestQuestionForm({
  requestId,
  action,
  locale = 'ru',
}: {
  requestId: string;
  action: (prevState: RequestQuestionState, formData: FormData) => Promise<RequestQuestionState>;
  /** DIG-69 — локаль интерфейса (cookie du-locale, дефолт ru). */
  locale?: Locale;
}) {
  const [state, formAction, pending] = useActionState<RequestQuestionState, FormData>(action, null);

  return (
    <details className="mt-3">
      <summary
        data-testid="request-question-summary"
        className="inline-flex cursor-pointer select-none items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-coral-600"
      >
        <MessageCircleQuestion aria-hidden="true" className="size-4" />
        {t(locale, 'requests.question.summary')}
      </summary>
      <form action={formAction} className="mt-2 rounded-button border border-border bg-card p-3">
        <input type="hidden" name="requestId" value={requestId} />
        <label
          htmlFor="request-question-message"
          className="block text-xs font-semibold text-foreground"
        >
          {t(locale, 'requests.question.label')}
        </label>
        <textarea
          id="request-question-message"
          name="message"
          rows={3}
          maxLength={500}
          required
          data-testid="request-question-message"
          placeholder={t(locale, 'requests.question.placeholder')}
          className="mt-1.5 w-full resize-y rounded-button border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-coral-600"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={pending}
            data-testid="request-question-submit"
            className="rounded-button border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-coral-600 disabled:opacity-60"
          >
            {pending ? t(locale, 'btn.submitting') : t(locale, 'btn.askQuestion')}
          </button>
          {state && !state.ok ? (
            <p role="alert" className="text-xs text-error-ink">
              {state.error}
            </p>
          ) : null}
          {state && state.ok ? (
            <p
              data-testid="request-question-success"
              role="status"
              className="text-xs text-success-ink"
            >
              {t(locale, 'requests.question.success')}
            </p>
          ) : null}
        </div>
      </form>
    </details>
  );
}
