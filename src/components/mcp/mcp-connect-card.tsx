'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, Copy, Eye, KeyRound } from 'lucide-react';
import { cn } from 'cn';
import {
  MCP_CONFIG_TOKEN_PLACEHOLDER,
  MCP_SETTINGS_HREF,
  buildMcpConfigSnippet,
} from '@/lib/mcp-docs';

// DIG-73 — карточка «Как подключить» на странице /mcp (GET-only):
// маскированное превью персонального токена (раскрывается кнопкой
// «Показать токен»), готовый JSON-конфиг с плейсхолдером <ВАШ_ТОКЕН> и
// кнопка «Скопировать конфиг». Реальный токен никогда не приходит на
// страницу: plaintext показывается один раз при выпуске во вкладке
// «Настройка MCP»; здесь — только маска. Мутаций нет (GET-only страница).

export interface McpConnectCardProps {
  /** Абсолютный URL демо-MCP-сервера (из заголовков запроса). */
  url: string;
  /** Маскированное превью выпущенного токена владельца (или null). */
  token: { tokenPreview: string; createdAt: Date } | null;
  /** Сотруднику персональный токен не выдаётся (сервер отдаёт данные студента-владельца). */
  isStudent: boolean;
}

/** Дата фиксирована по Москве — SSR и клиент совпадают без hydration-мигания. */
function formatTokenDate(date: Date): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Moscow',
  }).format(date);
}

export function McpConnectCard({ url, token, isStudent }: McpConnectCardProps) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const snippet = buildMcpConfigSnippet(url);

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
          Персональный токен
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
              {revealed ? 'Скрыть токен' : 'Показать токен'}
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
                  Токен выпущен {formatTokenDate(token.createdAt)}. Это маска: полный токен
                  показывается только один раз при выпуске — если он потерян, перевыпустите его в
                  настройках.
                </p>
              </div>
            )}
            <Link
              href={MCP_SETTINGS_HREF}
              data-testid="mcp-settings-link"
              className="w-fit text-xs font-semibold text-coral-600 underline-offset-2 hover:underline"
            >
              Выпустить или перевыпустить токен — «Настройка MCP»
            </Link>
          </div>
        ) : isStudent ? (
          <div className="flex flex-col gap-1">
            <p className="text-xs text-neutral-600">
              Токен ещё не создан: выпустите его во вкладке «Настройка MCP» — полный токен
              показывается один раз при выпуске.
            </p>
            <Link
              href={MCP_SETTINGS_HREF}
              data-testid="mcp-settings-link"
              className="w-fit text-xs font-semibold text-coral-600 underline-offset-2 hover:underline"
            >
              Создать токен — «Настройка MCP»
            </Link>
          </div>
        ) : (
          <p className="text-xs leading-relaxed text-neutral-600">
            В этом прототипе персональный токен выпускается в кабинете студента: сервер отдаёт
            данные владельца токена. Сотрудник видит эту инструкцию без блока токена.
          </p>
        )}
      </div>

      {/* Шаг 2 — JSON-конфиг */}
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-neutral-900">
          JSON-конфиг для Claude Desktop / Cursor / любого MCP-клиента
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
                <Check className="size-4" aria-hidden="true" /> Скопировано
              </>
            ) : (
              <>
                <Copy className="size-4" aria-hidden="true" /> Скопировать конфиг
              </>
            )}
          </button>
          <span className="text-[11px] text-neutral-500">
            Токен в конфиге — плейсхолдер {MCP_CONFIG_TOKEN_PLACEHOLDER}: подставьте свой из шага 1.
          </span>
        </div>
      </div>
    </div>
  );
}
