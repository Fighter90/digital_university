// DIG-33 — «Отправить на email» готового документа. Концепт-прототип:
// SMTP не подключается, сервер фиксирует отправку кабинетным
// уведомлением на email профиля и возвращает адрес — он и показывается
// студенту. Владение и готовность проверяет слой данных.
'use client';

import { useActionState } from 'react';
import { Mail } from 'lucide-react';

import type { RequestEmailState } from '@/server/actions/requests';

export function RequestEmailButton({
  number,
  action,
}: {
  number: string;
  action: (prevState: RequestEmailState, formData: FormData) => Promise<RequestEmailState>;
}) {
  const [state, formAction, pending] = useActionState<RequestEmailState, FormData>(action, null);

  return (
    <form action={formAction} className="inline-flex">
      <input type="hidden" name="number" value={number} />
      <button
        type="submit"
        disabled={pending}
        data-testid="request-email-send"
        className="inline-flex items-center gap-1.5 rounded-button border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-coral-600 disabled:opacity-60"
      >
        <Mail aria-hidden="true" className="size-4" />
        {pending ? 'Отправляем…' : 'Отправить на email'}
      </button>
      {state && !state.ok ? (
        <p role="alert" className="ml-2 self-center text-xs text-error-ink">
          {state.error}
        </p>
      ) : null}
      {state && state.ok ? (
        <p
          data-testid="request-email-success"
          role="status"
          className="ml-2 self-center text-xs text-success-ink"
        >
          Отправлено на {state.email}
        </p>
      ) : null}
    </form>
  );
}
