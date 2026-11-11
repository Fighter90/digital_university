'use client';

import { useRef } from 'react';
import { cn } from 'cn';

// DIG-13: Segmented — переключатель периода (День / Неделя / Месяц).
// role=radiogroup + role=radio, стрелки ←/→ перемещают выбор (roving tabindex).

export interface SegmentedOption<T extends string> {
  value: T;
  label: React.ReactNode;
}

export interface SegmentedProps<T extends string> {
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T;
  onChange: (value: T) => void;
  'aria-label': string;
  className?: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
  ...props
}: SegmentedProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const select = (index: number) => {
    onChange(options[index].value);
    refs.current[index]?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent, index: number) => {
    const delta =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0;
    if (delta === 0) return;
    event.preventDefault();
    const next = Math.min(options.length - 1, Math.max(0, index + delta));
    select(next);
  };

  return (
    <div
      role="radiogroup"
      className={cn('inline-flex rounded-pill border border-border bg-card p-1', className)}
      {...props}
    >
      {options.map((option, i) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => select(i)}
            onKeyDown={(event) => handleKeyDown(event, i)}
            className={cn(
              'h-8 rounded-pill px-4 text-sm font-medium transition-colors',
              selected
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
