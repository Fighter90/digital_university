'use client';

// DIG-68 — форма комментария на карточке проекта /msp/<slug>. projectId едет
// скрытым полем, владелец комментария — всегда сессия (проверяет слой
// данных: сотруднику отказ, несуществующий проект — NOT_FOUND с аудитом).
// Прогрессивное улучшение: работает и без JS (server action).
import { useActionState } from 'react';

import { addMspCommentAction, type MspActionState } from '@/server/actions/msp';
import { MAX_MSP_COMMENT_LENGTH } from '@/server/data';

export function MspCommentForm({ projectId }: { projectId: string }) {
  const [state, formAction, isPending] = useActionState<MspActionState, FormData>(
    addMspCommentAction,
    null,
  );

  return (
    <form
      action={formAction}
      data-testid="msp-comment-form"
      className="mt-3 flex flex-col gap-2 rounded-card border border-border bg-card p-4 shadow-soft"
    >
      {/* projectId уходит в action; скоуп автора проверяет слой данных. */}
      <input type="hidden" name="projectId" value={projectId} />
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Ваш комментарий</span>
        <textarea
          name="body"
          rows={3}
          required
          maxLength={MAX_MSP_COMMENT_LENGTH}
          placeholder="Поддержите запуск, задайте вопрос или предложите идею"
          className="rounded-button border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-coral-600"
        />
      </label>
      <button
        type="submit"
        disabled={isPending}
        className="inline-flex select-none items-center justify-center self-start gap-2 rounded-button bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground shadow-soft transition-colors hover:bg-accent-strong disabled:pointer-events-none disabled:opacity-50"
      >
        {isPending ? 'Отправляем…' : 'Отправить'}
      </button>
      {state?.error ? (
        <p role="alert" className="text-sm font-medium text-error-ink">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
