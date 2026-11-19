'use client';

import { t, type Locale } from '@/lib/i18n';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { changePasswordAction, type PasswordFormState } from '@/server/actions/settings';

// DIG-44 — вкладка «Безопасность»: смена пароля. Текущий пароль проверяется
// на сервере против argon2id-хэша; новый — минимум 8 символов, с повтором.
export function PasswordForm({ locale = 'ru' }: { locale?: Locale }) {
  const [state, formAction, isPending] = useActionState<PasswordFormState, FormData>(
    changePasswordAction,
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3" data-testid="password-form">
      <div className="flex flex-col gap-1">
        <label htmlFor="password-current" className="text-sm font-medium text-neutral-800">
          {t(locale, 'settings.password.current')}
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
          {t(locale, 'settings.password.new')}
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
        <p className="text-xs text-neutral-500">{t(locale, 'settings.password.min')}</p>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="password-repeat" className="text-sm font-medium text-neutral-800">
          {t(locale, 'settings.password.repeat')}
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
            {t(locale, 'settings.password.saved')}
          </p>
        ) : null}
      </div>

      <div>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? t(locale, 'settings.password.submitting') : t(locale, 'settings.password.submit')}
        </Button>
      </div>
    </form>
  );
}
