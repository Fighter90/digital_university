// DIG-72 — серверный клиент OpenRouter для плавающего AI-ассистента.
//
// Без SDK: прямой fetch к chat-completions. Ключ читается ТОЛЬКО из
// process.env.OPENROUTER_API_KEY на сервере (в браузер и в репозиторий не
// попадает — в .env.example только имя переменной). Таймаут 20 секунд,
// повторов нет: любой сбой → { ok:false } и fallback демо-режима выше по
// стеку. Модель — бесплатная llama-класса по умолчанию, переопределяется
// OPENROUTER_MODEL (дешёвые/free-варианты OpenRouter меняются — env
// позволяет заменить модель без релиза).
import { toPlainText, type AssistantChatMessage } from '@/lib/floating-assistant-knowledge';

export const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
export const OPENROUTER_TIMEOUT_MS = 20_000;
export const OPENROUTER_DEFAULT_MODEL = 'meta-llama/llama-3.3-70b-instruct:free';

export type OpenRouterFailureReason = 'no-key' | 'http' | 'timeout' | 'bad-response';

export type OpenRouterResult =
  { ok: true; answer: string } | { ok: false; reason: OpenRouterFailureReason };

export interface OpenRouterDeps {
  /** Явный ключ — для тестов; по умолчанию читается из env. */
  apiKey?: string | null;
  /** Явная модель — для тестов; по умолчанию env OPENROUTER_MODEL. */
  model?: string;
  /** Инъекция fetch (unit-тесты; реальная сеть не трогается). */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/** Ключ приложения: пустая/пробельная строка означает «ключа нет». */
export function readOpenRouterKey(): string | null {
  const key = (process.env.OPENROUTER_API_KEY ?? '').trim();
  return key.length > 0 ? key : null;
}

function resolveModel(deps: OpenRouterDeps): string {
  if (deps.model) return deps.model;
  const fromEnv = (process.env.OPENROUTER_MODEL ?? '').trim();
  return fromEnv.length > 0 ? fromEnv : OPENROUTER_DEFAULT_MODEL;
}

/**
 * Один запрос chat-completions. Успех — плоский текст ответа (markdown
 * снимается здесь же, чтобы в чат не попадал сырец). Любая ошибка —
 * структурированный отказ без броска исключения.
 */
export async function askOpenRouterChat(
  messages: AssistantChatMessage[],
  deps: OpenRouterDeps = {},
): Promise<OpenRouterResult> {
  const key = deps.apiKey !== undefined ? deps.apiKey : readOpenRouterKey();
  if (!key) return { ok: false, reason: 'no-key' };

  const doFetch = deps.fetchImpl ?? fetch;
  const timeoutMs = deps.timeoutMs ?? OPENROUTER_TIMEOUT_MS;

  try {
    const response = await doFetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        // Открытая атрибуция OpenRouter (не секрет): какой прототип зовёт API.
        'X-Title': 'Digital Deanery Concept',
      },
      body: JSON.stringify({
        model: resolveModel(deps),
        messages,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(timeoutMs),
      cache: 'no-store',
    });

    if (!response.ok) return { ok: false, reason: 'http' };

    const data = (await response.json()) as {
      choices?: { message?: { content?: unknown } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || content.trim().length === 0) {
      return { ok: false, reason: 'bad-response' };
    }
    const answer = toPlainText(content).trim();
    if (answer.length === 0) return { ok: false, reason: 'bad-response' };
    return { ok: true, answer };
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'TimeoutError';
    return { ok: false, reason: timedOut ? 'timeout' : 'http' };
  }
}
