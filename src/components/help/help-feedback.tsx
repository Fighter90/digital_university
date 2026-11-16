'use client';

// DIG-38 — «Полезно? Да / Нет» на странице статьи. Отзыв — клиентское
// состояние прототипа (нет модели в спеке данных DIG-9, см. non-goals
// change-папки). Delta-спека help-knowledge-base: после ответа видна
// благодарность и повторный выбор возможен — кнопки остаются, голос
// можно сменить (выбранный вариант отмечен aria-pressed).
import { useState } from 'react';
import { ThumbsDown, ThumbsUp } from 'lucide-react';

type Vote = 'yes' | 'no';

const voteButtonClasses = (active: boolean) =>
  `inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-button border px-4 text-sm font-semibold shadow-soft transition-colors sm:flex-none ${
    active
      ? 'border-foreground bg-foreground text-background'
      : 'border-border bg-card text-foreground hover:bg-muted'
  }`;

export function HelpFeedback() {
  const [vote, setVote] = useState<Vote | null>(null);

  return (
    <div
      data-testid="help-feedback"
      className="mt-6 flex flex-col gap-3 rounded-card border border-border bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-sm font-semibold">
        Полезно?{' '}
        {vote !== null ? <span className="text-success-ink">Спасибо! Ваш отзыв учтён.</span> : null}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          data-testid="help-feedback-yes"
          aria-pressed={vote === 'yes'}
          onClick={() => setVote('yes')}
          className={voteButtonClasses(vote === 'yes')}
        >
          <ThumbsUp aria-hidden="true" className="size-4" />
          Да
        </button>
        <button
          type="button"
          data-testid="help-feedback-no"
          aria-pressed={vote === 'no'}
          onClick={() => setVote('no')}
          className={voteButtonClasses(vote === 'no')}
        >
          <ThumbsDown aria-hidden="true" className="size-4" />
          Нет
        </button>
      </div>
    </div>
  );
}
