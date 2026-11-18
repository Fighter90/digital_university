// DIG-72 — оркестратор ответов плавающего AI-ассистента (серверный модуль,
// вызывается тонким server action'ом).
//
// Контракт задачи:
//  - rate-limit 10 вопросов/мин на сессию (скользящее окно, как DIG-11/47/64);
//  - вход обрезается до 1000 символов;
//  - RAG: лексический retrieval по справке (lib/floating-assistant-knowledge),
//    топ-3 чанка в промпт;
//  - OpenRouter при наличии ключа; нет ключа / ошибка / таймаут → обязательный
//    fallback: подсказка из справки с пометкой демо-режима (прототип для жюри
//    работает без интернета-ключа и без падений);
//  - в лог — только факт вызова и длина входа (не сам вопрос).
//
// IDOR не применим (чужие данные не читаются), но action'ы требуют
// requireDataCtx — сессия обязательна, скоуп лимитера по userId сессии.
import {
  buildOpenRouterMessages,
  retrieveKnowledgeChunks,
} from '@/lib/floating-assistant-knowledge';
import { askOpenRouterChat, readOpenRouterKey } from '@/server/ai/openrouter';
import { createVerifyRateLimiter, type VerifyRateLimiter } from '@/server/verify/rate-limit';

/** Окно лимита: 10 вопросов в минуту на сессию. */
export const FLOATING_ASSISTANT_RATE_WINDOW_MS = 60 * 1000;
export const FLOATING_ASSISTANT_MAX_ATTEMPTS = 10;
/** Обрезка входа: не более 1000 символов. */
export const QUESTION_MAX_LENGTH = 1000;
/** Длина подсказки-чанка в fallback-ответе. */
const HINT_MAX_LENGTH = 600;

export function createFloatingAssistantRateLimiter(): VerifyRateLimiter {
  return createVerifyRateLimiter({
    windowMs: FLOATING_ASSISTANT_RATE_WINDOW_MS,
    maxAttempts: FLOATING_ASSISTANT_MAX_ATTEMPTS,
  });
}

const globals = globalThis as unknown as { __floatingAssistantRateLimiter?: VerifyRateLimiter };

/** Экземпляр приложения (создаётся один раз на процесс, как у DIG-47/DIG-64). */
export const floatingAssistantRateLimiter: VerifyRateLimiter =
  (globals.__floatingAssistantRateLimiter ??= createFloatingAssistantRateLimiter());

export const FALLBACK_NOTICE = 'Демо-режим: показываю подсказку из справки';

const NO_DATA_ANSWER =
  'Об этом в справке кабинета пока нет. Откройте «Справку» (/guide) или ' +
  '«Вопросы и ответы» (/help), либо создайте обращение в деканат — там подскажут.';

/** Ответ action'а попап-чату. */
export type FloatingAssistantReply =
  | { ok: true; mode: 'ai'; answer: string }
  | {
      ok: true;
      mode: 'fallback';
      answer: string;
      notice: string;
      source: { title: string; href: string } | null;
    }
  | { ok: false; error: string };

export interface FloatingAssistantDeps {
  /** «Сейчас» — Date или часы-функция; по умолчанию new Date(). */
  now?: Date | (() => Date);
  /** Ключ лимитера: скоуп сессии (userId), не IP. */
  scopeKey: string;
  /** Источник ключа OpenRouter; по умолчанию — env (readOpenRouterKey). */
  apiKey?: () => string | null;
  /** Инъекция fetch для тестов — реальная сеть не трогается. */
  fetchImpl?: typeof fetch;
  /** Лимитер; по умолчанию — экземпляр приложения. */
  rateLimiter?: VerifyRateLimiter;
}

/**
 * Ответ на один вопрос студента: валидация → лимит → retrieval → модель
 * или fallback. Никогда не бросает: ошибки модели превращаются в fallback.
 */
export async function answerFloatingQuestion(
  input: { question: string },
  deps: FloatingAssistantDeps,
): Promise<FloatingAssistantReply> {
  const question = (input?.question ?? '').trim();
  if (question.length === 0) {
    return { ok: false, error: 'Введите вопрос — ассистент отвечает по справке кабинета.' };
  }

  const now =
    deps.now === undefined ? new Date() : typeof deps.now === 'function' ? deps.now() : deps.now;
  const limiter = deps.rateLimiter ?? floatingAssistantRateLimiter;
  const hit = limiter.hit(`session:${deps.scopeKey}`, now);
  if (hit.limited) {
    return {
      ok: false,
      error: 'Слишком много вопросов. Подождите минуту и попробуйте снова.',
    };
  }

  const clipped = question.slice(0, QUESTION_MAX_LENGTH);
  const chunks = retrieveKnowledgeChunks(clipped, 3);
  const readKey = deps.apiKey ?? readOpenRouterKey;

  const key = readKey();
  if (key) {
    const result = await askOpenRouterChat(buildOpenRouterMessages(clipped, chunks), {
      apiKey: key,
      fetchImpl: deps.fetchImpl,
    });
    if (result.ok) {
      logAsk(clipped.length, 'ai');
      return { ok: true, mode: 'ai', answer: result.answer };
    }
  }

  logAsk(clipped.length, 'fallback');
  const top = chunks[0] ?? null;
  if (!top) {
    return {
      ok: true,
      mode: 'fallback',
      answer: NO_DATA_ANSWER,
      notice: FALLBACK_NOTICE,
      source: null,
    };
  }
  const hint =
    top.text.length > HINT_MAX_LENGTH ? `${top.text.slice(0, HINT_MAX_LENGTH)}…` : top.text;
  return {
    ok: true,
    mode: 'fallback',
    answer: hint,
    notice: FALLBACK_NOTICE,
    source: { title: top.sourceLabel, href: top.href },
  };
}

/** Лог факта вызова: только длина входа и режим ответа — не сам вопрос. */
function logAsk(length: number, mode: 'ai' | 'fallback'): void {
  console.info(`[floating-assistant] ask length=${length} mode=${mode}`);
}
