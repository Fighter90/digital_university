'use client';

import { useActionState } from 'react';
import { Star } from 'lucide-react';
import { cn } from 'cn';

import { toggleFavoritePersonAction, type FavoritePersonState } from '@/server/actions/people';
import { t, type Locale } from '@/lib/i18n';

// DIG-102 — переключатель «★ Добавить в Избранное» / «★ В Избранном» на
// карточке человека: server action форма (работает без JS), aria-pressed +
// говорящая aria-label. Ошибка (чужой id, не студент) — карточкой-алертом.
export interface FavoritePersonButtonProps {
  personId: string;
  personName: string;
  isFavorite: boolean;
  /** compact — иконка-звезда на карточке списка; labeled — кнопка с текстом. */
  variant?: 'compact' | 'labeled';
  locale?: Locale;
}

export function FavoritePersonButton({
  personId,
  personName,
  isFavorite,
  variant = 'compact',
  locale = 'ru',
}: FavoritePersonButtonProps) {
  const [state, formAction, isPending] = useActionState<FavoritePersonState, FormData>(
    toggleFavoritePersonAction,
    null,
  );

  const ariaLabel = isFavorite
    ? t(locale, 'people.fav.removeAria', { name: personName })
    : t(locale, 'people.fav.addAria', { name: personName });

  return (
    <form action={formAction} className="relative">
      {/* id и направление переключения едут с формой; сервер перепроверяет всё. */}
      <input type="hidden" name="personId" value={personId} />
      <input type="hidden" name="on" value={isFavorite ? '0' : '1'} />
      <button
        type="submit"
        disabled={isPending}
        aria-pressed={isFavorite}
        aria-label={variant === 'compact' ? ariaLabel : undefined}
        data-testid={`person-favorite-${personId}`}
        className={cn(
          'flex items-center gap-1.5 rounded-pill font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-coral-600',
          variant === 'compact'
            ? 'size-8 justify-center text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600'
            : 'border px-3.5 py-2 text-sm',
          variant === 'labeled' &&
            (isFavorite
              ? 'border-amber-500/60 text-amber-600 hover:bg-neutral-100'
              : 'border-border bg-card text-foreground hover:border-muted-foreground/40'),
        )}
      >
        <Star
          aria-hidden="true"
          className={cn('size-4', variant === 'compact' && 'size-5', isFavorite && 'fill-amber-400 text-amber-500')}
        />
        {variant === 'labeled' ? (
          isFavorite ? (
            t(locale, 'people.fav.added')
          ) : (
            t(locale, 'people.fav.add')
          )
        ) : null}
      </button>
      {state?.error ? (
        <p
          role="alert"
          className="absolute right-0 top-10 z-10 w-56 rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium text-error-ink shadow-soft"
        >
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
