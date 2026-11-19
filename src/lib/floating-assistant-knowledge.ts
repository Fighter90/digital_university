// DIG-72 — RAG-модуль плавающего AI-ассистента. Чистые данные и функции
// без серверных импортов (импортируется и server-оркестратором, и unit-
// тестами — как lib/help-content DIG-70 и lib/faq-kb-catalog DIG-38).
//
// Индекс чанков = секции «Справки» (/guide, GUIDE_SECTIONS) + статьи
// «Вопросов и ответов» (/help, FAQ_ARTICLES). Retrieval — лексический
// скоринг без внешних embedding API: нормализация (регистр, ё→е),
// русский стемминг + английские ключи (общий токенизатор DIG-38),
// частота слов запроса по чанку, буст совпадения в заголовке.
// Сборка индекса ленивая и одноразовая — каталог статический.
import { faqStems } from '@/lib/faq-kb-catalog';
import {
  guideSections,
  type HelpSection,
} from '@/lib/help-content';
import {
  faqArticles,
  FAQ_ARTICLES,
  type FaqArticle,
} from '@/lib/faq-kb-catalog';
import type { Locale } from '@/lib/i18n';

/** Один чанк индекса: заголовок, текст и ссылка-источник для ответа. */
export interface KnowledgeChunk {
  id: string;
  kind: 'guide' | 'faq';
  title: string;
  text: string;
  /** Ссылка на источник: раздел справки, статья FAQ или CTA заявки. */
  href: string;
  /** Человекочитаемая подпись источника («Справка · Заявки и справки»). */
  sourceLabel: string;
}

/** Чанк с лексическим скором по запросу (больше — релевантнее). */
export interface ScoredKnowledgeChunk extends KnowledgeChunk {
  score: number;
}

/** Веса скоринга: заголовок важнее тела, частота в теле — линейно. */
const TITLE_HIT_SCORE = 6;
const TITLE_PREFIX_SCORE = 3;
const BODY_HIT_SCORE = 2;
const BODY_PREFIX_SCORE = 1;
/** Сколько лучших чанков уходит в промпт. */
export const RETRIEVAL_TOP_K = 3;

/** Токен чанка: стем и частота в тексте; отдельное множество — заголовок. */
interface IndexedChunk extends KnowledgeChunk {
  titleTokens: Set<string>;
  bodyTokens: Map<string, number>;
}

// Каталог справки и FAQ статический — индекс собирается один раз на процесс
// И на локаль (DIG-88: EN-чанки для locale=en).
const cache = new Map<Locale, IndexedChunk[]>();
// Публичный срез чанка (без индексных множеств) для ответов и тестов.
const publicCache = new Map<Locale, KnowledgeChunk[]>();

/** Подпись источника по локали: «Справка · …» / «Вопросы и ответы» — канон. */
function sourceLabelFor(kind: 'guide' | 'faq', title: string, locale: Locale): string {
  if (locale === 'en') return kind === 'guide' ? `Guide · ${title}` : 'FAQ';
  return kind === 'guide' ? `Справка · ${title}` : 'Вопросы и ответы';
}

function stripIndex(chunk: IndexedChunk): KnowledgeChunk {
  return {
    id: chunk.id,
    kind: chunk.kind,
    title: chunk.title,
    text: chunk.text,
    href: chunk.href,
    sourceLabel: chunk.sourceLabel,
  };
}

/**
 * Индекс чанков справки и FAQ (ленивая одноразовая сборка на локаль).
 */
export function buildKnowledgeChunks(locale: Locale = 'ru'): KnowledgeChunk[] {
  if (!publicCache.has(locale)) {
    publicCache.set(locale, getIndexedChunks(locale).map(stripIndex));
  }
  return publicCache.get(locale)!;
}

function getIndexedChunks(locale: Locale): IndexedChunk[] {
  if (!cache.has(locale)) indexChunks(locale);
  return cache.get(locale)!;
}

function indexChunks(locale: Locale): void {
  const chunks: IndexedChunk[] = [];
  const sections: HelpSection[] = guideSections(locale);
  const articles: FaqArticle[] = locale === 'en' ? faqArticles('en') : FAQ_ARTICLES;

  for (const section of sections) {
    const title = section.title;
    const parts: string[] = [title, section.summary];
    for (const step of section.steps) parts.push(step.text);
    for (const callout of section.callouts ?? []) parts.push(callout.text);
    chunks.push({
      id: `guide:${section.id}`,
      kind: 'guide',
      title,
      text: parts.join(' '),
      href: section.href,
      sourceLabel: sourceLabelFor('guide', title, locale),
      titleTokens: new Set(faqStems(title)),
      bodyTokens: tokenFrequencies(parts.join(' ')),
    });
  }

  for (const article of articles) {
    const title = article.question;
    chunks.push({
      id: article.id,
      kind: 'faq',
      title,
      text: `${title} ${article.answer}`,
      href: article.cta?.href ?? '/help',
      sourceLabel: sourceLabelFor('faq', title, locale),
      titleTokens: new Set(faqStems(title)),
      bodyTokens: tokenFrequencies(`${title} ${article.answer}`),
    });
  }

  cache.set(locale, chunks);
  publicCache.delete(locale);
}

/** Частоты стемов в тексте чанка (для частотного скоринга запроса). */
function tokenFrequencies(text: string): Map<string, number> {
  const frequencies = new Map<string, number>();
  for (const stem of faqStems(text)) {
    frequencies.set(stem, (frequencies.get(stem) ?? 0) + 1);
  }
  return frequencies;
}

/** Совпадение по префиксу стема (правило DIG-38: стипенди ⊂ стипендиальн). */
function prefixHit(tokens: Iterable<string>, stem: string): boolean {
  for (const token of tokens) {
    if (Math.min(token.length, stem.length) < 4) continue;
    if (token.startsWith(stem) || stem.startsWith(token)) return true;
  }
  return false;
}

/**
 * Лексический retrieval: скор по уникальным токенам запроса (стемминг,
 * стоп-слова и ё→е — общий токенизатор DIG-38), частота в теле чанка и
 * буст заголовка. Чанки без ни одного попадания не возвращаются; порядок
 * при равном скорe — каталоговый (справка, затем FAQ). Локаль выбирает
 * индекс (RU — канон, EN — англоязычные чанки).
 */
export function retrieveKnowledgeChunks(
  query: string,
  limit = RETRIEVAL_TOP_K,
  locale: Locale = 'ru',
): ScoredKnowledgeChunk[] {
  const queryTokens = [...new Set(faqStems(query))];
  if (queryTokens.length === 0 || limit <= 0) return [];

  const indexed = getIndexedChunks(locale);
  const scored: { chunk: IndexedChunk; score: number }[] = [];
  for (const chunk of indexed) {
    let score = 0;
    for (const token of queryTokens) {
      if (chunk.titleTokens.has(token)) score += TITLE_HIT_SCORE;
      else if (prefixHit(chunk.titleTokens, token)) score += TITLE_PREFIX_SCORE;

      const frequency = chunk.bodyTokens.get(token) ?? 0;
      score += BODY_HIT_SCORE * frequency;
      if (frequency === 0 && prefixHit(chunk.bodyTokens.keys(), token)) score += BODY_PREFIX_SCORE;
    }
    if (score > 0) scored.push({ chunk, score });
  }

  const order = new Map(indexed.map((chunk, index) => [chunk.id, index]));
  return scored
    .sort((a, b) => b.score - a.score || order.get(a.chunk.id)! - order.get(b.chunk.id)!)
    .slice(0, limit)
    .map(({ chunk, score }) => ({ ...stripIndex(chunk), score }));
}

/** Системный промпт: только справка кабинета, честное «не знаю» без выдумок. */
export const FLOATING_SYSTEM_PROMPT =
  'Ты — AI-ассистент цифрового деканата в личном кабинете студента. ' +
  'Отвечай ТОЛЬКО по справке кабинета (данному контексту): как пользоваться разделами, ' +
  'правила учёбы, справки, заявки. Не выдумывай правила и цифры. ' +
  'Если ответа в контексте нет — честно скажи, что этого нет в справке, и предложи ' +
  'открыть раздел «Справка» (/guide) или «Вопросы и ответы» (/help), либо создать ' +
  'обращение в деканат. Отвечай коротко и по-русски, простым текстом без markdown. ' +
  'Данные кабинета вымышленные — это концепт для конкурса.';

/** EN-системный промпт (DIG-88): тот же контракт, английский язык ответа. */
export const FLOATING_SYSTEM_PROMPT_EN =
  'You are the AI assistant of the digital deanery inside a student cabinet. ' +
  'Answer ONLY from the cabinet guide (the given context): how to use the sections, ' +
  'study rules, certificates, requests. Never invent rules or numbers. ' +
  'If the answer is not in the context — say honestly that the guide does not cover it, ' +
  'and suggest opening the “Guide” (/guide) or the “FAQ” (/help), or creating a ticket ' +
  'to the deanery. Answer briefly, in English, as plain text without markdown. ' +
  'All cabinet data is fictional — this is a contest concept.';

/** Системный промпт по локали (RU — канон, прежняя строка). */
export function floatingSystemPrompt(locale: Locale = 'ru'): string {
  return locale === 'en' ? FLOATING_SYSTEM_PROMPT_EN : FLOATING_SYSTEM_PROMPT;
}

/** Сообщение chat-completions. */
export interface AssistantChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Сообщения для OpenRouter: системный промпт + топ-чанки контекстом
 * (одним пользовательским сообщением) + сам вопрос последним сообщением.
 * Локаль выбирает язык системного промпта и языка запроса контекста.
 */
export function buildOpenRouterMessages(
  question: string,
  chunks: readonly KnowledgeChunk[],
  locale: Locale = 'ru',
): AssistantChatMessage[] {
  const messages: AssistantChatMessage[] = [
    { role: 'system', content: floatingSystemPrompt(locale) },
  ];
  if (chunks.length > 0) {
    const context = chunks.map((chunk) => `— ${chunk.title}\n${chunk.text}`).join('\n\n');
    messages.push({
      role: 'user',
      content:
        locale === 'en'
          ? `Context from the cabinet guide (use only it):\n\n${context}\n\n` +
            'Answer the student’s question using this context.'
          : `Контекст из справки кабинета (используй только его):\n\n${context}\n\n` +
            'Ответь на вопрос студента по этому контексту.',
    });
  }
  messages.push({ role: 'user', content: question });
  return messages;
}

/**
 * Снятие markdown-сырца: модель может вернуть разметку — в чате рендерится
 * только текст (заголовки, жирность, код-фенсы, ссылки → плоский текст).
 */
export function toPlainText(raw: string): string {
  return raw
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/[*_]{1,3}([^*_\n]+)[*_]{1,3}/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
