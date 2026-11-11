'use client';

// DIG-11 — functional sign-in form wired to the signInAction server action.
// The visual redesign of this screen is DIG-18 (Figma «02 · Вход»); this
// component only has to work: labels for e2e, a11y error output, the
// disabled «Госуслуги (демо)» button required by DIG-11, pending state.
import { useActionState } from 'react';
import { signInAction, type SignInFormState } from '@/server/actions/auth';

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, isPending] = useActionState<SignInFormState, FormData>(
    signInAction,
    null,
  );

  return (
    <form
      action={formAction}
      className="w-full max-w-sm rounded-2xl border border-neutral-200 p-6 shadow-sm"
    >
      <h1 className="mb-1 text-xl font-bold">Вход в кабинет</h1>
      <p className="mb-6 text-sm text-neutral-600">
        Логин и пароль выдаёт деканат. Вход защищён от подбора пароля.
      </p>

      <label className="mb-1 block text-sm font-medium" htmlFor="login">
        Логин
      </label>
      <input
        id="login"
        name="login"
        autoComplete="username"
        required
        className="mb-4 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
      />

      <label className="mb-1 block text-sm font-medium" htmlFor="password">
        Пароль
      </label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        className="mb-2 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
      />

      {state?.error ? (
        <p role="alert" className="mb-4 text-sm font-medium text-red-700">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="mb-3 w-full rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {isPending ? 'Входим…' : 'Войти'}
      </button>

      {/* DIG-11: Госуслуги — только неактивная демонстрационная кнопка, интеграции нет. */}
      <button
        type="button"
        disabled
        aria-disabled="true"
        title="Демонстрация: интеграция с Госуслугами не входит в прототип"
        className="w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-500"
      >
        Войти через Госуслуги
        <span className="ml-1 rounded bg-neutral-100 px-1.5 py-0.5 text-xs uppercase text-neutral-500">
          демо
        </span>
      </button>

      {next ? <input type="hidden" name="next" value={next} /> : null}
    </form>
  );
}
