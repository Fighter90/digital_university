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

const buttonClass =
  'inline-flex select-none items-center justify-center gap-2 rounded-button bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground shadow-soft transition-colors hover:bg-accent-strong disabled:pointer-events-none disabled:opacity-50';

const inputClass =
  'rounded-button border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-coral-600';

export function MspLaunchComposer() {
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
        Запустить проект
      </button>
    );
  }

  return (
    <section
      data-testid="msp-composer"
      aria-label="Новый запуск проекта"
      className="flex min-w-0 flex-col gap-3"
    >
      <h2 className="text-base font-semibold">Запустить проект</h2>
      <p className="text-xs text-muted-foreground">
        Расскажите о студенческом стартапе: что это, для кого и какая польза. Только вымышленные
        проекты и никаких реальных компаний — каталог концепта для конкурса.
      </p>

      <form
        action={formAction}
        data-testid="msp-composer-form"
        className="flex flex-col gap-3 rounded-card border border-border bg-card p-4 shadow-soft"
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Название</span>
          <input
            type="text"
            name="title"
            data-testid="msp-launch-title"
            required
            minLength={MIN_MSP_TITLE_LENGTH}
            maxLength={MAX_MSP_TITLE_LENGTH}
            placeholder="Конспект-бот"
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Краткое описание (слоган)</span>
          <input
            type="text"
            name="tagline"
            data-testid="msp-launch-tagline"
            required
            minLength={MIN_MSP_TAGLINE_LENGTH}
            maxLength={MAX_MSP_TAGLINE_LENGTH}
            placeholder="ИИ-конспекты лекций за минуту"
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">О проекте</span>
          <textarea
            name="description"
            data-testid="msp-launch-description"
            rows={5}
            required
            minLength={MIN_MSP_DESCRIPTION_LENGTH}
            maxLength={MAX_MSP_DESCRIPTION_LENGTH}
            placeholder="Что умеет проект, для кого он и какая проблема решается — чем конкретнее, тем интереснее каталогу"
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">
            Теги (через запятую, до {MAX_MSP_TAGS} по {MAX_MSP_TAG_LENGTH} символов)
          </span>
          <input
            type="text"
            name="tags"
            data-testid="msp-launch-tags"
            placeholder="ai, учёба, конспекты"
            className={inputClass}
          />
        </label>

        <div className="flex items-center gap-2">
          <button type="submit" disabled={isPending} className={buttonClass}>
            {isPending ? 'Публикуем…' : 'Опубликовать запуск'}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="inline-flex select-none items-center rounded-button border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Отмена
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
