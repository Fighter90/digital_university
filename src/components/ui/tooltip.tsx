'use client';

import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip';
import { cn } from 'cn';

// DIG-13: Tooltip — подсказка по фокусу/наведению (base-ui). Тёмный пилюль-фон,
// белый текст; открывается и с клавиатуры (триггер фокусируемый).
export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

export function Tooltip({ content, children, side = 'top', className }: TooltipProps) {
  return (
    <BaseTooltip.Provider>
      <BaseTooltip.Root>
        <BaseTooltip.Trigger
          render={
            <button
              type="button"
              aria-label={typeof content === 'string' ? content : 'Подсказка'}
              className="cursor-help align-middle"
            />
          }
        >
          {children}
        </BaseTooltip.Trigger>
        <BaseTooltip.Portal>
          <BaseTooltip.Positioner side={side} sideOffset={6} className="z-50 outline-none">
            <BaseTooltip.Popup
              className={cn(
                'rounded-button bg-foreground px-3 py-1.5 text-xs font-medium text-background shadow-soft',
                className,
              )}
            >
              {content}
            </BaseTooltip.Popup>
          </BaseTooltip.Positioner>
        </BaseTooltip.Portal>
      </BaseTooltip.Root>
    </BaseTooltip.Provider>
  );
}
