'use client';

import { useActionState, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { appealTemplateList } from '@/lib/staff-appeal-templates';
import { t, type Locale } from '@/lib/i18n';
import {
  replyAppealAction,
  resolveAppealAction,
  type StaffActionState,
} from '@/server/actions/staff';

// DIG-48 — формы чата обращения: ответ с кнопками шаблонов (клик подставляет
// текст) и «Решено» с необязательной финальной заметкой. Обе работают без JS.
export function AppealReplyForm({
  appealId,
  locale = 'ru',
}: {
  appealId: string;
  /** DIG-89 — локаль интерфейса (cookie du-locale, дефолт ru). */
  locale?: Locale;
}) {
  const [state, formAction, isPending] = useActionState<StaffActionState, FormData>(
    replyAppealAction,
    null,
  );
  const [text, setText] = useState('');

  return (
    <div className="rounded-2xl border border-neutral-200 bg-card p-4">
      <h2 className="text-sm font-bold text-neutral-900">{t(locale, 'staff.appealForm.replyTitle')}</h2>

      <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label={t(locale, 'staff.appealForm.templatesAria')}>
        {appealTemplateList(locale).map((template) => (
          <button
            key={template.id}
            type="button"
            data-testid={`template-${template.id}`}
            onClick={() => setText(template.text)}
            className="rounded-pill border border-neutral-200 px-3 py-1 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-coral-600"
          >
            {template.label}
          </button>
        ))}
      </div>

      <form action={formAction} data-testid="appeal-reply-form" className="mt-3">
        <input type="hidden" name="appealId" value={appealId} />
        <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
          {t(locale, 'staff.appealForm.replyLabel')}
          <textarea
            name="body"
            rows={3}
            required
            maxLength={2000}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={t(locale, 'staff.appealForm.replyPlaceholder')}
            className="rounded-button border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:outline-2 focus-visible:outline-coral-600"
          />
        </label>
        <button
          type="submit"
          disabled={isPending}
          className="mt-2 rounded-button bg-coral-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-coral-500 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-coral-600"
        >
          {t(locale, 'staff.appealForm.send')}
        </button>
        {state?.error ? (
          <p role="alert" className="mt-2 text-xs font-medium text-red-700">
            {state.error}
          </p>
        ) : null}
        {state?.ok ? (
          <p role="status" className="mt-2 text-xs font-medium text-green-700">
            {t(locale, 'staff.appealForm.sent')}
          </p>
        ) : null}
      </form>
    </div>
  );
}

export function AppealResolveForm({
  appealId,
  locale = 'ru',
}: {
  appealId: string;
  /** DIG-89 — локаль интерфейса (cookie du-locale, дефолт ru). */
  locale?: Locale;
}) {
  const [state, formAction, isPending] = useActionState<StaffActionState, FormData>(
    resolveAppealAction,
    null,
  );

  return (
    <form
      action={formAction}
      data-testid="appeal-resolve-form"
      className="rounded-2xl border border-green-200 bg-green-50/60 p-4"
    >
      <input type="hidden" name="appealId" value={appealId} />
      <h2 className="flex items-center gap-1.5 text-sm font-bold text-green-900">
        <CheckCircle2 className="size-4" aria-hidden="true" />
        {t(locale, 'staff.appealForm.resolveTitle')}
      </h2>
      <label className="mt-2 flex flex-col gap-1 text-xs font-medium text-neutral-600">
        {t(locale, 'staff.appealForm.noteLabel')}
        <textarea
          name="note"
          rows={2}
          maxLength={500}
          placeholder={t(locale, 'staff.appealForm.notePlaceholder')}
          className="rounded-button border border-green-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:outline-2 focus-visible:outline-coral-600"
        />
      </label>
      <button
        type="submit"
        disabled={isPending}
        className="mt-2 rounded-button bg-green-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-600 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-coral-600"
      >
        {t(locale, 'staff.appealForm.resolve')}
      </button>
      {state?.error ? (
        <p role="alert" className="mt-2 text-xs font-medium text-red-700">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

// DIG-89 — обе формы карточки обращения одним островком (по контракту
// рендера /staff/appeals/[id]): ответ с шаблонами + «Решено». closed —
// обращение закрыто: форм нет (страница показывает статус закрытия).
export function AppealForms({
  appealId,
  closed = false,
  locale = 'ru',
}: {
  appealId: string;
  closed?: boolean;
  /** DIG-89 — локаль интерфейса (cookie du-locale, дефолт ru). */
  locale?: Locale;
}) {
  if (closed) return null;
  return (
    <div className="flex flex-col gap-4">
      <AppealReplyForm appealId={appealId} locale={locale} />
      <AppealResolveForm appealId={appealId} locale={locale} />
    </div>
  );
}
