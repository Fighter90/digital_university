'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { changePasswordAction, type PasswordFormState } from '@/server/actions/settings';

// DIG-44 — вкладка «Безопасность»: смена пароля. Текущий пароль проверяется
// на сервере против argon2id-хэша; новый — минимум 8 символов, с повтором.
export function PasswordForm() {
  const [state, formAction, isPending] = useActionState<PasswordFormState, FormData>(
    changePasswordAction,
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3" data-testid="password-form">
      <div className="flex flex-col gap-1">
        <label htmlFor="password-current" className="text-sm font-medium text-neutral-800">
          Текущий пароль
        </label>
        <input
          id="password-current"
          name="current"
          type="password"
          autoComplete="current-password"
          required
          className="h-10 rounded-button border border-border bg-card px-3 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="password-next" className="text-sm font-medium text-neutral-800">
          Новый пароль
        </label>
        <input
          id="password-next"
          name="next"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="h-10 rounded-button border border-border bg-card px-3 text-sm"
        />
        <p className="text-xs text-neutral-500">Минимум 8 символов.</p>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="password-repeat" className="text-sm font-medium text-neutral-800">
          Повторите новый пароль
        </label>
        <input
          id="password-repeat"
          name="repeat"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="h-10 rounded-button border border-border bg-card px-3 text-sm"
        />
      </div>

      <div aria-live="polite">
        {state?.error ? (
          <p role="alert" className="text-sm font-semibold text-error-ink">
            {state.error}
          </p>
        ) : null}
        {state?.ok ? (
          <p role="status" className="text-sm font-semibold text-success-ink">
            Пароль изменён
          </p>
        ) : null}
      </div>

      <div>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? 'Меняем…' : 'Изменить пароль'}
        </Button>
      </div>
    </form>
  );
}
