// DIG-32 — отмена заявки студентом из списка «Мои заявки».
//
// Машина состояний DIG-30 разрешает отмену только до IN_PROGRESS
// (SUBMITTED / ACCEPTED / NEEDS_FIX → CANCELLED) и только владельцу:
// cancelRequestAction строит ctx из живой сессии и проверяет владение
// в слое данных, чужой requestId неотличим от несуществующего.
// Подтверждение — window.confirm, чтобы заявка не отменялась одним
// случайным тапом по карточке.
'use client';

import { useActionState } from 'react';

import { cancelRequestAction, type RequestActionState } from '@/server/actions/requests';

export function CancelRequestButton({ requestId }: { requestId: string }) {
  const [state, formAction, pending] = useActionState<RequestActionState, FormData>(
    cancelRequestAction,
    null,
  );

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!window.confirm('Отменить заявку? Действие нельзя отменить.')) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="requestId" value={requestId} />
      <button
        type="submit"
        data-testid="request-action-cancel"
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-button border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-coral-600 disabled:opacity-60"
      >
        {pending ? 'Отменяем…' : 'Отменить'}
      </button>
      {state && !state.ok ? (
        <p role="alert" className="mt-1.5 text-xs text-error-ink">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
