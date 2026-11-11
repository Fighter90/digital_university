'use client';

import { Dialog as BaseDialog } from '@base-ui/react/dialog';
import { X } from 'lucide-react';
import { cn } from 'cn';
import { Icon } from './icon';

// DIG-13: Sheet — боковая панель (справа на десктопе) / нижняя панель
// (на мобильном 360px). На базе base-ui Dialog: фокус-ловушка и Esc из коробки.
export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: SheetProps) {
  return (
    <BaseDialog.Root open={open} onOpenChange={onOpenChange}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="fixed inset-0 z-40 bg-foreground/25" />
        <BaseDialog.Popup
          className={cn(
            // мобильный: нижний лист; десктоп: правая панель
            'fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-block border-t border-border bg-card p-5 text-card-foreground shadow-hover outline-none',
            'sm:top-0 sm:bottom-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[420px] sm:rounded-t-none sm:rounded-l-block sm:border-t-0 sm:border-l',
            className,
          )}
        >
          <div className="mb-1 flex items-start justify-between gap-4">
            <BaseDialog.Title className="text-lg font-extrabold tracking-heading">
              {title}
            </BaseDialog.Title>
            <BaseDialog.Close
              aria-label="Закрыть панель"
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
