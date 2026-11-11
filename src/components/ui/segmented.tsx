'use client';

import { useRef } from 'react';
import { cn } from 'cn';

// DIG-13: Segmented — переключатель периода (День / Неделя / Месяц).
// role=radiogroup + role=radio, стрелки ←/→ перемещают выбор (roving tabindex).
// DIG-23: опция может быть disabled («Неделя» на десктопе до недельной сетки
// DIG-22) — она пропускается при навигации стрелками и помечается aria-disabled.

export interface SegmentedOption<T extends string> {
  value: T;
  label: React.ReactNode;
  /** Недоступный вид (например, «Неделя» на десктопе до merge DIG-22). */
  disabled?: boolean;
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
    const option = options[index];
    if (!option || option.disabled) return;
    onChange(option.value);
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
    let next = index + delta;
    while (next >= 0 && next < options.length && options[next].disabled) {
      next += delta;
    }
    if (next >= 0 && next < options.length) select(next);
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
            aria-disabled={option.disabled || undefined}
            tabIndex={selected ? 0 : -1}
            disabled={option.disabled}
            onClick={() => select(i)}
            onKeyDown={(event) => handleKeyDown(event, i)}
            className={cn(
              'h-8 rounded-pill px-4 text-sm font-medium transition-colors',
              selected
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:text-foreground',
              option.disabled && 'cursor-not-allowed opacity-50 hover:text-muted-foreground',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
