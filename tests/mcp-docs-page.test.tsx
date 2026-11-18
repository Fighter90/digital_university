// DIG-73 — контракт страницы документации MCP (/mcp, red-first).
// Приёмка: страница рендерит «что это / что доступно / как подключить /
// безопасность», JSON-сниппет с плейсхолдером <ВАШ_ТОКЕН> (никаких реальных
// ключей), кнопку «Скопировать конфиг», примеры вопросов; пункт меню в
// «Ещё», иконка /mcp, i18n-паритет menu/title; раздел /guide и FAQ-статья.
// Страница GET-only: мутаций нет, токен владельца — только маскированное
// превью (plaintext не хранится и не приходит на страницу).
import { describe, expect, it, vi } from 'vitest';
import { createElement, type ComponentType } from 'react';
import { prerenderToNodeStream } from 'react-dom/static';

const studentCtx = {
  userId: 'auth-anna',
  login: 'anna',
  role: 'STUDENT' as const,
  studentId: 'st-anna',
  groupName: 'ПИ-21',
  faculty: 'ИТ',
};

const staffCtx = {
  userId: 'auth-dean',
  login: 'dean.kovaleva',
  role: 'STAFF' as const,
  studentId: null,
  groupName: null,
  faculty: 'ИТ',
};

const tokenView = {
  tokenPreview: 'demo-mcp…ab12',
  createdAt: new Date('2026-11-14T10:00:00.000Z'),
};

// Мок ctx можно переключать между тестами (студент/сотрудник).
let currentCtx: typeof studentCtx | typeof staffCtx = studentCtx;
const tokenViewSpy = vi.fn(async () => tokenView);

vi.mock('next/headers', () => ({
  headers: vi.fn(
    async () => new Headers({ host: 'cabinet.example.edu', 'x-forwarded-proto': 'https' }),
  ),
  cookies: vi.fn(async () => new Map()),
}));

vi.mock('@/server/data', () => ({
  requireDataCtx: vi.fn(async () => currentCtx),
}));

vi.mock('@/server/data/mcp', () => ({
  getOwnMcpTokenView: (...args: unknown[]) => tokenViewSpy(...(args as [])),
}));

vi.mock('@/server/data/db', () => ({ dataDb: {} }));

import McpPage from '@/app/(cabinet)/mcp/page';
import { sectionIcon } from '@/components/shell/nav-icons';
import { MORE_SECTIONS, TAB_SECTIONS, resolveActiveTab } from '@/components/shell/nav-items';
import { navLabel, sectionTitle, t } from '@/lib/i18n';
import { en } from '@/lib/i18n/en';
import { ru } from '@/lib/i18n/ru';
import { DEANERY_MCP_TOOLS, MCP_ENDPOINT_PATH } from '@/lib/mcp-protocol';
import {
  MCP_CONFIG_TOKEN_PLACEHOLDER,
  MCP_EXAMPLE_QUESTIONS,
  buildMcpConfigSnippet,
} from '@/lib/mcp-docs';
import { GUIDE_SECTIONS, filterHelpSections } from '@/lib/help-content';
import { FAQ_ARTICLES, getFaqArticle } from '@/lib/faq-kb-catalog';

async function renderPage(): Promise<string> {
  const Page = McpPage as unknown as ComponentType;
  const { prelude } = await prerenderToNodeStream(createElement(Page));
  let html = '';
  for await (const chunk of prelude) {
    html += String(chunk);
  }
  return html.replaceAll('<!-- -->', '');
}

describe('/mcp — страница документации MCP (DIG-73)', () => {
  it('секции «что это», «что доступно», «как подключить», «безопасность»', async () => {
    currentCtx = studentCtx;
    const html = await renderPage();

    expect(html).toContain('data-testid="mcp-page"');
    expect(html).toContain('data-testid="mcp-what-is"');
    expect(html).toContain('data-testid="mcp-tools"');
    expect(html).toContain('data-testid="mcp-how-to"');
    expect(html).toContain('data-testid="mcp-security"');
    // Терминология Linear-аналога: протокол и securely.
    expect(html).toContain('Model Context Protocol');
    expect(html).toContain('MCP');
  });

  it('раздел «что доступно» повторяет каталог инструментов сервера (без выдумок)', async () => {
    currentCtx = studentCtx;
    const html = await renderPage();

    for (const tool of DEANERY_MCP_TOOLS) {
      expect(html, `инструмент ${tool.name}`).toContain(`data-testid="mcp-tool-${tool.name}"`);
      expect(html).toContain(tool.title);
    }
    // Read-only: записи через MCP нет.
    expect(html).toContain('read-only');
  });

  it('JSON-сниппет: URL эндпоинта, Bearer-заголовок и плейсхолдер вместо токена', async () => {
    const snippet = buildMcpConfigSnippet('https://cabinet.example.edu/api/mcp');
    const parsed: unknown = JSON.parse(snippet);
    expect(parsed).toEqual({
      mcpServers: {
        'digital-deanery': {
          command: 'npx',
          args: [
            '-y',
            'mcp-remote',
            'https://cabinet.example.edu/api/mcp',
            '--header',
            `Authorization: Bearer ${MCP_CONFIG_TOKEN_PLACEHOLDER}`,
          ],
        },
      },
    });

    currentCtx = studentCtx;
    const html = await renderPage();
    expect(html).toContain('data-testid="mcp-config-snippet"');
    expect(html).toContain(MCP_ENDPOINT_PATH);
    // В SSR-разметке `<` экранируется React'ом (&lt;ВАШ_ТОКЕН&gt;).
    expect(html).toContain('&lt;ВАШ_ТОКЕН&gt;');
    // Никаких реальных ключей: полный токен (demo-mcp-< entropy >) не попадает
    // в разметку; допустимо только маскированное превью с многоточием.
    expect(html).not.toMatch(/demo-mcp-[A-Za-z0-9_-]{16,}/);
  });

  it('кнопка «Скопировать конфиг» и примеры вопросов ассистенту', async () => {
    currentCtx = studentCtx;
    const html = await renderPage();

    expect(html).toContain('data-testid="mcp-copy-config"');
    expect(html).toContain('Скопировать конфиг');
    expect(html).toContain('data-testid="mcp-examples"');
    for (const question of MCP_EXAMPLE_QUESTIONS) {
      expect(html, `вопрос «${question}»`).toContain(question);
    }
  });

  it('токен владельца скрыт за кнопкой «Показать токен», plaintext недоступен', async () => {
    currentCtx = studentCtx;
    tokenViewSpy.mockClear();
    const html = await renderPage();

    expect(tokenViewSpy).toHaveBeenCalledTimes(1);
    // Кнопка раскрытия и ссылка на выпуск/перевыпуск токена.
    expect(html).toContain('data-testid="mcp-token-reveal"');
    expect(html).toContain('Показать токен');
    expect(html).toContain('href="/settings?tab=mcp"');
    expect(html).toContain('data-testid="mcp-settings-link"');
    // Даже маска не попадает в статичную разметку (кнопка раскрывает её на
    // клиенте), а полного токена нет нигде.
    expect(html).not.toContain(tokenView.tokenPreview);
    expect(html).not.toMatch(/demo-mcp-[A-Za-z0-9_-]{16,}/);
  });

  it('страница доступна сотруднику: без персонального токена и без чтения токена', async () => {
    currentCtx = staffCtx;
    tokenViewSpy.mockClear();
    const html = await renderPage();

    // Документация рендерится и сотруднику.
    expect(html).toContain('data-testid="mcp-page"');
    expect(html).toContain('data-testid="mcp-config-snippet"');
    // Персонального токена у сотрудника нет: вью не читается (нет лишнего
    // аудита ROLE_MISMATCH), блоков токена в разметке нет.
    expect(tokenViewSpy).not.toHaveBeenCalled();
    expect(html).not.toContain('data-testid="mcp-token-preview"');
  });
});

describe('пункт меню «Подключить ассистента (MCP)»', () => {
  it('есть в «Ещё» рядом с AI-ассистентом и подсвечивает вкладку «Ещё»', () => {
    expect(MORE_SECTIONS).toContainEqual({ href: '/mcp', label: 'Подключить ассистента (MCP)' });
    const mcpIndex = MORE_SECTIONS.findIndex((s) => s.href === '/mcp');
    const aiIndex = MORE_SECTIONS.findIndex((s) => s.href === '/ai-assistant');
    expect(Math.abs(mcpIndex - aiIndex)).toBe(1);
    // Не претендует на таб-бар.
    expect(TAB_SECTIONS.some((s) => s.href === '/mcp')).toBe(false);
    expect(resolveActiveTab('/mcp')).toBe('/more');
    expect(resolveActiveTab('/mcp/extra')).toBe('/more');
  });

  it('иконка /mcp — Plug (не fallback-«Домой», не Sparkles AI-ассистента)', () => {
    expect(sectionIcon('/mcp').displayName).toBe('Plug');
    expect(sectionIcon('/mcp')).not.toBe(sectionIcon('/ai-assistant'));
  });
});

describe('i18n: menu.mcp и title.mcp в обоих словарях', () => {
  it('RU-значения байт-в-байт совпадают с подписями навигации', () => {
    expect(ru['menu.mcp']).toBe('Подключить ассистента (MCP)');
    expect(ru['title.mcp']).toBe('Подключение ассистента (MCP)');
    expect(en['menu.mcp']).toBe('Connect your assistant (MCP)');
    expect(en['title.mcp']).toBe('Connect your assistant (MCP)');
    // Паритет наборов ключей закреплён общим i18n-тестом; здесь — значения.
    expect(Object.keys(en).sort()).toEqual(Object.keys(ru).sort());
  });

  it('sectionTitle и navLabel резолвят /mcp по локали', () => {
    expect(sectionTitle('ru', '/mcp')).toBe(ru['title.mcp']);
    expect(sectionTitle('en', '/mcp')).toBe(en['title.mcp']);
    expect(navLabel('en', '/mcp', 'fallback')).toBe('Connect your assistant (MCP)');
    expect(t('en', 'menu.mcp')).toBe('Connect your assistant (MCP)');
  });
});

describe('справка: раздел /guide и FAQ-статья про MCP', () => {
  it('в /guide есть раздел «Подключить внешнего AI-ассистента (MCP)»', () => {
    const section = GUIDE_SECTIONS.find((s) => s.id === 'mcp');
    expect(section).toBeDefined();
    expect(section?.title).toBe('Подключить внешнего AI-ассистента (MCP)');
    expect(section?.href).toBe('/mcp');
    expect(section?.steps.length).toBeGreaterThanOrEqual(3);
    // Раздел находится поиском справки (чистый фильтр).
    expect(filterHelpSections('mcp').map((s) => s.id)).toContain('mcp');
    expect(filterHelpSections('ассистента').map((s) => s.id)).toContain('mcp');
  });

  it('в /help есть FAQ-статья про MCP с CTA на /mcp', () => {
    const article = getFaqArticle('it-mcp-assistant');
    expect(article).not.toBeNull();
    expect(article?.category).toBe('IT');
    expect(article?.question).toContain('MCP');
    expect(article?.cta).toEqual({ label: 'Открыть инструкцию MCP', href: '/mcp' });
    // Связанные статьи существуют (общий инвариант каталога).
    expect(FAQ_ARTICLES.some((a) => a.id === 'it-mcp-assistant')).toBe(true);
  });
});
