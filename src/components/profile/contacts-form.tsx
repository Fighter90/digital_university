'use client';

import { useActionState, useState } from 'react';
import { Toggle } from '@/components/ui/toggle';
import { Button } from '@/components/ui/button';
import { saveContactsAction, type ProfileFormState } from '@/server/actions/profile';

// DIG-19: контакты — единственные данные профиля, которые редактирует студент
// (остальное ведёт деканат). Переключатели «видно преподавателям» управляют
// тем, что сотрудник деканата увидит на экране студента своего факультета.
export interface ContactsFormProps {
  email: string;
  phone: string | null;
  emailVisibleToStaff: boolean;
  phoneVisibleToStaff: boolean;
}

function VisibilityField({
  name,
  label,
  defaultChecked,
  checked,
  onChange,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-sm text-neutral-700">{label}</span>
      {/* Значение едет в action вместе с формой (прогрессивное улучшение). */}
      <input type="hidden" name={name} value={checked ? 'on' : 'off'} />
      <Toggle
        checked={checked}
        defaultChecked={defaultChecked}
        onCheckedChange={onChange}
        aria-label={label}
      />
    </div>
  );
}

export function ContactsForm({
  email,
  phone,
  emailVisibleToStaff,
  phoneVisibleToStaff,
}: ContactsFormProps) {
  const [state, formAction, isPending] = useActionState<ProfileFormState, FormData>(
    saveContactsAction,
    null,
  );
  const [emailVisible, setEmailVisible] = useState(emailVisibleToStaff);
  const [phoneVisible, setPhoneVisible] = useState(phoneVisibleToStaff);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="contacts-email" className="text-sm font-medium text-neutral-900">
          Email
        </label>
        <input
          id="contacts-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          defaultValue={email}
          className="h-11 rounded-button border border-border bg-card px-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:outline-2 focus-visible:outline-coral-600"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="contacts-phone" className="text-sm font-medium text-neutral-900">
          Телефон
        </label>
        <input
          id="contacts-phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          defaultValue={phone ?? ''}
          placeholder="+7 900 000-00-00"
          className="h-11 rounded-button border border-border bg-card px-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:outline-2 focus-visible:outline-coral-600"
        />
      </div>

      <div className="flex flex-col divide-y divide-neutral-100">
        <VisibilityField
          name="emailVisibleToStaff"
          label="Email виден преподавателям"
          defaultChecked={emailVisibleToStaff}
          checked={emailVisible}
          onChange={setEmailVisible}
        />
        <VisibilityField
          name="phoneVisibleToStaff"
          label="Телефон виден преподавателям"
          defaultChecked={phoneVisibleToStaff}
          checked={phoneVisible}
          onChange={setPhoneVisible}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? 'Сохраняем…' : 'Сохранить'}
        </Button>
        {state?.ok && (
          <p role="status" className="text-sm font-medium text-success-ink">
            Контакты сохранены
          </p>
        )}
        {state && !state.ok && state.error && (
          <p role="alert" className="text-sm font-medium text-error-ink">
            {state.error}
          </p>
        )}
      </div>
    </form>
  );
}
