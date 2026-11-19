// DIG-46 — полный экран «AI-ассистент» (Figma «25 AI-ассистент + M5»;
// референс блока «Оценка резюме · AI» в ResumeCraft).
//
// requireDataCtx() → getAssistantContext(): контекст чата строится слоем
// данных по владельцу сессии (IDOR-контракт DIG-12) и уходит в клиентский
// чат сериализуемым JSON — ответы формирует чистый движок
// src/lib/assistant-engine.ts (серверный прокси к модели — отдельная
// задача agent:backend, UI-контракт сообщений не изменится).
//
// Deep-link совместимость с экраном «Сессия» (DIG-28):
// /ai-assistant?intent=exam-prep&discipline=<код> сеет вопрос про экзамен.
import type { Metadata } from 'next';

import { AssistantChat } from '@/components/assistant/assistant-chat';
import { Sparkles } from 'lucide-react';
import { getAssistantContext, requireDataCtx } from '@/server/data';
import { dataDb } from '@/server/data/db';
import { t, type Locale } from '@/lib/i18n';
import { getLocale } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    title: t(locale, 'meta.assistant'),
    description: t(locale, 'meta.assistantDescription'),
  };
}

/** Коды дисциплин в deep-link: латиница/цифры и дефис (PI21-INFO). */
const DEEP_LINK_CODE = /^[A-Za-z0-9][A-Za-z0-9-]{0,63}$/;

/** Перенос запроса из базы знаний (DIG-38): лимит длины текста сида. */
const MAX_SEED_QUERY_LENGTH = 300;

/** ?intent=exam-prep&discipline=… → вопрос, который чат сеет при открытии. */
function buildSeedQuestion(
  intent: string | undefined,
  discipline: string | undefined,
  locale: Locale,
): string | null {
  if (intent !== 'exam-prep' || !discipline || !DEEP_LINK_CODE.test(discipline)) return null;
  return t(locale, 'assistant.seed.exam', { discipline });
}

/**
 * DIG-38: «Спросить AI-ассистента» из пустого состояния /help переносит
 * текст запроса в ?q= — он становится первым вопросом чата. Deep-link
 * ?intent=… приоритетнее. Отображается как текст (React экранирует), длина
 * ограничена — рефлекта бесконтрольного пользовательского ввода нет.
 */
function seedFromQuery(q: string | undefined): string | null {
  const trimmed = (q ?? '').trim();
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_SEED_QUERY_LENGTH);
}

export default async function AiAssistantPage({
  searchParams = Promise.resolve({}),
}: {
  searchParams?: Promise<Record<string, string>>;
}) {
  const [ctx, locale] = await Promise.all([requireDataCtx('/ai-assistant'), getLocale()] as const);
  const params = await searchParams;
  const context = await getAssistantContext(dataDb, ctx, new Date(), locale);
  const seedQuestion =
    buildSeedQuestion(params.intent, params.discipline, locale) ?? seedFromQuery(params.q);

  return (
    // Высота = вьюпорт минус каркас (топбар, баннер концепта, отступы main):
    // лента сообщений скроллится внутри, поле ввода всегда видно.
    <section className="mx-auto flex h-[calc(100dvh-13.5rem)] min-h-[28rem] w-full max-w-3xl flex-col px-4 md:h-[calc(100dvh-10.75rem)]">
      <header className="flex items-start gap-3 pb-4">
        <span
          aria-hidden="true"
          className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-card bg-coral-500 text-white shadow-soft"
        >
          <Sparkles className="size-5" />
        </span>
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold tracking-heading text-foreground md:text-2xl">
            {t(locale, 'assistant.panel.title')}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t(locale, 'assistant.page.subtitle')}
          </p>
        </div>
      </header>

      <AssistantChat context={context} seedQuestion={seedQuestion} locale={locale} />
    </section>
  );
}
