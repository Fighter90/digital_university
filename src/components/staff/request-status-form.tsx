'use client';

import { useActionState } from 'react';
import {
  requiresReason,
  STAFF_ALLOWED_TRANSITIONS,
  TRANSITION_ACTION_LABELS,
  TRANSITION_ACTION_TITLES,
} from '@/lib/staff-transitions';
import type { RequestStatus } from '@/server/data/types';
import { changeStatusAction, type StaffActionState } from '@/server/actions/staff';

// DIG-48 — смена статуса кнопками карточки сотрудника: только разрешённые
// переходы текущего статуса; «Нужна доработка» и «Отклонить» требуют причину
// (textarea required, кнопки без причины идут с formNoValidate — форма
// работает и без JS). Кнопки с name="to" отдают целевой статус формой.
export function RequestStatusForm({ number, status }: { number: string; status: RequestStatus }) {
  const [state, formAction, isPending] = useActionState<StaffActionState, FormData>(
    changeStatusAction,
    null,
  );
  const targets = STAFF_ALLOWED_TRANSITIONS[status];
  if (targets.length === 0) return null; // COMPLETED / REJECTED — терминальные

  return (
    <form
      action={formAction}
      data-testid="status-form"
      className="rounded-2xl border border-neutral-200 bg-card p-4"
    >
      <input type="hidden" name="number" value={number} />
      <h2 className="text-sm font-bold text-neutral-900">Сменить статус</h2>
      <label className="mt-2 flex flex-col gap-1 text-xs font-medium text-neutral-600">
        Причина (обязательна для «Нужна доработка» и «Отклонить»)
        <textarea
          name="reason"
          rows={2}
          required
          maxLength={500}
          placeholder="Например: приложите договор о практике"
          className="rounded-button border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:outline-2 focus-visible:outline-coral-600"
        />
      </label>

      <div className="mt-3 flex flex-wrap gap-2">
        {targets.map((target) => (
          <button
            key={target}
            type="submit"
            name="to"
            value={target}
            disabled={isPending}
            formNoValidate={!requiresReason(target)}
            aria-label={TRANSITION_ACTION_TITLES[target]}
            className="rounded-button border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-800 transition-colors hover:bg-neutral-50 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-coral-600"
          >
            {TRANSITION_ACTION_LABELS[target]}
          </button>
        ))}
      </div>

      {state?.error ? (
        <p role="alert" className="mt-2 text-xs font-medium text-red-700">
          {state.error}
        </p>
      ) : null}
      {state?.ok ? (
        <p role="status" className="mt-2 text-xs font-medium text-green-700">
          Статус обновлён — студент получил уведомление.
        </p>
      ) : null}
    </form>
  );
}
