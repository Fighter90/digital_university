'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { CalendarCheck } from 'lucide-react';

import { signUpForRetakeAction, type RetakeSignupState } from '@/server/actions/session';

// DIG-28 — «Записаться» на пересдачу (экран «Сессия»): server action
// signUpForRetakeAction создаёт заявку и уведомление (проверка владельца —
// в слое данных). Внутри — форма со скрытым examId (прогрессивное
// улучшение: работает и без JS). Уже созданная заявка заменяет кнопку
// бейджем со ссылкой на заявку; повторная отправка идемпотентна.
// Прошедшая пересдача (signUpAvailable: false) — пояснение вместо кнопки.
export function RetakeSignupForm({
  examId,
  requested,
  requestNumber,
  signUpAvailable,
}: {
  examId: string;
  requested: boolean;
  requestNumber: string | null;
  signUpAvailable: boolean;
}) {
  const [state, formAction, isPending] = useActionState<RetakeSignupState, FormData>(
    signUpForRetakeAction,
    null,
  );

  const done = requested || (state?.ok === true && state.examId === examId);
  const number = state?.ok === true && state.examId === examId ? state.requestNumber : requestNumber;

  if (done) {
    return (
      <div className="flex flex-col items-start gap-1.5">
        <Link
          data-testid="retake-requested"
          href={number ? `/requests/${number}` : '/requests'}
          className="inline-flex items-center gap-1.5 rounded-pill border border-success-soft bg-success-soft px-3 py-1.5 text-sm font-semibold text-success-ink transition-colors hover:underline"
        >
          <CalendarCheck aria-hidden="true" className="size-4" />
          Заявка создана
        </Link>
        <p className="text-xs text-muted-foreground">
          Запись передана в деканат — статус виден в «Моих заявках».
        </p>
      </div>
    );
  }

  if (!signUpAvailable) {
    return (
      <p className="text-sm text-muted-foreground">Пересдача уже состоялась — запись закрыта.</p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col items-start gap-1.5">
      {/* examId едет с формой; владелец перепроверяется на сервере. */}
      <input type="hidden" name="examId" value={examId} />
      <button
        type="submit"
        data-testid="retake-signup"
        disabled={isPending}
        className="inline-flex select-none items-center justify-center gap-2 rounded-button border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground shadow-soft transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
      >
        <CalendarCheck aria-hidden="true" className="size-4" />
        {isPending ? 'Записываем…' : 'Записаться'}
      </button>
      {state && !state.ok ? (
        <p role="alert" className="text-sm font-medium text-error-ink">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
