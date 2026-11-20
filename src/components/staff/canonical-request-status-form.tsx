'use client';

import { useActionState } from 'react';
import {
  allowedRequestTransitions,
  type CanonicalRequestStatus,
} from '@/lib/request-machine';
import { transitionActionLabel, transitionActionTitle } from '@/lib/staff-transitions';
import { t, type Locale } from '@/lib/i18n';
import type { RequestStatus } from '@/server/data/types';
import { changeCanonicalStatusAction, type StaffActionState } from '@/server/actions/staff';

// DIG-126 — переходы канонической заявки (ЗД-…) руками сотрудника: только
// легальные переходы машины DIG-30 для роли STAFF (allowedRequestTransitions);
// «Нужна доработка» и «Отклонить» требуют причину (textarea required, остальные
// кнопки с formNoValidate — форма работает и без JS). Повторная проверка
// перехода, причины и owner-scope — в слое данных и машине DIG-30.
// Подписи кнопок — общий словарь переходов сотрудника (RU/EN парой).
export function CanonicalRequestStatusForm({
  number,
  status,
  locale = 'ru',
}: {
  number: string;
  status: CanonicalRequestStatus;
  locale?: Locale;
}) {
  const [state, formAction, isPending] = useActionState<StaffActionState, FormData>(
    changeCanonicalStatusAction,
    null,
  );
  const targets = allowedRequestTransitions(status, 'STAFF');
  if (targets.length === 0) return null; // ISSUED / REJECTED — терминальные

  // Причина обязательна у доработки и отказа; машина без причины отклонит.
  const needsReason = (target: CanonicalRequestStatus): boolean =>
    target === 'NEEDS_FIX' || target === 'REJECTED';

  return (
    <form
      action={formAction}
      data-testid="canonical-status-form"
      className="rounded-2xl border border-neutral-200 bg-card p-4"
    >
      <input type="hidden" name="number" value={number} />
      <h2 className="text-sm font-bold text-neutral-900">{t(locale, 'staffForm.title')}</h2>
      <label className="mt-2 flex flex-col gap-1 text-xs font-medium text-neutral-600">
        {t(locale, 'staffForm.reasonLabel')}
        <textarea
          name="reason"
          rows={2}
          required
          maxLength={500}
          placeholder={t(locale, 'staff.statusForm.placeholder')}
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
            formNoValidate={!needsReason(target)}
            aria-label={transitionActionTitle(locale, target as Exclude<RequestStatus, 'SUBMITTED'>)}
            className="rounded-button border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-800 transition-colors hover:bg-neutral-50 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-coral-600"
          >
            {transitionActionLabel(locale, target as Exclude<RequestStatus, 'SUBMITTED'>)}
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
          {t(locale, 'staff.statusForm.saved')}
        </p>
      ) : null}
    </form>
  );
}
