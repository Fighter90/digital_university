// DIG-72 — RAG-модуль плавающего AI-ассистента: чанки справки (/guide) и
// FAQ (/help), лексический retrieval (русский + английский), промпт для
// OpenRouter и снятие markdown. Чистый модуль без серверных импортов —
// те же принципы, что у lib/help-content и lib/faq-kb-catalog.
import { describe, expect, it } from 'vitest';

import {
  FLOATING_SYSTEM_PROMPT,
  buildOpenRouterMessages,
  buildKnowledgeChunks,
  retrieveKnowledgeChunks,
  toPlainText,
} from '@/lib/floating-assistant-knowledge';

describe('индекс чанков', () => {
  it('собирает чанки из секций справки и статей FAQ', () => {
    const chunks = buildKnowledgeChunks();
    const guide = chunks.filter((c) => c.kind === 'guide');
    const faq = chunks.filter((c) => c.kind === 'faq');
    expect(guide.length).toBeGreaterThanOrEqual(10); // GUIDE_SECTIONS DIG-70
    expect(faq.length).toBeGreaterThanOrEqual(20); // FAQ_ARTICLES DIG-38
    // у каждого чанка — заголовок, текст и ссылка-источник
    for (const chunk of chunks) {
      expect(chunk.title.length).toBeGreaterThan(0);
      expect(chunk.text.length).toBeGreaterThan(0);
      expect(chunk.href.startsWith('/')).toBe(true);
    }
  });
});

describe('retrieval (лексический скоринг)', () => {
  it('RU-вопрос про справку об обучении находит FAQ-чанк про справки', () => {
    const top = retrieveKnowledgeChunks('Как оформить справку об обучении?', 3);
    expect(top.length).toBeGreaterThan(0);
    expect(['cert-online', 'cert-time', 'cert-paper', 'requests']).toContain(top[0]!.id);
  });

  it('RU-вопрос про пересдачу находит статью FAQ о пересдаче', () => {
    const top = retrieveKnowledgeChunks('Как пройти пересдачу?', 3);
    expect(top[0]!.id).toBe('study-retake');
  });

  it('RU-вопрос про стипендию находит статьи о стипендии (словоформа)', () => {
    const top = retrieveKnowledgeChunks('Когда придёт стипендия?', 3);
    expect(top[0]!.kind).toBe('faq');
    expect(top[0]!.id).toContain('schol');
  });

  it('вопрос про расписание находит раздел справки о расписании', () => {
    const top = retrieveKnowledgeChunks('Где посмотреть перенос пары?', 3);
    expect(top.some((c) => c.id === 'guide:schedule')).toBe(true);
  });

  it('английский/латинский ключ MCP находит раздел про подключение ассистента', () => {
    const top = retrieveKnowledgeChunks('Как настроить MCP для своего ассистента?', 3);
    // DIG-73: у справки появился выделенный раздел «mcp» — он теперь лучший
    // ответ на запрос про настройку MCP (раньше был только чанк guide:calendar).
    expect(top.some((c) => c.id === 'guide:mcp')).toBe(true);
  });

  it('возвращает не больше лимита и только чанки со скором выше нуля', () => {
    const top = retrieveKnowledgeChunks('общежитие заселение', 3);
    expect(top.length).toBeLessThanOrEqual(3);
    expect(top.length).toBeGreaterThan(0);
  });

  it('бессмысленный запрос не отдаёт чанков (скор 0 отфильтрован)', () => {
    const top = retrieveKnowledgeChunks('фываолдж прривет', 3);
    expect(top).toEqual([]);
  });
});

describe('промпт для OpenRouter', () => {
  it('системный промпт требует отвечать только по справке и честно признавать незнание', () => {
    expect(FLOATING_SYSTEM_PROMPT).toContain('справк');
    expect(FLOATING_SYSTEM_PROMPT).toMatch(/обращени|деканат/);
    expect(FLOATING_SYSTEM_PROMPT).toMatch(/честно|не наш(ёл|ли)|нет данных/i);
  });

  it('в промпт идут топ-3 чанка контекстом и вопрос последним сообщением пользователя', () => {
    const chunks = retrieveKnowledgeChunks('Как оформить справку?', 3);
    const messages = buildOpenRouterMessages('Как оформить справку?', chunks);
    expect(messages[0]!.role).toBe('system');
    expect(messages[0]!.content).toBe(FLOATING_SYSTEM_PROMPT);
    const contextMessages = messages.filter((m) => m.role === 'user' && m !== messages.at(-1));
    expect(contextMessages.length).toBe(1);
    // в контекст попали все чанки (их меньше лимита не бывает — фикс 3 или меньше)
    for (const chunk of chunks) {
      expect(contextMessages[0]!.content).toContain(chunk.title);
    }
    const last = messages.at(-1)!;
    expect(last.role).toBe('user');
    expect(last.content).toBe('Как оформить справку?');
  });
});

describe('toPlainText (ответ без markdown-сырца)', () => {
  it('снимает заголовки, жирный/курсив, код и ссылки', () => {
    const raw = [
      '## Заголовок',
      'Ответ **жирный** и _курсив_, `код`, ссылка [справка](/guide).',
      '```',
      'console.log(1)',
      '```',
    ].join('\n');
    const text = toPlainText(raw);
    expect(text).not.toMatch(/#{1,6}\s/);
    expect(text).not.toMatch(/\*\*|__/);
    expect(text).not.toMatch(/`/);
    expect(text).not.toMatch(/\[|\]\(/);
    expect(text).toContain('Заголовок');
    expect(text).toContain('жирный');
    expect(text).toContain('справка');
  });

  it('сохраняет переносы строк между абзацами', () => {
    const text = toPlainText('Первый абзац.\n\nВторой абзац.');
    expect(text).toContain('Первый абзац.');
    expect(text).toContain('Второй абзац.');
    expect(text).toMatch(/\n/);
  });
});
