'use client';

import { useState, useTransition } from 'react';
import { Copy, ExternalLink, Check } from 'lucide-react';
import { cn } from 'cn';
import { Badge } from '@/components/ui/badge';
import { setMcpServerConnectionAction } from '@/server/actions/settings';
import {
  MCP_SERVERS,
  setMcpConnected,
  type McpServerId,
  type McpServerState,
} from '@/lib/mcp-servers';
import { mcpServerEnMeta } from '@/lib/mcp-servers';
import { t, type Locale } from '@/lib/i18n';

// DIG-58 — вкладка «Настройка MCP»: список демо MCP-серверов цифрового
// ассистента. «Подключить» раскрывает инструкцию (deep-ссылка + демо-токен),
// «Подключить сервер» сохраняет статус через server action в демо-хранилище
// настроек студента. Все токены вымышленные — реальных ключей нет.
export function McpSettings({
  initial,
  servers: serversProp,
  locale = 'ru',
}: {
  /** Текущие статусы демо-серверов (страница настроек). */
  initial?: McpServerState[];
  /** Имя пропа из приёмочного теста DIG-89 (тот же список). */
  servers?: McpServerState[];
  /** DIG-89 — локаль интерфейса (cookie du-locale, дефолт ru). */
  locale?: Locale;
}) {
  const [servers, setServers] = useState<McpServerState[]>(initial ?? serversProp ?? []);
  const [openId, setOpenId] = useState<McpServerId | null>(null);
  const [copiedId, setCopiedId] = useState<McpServerId | null>(null);
  const [error, setError] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState(() => t(locale, 'settings.mcp.savedNote'));

  const persist = (id: McpServerId, connected: boolean, done: string) => {
    setError(false);
    setMessage(t(locale, 'settings.mcp.saving'));
    startTransition(async () => {
      const ok = await setMcpServerConnectionAction(id, connected);
      if (ok) {
        setServers((prev) => setMcpConnected(prev, id, connected));
        setOpenId(null);
        setMessage(done);
      } else {
        setError(true);
        setMessage(t(locale, 'settings.mcp.saveError'));
      }
    });
  };

  const copyToken = async (id: McpServerId, token: string) => {
    try {
      await navigator.clipboard.writeText(token);
      setCopiedId(id);
    } catch {
      setCopiedId(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2" aria-label={t(locale, 'settings.mcp.listAria')}>
        {servers.map((state) => {
          const baseMeta = MCP_SERVERS.find((s) => s.id === state.id)!;
          const enMeta = locale === 'en' ? mcpServerEnMeta(state.id) : null;
          const meta = enMeta
            ? { ...baseMeta, name: enMeta.name, tagline: enMeta.tagline, benefits: enMeta.benefits }
            : baseMeta;
          const isOpen = openId === state.id;
          return (
            <li
              key={state.id}
              data-testid="mcp-server-row"
              data-server-id={state.id}
              data-connected={state.connected ? 'true' : 'false'}
              className="rounded-card border border-border bg-card px-3 py-3 shadow-soft"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-neutral-900">{meta.name}</p>
                  <p className="mt-0.5 text-xs text-neutral-600">{meta.tagline}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge status={state.connected ? 'success' : 'neutral'} variant="soft">
                    {state.connected ? t(locale, 'settings.mcp.connected') : t(locale, 'settings.mcp.disconnected')}
                  </Badge>
                  {state.connected ? (
                    <button
                      type="button"
                      onClick={() => persist(state.id, false, t(locale, 'settings.mcp.offSaved'))}
                      disabled={isPending}
                      className="rounded-button border border-border bg-card px-3 py-1.5 text-sm font-semibold text-neutral-700 hover:bg-muted disabled:opacity-50"
                    >
                      {t(locale, 'settings.mcp.disconnect')}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setOpenId(isOpen ? null : state.id);
                        setCopiedId(null);
                      }}
                      aria-expanded={isOpen}
                      aria-controls={`mcp-instruction-${state.id}`}
                      className="rounded-button bg-foreground px-3 py-1.5 text-sm font-semibold text-background hover:opacity-90"
                    >
                      {t(locale, 'settings.mcp.connect')}
                    </button>
                  )}
                </div>
              </div>

              {isOpen && !state.connected && (
                <div
                  id={`mcp-instruction-${state.id}`}
                  data-testid="mcp-instruction"
                  className="mt-3 rounded-card-sm border border-border bg-muted p-3"
                >
                  <p className="text-xs font-semibold text-neutral-900">
                    {t(locale, 'settings.mcp.installTitle')}
                  </p>
                  <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-xs text-neutral-700">
                    <li>
                      {t(locale, 'settings.mcp.install.deepLink')}{' '}
                      <code className="break-all font-mono text-[11px]">{meta.deepLink}</code>{' '}
                      <span className="inline-flex items-center gap-1 align-baseline text-neutral-500">
                        <ExternalLink className="size-3" aria-hidden="true" />{' '}
                        {t(locale, 'settings.mcp.install.fakeLink')}
                      </span>
                    </li>
                    <li>
                      {t(locale, 'settings.mcp.install.copyToken')}
                      <span className="mt-1 flex flex-wrap items-center gap-2">
                        <code className="break-all rounded-pill border border-border bg-card px-2 py-1 font-mono text-[11px]">
                          {meta.demoToken}
                        </code>
                        <button
                          type="button"
                          onClick={() => copyToken(state.id, meta.demoToken)}
                          className="inline-flex items-center gap-1 rounded-pill border border-border bg-card px-2.5 py-1 text-xs font-semibold text-neutral-700 hover:bg-muted"
                        >
                          {copiedId === state.id ? (
                            <>
                              <Check className="size-3" aria-hidden="true" />{' '}
                              {t(locale, 'settings.mcpServer.copied')}
                            </>
                          ) : (
                            <>
                              <Copy className="size-3" aria-hidden="true" />{' '}
                              {t(locale, 'settings.mcpServer.copyToken')}
                            </>
                          )}
                        </button>
                      </span>
                    </li>
                    <li>{t(locale, 'settings.mcp.install.confirm')}</li>
                    <li>{t(locale, 'settings.mcp.install.return')}</li>
                  </ol>
                  <p className="mt-2 text-[11px] text-neutral-500">
                    {t(locale, 'settings.mcp.install.demoToken')}
                  </p>
                  <button
                    type="button"
                    onClick={() => persist(state.id, true, t(locale, 'settings.mcp.onSaved'))}
                    disabled={isPending}
                    className="mt-2 rounded-button bg-foreground px-3 py-1.5 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-50"
                  >
                    {t(locale, 'settings.mcp.connectServer')}
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <p
        aria-live="polite"
        role="status"
        className={cn('text-xs', error ? 'text-error-ink' : 'text-neutral-500')}
      >
        {message}
      </p>
    </div>
  );
}
