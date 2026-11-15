// DIG-32 — кнопка перехода статуса студентом (отмена / повторная подача).
//
// Машина состояний DIG-30 разрешает отмену только до IN_PROGRESS, а
// повторную подачу — из NEEDS_FIX: cancelRequestAction /
// resubmitRequestAction строят ctx из живой сессии и проверяют владение
// в слое данных, чужой requestId неотличим от несуществующего.
// Подтверждение — window.confirm, чтобы действие не срабатывало от
// случайного тапа.
'use client';

import { useActionState } from 'react';

import type { RequestActionState } from '@/server/actions/requests';

export interface RequestTransitionButtonProps {
  /** Server action перехода: (prevState, formData) => state. */
  action: (prevState: RequestActionState, formData: FormData) => Promise<RequestActionState>;
  requestId: string;
  label: string;
  pendingLabel: string;
  confirmText?: string;
  testid?: string;
  variant?: 'primary' | 'secondary';
}

export function RequestTransitionButton({
  action,
  requestId,
  label,
  pendingLabel,
  confirmText,
  testid,
  variant = 'secondary',
}: RequestTransitionButtonProps) {
  const [state, formAction, pending] = useActionState<RequestActionState, FormData>(
    action,
    null,
  );

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (confirmText && !window.confirm(confirmText)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="requestId" value={requestId} />
      <button
        type="submit"
        data-testid={testid}
        disabled={pending}
        className={`inline-flex items-center gap-1.5 rounded-button px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-coral-600 disabled:opacity-60 ${
          variant === 'primary'
            ? 'bg-coral-600 text-white shadow-soft hover:bg-coral-500'
            : 'border border-border bg-card text-foreground hover:bg-muted'
        }`}
      >
        {pending ? pendingLabel : label}
      </button>
      {state && !state.ok ? (
        <p role="alert" className="mt-1.5 text-xs text-error-ink">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
