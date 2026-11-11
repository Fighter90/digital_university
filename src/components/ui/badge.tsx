import { cn } from 'cn';

// DIG-13: Badge — единый словарь статусов. Мягкий вариант: soft-фон + ink-текст
// (контраст AA ≥ 4.5:1, см. tests/design-tokens.test.ts); solid — цветная
// заливка с белой надписью.

export type BadgeStatus = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'accent';
export type BadgeVariant = 'soft' | 'solid';

export const BADGE_STYLES: Record<BadgeStatus, { soft: string; solid: string }> = {
  success: {
    soft: 'border-success-soft bg-success-soft text-success-ink',
    solid: 'border-success bg-success text-white',
  },
  warning: {
    soft: 'border-warning-soft bg-warning-soft text-warning-ink',
    solid: 'border-warning bg-warning text-white',
  },
  error: {
    soft: 'border-error-soft bg-error-soft text-error-ink',
    solid: 'border-error bg-error text-white',
  },
  info: {
    soft: 'border-info-soft bg-info-soft text-info-ink',
    solid: 'border-info bg-info text-white',
  },
  neutral: {
    soft: 'border-border bg-muted text-muted-foreground',
    solid: 'border-foreground bg-foreground text-background',
  },
  accent: {
    soft: 'border-accent-soft bg-accent-soft text-accent-ink',
    solid: 'border-accent bg-accent text-white',
  },
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status?: BadgeStatus;
  variant?: BadgeVariant;
}

export function Badge({ status = 'neutral', variant = 'soft', className, ...props }: BadgeProps) {
  return (
    <span
      data-status={status}
      className={cn(
        `badge-${status}`,
        variant === 'soft' ? 'badge-soft' : 'badge-solid',
        'inline-flex w-fit items-center gap-1 rounded-pill border px-2.5 py-0.5 text-xs font-semibold',
        BADGE_STYLES[status][variant],
        className,
      )}
      {...props}
    />
  );
}
