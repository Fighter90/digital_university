'use client';

// DIG-46 — плавающая панель AI-ассистента на всех экранах кабинета.
//
// Открывается кнопкой AI (плавающая на мобильном, в шапке — на десктопе).
// На ширине 360 px панель занимает ВЕСЬ вьюпорт (приёмка задачи); на
// десктопе — правый drawer 480 px. Фокус-ловушка и Esc — на базе Base UI
// Dialog (как Sheet DIG-13). Контекст чата грузится с
// /api/assistant/context (только данные владельца сессии) в момент
// открытия; поле ввода не перекрывается клавиатурой благодаря viewport
// meta interactive-widget=resizes-content (src/app/layout.tsx).

import { useEffect, useState } from 'react';
import { Dialog as BaseDialog } from '@base-ui/react/dialog';
import { RefreshCw, Sparkles, X } from 'lucide-react';

import type { AssistantContext } from '@/lib/assistant-engine';
import { t, type Locale } from '@/lib/i18n';
import { AssistantChat } from './assistant-chat';
import { Icon } from '@/components/ui/icon';

export interface AssistantPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** DIG-88 — локаль интерфейса (cookie du-locale, дефолт ru). */
  locale?: Locale;
}

export function AssistantPanel({ open, onOpenChange, locale = 'ru' }: AssistantPanelProps) {
  const [context, setContext] = useState<AssistantContext | null>(null);
  const [status, setStatus] = useState<'idle' | 'ready' | 'error'>('idle');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    // setState — только в колбэках промиса: без синхронных сетстейтов в теле
    // эффекта (react-hooks/set-state-in-effect). «Загружается» = статус idle.
    fetch('/api/assistant/context', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        const data = (await response.json()) as AssistantContext;
        if (cancelled) return;
        setContext(data);
        setStatus('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [open, reloadKey]);

  return (
    <BaseDialog.Root open={open} onOpenChange={onOpenChange}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="fixed inset-0 z-40 bg-foreground/25" />
        <BaseDialog.Popup
          aria-label={t(locale, 'assistant.panel.aria')}
          className={[
            // 360 px: панель на весь экран, чат полнофункциональный.
            'fixed inset-0 z-50 flex flex-col bg-neutral-50 outline-none',
            // десктоп: правый drawer.
            'md:inset-y-0 md:left-auto md:right-0 md:w-[480px] md:border-l md:border-border md:shadow-hover',
          ].join(' ')}
        >
          <header className="flex items-center gap-2 border-b border-border bg-card px-4 py-3">
            <span
              aria-hidden="true"
              className="grid size-8 shrink-0 place-items-center rounded-pill bg-coral-500 text-white"
            >
              <Sparkles className="size-4" />
            </span>
            <BaseDialog.Title className="flex-1 text-lg font-extrabold tracking-heading">
              {t(locale, 'assistant.panel.title')}
            </BaseDialog.Title>
            <BaseDialog.Close
              data-testid="assistant-panel-close"
              aria-label={t(locale, 'assistant.panel.closeAria')}
              className="-m-1.5 rounded-button p-2 text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral-600"
            >
              <Icon icon={X} size={18} />
            </BaseDialog.Close>
          </header>

          <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-3">
            {status === 'error' ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                <p className="text-sm text-muted-foreground">
                  {t(locale, 'assistant.panel.error')}
                </p>
                <button
                  type="button"
                  data-testid="assistant-panel-retry"
                  onClick={() => {
                    setStatus('idle');
                    setReloadKey((key) => key + 1);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-button bg-accent-soft px-3 py-2 text-sm font-semibold text-accent-ink hover:bg-accent-soft/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral-600"
                >
                  <RefreshCw className="size-4" aria-hidden="true" />
                  {t(locale, 'assistant.panel.retry')}
                </button>
              </div>
            ) : status === 'ready' && context !== null ? (
              <AssistantChat
                context={context}
                onNavigate={() => onOpenChange(false)}
                locale={locale}
              />
            ) : (
              // Скелетон загрузки контекста (панель открылась, данные в пути).
              <div
                className="flex flex-col gap-2"
                aria-hidden="true"
                data-testid="assistant-panel-skeleton"
              >
                <div className="h-11 animate-pulse animate-shimmer rounded-card bg-neutral-200/70" />
                <div className="h-16 animate-pulse animate-shimmer rounded-card bg-neutral-200/70" />
                <div className="h-16 animate-pulse animate-shimmer rounded-card bg-neutral-200/70" />
                <div className="h-11 animate-pulse animate-shimmer rounded-card bg-neutral-200/70" />
              </div>
            )}
          </div>
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}
