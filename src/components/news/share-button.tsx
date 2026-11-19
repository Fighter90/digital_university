'use client';

import { useRef, useState } from 'react';
import { Check, Share2 } from 'lucide-react';
import { t, type Locale } from '@/lib/i18n';

// DIG-36 — «Поделиться ссылкой» на странице новости: копирует текущий URL
// через clipboard API; без разрешения/доступа — фолбэк на execCommand
// (кнопка работает без подтверждений и не требует серверного action).
// Статус — aria-live (role=status), чтобы скринридер озвучил результат.
export function ShareButton({ locale = 'ru' }: { locale?: Locale }) {
  const [copied, setCopied] = useState(false);
  const resetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copy = async () => {
    const url = window.location.href;
    let ok = false;
    try {
      await navigator.clipboard.writeText(url);
      ok = true;
    } catch {
      // Fallback для контекстов без clipboard-разрешения (в т.ч. e2e).
      try {
        const textarea = document.createElement('textarea');
        textarea.value = url;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        ok = document.execCommand('copy');
        textarea.remove();
      } catch {
        ok = false;
      }
    }
    setCopied(ok);
    if (resetRef.current) clearTimeout(resetRef.current);
    resetRef.current = setTimeout(() => setCopied(false), 4000);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => void copy()}
        data-testid="news-share"
        className="inline-flex items-center gap-1.5 rounded-button border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground shadow-soft transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-coral-600"
      >
        {copied ? (
          <Check aria-hidden="true" className="size-4 text-emerald-600" />
        ) : (
          <Share2 aria-hidden="true" className="size-4" />
        )}
        {t(locale, 'news.share')}
      </button>
      <span
        role="status"
        aria-live="polite"
        data-testid="news-share-status"
        className="text-sm text-muted-foreground"
      >
        {copied ? t(locale, 'news.share.copied') : ''}
      </span>
    </div>
  );
}
