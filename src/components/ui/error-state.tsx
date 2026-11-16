import { TriangleAlert } from 'lucide-react';
import { cn } from 'cn';
import { Icon } from './icon';
import { Illustration } from './illustration';
import { buttonVariants } from './button';
import type { IllustrationName } from '@/lib/illustrations';

// DIG-13: ErrorState — состояние ошибки с кнопкой «Повторить».
// DIG-16: опциональная декоративная иллюстрация вместо иконки.
export interface ErrorStateProps {
  title?: string;
  description?: React.ReactNode;
  onRetry?: () => void;
  illustration?: IllustrationName;
  className?: string;
}

export function ErrorState({
  title = 'Что-то пошло не так',
  description = 'Попробуйте повторить запрос или вернуться позже.',
  onRetry,
  illustration,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-card border border-error-soft bg-card px-6 py-12 text-center',
        className,
      )}
    >
      {illustration ? (
        <Illustration name={illustration} className="-mt-1 h-32 w-32 md:h-40 md:w-40" />
      ) : (
        <span
          aria-hidden="true"
          className="flex size-14 items-center justify-center rounded-pill bg-error-soft text-error-ink"
        >
          <Icon icon={TriangleAlert} size={26} />
        </span>
      )}
      <h3 className="text-base font-extrabold tracking-heading">{title}</h3>
      <p className="max-w-xs text-sm text-muted-foreground">{description}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'mt-2')}
        >
          Повторить
        </button>
      ) : null}
    </div>
  );
}
