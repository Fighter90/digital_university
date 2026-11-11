'use client';

import { useRef, useState, useTransition } from 'react';
import { Badge } from '@/components/ui/badge';
import { saveThemeAction } from '@/server/actions/profile';
import type { ThemePreference } from '@/server/data/types';

const OPTIONS: Array<{
  value: ThemePreference;
  label: string;
  disabled?: boolean;
  soon?: boolean;
}> = [
  { value: 'LIGHT', label: 'Светлая' },
  { value: 'SYSTEM', label: 'Системная' },
  { value: 'DARK', label: 'Тёмная', disabled: true, soon: true },
];

// DIG-19: тема — светлая / системная. Тёмная показана, но отключена
// («скоро», задача о тёмной теме); выбрать её нельзя ни в UI, ни со стороны
// клиентского кода — action валидирует значение на сервере.
export function ThemePicker({ initial }: { initial: ThemePreference }) {
  const [theme, setTheme] = useState<ThemePreference>(
    initial === 'DARK' ? 'SYSTEM' : initial,
  );
  const [, startTransition] = useTransition();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const select = (index: number) => {
    const option = OPTIONS[index];
    if (!option || option.disabled) return;
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
        className="inline-flex w-fit rounded-pill border border-border bg-card p-1"
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
              tabIndex={index === selectedIndex ? 0 : -1}
              disabled={option.disabled}
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
              className="flex h-8 items-center gap-1.5 rounded-pill px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 aria-selected:bg-foreground data-[selected=true]:bg-foreground data-[selected=true]:text-background"
              data-selected={selected}
            >
              {option.label}
              {option.soon && <Badge status="neutral">скоро</Badge>}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-neutral-500">
        Тёмная тема появится в отдельном обновлении — выбрать её пока нельзя.
      </p>
    </div>
  );
}
