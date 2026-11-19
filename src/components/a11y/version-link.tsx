// DIG-100 — ссылка «Версия для слабовидящих» / «Обычная версия».
//
// Два размещения одной ссылки (паттерн LocaleSwitch — форма с server
// action, работает и без JavaScript):
//  - strip — полоска-ссылка НАД шапкой (Shell кабинета и шапка лендинга);
//  - footer — ссылка со значком Eye в футере (лендинг и Shell).
//
// Состояние приходит пропом plain (cookie du-a11y-version читают server
// layout'ы); клик вызывает owner-scoped action toggleA11yVersion
// (src/server/actions/a11y.ts) с hidden-полем version=plain|off.
// Поле next — внутренний путь возврата после входа (валидация в action).
//
// В plain-режиме CSS-слой .a11y-plain (в самом конце globals.css)
// перекрывает декоративные стили: полоска и ссылка остаются той же
// ссылкой в том же месте — текст из словаря a11y.version.* (RU/EN).
import { Eye } from 'lucide-react';

import { toggleA11yVersion } from '@/server/actions/a11y';
import { t, type Locale } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export function A11yVersionLink({
  locale,
  variant = 'strip',
  plain = false,
  next,
}: {
  locale: Locale;
  /** strip — полоска над шапкой; footer — ссылка со значком в футере */
  variant?: 'strip' | 'footer';
  /** Текущее состояние: cookie du-a11y-version = plain */
  plain?: boolean;
  /** Внутренний путь возврата после входа (валидация — в server action) */
  next?: string;
}) {
  const label = t(locale, plain ? 'a11y.version.standard' : 'a11y.version.plain');
  const isStrip = variant === 'strip';

  return (
    <form
      action={toggleA11yVersion}
      data-testid={isStrip ? 'a11y-version-strip' : 'a11y-version-footer'}
      aria-label={label}
      className={cn(isStrip && 'border-b border-neutral-200 bg-white')}
    >
      {isStrip ? (
        <div className="mx-auto w-full max-w-[1440px] px-3 py-1.5 md:px-6">
          <VersionButton label={label} plain={plain} next={next} />
        </div>
      ) : (
        <VersionButton label={label} plain={plain} next={next} withIcon />
      )}
    </form>
  );
}

/** Кнопка-ссылка версии: hidden version + optional next, значок Eye в футере. */
function VersionButton({
  label,
  plain,
  next,
  withIcon = false,
}: {
  label: string;
  plain: boolean;
  next?: string;
  withIcon?: boolean;
}) {
  return (
    <>
      <input type="hidden" name="version" value={plain ? 'off' : 'plain'} />
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <button
        type="submit"
        data-testid="a11y-version-link"
        className="inline-flex items-center gap-1.5 py-1 text-left text-sm font-medium text-neutral-700 underline decoration-1 underline-offset-2 transition-colors hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-coral-600"
      >
        {withIcon && <EyeIcon />}
        {label}
      </button>
    </>
  );
}

/** Значок Eye (lucide) — только вариант footer; aria-hidden, текст самодостаточен. */
function EyeIcon() {
  return <Eye size={16} aria-hidden="true" data-testid="a11y-version-eye" className="shrink-0" />;
}
