'use client';

// DIG-18 — экран входа по макету Figma «02 · Вход»: форма с полями 48 px,
// кнопкой «показать пароль», чипами тестовых аккаунтов (клик заполняет поля),
// ссылкой «Забыли пароль?» и сохранённым контрактом DIG-11 (server action,
// role="alert", загрузка на кнопке, неактивная «Госуслуги (демо)»).
import { useActionState, useState } from 'react';
import { Eye, EyeOff, LoaderCircle } from 'lucide-react';
import { signInAction, type SignInFormState } from '@/server/actions/auth';
import { cn } from 'cn';

/**
 * Публичные (вымышленные по правилам AGENTS.md) демо-данные из
 * src/server/data/demo-seed.ts — чипы заполняют форму, чтобы жюри могло
 * войти одним кликом. Это НЕ секреты: пароли прототипа публичны by design.
 * DIG-50: логины/пароли едины для demo-набора DIG-12 и сида БД
 * (prisma/seed-data.ts) — одни и те же чипы работают и на memory-store,
 * и на prisma-проде (anna.smirnova / ilya.petrov / dean.kovaleva).
 */
export const TEST_ACCOUNTS = [
  {
    label: 'Анна Ковалёва · ПИ-21',
    login: 'anna.smirnova',
    password: 'anna-demo-2026',
    role: 'STUDENT',
  },
  {
    label: 'Илья Смирнов · ЭК-11',
    login: 'ilya.petrov',
    password: 'ilya-demo-2026',
    role: 'STUDENT',
  },
  { label: 'Сотрудник деканата', login: 'dean.kovaleva', password: 'dean-demo-2026', role: 'STAFF' },
] as const;

const FIELD_CLASS =
  'h-12 w-full rounded-button border border-input bg-card px-4 text-[15px] text-foreground placeholder:text-foreground-muted focus:border-muted-foreground/40 focus:outline-none';

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, isPending] = useActionState<SignInFormState, FormData>(
    signInAction,
    null,
  );
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="w-full max-w-md">
      <h1 className="text-2xl leading-tight sm:text-[28px]">Вход в кабинет</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Логин и пароль выдаёт деканат. Вход защищён от подбора пароля.
      </p>

      {/* Тестовые аккаунты: один клик — поля заполнены (сценарий для жюри). */}
      <div className="mt-6 rounded-card border border-border bg-accent-soft/60 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent-ink">
          Тестовые аккаунты
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Нажмите на чип — логин и пароль подставятся автоматически.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {TEST_ACCOUNTS.map((account) => (
            <button
              key={account.login}
              type="button"
              onClick={() => {
                setLogin(account.login);
                setPassword(account.password);
              }}
              className="inline-flex h-9 items-center rounded-pill border border-coral-200 bg-card px-3.5 text-sm font-medium text-foreground shadow-soft transition-colors hover:border-coral-400 hover:text-accent-ink"
            >
              {account.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <label htmlFor="login" className="mb-1.5 block text-sm font-medium">
          Логин
        </label>
        <input
          id="login"
          name="login"
          value={login}
          onChange={(event) => setLogin(event.target.value)}
          autoComplete="username"
          required
          placeholder="anna.smirnova"
          className={FIELD_CLASS}
        />
      </div>

      <div className="mt-4">
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          <label htmlFor="password" className="text-sm font-medium">
            Пароль
          </label>
          <a
            href="/forgot-password"
            className="text-sm font-medium text-accent-ink underline-offset-2 hover:underline"
          >
            Забыли пароль?
          </a>
        </div>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
            placeholder="••••••••"
            className={cn(FIELD_CLASS, 'pr-12')}
          />
          <button
            type="button"
            aria-pressed={showPassword}
            aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
            onClick={() => setShowPassword((value) => !value)}
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
          >
            {showPassword ? (
              <EyeOff size={20} aria-hidden="true" />
            ) : (
              <Eye size={20} aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {state?.error ? (
        <p
          role="alert"
          className="mt-4 rounded-card-sm border border-error-soft bg-error-soft px-4 py-3 text-sm font-medium text-error-ink"
        >
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="gradient-brand lift-hover mt-5 inline-flex h-12 w-full select-none items-center justify-center gap-2 rounded-button px-5 text-[15px] font-semibold text-white shadow-soft disabled:pointer-events-none disabled:opacity-60"
      >
        {isPending ? (
          <>
            <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />
            Входим…
          </>
        ) : (
          'Войти'
        )}
      </button>

      {/* DIG-11: Госуслуги — только неактивная демонстрационная кнопка, интеграции нет. */}
      <button
        type="button"
        disabled
        aria-disabled="true"
        title="Демонстрация: интеграция с Госуслугами не входит в прототип"
        className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-button border border-border bg-card text-[15px] font-medium text-muted-foreground"
      >
        Войти через Госуслуги
        <span className="rounded bg-muted px-1.5 py-0.5 text-xs uppercase">демо</span>
      </button>

      {next ? <input type="hidden" name="next" value={next} /> : null}
    </form>
  );
}
