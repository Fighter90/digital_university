'use client';

import { useState, useTransition } from 'react';
import { t, type Locale } from '@/lib/i18n';
import { Toggle } from '@/components/ui/toggle';
import { setA11y } from '@/server/actions/a11y';

// DIG-86 — блок «Крупный текст и без эффектов» (вкладка «Настройки →
// Доступность», для слабовидящих). Два независимых клавиатурных тумблера
// (Toggle — role="switch" на кнопке): крупный текст и отключение
// анимаций/теней. Сохраняются server action'ом setA11y (скоуплен сессией,
// cookie du-a11y) и применяются ко всему кабинету сразу (revalidate layout:
// классы a11y-* на <html> ставятся до первой отрисовки).
export function AccessibilitySettings({
  largeText,
  noEffects,
  locale = 'ru',
}: {
  largeText: boolean;
  noEffects: boolean;
  locale?: Locale;
}) {
  const [large, setLarge] = useState(largeText);
  const [flat, setFlat] = useState(noEffects);
  const [saved, setSaved] = useState(false);
  const [, startTransition] = useTransition();

  const persist = (pref: 'large-text' | 'no-effects', next: boolean) => {
    setSaved(false);
    if (pref === 'large-text') setLarge(next);
    else setFlat(next);
    startTransition(async () => {
      if (await setA11y(pref, next)) setSaved(true);
    });
  };

  return (
    <div className="flex flex-col gap-4" data-testid="a11y-settings">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-neutral-900">
            {t(locale, 'settings.a11yLargeText')}
          </p>
          <p className="text-xs text-neutral-600">{t(locale, 'settings.a11yLargeTextHint')}</p>
        </div>
        <Toggle
          checked={large}
          aria-label={t(locale, 'settings.a11yLargeText')}
          data-testid="a11y-large-text-toggle"
          onCheckedChange={(next) => persist('large-text', next)}
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-neutral-900">
            {t(locale, 'settings.a11yNoEffects')}
          </p>
          <p className="text-xs text-neutral-600">{t(locale, 'settings.a11yNoEffectsHint')}</p>
        </div>
        <Toggle
          checked={flat}
          aria-label={t(locale, 'settings.a11yNoEffects')}
          data-testid="a11y-no-effects-toggle"
          onCheckedChange={(next) => persist('no-effects', next)}
        />
      </div>

      <p aria-live="polite" role="status" className="text-xs text-neutral-500">
        {saved ? t(locale, 'settings.a11ySaved') : t(locale, 'settings.a11yIdle')}
      </p>
    </div>
  );
}
