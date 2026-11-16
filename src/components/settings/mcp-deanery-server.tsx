'use client';

import { useState, useTransition } from 'react';
import { Check, Copy, KeyRound, Link2 } from 'lucide-react';
import { cn } from 'cn';
import { rotateMcpTokenAction } from '@/server/actions/settings';
import { MCP_ENDPOINT_PATH } from '@/lib/mcp-protocol';

// DIG-64 — карточка «MCP-сервер деканата» на вкладке «Настройка MCP»:
// URL демо-сервера, персональный токен (создать / перевыпустить; plaintext
// показывается один раз) и инструкции подключения к ChatGPT и Claude.
// Данные вымышленные — реальных сервисов и ключей нет (конкурсный прототип).

export interface McpTokenViewProps {
  tokenPreview: string;
  createdAt: Date;
}

/** Формат даты фиксирован по Москве — SSR и клиент совпадают без hydration-мигания. */
function formatTokenDate(date: Date): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Moscow',
  }).format(date);
}

function CopyButton({
  value,
  label,
  copied,
  onCopy,
  className,
}: {
  value: string;
  label: string;
  copied: boolean;
  onCopy: (value: string) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onCopy(value)}
      className={cn(
        'inline-flex items-center gap-1 rounded-pill border border-border bg-card px-2.5 py-1 text-xs font-semibold text-neutral-700 hover:bg-muted',
        className,
      )}
    >
      {copied ? (
        <>
          <Check className="size-3" aria-hidden="true" /> Скопировано
        </>
      ) : (
        <>
          <Copy className="size-3" aria-hidden="true" /> {label}
        </>
      )}
    </button>
  );
}

export function McpDeaneryServer({ url, token }: { url: string; token: McpTokenViewProps | null }) {
  const [fresh, setFresh] = useState<{ token: string; preview: string } | null>(null);
  const [failed, setFailed] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [copiedKind, setCopiedKind] = useState<'url' | 'token' | null>(null);

  const copy = async (value: string, kind: 'url' | 'token') => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKind(kind);
    } catch {
      setCopiedKind(null);
    }
  };

  const rotate = () => {
    setFailed(false);
    startTransition(async () => {
      const result = await rotateMcpTokenAction();
      if (result.ok && result.token && result.preview) {
        setFresh({ token: result.token, preview: result.preview });
        setCopiedKind(null);
      } else {
        setFailed(true);
      }
    });
  };

  const claudeConfig = JSON.stringify(
    {
      mcpServers: {
        'digital-deanery': {
          command: 'npx',
          args: ['-y', 'mcp-remote', url, '--header', 'Authorization: Bearer <ВАШ_ТОКЕН>'],
        },
      },
    },
    null,
    2,
  );

  return (
    <div data-testid="mcp-deanery-server" className="flex flex-col gap-3">
      {/* URL сервера */}
      <div className="flex flex-col gap-1.5">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-neutral-900">
          <Link2 className="size-4 text-neutral-500" aria-hidden="true" /> URL сервера
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <code
            data-testid="mcp-server-url"
            className="min-w-0 flex-1 break-all rounded-card-sm border border-border bg-muted px-2 py-1.5 font-mono text-xs text-neutral-900"
          >
            {url}
          </code>
          <CopyButton
            value={url}
            label="Скопировать URL"
            copied={copiedKind === 'url'}
            onCopy={(value) => copy(value, 'url')}
          />
        </div>
      </div>

      {/* Персональный токен */}
      <div className="flex flex-col gap-1.5">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-neutral-900">
          <KeyRound className="size-4 text-neutral-500" aria-hidden="true" />
          Персональный токен доступа
        </p>

        {fresh ? (
          <div
            data-testid="mcp-token-fresh"
            className="flex flex-col gap-2 rounded-card-sm border border-coral-200 bg-coral-50 p-3"
          >
            <code
              data-testid="mcp-token-value"
              className="break-all rounded-pill border border-border bg-card px-2 py-1 font-mono text-[11px] text-neutral-900"
            >
              {fresh.token}
            </code>
            <div className="flex flex-wrap items-center gap-2">
              <CopyButton
                value={fresh.token}
                label="Скопировать токен"
                copied={copiedKind === 'token'}
                onCopy={(value) => copy(value, 'token')}
              />
              <button
                type="button"
                onClick={rotate}
                disabled={isPending}
                className="rounded-pill border border-border bg-card px-2.5 py-1 text-xs font-semibold text-neutral-700 hover:bg-muted disabled:opacity-50"
              >
                Перевыпустить токен
              </button>
            </div>
            <p className="text-[11px] leading-relaxed text-neutral-600">
              Токен показывается только один раз — скопируйте его прямо сейчас и вставьте в
              ассистент. Прежний токен отозван.
            </p>
          </div>
        ) : token ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-neutral-600">
              Токен создан,{' '}
              <code
                data-testid="mcp-token-preview"
                className="rounded-pill border border-border bg-muted px-2 py-0.5 font-mono text-[11px] text-neutral-900"
              >
                {token.tokenPreview}
              </code>{' '}
              ({formatTokenDate(token.createdAt)})
            </span>
            <button
              type="button"
              data-testid="mcp-token-rotate"
              onClick={rotate}
              disabled={isPending}
              className="rounded-button border border-border bg-card px-3 py-1.5 text-sm font-semibold text-neutral-700 hover:bg-muted disabled:opacity-50"
            >
              Перевыпустить токен
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-neutral-600">Токен ещё не создан.</span>
            <button
              type="button"
              data-testid="mcp-token-rotate"
              onClick={rotate}
              disabled={isPending}
              className="rounded-button bg-foreground px-3 py-1.5 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-50"
            >
              Создать токен
            </button>
          </div>
        )}

        {failed ? (
          <p role="alert" className="text-xs text-error-ink">
            Не удалось выпустить токен. Попробуйте ещё раз.
          </p>
        ) : (
          <p className="text-xs text-neutral-500">
            В хранилище остаётся только хэш токена; полный токен виден один раз при выпуске.
          </p>
        )}
      </div>

      {/* Инструкции подключения */}
      <div className="grid gap-3 sm:grid-cols-2">
        <section
          aria-labelledby="mcp-chatgpt"
          className="rounded-card-sm border border-border bg-muted p-3"
        >
          <h3 id="mcp-chatgpt" className="text-xs font-semibold text-neutral-900">
            Подключение к ChatGPT
          </h3>
          <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-xs leading-relaxed text-neutral-700">
            <li>Настройки → Подключения (Connectors) → Создать.</li>
            <li>
              Вставьте URL сервера: <span className="font-mono">{url}</span>
            </li>
            <li>
              В поле авторизации укажите заголовок:{' '}
              <span className="font-mono">Authorization: Bearer &lt;токен&gt;</span>
            </li>
            <li>Спросите ассистента: «моё расписание на сегодня».</li>
          </ol>
        </section>

        <section
          aria-labelledby="mcp-claude"
          className="rounded-card-sm border border-border bg-muted p-3"
        >
          <h3 id="mcp-claude" className="text-xs font-semibold text-neutral-900">
            Подключение к Claude
          </h3>
          <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-xs leading-relaxed text-neutral-700">
            <li>Settings → Connectors → Add custom connector (или через конфиг ниже).</li>
            <li>
              Вставьте URL: <span className="font-mono">{url}</span>
            </li>
            <li>Перезапустите клиент и спросите: «мои оценки».</li>
          </ol>
          <pre
            data-testid="mcp-config-claude"
            className="mt-2 overflow-x-auto rounded-card-sm border border-border bg-card p-2 font-mono text-[10px] leading-relaxed text-neutral-800"
          >
            {claudeConfig}
          </pre>
        </section>
      </div>

      <p className="text-[11px] leading-relaxed text-neutral-500">
        Сервер отвечает на {MCP_ENDPOINT_PATH} и отдаёт только ваши данные (вымышленный демо-набор):
        расписание на сегодня, оценки, непрочитанные. Реальных сервисов и ключей за ним нет — это
        концепт для конкурса.
      </p>
    </div>
  );
}
