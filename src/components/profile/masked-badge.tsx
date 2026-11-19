'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { maskStudentBadge } from '@/lib/profile-format';
import { t, type Locale } from '@/lib/i18n';

// DIG-19: номер студенческого билета скрыт по умолчанию («2023-12-••••34»);
// кнопка «Показать» раскрывает полное значение только на этом экране.
// DIG-89: MaskedBadge — управляемая (controlled) версия: состояние раскрытия
// можно держать снаружи; MaskedStudentBadge — обёртка страницы профиля с
// локальным состоянием поверх неё (RU-рендер прежний, байт-в-байт).

/** Управляемый бейдж: замаскированное значение + кнопка «Показать»/«Скрыть». */
export function MaskedBadge({
  value,
  revealed,
  onToggle,
  locale = 'ru',
}: {
  value: string;
  revealed: boolean;
  onToggle: () => void;
  /** DIG-89 — локаль интерфейса (cookie du-locale, дефолт ru). */
  locale?: Locale;
}) {
  const Icon = revealed ? EyeOff : Eye;

  return (
    <span data-testid="student-badge" className="inline-flex flex-wrap items-center gap-2">
      <span className="font-mono text-sm font-medium text-neutral-900">
        {revealed ? value : maskStudentBadge(value)}
      </span>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={revealed}
        className="inline-flex items-center gap-1 rounded-button px-2 py-1 text-xs font-medium text-coral-700 hover:bg-coral-50 focus-visible:outline-2 focus-visible:outline-coral-600"
      >
        <Icon className="size-3.5" aria-hidden="true" />
        {revealed ? t(locale, 'profile.masked.hide') : t(locale, 'profile.masked.show')}
      </button>
    </span>
  );
}

/** Обёртка страницы профиля: локальное состояние раскрытия поверх MaskedBadge. */
export function MaskedStudentBadge({
  value,
  locale = 'ru',
}: {
  value: string;
  /** DIG-89 — локаль интерфейса (cookie du-locale, дефолт ru). */
  locale?: Locale;
}) {
  const [revealed, setRevealed] = useState(false);
  return (
    <MaskedBadge
      value={value}
      revealed={revealed}
      onToggle={() => setRevealed((v) => !v)}
      locale={locale}
    />
  );
}
