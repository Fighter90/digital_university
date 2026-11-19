'use client';

import { t, type Locale, type TranslationKey } from '@/lib/i18n';

import { useRef, useState, useTransition } from 'react';
import { Badge } from '@/components/ui/badge';
import { Toggle } from '@/components/ui/toggle';
import {
  saveFontSizeAction,
  saveLanguageAction,
  saveReduceMotionAction,
} from '@/server/actions/settings';
import type { FontSizePreference, LanguagePreference } from '@/server/data/types';

interface SegmentedOption {
  value: string;
  label?: string;
  soon?: boolean;
  /** DIG-89 — ключ словаря для EN-подписи опции. */
  labelKey?: TranslationKey;
}

// Один сегментный переключатель (radiogroup) — собственный компонент, чтобы
// рефы жили внутри него (доступ к ref — только в обработчиках и ref-callback).
function SegmentedGroup({
  label,
  groupLabel,
  hint,
  options,
  selected,
  onSelect,
  locale,
}: {
  /** Видимая подпись блока. */
  label: string;
  groupLabel: string;
  hint: string;
  options: SegmentedOption[];
  selected: string;
  onSelect: (value: string) => void;
  locale: Locale;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = options.findIndex((o) => o.value === selected);

  const select = (index: number) => {
    const option = options[index];
    if (!option || option.soon) return;
    refs.current[index]?.focus();
    onSelect(option.value);
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-semibold text-neutral-900">{label}</p>
      <div
        role="radiogroup"
        aria-label={groupLabel}
        className="inline-flex w-fit flex-wrap rounded-pill border border-border bg-card p-1"
      >
        {options.map((option, index) => {
          const active = option.value === selected;
          return (
            <button
              key={option.value}
              ref={(el) => {
                refs.current[index] = el;
              }}
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={index === selectedIndex ? 0 : -1}
              disabled={Boolean(option.soon)}
              onClick={() => select(index)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                  event.preventDefault();
                  select(Math.min(options.length - 1, index + 1));
                } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                  event.preventDefault();
                  select(Math.max(0, index - 1));
                }
              }}
              data-selected={active}
              className="flex h-8 items-center gap-1.5 rounded-pill px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 data-[selected=true]:bg-foreground data-[selected=true]:text-background"
            >
              {option.labelKey ? t(locale, option.labelKey) : option.label}
              {option.soon && <Badge status="neutral">{t(locale, 'settings.appearance.soon')}</Badge>}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-neutral-500">{hint}</p>
    </div>
  );
}

// DIG-89 — подписи опций берутся из словаря по локали (labelKey); label —
// только для локально-независимых подписей латиницей («English»).
const LANGUAGES: Array<{ value: LanguagePreference; label?: string; soon?: boolean; labelKey?: SegmentedOption['labelKey'] }> = [
  { value: 'RU', labelKey: 'settings.appearance.lang.RU' },
  { value: 'EN', label: 'English', soon: true },
];

const FONT_SIZES: Array<{ value: FontSizePreference; labelKey: SegmentedOption['labelKey'] }> = [
  { value: 'NORMAL', labelKey: 'settings.appearance.font.NORMAL' },
  { value: 'LARGE', labelKey: 'settings.appearance.font.LARGE' },
  { value: 'XLARGE', labelKey: 'settings.appearance.font.XLARGE' },
];

// DIG-44 — вкладка «Вид»: язык (EN — заглушка «скоро»), размер шрифта и
// «Уменьшить анимацию». Тема — отдельный ThemePicker. Всё сохраняется server
// action'ом и применяется к кабинету сразу (root layout перевалидируется).
export function AppearanceSettings({
  language,
  fontSize,
  reduceMotion,
  locale = 'ru',
}: {
  language: LanguagePreference;
  fontSize: FontSizePreference;
  reduceMotion: boolean;
  /** DIG-89 — локаль интерфейса (cookie du-locale, дефолт ru). */
  locale: Locale;
}) {
  const [selectedLanguage, setSelectedLanguage] = useState<LanguagePreference>(language);
  const [selectedSize, setSelectedSize] = useState<FontSizePreference>(fontSize);
  const [motion, setMotion] = useState(reduceMotion);
  const [saved, setSaved] = useState(false);
  const [, startTransition] = useTransition();

  const persist = (run: () => Promise<boolean>) => {
    setSaved(false);
    startTransition(async () => {
      const ok = await run();
      if (ok) setSaved(true);
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <SegmentedGroup
        label={t(locale, 'settings.appearance.language')}
        groupLabel={t(locale, 'settings.appearance.languageGroup')}
        hint={t(locale, 'settings.appearance.languageHint')}
        options={LANGUAGES}
        selected={selectedLanguage}
        onSelect={(value) => {
          setSelectedLanguage(value as LanguagePreference);
          persist(() => saveLanguageAction(value));
        }}
        locale={locale}
      />

      <SegmentedGroup
        label={t(locale, 'settings.appearance.font')}
        groupLabel={t(locale, 'settings.appearance.fontGroup')}
        hint={t(locale, 'settings.appearance.fontHint')}
        options={FONT_SIZES}
        selected={selectedSize}
        onSelect={(value) => {
          setSelectedSize(value as FontSizePreference);
          persist(() => saveFontSizeAction(value));
        }}
        locale={locale}
      />

      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-neutral-900">{t(locale, 'settings.appearance.motion')}</p>
          <p className="text-xs text-neutral-600">
            {t(locale, 'settings.appearance.motionDesc')}
          </p>
        </div>
        <Toggle
          checked={motion}
          aria-label={t(locale, 'settings.appearance.motionAria')}
          onCheckedChange={(next) => {
            setMotion(next);
            persist(() => saveReduceMotionAction(next));
          }}
        />
      </div>

      <p aria-live="polite" role="status" className="text-xs text-neutral-500">
        {saved
          ? t(locale, 'settings.appearance.saved')
          : t(locale, 'settings.appearance.idle')}
      </p>
    </div>
  );
}
