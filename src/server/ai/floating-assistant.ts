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
import type { Locale } from '@/lib/i18n';

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

/** EN-пометка демо-режима (DIG-88, locale=en). */
export const FALLBACK_NOTICE_EN = 'Demo mode: showing a hint from the guide';

const NO_DATA_ANSWER =
  'Об этом в справке кабинета пока нет. Откройте «Справку» (/guide) или ' +
  '«Вопросы и ответы» (/help), либо создайте обращение в деканат — там подскажут.';

const NO_DATA_ANSWER_EN =
  'There is nothing about this in the cabinet guide yet. Open the “Guide” (/guide) ' +
  'or the “FAQ” (/help), or create a ticket to the deanery — they will help there.';

const RATE_LIMIT_ERROR = 'Слишком много вопросов. Подождите минуту и попробуйте снова.';
const RATE_LIMIT_ERROR_EN = 'Too many questions. Wait a minute and try again.';

const EMPTY_QUESTION_ERROR = 'Введите вопрос — ассистент отвечает по справке кабинета.';
const EMPTY_QUESTION_ERROR_EN = 'Enter a question — the assistant answers from the cabinet guide.';

/** Пометка демо-режима по локали (RU — канон). */
export function fallbackNotice(locale: Locale = 'ru'): string {
  return locale === 'en' ? FALLBACK_NOTICE_EN : FALLBACK_NOTICE;
}

/** Подсказка ответа по локали. */
export function fallbackAnswer(locale: Locale = 'ru'): string {
  return locale === 'en' ? NO_DATA_ANSWER_EN : NO_DATA_ANSWER;
}

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
  /**
   * DIG-88 — локаль интерфейса (cookie du-locale): язык видимых строк
   * ответа (fallback-подсказка, ошибки) и RAG-чанков. RU — канон.
   */
  locale?: Locale;
}

/**
 * Ответ на один вопрос студента: валидация → лимит → retrieval → модель
 * или fallback. Никогда не бросает: ошибки модели превращаются в fallback.
 */
export async function answerFloatingQuestion(
  input: { question: string },
  deps: FloatingAssistantDeps,
): Promise<FloatingAssistantReply> {
  const locale: Locale = deps.locale ?? 'ru';
  const question = (input?.question ?? '').trim();
  if (question.length === 0) {
    return {
      ok: false,
      error: locale === 'en' ? EMPTY_QUESTION_ERROR_EN : EMPTY_QUESTION_ERROR,
    };
  }

  const now =
    deps.now === undefined ? new Date() : typeof deps.now === 'function' ? deps.now() : deps.now;
  const limiter = deps.rateLimiter ?? floatingAssistantRateLimiter;
  const hit = limiter.hit(`session:${deps.scopeKey}`, now);
  if (hit.limited) {
    return {
      ok: false,
      error: locale === 'en' ? RATE_LIMIT_ERROR_EN : RATE_LIMIT_ERROR,
    };
  }

  const clipped = question.slice(0, QUESTION_MAX_LENGTH);
  const chunks = retrieveKnowledgeChunks(clipped, 3, locale);
  const readKey = deps.apiKey ?? readOpenRouterKey;

  const key = readKey();
  if (key) {
    const result = await askOpenRouterChat(buildOpenRouterMessages(clipped, chunks, locale), {
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
      answer: fallbackAnswer(locale),
      notice: fallbackNotice(locale),
      source: null,
    };
  }
  const hint =
    top.text.length > HINT_MAX_LENGTH ? `${top.text.slice(0, HINT_MAX_LENGTH)}…` : top.text;
  return {
    ok: true,
    mode: 'fallback',
    answer: hint,
    notice: fallbackNotice(locale),
    source: { title: top.sourceLabel, href: top.href },
  };
}

/** Лог факта вызова: только длина входа и режим ответа — не сам вопрос. */
function logAsk(length: number, mode: 'ai' | 'fallback'): void {
  console.info(`[floating-assistant] ask length=${length} mode=${mode}`);
}
