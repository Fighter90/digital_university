'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, Copy, Eye, KeyRound } from 'lucide-react';
import { cn } from 'cn';
import {
  MCP_SETTINGS_HREF,
  buildMcpConfigSnippet,
  mcpConfigTokenPlaceholder,
} from '@/lib/mcp-docs';
import { t, type Locale } from '@/lib/i18n';

// DIG-73 — карточка «Как подключить» на странице /mcp (GET-only):
// маскированное превью персонального токена (раскрывается кнопкой
// «Показать токен»), готовый JSON-конфиг с плейсхолдером и кнопка
// «Скопировать конфиг». Реальный токен никогда не приходит на страницу:
// plaintext показывается один раз при выпуске во вкладке «Настройка MCP»;
// здесь — только маска. Мутаций нет (GET-only страница).
// DIG-88 — подписи и плейсхолдер сниппета по локали (RU — канон).

export interface McpConnectCardProps {
  /** Абсолютный URL демо-MCP-сервера (из заголовков запроса). */
  url: string;
  /** Маскированное превью выпущенного токена владельца (или null). */
  token: { tokenPreview: string; createdAt: Date } | null;
  /** Сотруднику персональный токен не выдаётся (сервер отдаёт данные студента-владельца). */
  isStudent: boolean;
  /** DIG-88 — локаль интерфейса (cookie du-locale, дефолт ru). */
  locale?: Locale;
}

/** Дата фиксирована по Москве — SSR и клиент совпадают без hydration-мигания. */
function formatTokenDate(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'ru-RU', {
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Moscow',
  }).format(date);
}

export function McpConnectCard({ url, token, isStudent, locale = 'ru' }: McpConnectCardProps) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const snippet = buildMcpConfigSnippet(url, locale);
  const placeholder = mcpConfigTokenPlaceholder(locale);

  const copyConfig = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div data-testid="mcp-connect-card" className="flex flex-col gap-4">
      {/* Шаг 1 — персональный токен */}
      <div className="flex flex-col gap-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-neutral-900">
          <KeyRound className="size-4 text-neutral-500" aria-hidden="true" />
          {t(locale, 'mcp.card.token')}
        </p>

        {isStudent && token ? (
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              data-testid="mcp-token-reveal"
              onClick={() => setRevealed((value) => !value)}
              aria-expanded={revealed}
              aria-controls="mcp-token-details"
              className="inline-flex w-fit items-center gap-1.5 rounded-button border border-border bg-card px-3 py-1.5 text-sm font-semibold text-neutral-700 hover:bg-muted"
            >
              <Eye className="size-4" aria-hidden="true" />
              {revealed ? t(locale, 'mcp.card.hideToken') : t(locale, 'mcp.card.showToken')}
            </button>
            {revealed && (
              <div id="mcp-token-details" className="flex flex-col gap-1">
                <code
                  data-testid="mcp-token-preview"
                  className="w-fit break-all rounded-pill border border-border bg-muted px-2 py-1 font-mono text-[11px] text-neutral-900"
                >
                  {token.tokenPreview}
                </code>
                <p className="text-[11px] leading-relaxed text-neutral-600">
                  {t(locale, 'mcp.card.issued', { date: formatTokenDate(token.createdAt, locale) })}
                </p>
              </div>
            )}
            <Link
              href={MCP_SETTINGS_HREF}
              data-testid="mcp-settings-link"
              className="w-fit text-xs font-semibold text-coral-600 underline-offset-2 hover:underline"
            >
              {t(locale, 'mcp.card.manage')}
            </Link>
          </div>
        ) : isStudent ? (
          <div className="flex flex-col gap-1">
            <p className="text-xs text-neutral-600">{t(locale, 'mcp.card.none')}</p>
            <Link
              href={MCP_SETTINGS_HREF}
              data-testid="mcp-settings-link"
              className="w-fit text-xs font-semibold text-coral-600 underline-offset-2 hover:underline"
            >
              {t(locale, 'mcp.card.create')}
            </Link>
          </div>
        ) : (
          <p className="text-xs leading-relaxed text-neutral-600">
            {t(locale, 'mcp.card.staffNote')}
          </p>
        )}
      </div>

      {/* Шаг 2 — JSON-конфиг */}
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-neutral-900">
          {t(locale, 'mcp.card.configTitle')}
        </p>
        <pre
          data-testid="mcp-config-snippet"
          className="overflow-x-auto rounded-card-sm border border-border bg-muted p-3 font-mono text-[11px] leading-relaxed text-neutral-800"
        >
          {snippet}
        </pre>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="mcp-copy-config"
            onClick={copyConfig}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-button bg-foreground px-3 py-1.5 text-sm font-semibold text-background hover:opacity-90',
            )}
          >
            {copied ? (
              <>
                <Check className="size-4" aria-hidden="true" /> {t(locale, 'mcp.card.copied')}
              </>
            ) : (
              <>
                <Copy className="size-4" aria-hidden="true" /> {t(locale, 'mcp.card.copy')}
              </>
            )}
          </button>
          <span className="text-[11px] text-neutral-500">
            {t(locale, 'mcp.card.placeholderHint', { placeholder })}
          </span>
        </div>
      </div>
    </div>
  );
}
