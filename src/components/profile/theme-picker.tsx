'use client';

import { useRef, useState, useTransition } from 'react';
import { saveThemeAction } from '@/server/actions/profile';
import type { ThemePreference } from '@/server/data/types';

const OPTIONS: Array<{
  value: ThemePreference;
  label: string;
  description: string;
}> = [
  { value: 'LIGHT', label: 'Светлая', description: 'Светлые поверхности, как в макете.' },
  { value: 'SYSTEM', label: 'Системная', description: 'Следует настройкам системы.' },
  { value: 'DARK', label: 'Тёмная', description: 'Тёмные поверхности для вечерних дежурств.' },
];

// DIG-44: тема — светлая / системная / тёмная. Все три доступны и применяются
// ко всему кабинету server-side (класс на <html> из root layout): выбрать
// тёмную нельзя было в DIG-19 («скоро»), теперь она включена.
export function ThemePicker({ initial }: { initial: ThemePreference }) {
  const [theme, setTheme] = useState<ThemePreference>(initial);
  const [, startTransition] = useTransition();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const select = (index: number) => {
    const option = OPTIONS[index];
    if (!option) return;
    setTheme(option.value);
    refs.current[index]?.focus();
    startTransition(() => {
      void saveThemeAction(option.value);
    });
  };

  const selectedIndex = OPTIONS.findIndex((o) => o.value === theme);

  return (
    <div className="flex flex-col gap-2">
      <div
        role="radiogroup"
        aria-label="Тема оформления"
        className="inline-flex w-fit flex-wrap rounded-pill border border-border bg-card p-1"
      >
        {OPTIONS.map((option, index) => {
          const selected = option.value === theme;
          return (
            <button
              key={option.value}
              ref={(el) => {
                refs.current[index] = el;
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${option.label}. ${option.description}`}
              tabIndex={index === selectedIndex ? 0 : -1}
              onClick={() => select(index)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                  event.preventDefault();
                  select(Math.min(OPTIONS.length - 1, index + 1));
                } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                  event.preventDefault();
                  select(Math.max(0, index - 1));
                }
              }}
              className="flex h-8 items-center gap-1.5 rounded-pill px-4 text-sm font-medium transition-colors data-[selected=true]:bg-foreground data-[selected=true]:text-background"
              data-selected={selected}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <p aria-live="polite" role="status" className="text-xs text-neutral-500">
        Тема применяется ко всему кабинету сразу и сохраняется в настройках.
      </p>
    </div>
  );
}
