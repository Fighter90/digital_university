import { Inbox } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from 'cn';
import { Icon } from './icon';

// DIG-13: EmptyState — пустое состояние: иллюстрация + текст + CTA.
export interface EmptyStateProps {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  icon?: LucideIcon;
  className?: string;
}

export function EmptyState({
  title,
  description,
  action,
  icon = Inbox,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-card border border-dashed border-border bg-card px-6 py-12 text-center',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="flex size-14 items-center justify-center rounded-pill bg-accent-soft text-accent-ink"
      >
        <Icon icon={icon} size={26} />
      </span>
      <h3 className="text-base font-extrabold tracking-heading">{title}</h3>
      {description ? <p className="max-w-xs text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
