// DIG-33 — форма исправления доработки прямо в карточке: студент
// описывает, что исправил, и отправляет заявку повторно
// (NEEDS_FIX → SUBMITTED машиной состояний DIG-30). Комментарий попадает
// в событие истории — приёмка «пишет событие». Владение и переход
// проверяет сервер: resubmitRequestAction строит ctx из живой сессии.
// После успеха — router.refresh(): серверный рендер перечитает заявку.
'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Send } from 'lucide-react';

import type { RequestActionState } from '@/server/actions/requests';

export function RequestFixForm({
  requestId,
  action,
}: {
  requestId: string;
  action: (prevState: RequestActionState, formData: FormData) => Promise<RequestActionState>;
}) {
  const [state, formAction, pending] = useActionState<RequestActionState, FormData>(action, null);
  const router = useRouter();

  const ok = state !== null && state.ok;
  useEffect(() => {
    if (ok) router.refresh();
  }, [ok, router]);

  return (
    <form
      action={formAction}
      data-testid="request-fix-form"
      className="mt-3 rounded-button border border-border bg-card p-3"
    >
      <input type="hidden" name="requestId" value={requestId} />
      <label htmlFor="request-fix-comment" className="block text-xs font-semibold text-foreground">
        Что исправлено
      </label>
      <textarea
        id="request-fix-comment"
        name="comment"
        rows={3}
        maxLength={500}
        data-testid="request-fix-comment"
        placeholder="Например: исправил ФИО латиницей, приложил скан"
        className="mt-1.5 w-full resize-y rounded-button border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-coral-600"
      />
      <div className="mt-2 flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          data-testid="request-resubmit"
          className="inline-flex items-center gap-1.5 rounded-button bg-coral-600 px-4 py-2 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-coral-500 focus-visible:outline-2 focus-visible:outline-coral-600 disabled:opacity-60"
        >
          <Send aria-hidden="true" className="size-4" />
          {pending ? 'Подаём…' : 'Отправить повторно'}
        </button>
        {state && !state.ok ? (
          <p role="alert" className="text-xs text-error-ink">
            {state.error}
          </p>
        ) : null}
        {ok ? (
          <p data-testid="request-fix-success" role="status" className="text-xs text-success-ink">
            Заявка отправлена повторно
          </p>
        ) : null}
      </div>
    </form>
  );
}
