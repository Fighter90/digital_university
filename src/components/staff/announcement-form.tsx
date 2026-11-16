'use client';

import { useActionState, useState } from 'react';
import { createAnnouncementAction, type StaffActionState } from '@/server/actions/staff';

// DIG-48 — форма объявления с живым предпросмотром: аудитория (факультет
// или группа факультета), заголовок, текст. Предпросмотр обновляется при
// вводе (до публикации). Отправка — server action, работает без JS.
export function AnnouncementForm({ groups, faculty }: { groups: string[]; faculty: string }) {
  const [state, formAction, isPending] = useActionState<StaffActionState, FormData>(
    createAnnouncementAction,
    null,
  );
  const [scope, setScope] = useState<'FACULTY' | 'GROUP'>('FACULTY');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [group, setGroup] = useState(groups[0] ?? '');

  const audienceLabel =
    scope === 'FACULTY' ? `Факультет ${faculty}` : `Группа ${group || '—'} (факультет ${faculty})`;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <form
        action={formAction}
        data-testid="announcement-form"
        className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-card p-4"
      >
        <fieldset className="flex gap-4 text-sm text-neutral-800">
          <legend className="mb-1 text-xs font-medium text-neutral-600">Аудитория</legend>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="scope"
              value="FACULTY"
              checked={scope === 'FACULTY'}
              onChange={() => setScope('FACULTY')}
              className="accent-coral-600"
            />
            Весь факультет
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
            Группа
          </label>
        </fieldset>

        <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
          Группа (только группы вашего факультета)
          <select
            name="groupName"
            value={group}
            disabled={scope === 'FACULTY'}
            onChange={(event) => setGroup(event.target.value)}
            className="rounded-button border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 disabled:bg-neutral-100 disabled:text-neutral-400 focus-visible:outline-2 focus-visible:outline-coral-600"
          >
            {groups.length === 0 && <option value="">Нет групп</option>}
            {groups.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
          Заголовок
          <input
            type="text"
            name="title"
            required
            maxLength={120}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Например: Собрание группы"
            className="rounded-button border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:outline-2 focus-visible:outline-coral-600"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
          Текст объявления
          <textarea
            name="body"
            rows={4}
            required
            maxLength={2000}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Что и когда, куда приходить, что взять с собой"
            className="rounded-button border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:outline-2 focus-visible:outline-coral-600"
          />
        </label>

        <button
          type="submit"
          disabled={isPending}
          className="self-start rounded-button bg-coral-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-coral-500 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-coral-600"
        >
          Опубликовать
        </button>

        {state?.error ? (
          <p role="alert" className="text-xs font-medium text-red-700">
            {state.error}
          </p>
        ) : null}
        {state?.ok ? (
          <p role="status" className="text-xs font-medium text-green-700">
            Объявление опубликовано.
          </p>
        ) : null}
      </form>

      {/* Живой предпросмотр карточки объявления. */}
      <div
        data-testid="announcement-preview"
        className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-4"
      >
        <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
          Предпросмотр · {audienceLabel}
        </p>
        <p className="mt-2 text-sm font-bold text-neutral-900">
          {title.trim() || 'Заголовок объявления'}
        </p>
        <p className="mt-1 whitespace-pre-line text-sm text-neutral-700">
          {body.trim() || 'Текст объявления появится здесь по мере ввода.'}
        </p>
        <p className="mt-3 text-[11px] text-neutral-500">
          Опубликует специалист деканата · концепт для конкурса, данные вымышленные
        </p>
      </div>
    </div>
  );
}
