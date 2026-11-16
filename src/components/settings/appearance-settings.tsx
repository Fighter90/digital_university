'use client';

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
  label: string;
  soon?: boolean;
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
}: {
  /** Видимая подпись блока. */
  label: string;
  groupLabel: string;
  hint: string;
  options: SegmentedOption[];
  selected: string;
  onSelect: (value: string) => void;
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
              {option.label}
              {option.soon && <Badge status="neutral">скоро</Badge>}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-neutral-500">{hint}</p>
    </div>
  );
}

const LANGUAGES: Array<{ value: LanguagePreference; label: string; soon?: boolean }> = [
  { value: 'RU', label: 'Русский' },
  { value: 'EN', label: 'English', soon: true },
];

const FONT_SIZES: Array<{ value: FontSizePreference; label: string }> = [
  { value: 'NORMAL', label: 'Обычный' },
  { value: 'LARGE', label: 'Крупный' },
  { value: 'XLARGE', label: 'Очень крупный' },
];

// DIG-44 — вкладка «Вид»: язык (EN — заглушка «скоро»), размер шрифта и
// «Уменьшить анимацию». Тема — отдельный ThemePicker. Всё сохраняется server
// action'ом и применяется к кабинету сразу (root layout перевалидируется).
export function AppearanceSettings({
  language,
  fontSize,
  reduceMotion,
}: {
  language: LanguagePreference;
  fontSize: FontSizePreference;
  reduceMotion: boolean;
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
        label="Язык"
        groupLabel="Язык интерфейса"
        hint="Английский появится в отдельном обновлении — выбрать его пока нельзя."
        options={LANGUAGES}
        selected={selectedLanguage}
        onSelect={(value) => {
          setSelectedLanguage(value as LanguagePreference);
          persist(() => saveLanguageAction(value));
        }}
      />

      <SegmentedGroup
        label="Размер шрифта"
        groupLabel="Размер шрифта"
        hint="Размер применяется ко всему кабинету."
        options={FONT_SIZES}
        selected={selectedSize}
        onSelect={(value) => {
          setSelectedSize(value as FontSizePreference);
          persist(() => saveFontSizeAction(value));
        }}
      />

      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-neutral-900">Уменьшить анимацию</p>
          <p className="text-xs text-neutral-600">
            Отключает плавные переходы и перемещения интерфейса.
          </p>
        </div>
        <Toggle
          checked={motion}
          aria-label="Уменьшить анимацию"
          onCheckedChange={(next) => {
            setMotion(next);
            persist(() => saveReduceMotionAction(next));
          }}
        />
      </div>

      <p aria-live="polite" role="status" className="text-xs text-neutral-500">
        {saved
          ? 'Сохранено — настройки вида применены ко всему кабинету.'
          : 'Изменения сохраняются сразу и применяются ко всему кабинету.'}
      </p>
    </div>
  );
}
