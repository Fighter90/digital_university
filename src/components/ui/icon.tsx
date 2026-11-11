import type { LucideIcon } from 'lucide-react';
import { cn } from 'cn';

// DIG-13: все иконки дизайн-системы — lucide-react (ISC) со stroke 1.8,
// как в макетах. Обёртка гарантирует единый вес линий по всему приложению.
export interface IconProps extends React.SVGProps<SVGSVGElement> {
  icon: LucideIcon;
  size?: number;
}

export function Icon({ icon: Glyph, size = 20, className, ...props }: IconProps) {
  return (
    <Glyph
      width={size}
      height={size}
      strokeWidth={1.8}
      aria-hidden="true"
      className={cn('shrink-0', className)}
      {...props}
    />
  );
}
