'use client';

// DIG-68 — композер запуска «Запустить проект»: название, краткое описание,
// описание и теги через запятую. Server action createMspProjectAction при
// успехе делает redirect на карточку /msp/<slug> (slug генерирует слой
// данных). Кнопка раскрывает форму (как «Новое обращение» на /feedback) —
// на десктопе панель композера живёт в правой колонке сетки.
import { useActionState, useState } from 'react';
import { Rocket } from 'lucide-react';

import { createMspProjectAction, type MspActionState } from '@/server/actions/msp';
import {
  MAX_MSP_DESCRIPTION_LENGTH,
  MAX_MSP_TAGLINE_LENGTH,
  MAX_MSP_TAG_LENGTH,
  MAX_MSP_TAGS,
  MAX_MSP_TITLE_LENGTH,
  MIN_MSP_DESCRIPTION_LENGTH,
  MIN_MSP_TAGLINE_LENGTH,
  MIN_MSP_TITLE_LENGTH,
} from '@/lib/msp';
import { t, type Locale } from '@/lib/i18n';

const buttonClass =
  'inline-flex select-none items-center justify-center gap-2 rounded-button bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground shadow-soft transition-colors hover:bg-accent-strong disabled:pointer-events-none disabled:opacity-50';

const inputClass =
  'rounded-button border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-coral-600';

export function MspLaunchComposer({ locale = 'ru' }: { locale?: Locale }) {
  const [state, formAction, isPending] = useActionState<MspActionState, FormData>(
    createMspProjectAction,
    null,
  );
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        data-testid="msp-launch-open"
        onClick={() => setOpen(true)}
        className={buttonClass}
      >
        <Rocket className="size-4" aria-hidden="true" />
        {t(locale, 'msp.launch.cta')}
      </button>
    );
  }

  return (
    <section
      data-testid="msp-composer"
      aria-label={t(locale, 'msp.launch.aria')}
      className="flex min-w-0 flex-col gap-3"
    >
      <h2 className="text-base font-semibold">{t(locale, 'msp.launch.title')}</h2>
      <p className="text-xs text-muted-foreground">
        {t(locale, 'msp.launch.desc')}
      </p>

      <form
        action={formAction}
        data-testid="msp-composer-form"
        className="flex flex-col gap-3 rounded-card border border-border bg-card p-4 shadow-soft"
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t(locale, 'msp.launch.name')}</span>
          <input
            type="text"
            name="title"
            data-testid="msp-launch-title"
            required
            minLength={MIN_MSP_TITLE_LENGTH}
            maxLength={MAX_MSP_TITLE_LENGTH}
            placeholder={t(locale, 'msp.namePlaceholder')}
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t(locale, 'msp.launch.tagline')}</span>
          <input
            type="text"
            name="tagline"
            data-testid="msp-launch-tagline"
            required
            minLength={MIN_MSP_TAGLINE_LENGTH}
            maxLength={MAX_MSP_TAGLINE_LENGTH}
            placeholder={t(locale, 'msp.launch.taglinePlaceholder')}
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t(locale, 'msp.launch.about')}</span>
          <textarea
            name="description"
            data-testid="msp-launch-description"
            rows={5}
            required
            minLength={MIN_MSP_DESCRIPTION_LENGTH}
            maxLength={MAX_MSP_DESCRIPTION_LENGTH}
            placeholder={t(locale, 'msp.launch.aboutPlaceholder')}
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">
            {t(locale, 'msp.launch.tags', { max: MAX_MSP_TAGS, length: MAX_MSP_TAG_LENGTH })}
          </span>
          <input
            type="text"
            name="tags"
            data-testid="msp-launch-tags"
            placeholder={t(locale, 'msp.launch.tagsPlaceholder')}
            className={inputClass}
          />
        </label>

        <div className="flex items-center gap-2">
          <button type="submit" disabled={isPending} className={buttonClass}>
            {isPending ? t(locale, 'msp.launch.submitting') : t(locale, 'msp.launch.submit')}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="inline-flex select-none items-center rounded-button border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            {t(locale, 'msp.launch.cancel')}
          </button>
        </div>
        {state?.error ? (
          <p role="alert" className="text-sm font-medium text-error-ink">
            {state.error}
          </p>
        ) : null}
      </form>
    </section>
  );
}
