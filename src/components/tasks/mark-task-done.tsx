'use client';

import { useActionState } from 'react';
import { CalendarCheck2 } from 'lucide-react';

import { t, type Locale } from '@/lib/i18n';
import { markTaskDoneAction, type MarkTaskDoneState } from '@/server/actions/tasks';

// DIG-34 — «Отметить выполненной» для ручных задач (экран «Задачи»).
// Прогрессивное улучшение: обычная форма работает и без JS. После успеха
// revalidatePath перегенерирует /tasks и /dashboard — строка исчезает.
// Повторная отметка идемпотентна (слой данных сохраняет первый doneAt).
// DIG-87 — подписи по локали (дефолт 'ru' — прежние строки).
export function MarkTaskDoneButton({
  taskId,
  locale = 'ru',
}: {
  taskId: string;
  /** DIG-87 — локаль интерфейса (cookie du-locale, дефолт ru). */
  locale?: Locale;
}) {
  const [state, formAction, isPending] = useActionState<MarkTaskDoneState, FormData>(
    markTaskDoneAction,
    null,
  );

  return (
    <form action={formAction} className="flex shrink-0 flex-col items-end">
      <input type="hidden" name="taskId" value={taskId} />
      <button
        type="submit"
        data-testid="task-done-button"
        disabled={isPending}
        className="inline-flex select-none items-center justify-center gap-1.5 rounded-button border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-soft transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral-600 disabled:pointer-events-none disabled:opacity-50"
      >
        <CalendarCheck2 aria-hidden="true" className="size-4" />
        {isPending ? t(locale, 'tasks.markDonePending') : t(locale, 'tasks.markDone')}
      </button>
      {state && !state.ok ? (
        <p role="alert" className="mt-1 text-right text-xs font-medium text-error-ink">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
