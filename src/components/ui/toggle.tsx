'use client';

import { useState } from 'react';
import { cn } from 'cn';

// DIG-13: Toggle — переключатель (role=switch), клавиатурный (кнопка).
export interface ToggleProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'onChange' | 'checked'
> {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

export function Toggle({
  checked,
  defaultChecked = false,
  onCheckedChange,
  className,
  ...props
}: ToggleProps) {
  const [internal, setInternal] = useState(defaultChecked);
  const isOn = checked ?? internal;

  const handleClick = () => {
    const next = !isOn;
    if (onCheckedChange) {
      onCheckedChange(next);
    } else {
      setInternal(next);
    }
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isOn}
      onClick={handleClick}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-pill border transition-colors',
        isOn ? 'gradient-brand border-transparent' : 'border-border bg-muted',
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          'inline-block size-4 rounded-pill border border-border bg-white shadow-soft transition-transform',
          isOn ? 'translate-x-6' : 'translate-x-1',
        )}
      />
    </button>
  );
}
