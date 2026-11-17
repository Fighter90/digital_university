// DIG-68 — кнопка голоса «▲» (Product Hunt style): обычная форма c server
// action, работает и без JS. Повторный клик снимает голос (toggleMspVote
// в слое данных держит UNIQUE пару проект+студент), projectId едет скрытым
// полем — владелец голоса всегда сессия, ввод projectId проверяет слой.
import { ChevronUp } from 'lucide-react';

import { toggleMspVoteAction } from '@/server/actions/msp';
import { cn } from 'cn';

export function MspVoteButton({
  projectId,
  votes,
  votedByMe,
  testId,
  compact = false,
  canVote = true,
}: {
  projectId: string;
  votes: number;
  votedByMe: boolean;
  testId?: string;
  compact?: boolean;
  /** false — сотрудник: каталог читает, но не голосует (мутации студентов). */
  canVote?: boolean;
}) {
  if (!canVote) {
    return (
      <span
        data-testid={testId}
        title="Голосование доступно студентам"
        className={cn(
          'flex select-none flex-col items-center justify-center gap-0.5 rounded-button border border-border bg-muted px-3 text-muted-foreground',
          compact ? 'min-w-14 py-1.5 text-sm' : 'min-w-16 py-2',
        )}
      >
        <ChevronUp className={compact ? 'size-4' : 'size-5'} aria-hidden="true" />
        <span
          className="font-semibold tabular-nums"
          data-testid={testId ? `${testId}-count` : undefined}
        >
          {votes}
        </span>
        <span className="sr-only">Голосов: {votes}</span>
      </span>
    );
  }
  return (
    <form action={toggleMspVoteAction} data-testid={testId}>
      <input type="hidden" name="projectId" value={projectId} />
      <button
        type="submit"
        aria-pressed={votedByMe}
        title={votedByMe ? 'Убрать голос' : 'Голосовать за проект'}
        className={cn(
          'flex select-none flex-col items-center justify-center gap-0.5 rounded-button border px-3 shadow-soft transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral-600',
          compact ? 'min-w-14 py-1.5 text-sm' : 'min-w-16 py-2',
          votedByMe
            ? 'border-coral-400 bg-coral-100 text-coral-600 hover:bg-coral-200'
            : 'border-border bg-card text-foreground hover:bg-muted',
        )}
      >
        <ChevronUp className={compact ? 'size-4' : 'size-5'} aria-hidden="true" />
        <span
          className="font-semibold tabular-nums"
          data-testid={testId ? `${testId}-count` : undefined}
        >
          {votes}
        </span>
        <span className="sr-only">
          {votedByMe ? 'Голос учтён, нажмите, чтобы убрать' : 'Голосовать'}
        </span>
      </button>
    </form>
  );
}
