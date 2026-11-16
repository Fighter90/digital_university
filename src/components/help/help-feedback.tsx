'use client';

// DIG-38 — «Полезно? Да / Нет» на странице статьи. Отзыв — клиентское
// состояние прототипа (нет модели в спеке данных DIG-9, см. non-goals
// change-папки), после ответа — благодарность вместо вопросительного блока.
import { useState } from 'react';
import { ThumbsDown, ThumbsUp } from 'lucide-react';

type Vote = 'yes' | 'no';

export function HelpFeedback() {
  const [vote, setVote] = useState<Vote | null>(null);

  return (
    <div
      data-testid="help-feedback"
      className="mt-6 flex flex-col gap-3 rounded-card border border-border bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      {vote === null ? (
        <>
          <p className="text-sm font-semibold">Полезно?</p>
          <div className="flex gap-2">
            <button
              type="button"
              data-testid="help-feedback-yes"
              onClick={() => setVote('yes')}
              className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-button border border-border bg-card px-4 text-sm font-semibold text-foreground shadow-soft transition-colors hover:bg-muted sm:flex-none"
            >
              <ThumbsUp aria-hidden="true" className="size-4" />
              Да
            </button>
            <button
              type="button"
              data-testid="help-feedback-no"
              onClick={() => setVote('no')}
              className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-button border border-border bg-card px-4 text-sm font-semibold text-foreground shadow-soft transition-colors hover:bg-muted sm:flex-none"
            >
              <ThumbsDown aria-hidden="true" className="size-4" />
              Нет
            </button>
          </div>
        </>
      ) : (
        <p className="text-sm font-semibold text-success-ink">
          Спасибо! Ваш отзыв учтён — деканат дорабатывает базу ответов.
        </p>
      )}
    </div>
  );
}
