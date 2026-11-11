'use client';

import { useActionState } from 'react';
import { MessageSquareWarning } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { reportDataErrorAction, type ProfileFormState } from '@/server/actions/profile';

// DIG-19: ОДНА точка входа «Нашли ошибку в данных?» — по нажатию сразу
// создаётся обращение в деканат с предзаполненной темой (без второй формы
// и без дублей, как это было в аудированном ЛК).
export function DataErrorReport() {
  const [state, formAction, isPending] = useActionState<ProfileFormState, FormData>(
    reportDataErrorAction,
    null,
  );

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-neutral-600">
        ФИО, факультет, направление, курс, группу и номер зачётки ведёт деканат. Если видите
        неточность — отправьте обращение, тема заполнится автоматически.
      </p>
      <form action={formAction} className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="secondary" size="sm" disabled={isPending}>
          <MessageSquareWarning className="size-4" aria-hidden="true" />
          {isPending ? 'Отправляем…' : 'Нашли ошибку в данных?'}
        </Button>
        {state?.ok && (
          <p role="status" className="text-sm font-medium text-success-ink">
            Обращение создано — ответ придёт в «Связь с деканатом»
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
