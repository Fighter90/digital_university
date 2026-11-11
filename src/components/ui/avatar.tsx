import { cn } from 'cn';

// DIG-13: Avatar — инициалы (до двух слов) или фото, пилюля.
const SIZES = {
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-14 text-lg',
} as const;

export interface AvatarProps {
  name: string;
  src?: string;
  size?: keyof typeof SIZES;
  className?: string;
}

export function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
}

export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        className={cn('rounded-pill object-cover', SIZES[size], className)}
      />
    );
  }
  return (
    <span
      role="img"
      aria-label={name}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-pill bg-accent-soft font-bold text-accent-ink',
        SIZES[size],
        className,
      )}
    >
      {getInitials(name)}
    </span>
  );
}
