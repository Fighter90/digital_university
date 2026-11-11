import { cn } from 'cn';

// DIG-13: Button — primary-градиент / secondary / ghost / danger, высоты 40 (sm) и 48 (md).
// Радиус 8px (--radius-button), hover — подъём 2px + тень hover (только primary).
// Кольцо фокуса — глобальный :focus-visible из globals.css.

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

const BASE =
  'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-button font-semibold transition-[transform,box-shadow,background-color,color,border-color] duration-150 disabled:pointer-events-none disabled:opacity-50';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'gradient-brand text-white shadow-soft lift-hover',
  secondary: 'border border-border bg-card text-foreground shadow-soft hover:bg-muted',
  ghost: 'text-foreground hover:bg-muted',
  danger: 'bg-error text-white hover:bg-error/90',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-10 px-4 text-sm',
  md: 'h-12 px-5 text-[15px]',
};

export function buttonVariants({
  variant = 'primary',
  size = 'md',
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}): string {
  // маркеры btn-* упрощают отладку и тесты вариантов
  return cn(`btn-${variant}`, `btn-${size}`, BASE, VARIANTS[variant], SIZES[size], className);
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  type = 'button',
  ...props
}: ButtonProps) {
  return <button type={type} className={buttonVariants({ variant, size, className })} {...props} />;
}
