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

// DIG-58 — вкладка «Настройка MCP»: список демо MCP-серверов цифрового
// ассистента. «Подключить» раскрывает инструкцию (deep-ссылка + демо-токен),
// «Подключить сервер» сохраняет статус через server action в демо-хранилище
// настроек студента. Все токены вымышленные — реальных ключей нет.
export function McpSettings({ initial }: { initial: McpServerState[] }) {
  const [servers, setServers] = useState<McpServerState[]>(initial);
  const [openId, setOpenId] = useState<McpServerId | null>(null);
  const [copiedId, setCopiedId] = useState<McpServerId | null>(null);
  const [error, setError] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState(
    'Подключённые серверы сохраняются в настройках вашего кабинета.',
  );

  const persist = (id: McpServerId, connected: boolean, done: string) => {
    setError(false);
    setMessage('Сохраняем…');
    startTransition(async () => {
      const ok = await setMcpServerConnectionAction(id, connected);
      if (ok) {
        setServers((prev) => setMcpConnected(prev, id, connected));
        setOpenId(null);
        setMessage(done);
      } else {
        setError(true);
        setMessage('Не удалось сохранить статус. Попробуйте ещё раз.');
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
      <ul className="flex flex-col gap-2" aria-label="MCP-серверы ассистента">
        {servers.map((state) => {
          const meta = MCP_SERVERS.find((s) => s.id === state.id)!;
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
                    {state.connected ? 'Подключён' : 'Не подключён'}
                  </Badge>
                  {state.connected ? (
                    <button
                      type="button"
                      onClick={() => persist(state.id, false, 'Отключено — статус сохранён.')}
                      disabled={isPending}
                      className="rounded-button border border-border bg-card px-3 py-1.5 text-sm font-semibold text-neutral-700 hover:bg-muted disabled:opacity-50"
                    >
                      Отключить
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
                      Подключить
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
                    Установка (демо-инструкция)
                  </p>
                  <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-xs text-neutral-700">
                    <li>
                      Откройте deep-ссылку:{' '}
                      <code className="break-all font-mono text-[11px]">{meta.deepLink}</code>{' '}
                      <span className="inline-flex items-center gap-1 align-baseline text-neutral-500">
                        <ExternalLink className="size-3" aria-hidden="true" /> фиктивная ссылка
                        прототипа
                      </span>
                    </li>
                    <li>
                      Скопируйте демо-токен и вставьте его в клиенте MCP:
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
                              <Check className="size-3" aria-hidden="true" /> Скопировано
                            </>
                          ) : (
                            <>
                              <Copy className="size-3" aria-hidden="true" /> Скопировать токен
                            </>
                          )}
                        </button>
                      </span>
                    </li>
                    <li>Подтвердите добавление сервера в клиенте MCP.</li>
                    <li>Вернитесь сюда и нажмите «Подключить сервер».</li>
                  </ol>
                  <p className="mt-2 text-[11px] text-neutral-500">
                    Токен демонстрационный (помечен demo-) и не даёт доступа к реальным сервисам.
                  </p>
                  <button
                    type="button"
                    onClick={() => persist(state.id, true, 'Подключено — статус сохранён.')}
                    disabled={isPending}
                    className="mt-2 rounded-button bg-foreground px-3 py-1.5 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-50"
                  >
                    Подключить сервер
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
