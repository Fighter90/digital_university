// DIG-72 — server action попап-чата плавающего AI-ассистента.
//
// Тонкая обёртка над answerFloatingQuestion (src/server/ai/floating-assistant):
// сессия обязательна (requireDataCtx, аноним → /login), скоуп rate-limit —
// userId сессии. Чужие данные action не читает (IDOR-поверхности нет), но
// контракт «каждое действие за живой сессией» соблюдён как у всех actions.
// Вся логика (лимит 10/мин, обрезка ≤1000, RAG, OpenRouter, fallback) —
// в чистом серверном модуле с инъекциями, который покрывают unit-тесты.
'use server';

import {
  answerFloatingQuestion,
  type FloatingAssistantReply,
} from '@/server/ai/floating-assistant';
import { requireDataCtx } from '@/server/data';

export type { FloatingAssistantReply };

/**
 * Вопрос студента попап-чату на FAB. Ответ — текст по справке кабинета
 * (режим ai) или подсказка из справки с пометкой демо-режима (fallback).
 */
export async function askFloatingAssistant(input: {
  question: string;
}): Promise<FloatingAssistantReply> {
  const ctx = await requireDataCtx('/ai-assistant');
  return answerFloatingQuestion(input, { scopeKey: ctx.userId });
}
