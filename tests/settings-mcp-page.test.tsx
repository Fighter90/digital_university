// DIG-58 — SSR-контракт вкладки «Настройка MCP» экрана /settings.
// Рендерим страницу как server component с замоканной сессией/данными
// (тот же приём, что tests/settings-page.test.tsx) и закрепляем видимое
// поведение: пятая вкладка в навигации, список демо-серверов со статусами,
// кнопки «Подключить», карточки-примеры и разделы справки.
// DIG-64 добавляет карточку «MCP-сервер деканата»: URL /api/mcp, состояние
// персонального токена и инструкции ChatGPT/Claude.
import { describe, expect, it, vi } from 'vitest';
import { createElement, type ComponentType } from 'react';
import { prerenderToNodeStream } from 'react-dom/static';
import { DEFAULT_MCP_CONNECTIONS } from '@/lib/mcp-servers';

const studentCtx = {
  userId: 'auth-anna',
  login: 'anna',
  role: 'STUDENT' as const,
  studentId: 'st-anna',
  groupName: 'ПИ-21',
  faculty: 'ИТ',
};

const annaSettings = {
  studentId: 'st-anna',
  phone: null,
  emailVisibleToStaff: true,
  phoneVisibleToStaff: true,
  notificationChannels: {
    SCHEDULE: { PUSH: true, EMAIL: true, TELEGRAM: false },
    GRADE: { PUSH: true, EMAIL: true, TELEGRAM: false },
    REQUEST: { PUSH: true, EMAIL: true, TELEGRAM: false },
    NEWS: { PUSH: true, EMAIL: true, TELEGRAM: false },
    DEADLINE: { PUSH: true, EMAIL: true, TELEGRAM: false },
    SYSTEM: { PUSH: true, EMAIL: true, TELEGRAM: false },
  },
  theme: 'SYSTEM' as const,
  widgets: [
    { id: 'today', enabled: true },
    { id: 'deadlines', enabled: true },
    { id: 'performance', enabled: true },
    { id: 'requests', enabled: true },
    { id: 'news', enabled: true },
    { id: 'events', enabled: true },
  ],
  quietHours: { enabled: false, from: '22:00', to: '08:00' },
  language: 'RU' as const,
  fontSize: 'NORMAL' as const,
  reduceMotion: false,
  mcpConnections: DEFAULT_MCP_CONNECTIONS.map((s) =>
    s.id === 'producthunt' ? { ...s, connected: true } : s,
  ),
  mcpToken: null,
  updatedAt: new Date('2026-11-14T10:00:00.000Z'),
};

vi.mock('next/headers', () => ({
  headers: vi.fn(
    async () => new Headers({ host: 'cabinet.example.edu', 'x-forwarded-proto': 'https' }),
  ),
  cookies: vi.fn(async () => new Map()),
}));

vi.mock('@/server/auth/session', () => ({
  getAuthSession: vi.fn(async () => null),
  requireUser: vi.fn(async () => ({ id: 'auth-anna', login: 'anna', role: 'STUDENT' as const })),
  requireStaff: vi.fn(async () => ({ id: 'x', login: 'x', role: 'STAFF' as const })),
  listActiveUserSessions: vi.fn(async () => []),
}));

vi.mock('@/server/data', () => ({
  requireDataCtx: vi.fn(async () => studentCtx),
  getOwnProfile: vi.fn(async () => null),
  getOwnSettings: vi.fn(async () => annaSettings),
}));

vi.mock('@/server/data/mcp', () => ({
  getOwnMcpTokenView: vi.fn(async () => ({
    tokenPreview: 'demo-mcp…ab12',
    createdAt: new Date('2026-11-14T10:00:00.000Z'),
  })),
}));

vi.mock('@/server/data/db', () => ({ dataDb: {} }));

import SettingsPage from '@/app/(cabinet)/settings/page';

type PageProps = { searchParams?: Promise<Record<string, string | undefined>> };

async function renderPage(tab?: string): Promise<string> {
  const { prelude } = await prerenderToNodeStream(
    createElement(SettingsPage as unknown as ComponentType<PageProps>, {
      searchParams: Promise.resolve({ tab }),
    }),
  );
  let html = '';
  for await (const chunk of prelude) {
    html += String(chunk);
  }
  return html;
}

describe('/settings — пункт «Настройка MCP» (DIG-58)', () => {
  it('в навигации настроек есть вкладка «Настройка MCP»', async () => {
    const html = await renderPage(undefined);
    expect(html).toContain('Настройка MCP');
    expect(html).toContain('tab=mcp');
  });

  it('?tab=mcp открывает список серверов со статусами и кнопками', async () => {
    const html = await renderPage('mcp');
    // Список демо-серверов.
    for (const label of ['Product Hunt', 'Календарь', 'Деканат-API']) {
      expect(html, `server ${label} missing`).toContain(label);
    }
    // Статусы: подключён (Product Hunt из настроек) и не подключён (остальные).
    expect(html).toContain('Подключён');
    expect(html).toContain('Не подключён');
    // Кнопки подключения/отключения.
    expect(html).toContain('Подключить');
    expect(html).toContain('Отключить');
    // Строка Product Hunt помечена подключённой (data-атрибут для e2e).
    expect(html).toMatch(/data-server-id="producthunt"[^>]*data-connected="true"/);
  });

  it('карточки-примеры объясняют, что даёт каждый сервер', async () => {
    const html = await renderPage('mcp');
    expect(html).toContain('Что даёт каждый сервер');
    expect(html).toContain('тренд');
    expect(html).toContain('Дедлайны');
    expect(html).toContain('заявок');
  });

  it('расширенная справка: MCP, токены, установка, частые ошибки', async () => {
    const html = await renderPage('mcp');
    for (const heading of [
      'Как работает MCP',
      'Безопасность токенов',
      'Пошаговая установка',
      'Частые ошибки',
    ]) {
      expect(html, `help section ${heading} missing`).toContain(heading);
    }
  });

  it('экран честно помечен как демо (реальных ключей нет)', async () => {
    const html = await renderPage('mcp');
    expect(html).toContain('демонстрационные');
    expect(html).toContain('не даёт доступа к реальным сервисам');
  });
});

describe('/settings?tab=mcp — карточка «MCP-сервер деканата» (DIG-64)', () => {
  it('карточка показывает URL сервера /api/mcp из заголовков запроса', async () => {
    const html = await renderPage('mcp');
    expect(html).toContain('MCP-сервер деканата');
    expect(html).toMatch(/data-testid="mcp-server-url"[^<]*<\/code>|mcp-server-url/);
    expect(html).toContain('https://cabinet.example.edu/api/mcp');
    expect(html).not.toContain('http://cabinet.example.edu');
  });

  it('состояние токена: превью и «Перевыпустить токен»', async () => {
    const html = await renderPage('mcp');
    expect(html).toContain('demo-mcp…ab12');
    expect(html).toContain('Перевыпустить токен');
    // Полный токен не рендерится никогда — только после выпуска (клиентское состояние).
    expect(html).not.toMatch(/demo-mcp-[A-Za-z0-9_-]{20,}/);
  });

  it('инструкции подключения к ChatGPT и Claude', async () => {
    const html = await renderPage('mcp');
    expect(html).toContain('Подключение к ChatGPT');
    expect(html).toContain('Подключение к Claude');
    expect(html).toMatch(/mcp-config-claude/);
    expect(html).toContain('mcp-remote');
    expect(html).toContain('Authorization: Bearer');
  });

  it('карточка честно помечена демо-статусом', async () => {
    const html = await renderPage('mcp');
    expect(html).toContain('вымышленный демо-набор');
  });
});
