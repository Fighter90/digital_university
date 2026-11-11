'use client';

import { Check, Download, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from 'cn';
import { Icon } from './icon';

// DIG-13: Stepper — 5 шагов заявки. Состояния: done / current / pending /
// rejected / ready. Текущий шаг помечен aria-current="step".

export type StepState = 'done' | 'current' | 'pending' | 'rejected' | 'ready';

const STEP_META: Record<StepState, { circle: string; text: string; icon?: LucideIcon }> = {
  done: {
    circle: 'border-success bg-success text-white',
    text: 'text-foreground',
    icon: Check,
  },
  current: {
    circle: 'gradient-brand border-transparent text-white shadow-soft',
    text: 'text-foreground font-bold',
  },
  pending: {
    circle: 'border-border bg-card text-muted-foreground',
    text: 'text-muted-foreground',
  },
  rejected: {
    circle: 'border-error bg-error-soft text-error-ink',
    text: 'text-error-ink line-through',
    icon: X,
  },
  ready: {
    circle: 'border-info bg-info-soft text-info-ink',
    text: 'text-info-ink font-bold',
    icon: Download,
  },
};

export interface StepperProps {
  steps: ReadonlyArray<{ label: string }>;
  states: ReadonlyArray<StepState>;
  className?: string;
}

export function Stepper({ steps, states, className }: StepperProps) {
  return (
    <ol aria-label="Шаги заявки" className={cn('flex w-full', className)}>
      {steps.map((step, i) => {
        const state = states[i] ?? 'pending';
        const meta = STEP_META[state];
        return (
          <li
            key={`${step.label}-${i}`}
            aria-current={state === 'current' ? 'step' : undefined}
            className={cn(
              'stepper-step',
              `stepper-${state}`,
              'relative flex min-w-0 flex-1 flex-col items-center gap-1.5',
            )}
          >
            <span
              className={cn(
                'flex size-8 items-center justify-center rounded-pill border text-sm font-bold',
                meta.circle,
              )}
            >
              {meta.icon ? (
                <Icon icon={meta.icon} size={15} />
              ) : (
                <span aria-hidden="true">{i + 1}</span>
              )}
            </span>
            <span className={cn('max-w-full truncate text-center text-xs', meta.text)}>
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
