'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { maskStudentBadge } from '@/lib/profile-format';

// DIG-19: номер студенческого билета скрыт по умолчанию («2023-12-••••34»);
// кнопка «Показать» раскрывает полное значение только на этом экране.
export function MaskedStudentBadge({ value }: { value: string }) {
  const [revealed, setRevealed] = useState(false);
  const Icon = revealed ? EyeOff : Eye;

  return (
    <span data-testid="student-badge" className="inline-flex flex-wrap items-center gap-2">
      <span className="font-mono text-sm font-medium text-neutral-900">
        {revealed ? value : maskStudentBadge(value)}
      </span>
      <button
        type="button"
        onClick={() => setRevealed((v) => !v)}
        aria-pressed={revealed}
        className="inline-flex items-center gap-1 rounded-button px-2 py-1 text-xs font-medium text-coral-700 hover:bg-coral-50 focus-visible:outline-2 focus-visible:outline-coral-600"
      >
        <Icon className="size-3.5" aria-hidden="true" />
        {revealed ? 'Скрыть' : 'Показать'}
      </button>
    </span>
  );
}
