'use client';

import { Dialog as BaseDialog } from '@base-ui/react/dialog';
import { X } from 'lucide-react';
import { cn } from 'cn';
import { Icon } from './icon';

// DIG-13: Dialog — модальное окно по центру (base-ui: фокус-ловушка, Esc,
// закрытие по клику вне — из коробки). Радиус крупного блока 24px.
export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: DialogProps) {
  return (
    <BaseDialog.Root open={open} onOpenChange={onOpenChange}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="fixed inset-0 z-40 bg-foreground/25" />
        <BaseDialog.Popup
          className={cn(
            'fixed top-1/2 left-1/2 z-50 w-[min(440px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-block border border-border bg-card p-6 text-card-foreground shadow-hover outline-none',
            className,
          )}
        >
          <div className="mb-1 flex items-start justify-between gap-4">
            <BaseDialog.Title className="text-lg font-extrabold tracking-heading">
              {title}
            </BaseDialog.Title>
            <BaseDialog.Close
              aria-label="Закрыть окно"
              className="-m-2 rounded-button p-2 text-muted-foreground hover:text-foreground"
            >
              <Icon icon={X} size={18} />
            </BaseDialog.Close>
          </div>
          {description ? (
            <BaseDialog.Description className="text-sm text-muted-foreground">
              {description}
            </BaseDialog.Description>
          ) : null}
          {children ? <div className="mt-4">{children}</div> : null}
          {footer ? <div className="mt-6 flex justify-end gap-3">{footer}</div> : null}
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}
