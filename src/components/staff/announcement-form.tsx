'use client';

import { useActionState, useState } from 'react';
import { createAnnouncementAction, type StaffActionState } from '@/server/actions/staff';
import { t, type Locale } from '@/lib/i18n';
import { localizedGroup, localizedFaculty } from '@/lib/en-demo-content';

// DIG-48 — форма объявления с живым предпросмотром: аудитория (факультет
// или группа факультета), заголовок, текст. Предпросмотр обновляется при
// вводе (до публикации). Отправка — server action, работает без JS.
export function AnnouncementForm({
  groups,
  faculty,
  locale = 'ru',
}: {
  groups: string[];
  faculty: string;
  /** DIG-89 — локаль интерфейса (cookie du-locale, дефолт ru). */
  locale?: Locale;
}) {
  const [state, formAction, isPending] = useActionState<StaffActionState, FormData>(
    createAnnouncementAction,
    null,
  );
  const [scope, setScope] = useState<'FACULTY' | 'GROUP'>('FACULTY');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [group, setGroup] = useState(groups[0] ?? '');

  const facultyLabel = localizedFaculty(locale, faculty);
  const groupLabel = localizedGroup(locale, group || null);
  const audienceLabel =
    scope === 'FACULTY'
      ? t(locale, 'staff.announcementForm.scopeFaculty', { faculty: facultyLabel })
      : t(locale, 'staff.announcementForm.scopeGroup', { group: groupLabel, faculty: facultyLabel });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <form
        action={formAction}
        data-testid="announcement-form"
        className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-card p-4"
      >
        <fieldset className="flex gap-4 text-sm text-neutral-800">
          <legend className="mb-1 text-xs font-medium text-neutral-600">{t(locale, 'staff.announcementForm.audience')}</legend>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="scope"
              value="FACULTY"
              checked={scope === 'FACULTY'}
              onChange={() => setScope('FACULTY')}
              className="accent-coral-600"
            />
            {t(locale, 'staff.announcementForm.wholeFaculty')}
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="scope"
              value="GROUP"
              checked={scope === 'GROUP'}
              onChange={() => setScope('GROUP')}
              className="accent-coral-600"
            />
            {t(locale, 'staff.announcementForm.group')}
          </label>
        </fieldset>

        <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
          {t(locale, 'staff.announcementForm.groupHint')}
          <select
            name="groupName"
            value={group}
            disabled={scope === 'FACULTY'}
            onChange={(event) => setGroup(event.target.value)}
            className="rounded-button border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 disabled:bg-neutral-100 disabled:text-neutral-400 focus-visible:outline-2 focus-visible:outline-coral-600"
          >
            {groups.length === 0 && <option value="">{t(locale, 'staff.announcementForm.noGroups')}</option>}
            {groups.map((name) => (
              <option key={name} value={name}>
                {localizedGroup(locale, name)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
          {t(locale, 'staff.announcementForm.titleLabel')}
          <input
            type="text"
            name="title"
            required
            maxLength={120}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={t(locale, 'staff.announcementForm.titlePlaceholder')}
            className="rounded-button border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:outline-2 focus-visible:outline-coral-600"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
          {t(locale, 'staff.announcementForm.bodyLabel')}
          <textarea
            name="body"
            rows={4}
            required
            maxLength={2000}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder={t(locale, 'staff.announcementForm.bodyPlaceholder')}
            className="rounded-button border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:outline-2 focus-visible:outline-coral-600"
          />
        </label>

        <button
          type="submit"
          disabled={isPending}
          className="self-start rounded-button bg-coral-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-coral-500 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-coral-600"
        >
          {t(locale, 'staff.announcementForm.publish')}
        </button>

        {state?.error ? (
          <p role="alert" className="text-xs font-medium text-red-700">
            {state.error}
          </p>
        ) : null}
        {state?.ok ? (
          <p role="status" className="text-xs font-medium text-green-700">
            {t(locale, 'staff.announcementForm.published')}
          </p>
        ) : null}
      </form>

      {/* Живой предпросмотр карточки объявления. */}
      <div
        data-testid="announcement-preview"
        className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-4"
      >
        <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
          {t(locale, 'staff.announcementForm.preview', { audience: audienceLabel })}
        </p>
        <p className="mt-2 text-sm font-bold text-neutral-900">
          {title.trim() || t(locale, 'staff.announcementForm.previewTitle')}
        </p>
        <p className="mt-1 whitespace-pre-line text-sm text-neutral-700">
          {body.trim() || t(locale, 'staff.announcementForm.previewBody')}
        </p>
        <p className="mt-3 text-[11px] text-neutral-500">
          {t(locale, 'staff.announcementForm.disclaimer')}
        </p>
      </div>
    </div>
  );
}
