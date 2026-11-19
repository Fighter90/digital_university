'use client';

import { useActionState } from 'react';
import { MessageSquareWarning } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { t, type Locale } from '@/lib/i18n';
import { reportDataErrorAction, type ProfileFormState } from '@/server/actions/profile';

// DIG-19: ОДНА точка входа «Нашли ошибку в данных?» — по нажатию сразу
// создаётся обращение в деканат с предзаполненной темой (без второй формы
// и без дублей, как это было в аудированном ЛК).
export function DataErrorReport({ locale = 'ru' }: { locale?: Locale }) {
  const [state, formAction, isPending] = useActionState<ProfileFormState, FormData>(
    reportDataErrorAction,
    null,
  );

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-neutral-600">
        {t(locale, 'profile.error.desc')}
      </p>
      <form action={formAction} className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="secondary" size="sm" disabled={isPending}>
          <MessageSquareWarning className="size-4" aria-hidden="true" />
          {isPending ? t(locale, 'profile.error.submitting') : t(locale, 'profile.error.button')}
        </Button>
        {state?.ok && (
          <p role="status" className="text-sm font-medium text-success-ink">
            {t(locale, 'profile.error.success')}
          </p>
        )}
        {state && !state.ok && state.error && (
          <p role="alert" className="text-sm font-medium text-error-ink">
            {state.error}
          </p>
        )}
      </form>
    </div>
  );
}
