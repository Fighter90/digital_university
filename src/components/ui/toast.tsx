'use client';

import { CircleCheck, CircleX, Info, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { cn } from 'cn';
import { Icon } from './icon';

// DIG-13: Toast — всплывающие уведомления. Провайдер + хук useToast().
// Роль status (aria-live), автозакрытие 5 с, кнопка «Закрыть».

export type ToastTone = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
}

interface ToastApi {
  toast: (input: { title: string; description?: string; tone?: ToastTone }) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const TONE_META: Record<ToastTone, { icon: LucideIcon; accent: string; border: string }> = {
  success: { icon: CircleCheck, accent: 'text-success-ink', border: 'border-success-soft' },
  error: { icon: CircleX, accent: 'text-error-ink', border: 'border-error-soft' },
  info: { icon: Info, accent: 'text-info-ink', border: 'border-info-soft' },
};

const AUTO_DISMISS_MS = 5000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback<ToastApi['toast']>(
    ({ title, description, tone = 'info' }) => {
      const id = nextId.current++;
      setItems((current) => [...current, { id, title, description, tone }]);
      window.setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-label="Уведомления"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:items-end"
      >
        {items.map((item) => (
          <div
            key={item.id}
            role="status"
            data-tone={item.tone}
            className={cn(
              'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-card border bg-card p-4 shadow-hover',
              TONE_META[item.tone].border,
            )}
          >
            <Icon
              icon={TONE_META[item.tone].icon}
              size={20}
              className={TONE_META[item.tone].accent}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{item.title}</p>
              {item.description ? (
                <p className="mt-0.5 text-sm text-muted-foreground">{item.description}</p>
              ) : null}
            </div>
            <button
              type="button"
              aria-label="Закрыть уведомление"
              onClick={() => dismiss(item.id)}
              className="-m-1 rounded-button p-1 text-muted-foreground hover:text-foreground"
            >
              <Icon icon={X} size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast должен вызываться внутри <ToastProvider>');
  }
  return ctx;
}
