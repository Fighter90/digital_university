import { cn } from 'cn';

// DIG-13: Skeleton — заглушка загрузки, скрыта от скринридеров.
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-button bg-muted', className)}
      {...props}
    />
  );
}
