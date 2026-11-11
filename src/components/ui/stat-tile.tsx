import type { LucideIcon } from 'lucide-react';
import { cn } from 'cn';
import { Icon } from './icon';

// DIG-13: StatTile — плитка показателя (успеваемость, посещаемость, заявки).
export interface StatTileProps {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  className?: string;
}

export function StatTile({ label, value, hint, icon, className }: StatTileProps) {
  return (
    <div
      className={cn(
        'rounded-card border border-border bg-card p-4 shadow-soft lift-hover',
        className,
      )}
    >
      <div className="flex items-center gap-2">
        {icon ? (
          <span className="flex size-8 items-center justify-center rounded-pill bg-accent-soft text-accent-ink">
            <Icon icon={icon} size={16} />
          </span>
        ) : null}
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-extrabold tracking-heading">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
