import { cn } from 'cn';

// DIG-13: Skeleton — заглушка загрузки, скрыта от скринридеров.
// DIG-71: поверх pulse идёт shimmer — пробег световой полосы (transform-only).
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse animate-shimmer rounded-button bg-muted', className)}
      {...props}
    />
  );
}
