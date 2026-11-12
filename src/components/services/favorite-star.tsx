'use client';

import { useActionState } from 'react';
import { Star } from 'lucide-react';
import { cn } from 'cn';

import { toggleFavoriteAction, type FavoriteState } from '@/server/actions/services';

// DIG-29 — звёздочка избранного на карточке сервиса: server action форма
// (работает без JS), aria-pressed + говорящая aria-label. Ошибки — лимит
// «не больше 6» и некорректный id — показываются карточкой-алертом рядом.
export interface FavoriteStarProps {
  serviceId: string;
  serviceTitle: string;
  isFavorite: boolean;
}

export function FavoriteStar({ serviceId, serviceTitle, isFavorite }: FavoriteStarProps) {
  const [state, formAction, isPending] = useActionState<FavoriteState, FormData>(
    toggleFavoriteAction,
    null,
  );

  return (
    <form action={formAction} className="absolute right-3 top-3">
      {/* id и направление переключения едут с формой; сервер перепроверяет всё. */}
      <input type="hidden" name="serviceId" value={serviceId} />
      <input type="hidden" name="on" value={isFavorite ? '0' : '1'} />
      <button
        type="submit"
        disabled={isPending}
        aria-pressed={isFavorite}
        aria-label={
          isFavorite
            ? `Убрать «${serviceTitle}» из избранного`
            : `Добавить «${serviceTitle}» в избранное`
        }
        data-testid={`favorite-toggle-${serviceId}`}
        className="flex size-8 items-center justify-center rounded-pill text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-coral-600"
      >
        <Star
          aria-hidden="true"
          className={cn('size-5', isFavorite && 'fill-amber-400 text-amber-500')}
        />
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
