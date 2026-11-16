// DIG-33 — «Задать вопрос по заявке»: обращение в деканат с привязкой
// к номеру (тема строит слой данных: «Вопрос по заявке ЗД-…», вопрос —
// в первом сообщении). <details> работает и без JS (прогрессивное
// улучшение, как формы профиля); владение проверяет сервер.
'use client';

import { useActionState } from 'react';
import { MessageCircleQuestion } from 'lucide-react';

import type { RequestQuestionState } from '@/server/actions/requests';

export function RequestQuestionForm({
  requestId,
  action,
}: {
  requestId: string;
  action: (prevState: RequestQuestionState, formData: FormData) => Promise<RequestQuestionState>;
}) {
  const [state, formAction, pending] = useActionState<RequestQuestionState, FormData>(action, null);

  return (
    <details className="mt-3">
      <summary
        data-testid="request-question-summary"
        className="inline-flex cursor-pointer select-none items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-coral-600"
      >
        <MessageCircleQuestion aria-hidden="true" className="size-4" />
        Задать вопрос по заявке
      </summary>
      <form action={formAction} className="mt-2 rounded-button border border-border bg-card p-3">
        <input type="hidden" name="requestId" value={requestId} />
        <label
          htmlFor="request-question-message"
          className="block text-xs font-semibold text-foreground"
        >
          Вопрос деканату
        </label>
        <textarea
          id="request-question-message"
          name="message"
          rows={3}
          maxLength={500}
          required
          data-testid="request-question-message"
          placeholder="Сформулируйте вопрос — номер заявки приложится автоматически"
          className="mt-1.5 w-full resize-y rounded-button border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-coral-600"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={pending}
            data-testid="request-question-submit"
            className="rounded-button border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-coral-600 disabled:opacity-60"
          >
            {pending ? 'Отправляем…' : 'Отправить вопрос'}
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
              Обращение создано — деканат ответит в уведомлениях
            </p>
          ) : null}
        </div>
      </form>
    </details>
  );
}
