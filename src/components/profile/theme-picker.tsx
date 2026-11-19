'use client';

import { useRef, useState, useTransition } from 'react';
import { saveThemeAction } from '@/server/actions/profile';
import { t, type Locale } from '@/lib/i18n';
import type { ThemePreference } from '@/server/data/types';

const OPTIONS: Array<{
  value: ThemePreference;
  labelKey: 'profile.theme.LIGHT.label' | 'profile.theme.SYSTEM.label' | 'profile.theme.DARK.label';
  descKey: 'profile.theme.LIGHT.desc' | 'profile.theme.SYSTEM.desc' | 'profile.theme.DARK.desc';
}> = [
  { value: 'LIGHT', labelKey: 'profile.theme.LIGHT.label', descKey: 'profile.theme.LIGHT.desc' },
  { value: 'SYSTEM', labelKey: 'profile.theme.SYSTEM.label', descKey: 'profile.theme.SYSTEM.desc' },
  { value: 'DARK', labelKey: 'profile.theme.DARK.label', descKey: 'profile.theme.DARK.desc' },
];

// DIG-44: тема — светлая / системная / тёмная. Все три доступны и применяются
// ко всему кабинету server-side (класс на <html> из root layout): выбрать
// тёмную нельзя было в DIG-19 («скоро»), теперь она включена.
export function ThemePicker({
  initial,
  theme,
  locale = 'ru',
}: {
  /** Начальная тема (основной сценарий экрана /settings). */
  initial?: ThemePreference;
  /** Тема напрямую, без строки настроек (EN-рендер поверхностей). */
  theme?: ThemePreference;
  /** DIG-89 — локаль интерфейса (cookie du-locale, дефолт ru). */
  locale?: Locale;
}) {
  const [current, setTheme] = useState<ThemePreference>(theme ?? initial ?? 'LIGHT');
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

  const selectedIndex = OPTIONS.findIndex((o) => o.value === current);

  return (
    <div className="flex flex-col gap-2">
      <div
        role="radiogroup"
        aria-label={t(locale, 'profile.theme.aria')}
        className="inline-flex w-fit flex-wrap rounded-pill border border-border bg-card p-1"
      >
        {OPTIONS.map((option, index) => {
          const selected = option.value === current;
          return (
            <button
              key={option.value}
              ref={(el) => {
                refs.current[index] = el;
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${t(locale, option.labelKey)}. ${t(locale, option.descKey)}`}
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
              {t(locale, option.labelKey)}
            </button>
          );
        })}
      </div>
      <p aria-live="polite" role="status" className="text-xs text-neutral-500">
        {t(locale, 'profile.theme.applied')}
      </p>
    </div>
  );
}
