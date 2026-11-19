// DIG-33 — номер заявки копируется кнопкой (боль аудита: номер нельзя
// было ни выделить удобно, ни передать в деканат без опечаток).
// Копирование — best-effort: clipboard API, при отказе — fallback на
// скрытый textarea + execCommand (старые WebView на 360 px).
'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { t, type Locale } from '@/lib/i18n';

export function CopyRequestNumber({
  number,
  locale = 'ru',
}: {
  number: string;
  /** DIG-84 — локаль интерфейса (cookie du-locale, дефолт ru). */
  locale?: Locale;
}) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const copy = async () => {
    let ok = false;
    try {
      await navigator.clipboard.writeText(number);
      ok = true;
    } catch {
      // Fallback без clipboard API (не secure context / отказ разрешения).
      try {
        const textarea = document.createElement('textarea');
        textarea.value = number;
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
    if (ok) {
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      data-testid="copy-request-number"
      aria-label={t(locale, 'requests.copyAria', { number })}
      className="inline-flex items-center gap-1 rounded-button px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-coral-600"
    >
      {copied ? (
        <Check aria-hidden="true" className="size-3.5 text-success" />
      ) : (
        <Copy aria-hidden="true" className="size-3.5" />
      )}
      {copied ? t(locale, 'requests.copied') : t(locale, 'requests.copy')}
    </button>
  );
}
