// DIG-88 — EN-локализация часть 2: /guide, /help (статьи, категории, поиск),
// /ai-assistant (попап-чат, карточки действий, приветствие, fallback) и /mcp.
//
// Приёмка задачи: на английской версии НЕТ кириллицы в видимом рендере
// четырёх поверхностей (страницы рендерятся с locale=en через мок getLocale),
// RU-рендер байт-в-байт прежний. Красный-первый контур:
//  1) страницы /guide, /help (+ статья), /mcp, /ai-assistant при locale=en —
//     без [А-Яа-яЁё];
//  2) контент-каталоги (справка, FAQ ×2, MCP-доки) на EN без кириллицы,
//     RU-значения байт-в-байт прежние;
//  3) движок ассистента: EN-подсказки, EN-ответы всех намерений, EN-поиск;
//  4) RAG плавающего ассистента: EN-чанки и EN-sourceLabel.
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { act } from 'react';
import { createElement, type ComponentType } from 'react';
import { prerenderToNodeStream } from 'react-dom/static';

// getLocale → 'en': страницы рендерят английскую локаль (в проде — cookie).
vi.mock('@/lib/i18n/server', () => ({
  getLocale: vi.fn(async () => 'en' as const),
}));

// /mcp читает заголовки запроса (host для URL сервера) — в юнит-среде мок.
vi.mock('next/headers', () => ({
  headers: vi.fn(
    async () => new Headers({ host: 'cabinet.example.edu', 'x-forwarded-proto': 'https' }),
  ),
  cookies: vi.fn(async () => new Map()),
}));

// Демо-MCP-сервер страницы /mcp: сессия студента и маска токена.
vi.mock('@/server/data', () => ({
  requireDataCtx: vi.fn(async () => ({
    userId: 'auth-anna',
    login: 'anna',
    role: 'STUDENT' as const,
    studentId: 'st-anna',
    groupName: 'ПИ-21',
    faculty: 'ИТ',
  })),
  getAssistantContext: vi.fn(async () => contextFixture()),
}));

vi.mock('@/server/data/mcp', () => ({
  getOwnMcpTokenView: vi.fn(async () => ({
    tokenPreview: 'demo-mcp…ab12',
    createdAt: new Date('2026-11-14T10:00:00.000Z'),
  })),
}));

vi.mock('@/server/data/db', () => ({ dataDb: {} }));

// Server action попапа (модуль 'use server') в юнит-среде не вызывается.
vi.mock('@/server/actions/floating-assistant', () => ({
  askFloatingAssistant: vi.fn(async () => ({ ok: true, mode: 'ai', answer: 'Answer' })),
}));

afterEach(cleanup);

import GuidePage from '@/app/(cabinet)/guide/page';
import HelpPage from '@/app/(cabinet)/help/page';
import ArticlePage from '@/app/(cabinet)/help/[slug]/page';
import McpPage from '@/app/(cabinet)/mcp/page';
import AiAssistantPage from '@/app/(cabinet)/ai-assistant/page';

import { ru as ruDict } from '@/lib/i18n/ru';
import { en } from '@/lib/i18n/en';
import {
  guideHeading,
  guideIntro,
  guideSections,
  guideStepCountLabel,
} from '@/lib/help-content';
import {
  FAQ_ARTICLES,
  FAQ_CATEGORY_LABELS,
  POPULAR_QUERIES,
  faqArticles,
  faqCategoryLabel,
  popularQueries,
  searchFaqArticles,
} from '@/lib/faq-kb-catalog';
import { FAQ_ENTRIES, faqEntries } from '@/lib/faq-catalog';
import {
  MCP_CONFIG_TOKEN_PLACEHOLDER,
  MCP_DOCS_SECURITY,
  MCP_DOCS_STEPS,
  MCP_DOCS_WHAT_IS,
  MCP_EXAMPLE_QUESTIONS,
  buildMcpConfigSnippet,
  mcpConfigTokenPlaceholder,
  mcpDocsSecurity,
  mcpDocsSteps,
  mcpDocsWhatIs,
  mcpExampleQuestions,
  mcpToolCatalog,
} from '@/lib/mcp-docs';
import {
  ASSISTANT_HINTS,
  assistantHints,
  buildAssistantReply,
  detectAssistantIntent,
  type AssistantContext,
  type AssistantCard,
} from '@/lib/assistant-engine';
import { buildKnowledgeChunks, retrieveKnowledgeChunks } from '@/lib/floating-assistant-knowledge';
import { HelpSearch } from '@/components/help/help-search';
import { HelpBrowser } from '@/components/help/help-browser';
import { HelpFeedback } from '@/components/help/help-feedback';
import { Callout } from '@/components/help/callout';
import { AssistantChat } from '@/components/assistant/assistant-chat';
import { AssistantCardList } from '@/components/assistant/assistant-cards';
import { FloatingAssistantPopup } from '@/components/assistant/floating-assistant-popup';

const CYRILLIC = /[А-Яа-яЁё]/;

function expectNoCyrillic(html: string, what: string) {
  const hit = CYRILLIC.exec(html);
  expect(
    hit,
    `${what}: кириллица в EN-рендере: …${html.slice(Math.max(0, (hit?.index ?? 0) - 40), (hit?.index ?? 0) + 60)}…`,
  ).toBeNull();
}

async function renderPage(node: React.ReactNode): Promise<string> {
  const { prelude } = await prerenderToNodeStream(node);
  let html = '';
  for await (const chunk of prelude) {
    html += String(chunk);
  }
  return html.replaceAll('<!-- -->', '');
}

// ── фикстуры ──────────────────────────────────────────────────────────────────

function contextFixture(): AssistantContext {
  return {
    role: 'STUDENT',
    firstName: 'Anna',
    groupLabel: 'CS-21',
    tomorrow: {
      dateKey: '2026-11-12',
      dateLabel: 'Thursday, November 12',
      events: [
        {
          timeLabel: '12:00–13:30',
          discipline: 'Programming',
          kindLabel: 'Lab',
          roomLabel: 'Room 405',
          teacher: 'Ivanova Irina Igorevna',
          isMoved: true,
          isCancelled: false,
          isOnline: false,
          previousRoomLabel: 'was: room 310',
        },
      ],
    },
    nextStudyDayLabel: null,
    disciplines: [
      {
        code: 'PI21-DB',
        name: 'Databases',
        teacherName: 'Sokolov Sergey Sergeevich',
        accumulated: 25.5,
        maxPossible: 75.5,
        plan: [
          {
            code: 'PI21-DB-P1',
            name: 'Project',
            kindLabel: 'Project',
            weightPercent: 30,
            maxScore: 100,
            graded: true,
            score: 85,
          },
          {
            code: 'PI21-DB-E1',
            name: 'Exam',
            kindLabel: 'Exam',
            weightPercent: 50,
            maxScore: 100,
            graded: false,
            score: null,
          },
        ],
        exam: {
          code: 'PI21-DB-E1',
          name: 'Exam',
          weightPercent: 50,
          maxScore: 100,
          graded: false,
          score: null,
        },
      },
    ],
  };
}

const scheduleCard: AssistantCard = {
  type: 'schedule',
  title: 'Tomorrow · Thursday, November 12',
  dateLabel: 'Thursday, November 12',
  events: contextFixture().tomorrow!.events,
  note: null,
  href: '/schedule?view=day&date=2026-11-12',
};

const orderCard: AssistantCard = {
  type: 'order',
  serviceId: 'cert-defer',
  title: 'Request draft',
  serviceTitle: 'Military-service deferral certificate',
  benefit: 'For the enlistment office at your place of study',
  etaLabel: '1 day',
  formatLabel: 'PDF',
  requestTypeLabel: 'Certificate',
  notice: 'Draft, not submitted.',
  confirmLabel: 'Confirm and send',
  disabledReason: null,
};

// ── 1. страницы при locale=en: ноль кириллицы ─────────────────────────────────

describe('DIG-88: страницы /guide /help /mcp /ai-assistant при locale=en без кириллицы', () => {
  it('/guide: заголовок, интро, все разделы и поиск — EN', async () => {
    const Page = GuidePage as unknown as ComponentType;
    const html = await renderPage(createElement(Page));
    expectNoCyrillic(html, 'GuidePage');
    expect(html).toContain('How to use the cabinet');
    expect(html).toContain('Search the guide');
    expect(html).toContain('Contents');
    expect(html).toContain('Open the section');
  });

  it('/help: поиск, популярные запросы, категории и статьи — EN', async () => {
    const Page = HelpPage as unknown as ComponentType;
    const html = await renderPage(createElement(Page));
    expectNoCyrillic(html, 'HelpPage');
    expect(html).toContain('Find your answer');
    expect(html).toContain('Scholarships and payments');
    expect(html).toContain('When does the scholarship arrive?');
  });

  it('/help/[slug]: статья, «Полезно?», связанные — EN', async () => {
    const Article = ArticlePage as unknown as ComponentType<{ params: Promise<{ slug: string }> }>;
    const html = await renderPage(
      createElement(Article, { params: Promise.resolve({ slug: 'schol-when' }) }),
    );
    expectNoCyrillic(html, 'ArticlePage');
    expect(html).toContain('When does the scholarship arrive?');
    expect(html).toContain('Was this helpful?');
    expect(html).toContain('Related articles');
    expect(html).toContain('All questions and answers');
  });

  it('/mcp: секции, каталог инструментов, шаги, примеры, карточка подключения — EN', async () => {
    const Page = McpPage as unknown as ComponentType;
    const html = await renderPage(createElement(Page));
    expectNoCyrillic(html, 'McpPage');
    expect(html).toContain('What is MCP');
    expect(html).toContain('My schedule for today');
    expect(html).toContain('Copy config');
    // Плейсхолдер в разметке экранируется (&lt;…&gt;) — проверяем имя без скобок.
    expect(html).toContain('YOUR_TOKEN');
    // RU-плейсхолдер и RU-заголовки не проникают в EN-рендер.
    expect(html).not.toContain('<ВАШ_ТОКЕН>');
  });

  it('/ai-assistant: приветствие, подсказки, кнопки, дисклеймер — EN', async () => {
    const Page = AiAssistantPage as unknown as ComponentType<{
      searchParams?: Promise<Record<string, string>>;
    }>;
    const html = await renderPage(createElement(Page, { searchParams: Promise.resolve({}) }));
    expectNoCyrillic(html, 'AiAssistantPage');
    expect(html).toContain('AI assistant');
    expect(html).toContain('Hello, Anna!');
    expect(html).toContain('What do I have tomorrow?');
    expect(html).toContain('New dialog');
  });
});

// ── 2. контент-каталоги: EN без кириллицы, RU байт-в-байт ─────────────────────

describe('DIG-88: справка /guide — двуязычный каталог', () => {
  it('EN-разделы: заголовки, шаги, ссылки, callout — без кириллицы', () => {
    const sections = guideSections('en');
    expect(sections.map((s) => s.id)).toEqual(guideSections('ru').map((s) => s.id));
    for (const section of sections) {
      expectNoCyrillic(section.title, `guide ${section.id}.title`);
      expectNoCyrillic(section.summary, `guide ${section.id}.summary`);
      for (const step of section.steps) {
        expectNoCyrillic(step.text, `guide ${section.id}.step`);
        if (step.link) expectNoCyrillic(step.link.label, `guide ${section.id}.link`);
      }
      for (const callout of section.callouts ?? []) {
        expectNoCyrillic(callout.text, `guide ${section.id}.callout`);
      }
    }
    expect(guideHeading('en')).toBe('How to use the cabinet');
    expect(guideIntro('en')).not.toMatch(CYRILLIC);
    expect(guideStepCountLabel(2, 'en')).toBe('sections');
  });

  it('RU байт-в-байт: прежние строки каталога не изменились', () => {
    expect(guideHeading()).toBe('Как пользоваться кабинетом');
    expect(guideIntro()).toBe(
      'Справка по кабинету: короткие пошаговые инструкции по каждому разделу — от входа до ICS-подписки. Все данные в кабинете вымышленные, прототип — концепт для конкурса.',
    );
    const login = guideSections().find((s) => s.id === 'login')!;
    expect(login.title).toBe('Вход и безопасность');
    expect(login.steps[0]!.text).toBe(
      'Откройте страницу входа и введите логин и пароль, выданные вам деканатом (в прототипе — вымышленные демо-аккаунты).',
    );
    const requests = guideSections().find((s) => s.id === 'requests')!;
    expect(requests.steps[2]!.text).toBe(
      'Следите за статусом: Подана → Принята → В работе → Готова → Выдана.',
    );
  });
});

describe('DIG-88: база знаний /help — двуязычный каталог', () => {
  it('EN-статьи: вопрос, ответ, категории, популярные запросы — без кириллицы', () => {
    const articles = faqArticles('en');
    expect(articles.map((a) => a.id)).toEqual(FAQ_ARTICLES.map((a) => a.id));
    for (const article of articles) {
      expectNoCyrillic(article.question, `faq ${article.id}.question`);
      expectNoCyrillic(article.answer, `faq ${article.id}.answer`);
      if (article.cta) expectNoCyrillic(article.cta.label, `faq ${article.id}.cta`);
    }
    for (const category of articles.map((a) => a.category)) {
      expectNoCyrillic(faqCategoryLabel('en', category), `category ${category}`);
    }
    for (const popular of popularQueries('en')) {
      expectNoCyrillic(popular, 'popular query');
    }
  });

  it('EN-поиск находит статьи по английским запросам', () => {
    const hits = searchFaqArticles('scholarship', 'en');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]!.id).toContain('schol');
    expect(searchFaqArticles('enrollment certificate', 'en').map((a) => a.id)).toContain(
      'cert-online',
    );
  });

  it('RU байт-в-байт: прежние строки и поиск не изменились', () => {
    expect(FAQ_CATEGORY_LABELS.STUDY).toBe('Учёба и сессия');
    expect(POPULAR_QUERIES[0]).toBe('стипендия');
    expect(
      FAQ_ARTICLES.find((a) => a.id === 'schol-when')!.question,
    ).toBe('Когда приходит стипендия?');
    expect(searchFaqArticles('стипендия')[0]!.id).toContain('schol');
    expect(faqCategoryLabel('ru', 'DORMITORY')).toBe('Общежитие');
    expect(popularQueries()).toEqual(POPULAR_QUERIES);
    expect(faqArticles().map((a) => a.question)).toEqual(FAQ_ARTICLES.map((a) => a.question));
  });

  it('каталог ⌘K (faq-catalog): EN-вопросы/ответы/теги без кириллицы, RU прежние', () => {
    const entriesEn = faqEntries('en');
    expect(entriesEn.map((e) => e.id)).toEqual(FAQ_ENTRIES.map((e) => e.id));
    for (const entry of entriesEn) {
      expectNoCyrillic(entry.question, `faq-entry ${entry.id}.question`);
      expectNoCyrillic(entry.answer, `faq-entry ${entry.id}.answer`);
      expectNoCyrillic(entry.tags.join(' '), `faq-entry ${entry.id}.tags`);
    }
    expect(FAQ_ENTRIES[0]!.question).toBe('Как заказать справку об обучении?');
    expect(faqEntries()[0]!.question).toBe('Как заказать справку об обучении?');
    expect(faqEntries('en')[0]!.question).toBe('How do I order an enrollment certificate?');
  });
});

// ── 3. страница /mcp: доки и конфиг-сниппет ───────────────────────────────────

describe('DIG-88: MCP-документация двуязычна', () => {
  it('EN-тексты: что это, безопасность, шаги, примеры, инструменты — без кириллицы', () => {
    for (const paragraph of mcpDocsWhatIs('en')) expectNoCyrillic(paragraph, 'what-is');
    for (const paragraph of mcpDocsSecurity('en')) expectNoCyrillic(paragraph, 'security');
    for (const step of mcpDocsSteps('en')) {
      expectNoCyrillic(step.title, 'step title');
      expectNoCyrillic(step.text, 'step text');
    }
    for (const question of mcpExampleQuestions('en')) expectNoCyrillic(question, 'example');
    for (const tool of mcpToolCatalog('en')) {
      expectNoCyrillic(tool.title, `tool ${tool.name}.title`);
      expectNoCyrillic(tool.description, `tool ${tool.name}.description`);
    }
    expect(mcpConfigTokenPlaceholder('en')).toBe('<YOUR_TOKEN>');
    const snippet = buildMcpConfigSnippet('https://cabinet.example.edu/api/mcp', 'en');
    expectNoCyrillic(snippet, 'config snippet');
    expect(snippet).toContain('<YOUR_TOKEN>');
  });

  it('RU байт-в-байт: прежние экспорты не изменились', () => {
    expect(MCP_CONFIG_TOKEN_PLACEHOLDER).toBe('<ВАШ_ТОКЕН>');
    expect(mcpConfigTokenPlaceholder()).toBe('<ВАШ_ТОКЕН>');
    expect(mcpDocsWhatIs()[0]).toBe(MCP_DOCS_WHAT_IS[0]);
    expect(mcpDocsSecurity()).toEqual([...MCP_DOCS_SECURITY]);
    expect(mcpDocsSteps()).toEqual([...MCP_DOCS_STEPS]);
    expect(mcpExampleQuestions()).toEqual([...MCP_EXAMPLE_QUESTIONS]);
    expect(buildMcpConfigSnippet('https://cabinet.example.edu/api/mcp')).toContain('<ВАШ_ТОКЕН>');
    expect(mcpToolCatalog()[0]!.title).toBe('Моё расписание на сегодня');
  });
});

// ── 4. движок ассистента ──────────────────────────────────────────────────────

describe('DIG-88: движок ассистента на EN', () => {
  it('EN-вопросы распознаются прежними намерениями', () => {
    expect(detectAssistantIntent('What do I have tomorrow?')).toBe('tomorrow-schedule');
    expect(
      detectAssistantIntent('How many points do I need on the Databases exam to get an 8?'),
    ).toBe('exam-target');
    expect(detectAssistantIntent('Order a certificate for the military enlistment office')).toBe(
      'order-defer-certificate',
    );
    expect(detectAssistantIntent('How do I take an academic leave?')).toBe('faq-academic-leave');
    expect(detectAssistantIntent('Show me the schedule of another student')).toBe('foreign-data');
    expect(detectAssistantIntent('What is the weather like today?')).toBe('off-topic');
    // RU-поведение прежнее.
    expect(detectAssistantIntent('Что у меня завтра?')).toBe('tomorrow-schedule');
    expect(detectAssistantIntent('Закажи справку для военкомата')).toBe(
      'order-defer-certificate',
    );
  });

  it('EN-ответы всех намерений без кириллицы', () => {
    const ctx = contextFixture();
    const asks = [
      'What do I have tomorrow?',
      'How many points do I need on the Databases exam to get an 8?',
      'Order a certificate for the military enlistment office',
      'How do I take an academic leave?',
      'Show me the gradebook of another student',
      'Tell me a joke',
      'blah blah blah',
    ];
    for (const ask of asks) {
      const reply = buildAssistantReply(ask, ctx, 'en');
      expectNoCyrillic(reply.text, `reply «${ask}»`);
      expectNoCyrillic(JSON.stringify(reply.cards), `cards «${ask}»`);
      for (const source of reply.sources) expectNoCyrillic(source, `sources «${ask}»`);
    }
  });

  it('EN-ответ про завтра: заголовок, карточка, источник', () => {
    const reply = buildAssistantReply('What do I have tomorrow?', contextFixture(), 'en');
    expect(reply.text).toContain('Tomorrow, Thursday, November 12, you have 1 class');
    const card = reply.cards[0]!;
    expect(card.type === 'schedule' && card.title).toBe('Tomorrow · Thursday, November 12');
    expect(reply.sources).toEqual(['schedule']);
  });

  it('EN-подсказки без кириллицы; RU байт-в-байт', () => {
    expect(ASSISTANT_HINTS[0]).toBe('Что у меня завтра?');
    for (const hint of assistantHints('en')) {
      expectNoCyrillic(hint, 'hint');
    }
    expect(assistantHints()).toEqual(ASSISTANT_HINTS);
    expect(buildAssistantReply('Что у меня завтра?', contextRuFixture()).text).toContain(
      'Завтра, пятница, 13 ноября, у вас 2 пары',
    );
  });
});

function contextRuFixture(): AssistantContext {
  const ctx = contextFixture();
  return {
    ...ctx,
    firstName: 'Анна',
    tomorrow: {
      dateKey: '2026-11-13',
      dateLabel: 'пятница, 13 ноября',
      events: [
        ctx.tomorrow!.events[0]!,
        {
          timeLabel: '14:00–15:30',
          discipline: 'Программирование',
          kindLabel: 'Лабораторная',
          roomLabel: 'ауд. 405',
          teacher: 'Иванова Ирина Игоревна',
          isMoved: false,
          isCancelled: false,
          isOnline: false,
          previousRoomLabel: null,
        },
      ],
    },
  };
}

// ── 5. клиентские компоненты при locale=en ────────────────────────────────────

describe('DIG-88: компоненты справки на EN без кириллицы', () => {
  it('HelpSearch: поиск, оглавление, кнопки — EN', () => {
    const html = renderToStaticMarkup(
      createElement(HelpSearch, { sections: guideSections('en'), locale: 'en' }),
    );
    expectNoCyrillic(html, 'HelpSearch');
    expect(html).toContain('Search the guide');
    expect(html).toContain('Contents');
    expect(html).toContain('Open the section');
  });

  it('HelpBrowser: категории, популярные запросы, статьи — EN', () => {
    const html = renderToStaticMarkup(createElement(HelpBrowser, { locale: 'en' }));
    expectNoCyrillic(html, 'HelpBrowser');
    expect(html).toContain('Find your answer');
    expect(html).toContain('Popular searches');
    expect(html).toContain('scholarship');
  });

  it('HelpBrowser EN: пустой результат поиска — не тупик и без кириллицы', () => {
    const { container } = render(createElement(HelpBrowser, { locale: 'en' }));
    const input = container.querySelector('#help-search') as HTMLInputElement;
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )!.set!;
      setter.call(input, 'qqqq');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const html = container.innerHTML;
    expect(html).toContain('Nothing found');
    expect(html).toContain('Ask the AI assistant');
    expectNoCyrillic(html, 'HelpBrowser empty');
  });

  it('HelpFeedback и Callout — EN', () => {
    const feedback = renderToStaticMarkup(createElement(HelpFeedback, { locale: 'en' }));
    expectNoCyrillic(feedback, 'HelpFeedback');
    expect(feedback).toContain('Was this helpful?');
    // Голос «Да» отмечается и благодарность появляется (delta-спека).
    const live = render(createElement(HelpFeedback, { locale: 'en' }));
    fireEvent.click(live.getByTestId('help-feedback-yes'));
    expectNoCyrillic(live.container.innerHTML, 'HelpFeedback voted');
    expect(live.container.innerHTML).toContain('Your feedback is counted');
    const callout = renderToStaticMarkup(
      createElement(Callout, {
        callout: { kind: 'tip', text: 'Deadline notifications live in Settings.' },
        locale: 'en',
      }),
    );
    expectNoCyrillic(callout, 'Callout');
    expect(callout).toContain('Tip');
    const warning = renderToStaticMarkup(
      createElement(Callout, {
        callout: { kind: 'warning', text: 'Never share your token.' },
        locale: 'en',
      }),
    );
    expect(warning).toContain('Important');
  });

  it('RU байт-в-байт: подписи компонентов прежние', () => {
    const feedback = render(createElement(HelpFeedback));
    expect(feedback.container.innerHTML).toContain('Полезно?');
    fireEvent.click(feedback.getByTestId('help-feedback-yes'));
    expect(feedback.container.innerHTML).toContain('Спасибо! Ваш отзыв учтён.');
    const callout = renderToStaticMarkup(
      createElement(Callout, { callout: { kind: 'tip', text: 'Совет.' } }),
    );
    expect(callout).toContain('Совет');
    const search = renderToStaticMarkup(
      createElement(HelpSearch, { sections: guideSections() }),
    );
    expect(search).toContain('Поиск по справке');
    expect(search).toContain('Содержание');
    expect(search).toContain('Открыть раздел');
    const browser = renderToStaticMarkup(createElement(HelpBrowser));
    expect(browser).toContain('Найдите ответ');
    expect(browser).toContain('стипендия');
  });
});

describe('DIG-88: ассистент и попап на EN без кириллицы', () => {
  it('AssistantChat: приветствие, подсказки, кнопки, поле — EN', () => {
    const html = renderToStaticMarkup(
      createElement(AssistantChat, { context: contextFixture(), locale: 'en' }),
    );
    expectNoCyrillic(html, 'AssistantChat');
    expect(html).toContain('Hello, Anna!');
    expect(html).toContain('New dialog');
    expect(html).toContain('History');
    expect(html).toContain('What do I have tomorrow?');
    expect(html).toContain('Ask about your studies');
  });

  it('AssistantChat RU байт-в-байт: прежнее приветствие и подсказки', () => {
    const html = renderToStaticMarkup(createElement(AssistantChat, { context: contextRuFixture() }));
    expect(html).toContain('Здравствуйте, Анна!');
    expect(html).toContain('Что у меня завтра?');
    expect(html).toContain('Новый диалог');
    expect(html).toContain('История');
    expect(html).toContain('Спросите про учёбу');
  });

  it('карточки действий (schedule/order/faq) на EN — без кириллицы', () => {
    const html = renderToStaticMarkup(
      createElement(AssistantCardList, {
        cards: [
          scheduleCard,
          orderCard,
          {
            type: 'faq',
            title: 'How to take an academic leave',
            articleTitle: 'Academic leave: how to arrange it',
            articleHref: '/help',
            bullets: ['Submit the application at the deanery.'],
          },
        ],
        locale: 'en',
      }),
    );
    expectNoCyrillic(html, 'AssistantCardList');
    expect(html).toContain('Rescheduled · was: room 310');
    expect(html).toContain('Open the schedule');
    expect(html).toContain('Confirm and send');
    expect(html).toContain('ready in: 1 day');
  });

  it('калькулятор цели на EN — без кириллицы', () => {
    const card: AssistantCard = {
      type: 'calculator',
      title: 'Goal calculator · Databases',
      disciplineCode: 'PI21-DB',
      disciplineName: 'Databases',
      teacherName: 'Sokolov Sergey Sergeevich',
      accumulatedLabel: '25.5 out of 100',
      maxPossibleLabel: '75.5 out of 100',
      plan: contextFixture().disciplines[0]!.plan,
      exam: contextFixture().disciplines[0]!.exam,
      initialTarget: 80,
    };
    const html = renderToStaticMarkup(
      createElement(AssistantCardList, { cards: [card], locale: 'en' }),
    );
    expectNoCyrillic(html, 'CalculatorCard');
    expect(html).toContain('Accumulated: 25.5 out of 100');
    expect(html).toContain('Custom target');
  });

  it('FloatingAssistantPopup: приветствие, плейсхолдер, кнопка — EN', () => {
    render(createElement(FloatingAssistantPopup, { open: true, onOpenChange: () => {}, locale: 'en' }));
    // BaseDialog рендерит в портал — содержимое ищем во всём document.body.
    const html = document.body.innerHTML;
    expectNoCyrillic(html, 'FloatingAssistantPopup');
    expect(html).toContain('Hello!');
    expect(html).toContain('help assistant');
    expect(html).toContain('Ask how to use the cabinet');
  });

  it('FloatingAssistantPopup RU байт-в-байт', () => {
    render(createElement(FloatingAssistantPopup, { open: true, onOpenChange: () => {} }));
    const html = document.body.innerHTML;
    expect(html).toContain('Здравствуйте!');
    expect(html).toContain('Спросите, как пользоваться кабинетом…');
  });
});

// ── 6. RAG плавающего ассистента ──────────────────────────────────────────────

describe('DIG-88: RAG плавающего ассистента двуязычен', () => {
  it('EN-чанки: заголовок, текст, источник — без кириллицы', () => {
    const chunks = buildKnowledgeChunks('en');
    expect(chunks.length).toBe(buildKnowledgeChunks('ru').length);
    for (const chunk of chunks) {
      expectNoCyrillic(chunk.title, `chunk ${chunk.id}.title`);
      expectNoCyrillic(chunk.text, `chunk ${chunk.id}.text`);
      expectNoCyrillic(chunk.sourceLabel, `chunk ${chunk.id}.sourceLabel`);
    }
    expect(chunks.some((c) => c.sourceLabel.startsWith('Guide · '))).toBe(true);
    expect(chunks.some((c) => c.sourceLabel === 'FAQ')).toBe(true);
  });

  it('EN-вопрос находит EN-чанк', () => {
    const top = retrieveKnowledgeChunks('How do I get an enrollment certificate?', 3, 'en');
    expect(top.length).toBeGreaterThan(0);
    expect(top[0]!.id).toContain('cert');
    expectNoCyrillic(top[0]!.text, 'top chunk');
  });

  it('RU байт-в-байт: прежние чанки и подписи источников', () => {
    const chunks = buildKnowledgeChunks();
    expect(chunks.some((c) => c.sourceLabel.startsWith('Справка · '))).toBe(true);
    expect(chunks.some((c) => c.sourceLabel === 'Вопросы и ответы')).toBe(true);
    const top = retrieveKnowledgeChunks('Как оформить справку об обучении?', 3);
    expect(top.length).toBeGreaterThan(0);
  });
});

// ── 7. словари: паритет и отсутствие кириллицы на EN ──────────────────────────

describe('DIG-88: словари i18n', () => {
  it('наборы ключей RU и EN идентичны', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(ruDict).sort());
  });

  it('новые EN-ключи без кириллицы', () => {
    for (const [key, value] of Object.entries(en)) {
      if (key.startsWith('locale.')) continue;
      expect(CYRILLIC.test(value), `ключ ${key}: «${value}»`).toBe(false);
    }
  });

  it('RU-значения новых ключей байт-в-байт равны прежним строкам интерфейса', () => {
    expect(ruDict['assistant.newDialog']).toBe('Новый диалог');
    expect(ruDict['assistant.history']).toBe('История');
    expect(ruDict['assistant.sourcesPrefix']).toBe('По данным: {sources}');
    expect(ruDict['assistant.input.placeholder']).toBe(
      'Спросите про учёбу: пара, оценка, справка…',
    );
    expect(ruDict['assistant.card.openSchedule']).toBe('Открыть расписание');
    expect(ruDict['assistant.report.trigger']).toBe('Сообщить о неверном ответе');
    expect(ruDict['help.findAnswer']).toBe('Найдите ответ');
    expect(ruDict['help.feedback.question']).toBe('Полезно?');
    expect(ruDict['help.feedback.thanks']).toBe('Спасибо! Ваш отзыв учтён.');
    expect(ruDict['help.back']).toBe('Все вопросы и ответы');
    expect(ruDict['help.related']).toBe('Связанные статьи');
    expect(ruDict['guide.search.label']).toBe('Поиск по справке');
    expect(ruDict['guide.toc']).toBe('Содержание');
    expect(ruDict['guide.openSection']).toBe('Открыть раздел');
    expect(ruDict['mcp.card.copy']).toBe('Скопировать конфиг');
    expect(ruDict['mcp.card.copied']).toBe('Скопировано');
    expect(ruDict['mcp.whatIs']).toBe('Что такое MCP');
    expect(ruDict['callout.tip']).toBe('Совет');
    expect(ruDict['callout.warning']).toBe('Важно');
    expect(ruDict['assistant.popup.pending']).toBe('Ассистент печатает…');
    expect(ruDict['meta.guide']).toBe('Справка — Цифровой деканат');
    expect(ruDict['meta.help']).toBe('Вопросы и ответы — Цифровой деканат');
    expect(ruDict['meta.mcp']).toBe('Подключение ассистента (MCP) — Цифровой деканат');
    expect(ruDict['meta.assistant']).toBe('AI-ассистент — Цифровой деканат');
  });
});
