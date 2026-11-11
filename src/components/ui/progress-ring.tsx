import { cn } from 'cn';

// DIG-13: ProgressRing — круговой индикатор прогресса (успеваемость, заявки).

export interface ProgressRingProps {
  value: number;
  label: string;
  size?: number;
  stroke?: number;
  className?: string;
  children?: React.ReactNode;
}

export function ProgressRing({
  value,
  label,
  size = 64,
  stroke = 6,
  className,
  children,
}: ProgressRingProps) {
  const clamped = Math.min(100, Math.max(0, Math.round(value)));
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - clamped / 100);

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      className={cn('relative inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--border)"
          strokeWidth={stroke}
        />
        <circle
          className="progress-arc"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--du-accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      {children ? (
        <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">
          {children}
        </span>
      ) : null}
    </div>
  );
}
