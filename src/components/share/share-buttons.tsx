'use client';

// DIG-101 — блок «Поделиться» (статьи справки, новости, детали пары).
//
// Четыре кнопки-иконки (lucide): Share2 → ВКонтакте, Send → Telegram,
// MessageCircle → WhatsApp, Link → «Скопировать ссылку». Шеры открывают
// share-URL сервиса в новой вкладке (target=_blank + rel=noreferrer
// noopener — обратная утечка referrer и window.opener закрыты). Копирование
// — navigator.clipboard с фолбэком execCommand (паттерн ShareButton DIG-36)
// и видимым подтверждением «Ссылка скопирована» в aria-live (role=status).
//
// Корень-относительный url (страницы отдают «/help/x») становится
// абсолютным на клиенте (window.location.origin) — SSR-страница не зависит
// от заголовков прокси; до гидрации href остаётся переданным значением.

import { useEffect, useRef, useState } from 'react';
import { Check, Link, MessageCircle, Send, Share2 } from 'lucide-react';

import { t, type Locale } from '@/lib/i18n';
import { absoluteShareUrl, telegramShareUrl, vkShareUrl, whatsappShareUrl } from '@/lib/share-urls';

export interface ShareButtonsProps {
  /** Ссылка для шаринга (абсолютная или корень-относительная «/path»). */
  url: string;
  /** Заголовок — текст шаринга в Telegram/WhatsApp. */
  title: string;
  /** Локаль подписей (cookie du-locale; дефолт ru). */
  locale?: Locale;
  /** testid кнопки копирования (статья новости сохраняет контракт e2e). */
  copyTestId?: string;
  /** testid статуса копирования (по умолчанию `${copyTestId}-status`). */
  statusTestId?: string;
}

export function ShareButtons({
  url,
  title,
  locale = 'ru',
  copyTestId = 'share-copy',
  statusTestId,
}: ShareButtonsProps) {
  const statusId = statusTestId ?? `${copyTestId}-status`;
  // Origin узнаётся только на клиенте: SSR рендерит href как передали.
  const [origin, setOrigin] = useState('');
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const resetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Тот же приём, что now-line в week-view: setState из локальной функции
    // эффекта — клиентский origin появляется после mount, SSR-мисматча нет.
    const resolveOrigin = () => setOrigin(window.location.origin);
    resolveOrigin();
  }, []);

  const absolute = absoluteShareUrl(url, origin);

  const copy = async () => {
    // На клик origin пересчитывается напрямую: даже если эффект ещё не
    // отработал (клик сразу после гидрации), копируется корректный URL.
    const target = absoluteShareUrl(url, window.location.origin);
    let ok = false;
    try {
      await navigator.clipboard.writeText(target);
      ok = true;
    } catch {
      // Фолбэк для контекстов без clipboard-разрешения (в т.ч. e2e).
      try {
        const textarea = document.createElement('textarea');
        textarea.value = target;
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
    setCopyState(ok ? 'copied' : 'failed');
    if (resetRef.current) clearTimeout(resetRef.current);
    resetRef.current = setTimeout(() => setCopyState('idle'), 4000);
  };

  const social = [
    {
      testId: 'share-vk',
      href: vkShareUrl(absolute),
      ariaLabel: t(locale, 'share.vk'),
      Icon: Share2,
    },
    {
      testId: 'share-telegram',
      href: telegramShareUrl(absolute, title),
      ariaLabel: t(locale, 'share.telegram'),
      Icon: Send,
    },
    {
      testId: 'share-whatsapp',
      href: whatsappShareUrl(absolute, title),
      ariaLabel: t(locale, 'share.whatsapp'),
      Icon: MessageCircle,
    },
  ];

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      role="group"
      aria-label={t(locale, 'share.groupAria')}
      data-testid="share-buttons"
    >
      <span className="text-sm font-semibold text-muted-foreground">
        {t(locale, 'share.title')}
      </span>
      {social.map(({ testId, href, ariaLabel, Icon }) => (
        <a
          key={testId}
          href={href}
          target="_blank"
          rel="noreferrer noopener"
          aria-label={ariaLabel}
          title={ariaLabel}
          data-testid={testId}
          className="inline-flex size-9 items-center justify-center rounded-button border border-border bg-card text-foreground shadow-soft transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-coral-600"
        >
          <Icon aria-hidden="true" className="size-4" />
        </a>
      ))}
      <button
        type="button"
        onClick={() => void copy()}
        aria-label={t(locale, 'share.copy')}
        title={t(locale, 'share.copy')}
        data-testid={copyTestId}
        className="inline-flex size-9 items-center justify-center rounded-button border border-border bg-card text-foreground shadow-soft transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-coral-600"
      >
        {copyState === 'copied' ? (
          <Check aria-hidden="true" className="size-4 text-emerald-600" />
        ) : (
          <Link aria-hidden="true" className="size-4" />
        )}
      </button>
      <span
        role="status"
        aria-live="polite"
        data-testid={statusId}
        className="text-sm text-muted-foreground"
      >
        {copyState === 'copied'
          ? t(locale, 'share.copied')
          : copyState === 'failed'
            ? t(locale, 'share.copyFailed')
            : ''}
      </span>
    </div>
  );
}
