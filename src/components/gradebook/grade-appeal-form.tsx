'use client';

import { useActionState } from 'react';
import { MessageSquareWarning } from 'lucide-react';

import { createGradeAppealAction, type GradeAppealState } from '@/server/actions/gradebook';
import { t, type Locale } from '@/lib/i18n';

// DIG-27 — «Ошибка в оценке?» на карточке дисциплины: server action
// createGradeAppealAction создаёт обращение в деканат с предзаполненной
// дисциплиной (проверка владельца — в слое данных). Внутри — форма с
// скрытым кодом дисциплины (прогрессивное улучшение: работает и без JS).
export function GradeAppealForm({
  disciplineCode,
  locale = 'ru',
}: {
  disciplineCode: string;
  /** DIG-89 — локаль интерфейса (cookie du-locale, дефолт ru). */
  locale?: Locale;
}) {
  const [state, formAction, isPending] = useActionState<GradeAppealState, FormData>(
    createGradeAppealAction,
    null,
  );

  if (state?.ok) {
    return (
      <div
        role="status"
        className="rounded-card border border-success-soft bg-success-soft/60 p-4"
      >
        <p className="text-sm font-semibold text-success-ink">
          {t(locale, 'gradebook.appeal.created')}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(locale, 'gradebook.appeal.createdDesc')}
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      {/* Код дисциплины едет в action вместе с формой; владелец перепроверяется на сервере. */}
      <input type="hidden" name="disciplineCode" value={disciplineCode} />
      <button
        type="submit"
        disabled={isPending}
        className="inline-flex select-none items-center justify-center gap-2 rounded-button border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground shadow-soft transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
      >
        <MessageSquareWarning aria-hidden="true" className="size-4" />
        {isPending ? t(locale, 'gradebook.appeal.submitting') : t(locale, 'gradebook.appeal.submit')}
      </button>
      <p className="text-xs text-muted-foreground">{t(locale, 'gradebook.appeal.hint')}</p>
      {state?.error ? (
        <p role="alert" className="text-sm font-medium text-error-ink">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
