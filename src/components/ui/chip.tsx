import { cn } from 'cn';

// DIG-13: Chip — фильтр-пилюля. Активный — чёрная заливка (bg-foreground),
// неактивный — белая карточка с границей.
export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

export function Chip({
  active = false,
  className,
  type = 'button',
  children,
  ...props
}: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={active}
      className={cn(
        'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-pill border px-4 text-sm font-medium transition-colors',
        active
          ? 'border-foreground bg-foreground text-background'
          : 'border-border bg-card text-foreground hover:border-muted-foreground/40',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
