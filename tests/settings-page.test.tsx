// DIG-44 — render contract of the tabbed /settings screen (unit, SSR).
// The page is an async server component; we prerender it with mocked session
// and data modules (same approach as tests/profile-settings-page.test.tsx)
// and pin the visible contract of each tab: widgets (order/toggles/keyboard
// buttons/preview), notification matrix + quiet hours, security (password
// change + sessions with «Завершить»), appearance (dark theme enabled,
// language stub, font size, reduce motion).
import { describe, expect, it, vi } from 'vitest';
import { createElement, type ComponentType } from 'react';
import { prerenderToNodeStream } from 'react-dom/static';

import { DEFAULT_WIDGET_ORDER, normalizeWidgets } from '@/lib/dashboard-widgets';

const studentCtx = {
  userId: 'auth-anna',
  login: 'anna',
  role: 'STUDENT' as const,
  studentId: 'st-anna',
  groupName: 'ПИ-21',
  faculty: 'ИТ',
};

const staffCtx = { ...studentCtx, role: 'STAFF' as const, studentId: null, groupName: null };

const annaSettings = {
  studentId: 'st-anna',
  phone: '+7 900 010-20-30',
  emailVisibleToStaff: true,
  phoneVisibleToStaff: false,
  notificationChannels: {
    SCHEDULE: { PUSH: true, EMAIL: true, TELEGRAM: false },
    GRADE: { PUSH: true, EMAIL: true, TELEGRAM: false },
    REQUEST: { PUSH: true, EMAIL: true, TELEGRAM: false },
    NEWS: { PUSH: true, EMAIL: true, TELEGRAM: false },
    DEADLINE: { PUSH: false, EMAIL: true, TELEGRAM: false },
    SYSTEM: { PUSH: true, EMAIL: true, TELEGRAM: false },
  },
  theme: 'SYSTEM' as const,
  widgets: normalizeWidgets([{ id: 'deadlines', enabled: true }]),
  quietHours: { enabled: true, from: '22:00', to: '08:00' },
  language: 'RU' as const,
  fontSize: 'NORMAL' as const,
  reduceMotion: false,
  updatedAt: new Date('2026-11-11T10:00:00.000Z'),
};

const liveSessions = [
  {
    id: 'sess-current',
    userId: 'auth-anna',
    tokenHash: 'hash-current',
    expiresAt: new Date('2026-11-18T10:00:00.000Z'),
    ip: null,
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    createdAt: new Date('2026-11-11T09:05:00.000Z'),
  },
  {
    id: 'sess-other',
    userId: 'auth-anna',
    tokenHash: 'hash-other',
    expiresAt: new Date('2026-11-17T10:00:00.000Z'),
    ip: '192.0.2.7',
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    createdAt: new Date('2026-11-10T21:30:00.000Z'),
  },
];

vi.mock('@/server/auth/session', () => ({
  getAuthSession: vi.fn(async () => ({
    user: { id: 'auth-anna', login: 'anna', role: 'STUDENT' as const },
    session: { ...liveSessions[0] },
  })),
  requireUser: vi.fn(async () => ({ id: 'auth-anna', login: 'anna', role: 'STUDENT' as const })),
  requireStaff: vi.fn(async () => ({ id: 'x', login: 'x', role: 'STAFF' as const })),
  listActiveUserSessions: vi.fn(async () => liveSessions),
}));

vi.mock('@/server/data', () => ({
  requireDataCtx: vi.fn(async () => studentCtx),
  getOwnProfile: vi.fn(async () => null),
  getOwnSettings: vi.fn(async () => annaSettings),
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

describe('/settings — tabs (DIG-44)', () => {
  it('shows the four tabs and defaults to «Главная»', async () => {
    const html = await renderPage(undefined);
    for (const label of ['Главная', 'Уведомления', 'Безопасность', 'Вид']) {
      expect(html, `tab ${label} missing`).toContain(label);
    }
    // Widget management visible on the default tab.
    expect(html).toContain('Виджеты главной');
    expect(html).toContain('aria-current="page"');
  });

  it('unknown tab falls back to «Главная»', async () => {
    const html = await renderPage('hack');
    expect(html).toContain('Виджеты главной');
  });
});

describe('/settings?tab=home — widget management', () => {
  it('renders all six widgets with keyboard move buttons and a preview', async () => {
    const html = await renderPage('home');
    for (const label of [
      'Сегодня',
      'Дедлайны',
      'Успеваемость',
      'Заявки',
      'Новости',
      'Мероприятия',
    ]) {
      expect(html, `widget ${label} missing`).toContain(label);
    }
    // Keyboard-first reordering: explicit up/down buttons per row.
    expect(html).toContain('Поднять');
    expect(html).toContain('Опустить');
    // Toggles for enable/disable.
    expect(html).toMatch(/role="switch"/);
    // Preview of the resulting order.
    expect(html).toContain('Предпросмотр');
    // Saved custom order (deadlines first) is reflected server-side.
    expect(html.indexOf('Дедлайны')).toBeLessThan(html.indexOf('>Сегодня<'));
  });
});

describe('/settings?tab=notifications — matrix + quiet hours', () => {
  it('renders the category × channel matrix and the quiet-hours block', async () => {
    const html = await renderPage('notifications');
    for (const type of ['Расписание', 'Дедлайны', 'Заявки', 'Оценки', 'Объявления']) {
      expect(html, `type ${type} missing`).toContain(type);
    }
    expect(html).toContain('В кабинете');
    expect(html).toContain('Telegram');
    expect(html).toContain('Тихие часы');
    // Quiet hours window comes from the server state.
    expect(html).toContain('22:00');
    expect(html).toContain('08:00');
    // Telegram switches stay disabled («скоро»).
    const telegramToggles = html.match(/— Telegram/g)?.length ?? 0;
    expect(telegramToggles).toBe(5);
  });
});

describe('/settings?tab=security — password + sessions', () => {
  it('renders the password change form', async () => {
    const html = await renderPage('security');
    expect(html).toContain('Смена пароля');
    expect(html).toContain('Текущий пароль');
    expect(html).toContain('Новый пароль');
    expect(html).toContain('Повторите новый пароль');
    expect(html).toContain('Изменить пароль');
  });

  it('lists sessions with device, city placeholder, time and «Завершить» for others', async () => {
    const html = await renderPage('security');
    expect(html).toContain('Активные сеансы');
    expect(html).toContain('Windows · Chrome');
    expect(html).toContain('iPhone · Safari');
    expect(html).toContain('Это устройство');
    expect(html).toContain('Город');
    // «Завершить» only for OTHER sessions.
    expect(html).toContain('Завершить');
    expect(html.match(/Завершить</g)?.length).toBe(1);
    // Global sign-out keeps its explicit label.
    expect(html).toContain('Выйти на всех устройствах');
    expect(html).toContain('Выйти на этом устройстве');
  });
});

describe('/settings?tab=appearance — theme, language, font, motion', () => {
  it('offers light/system/dark with DARK ENABLED now', async () => {
    const html = await renderPage('appearance');
    for (const label of ['Светлая', 'Системная', 'Тёмная']) {
      expect(html, `theme ${label} missing`).toContain(label);
    }
    // DIG-44: кнопка «Тёмная» больше не disabled (в DIG-19 была «скоро»).
    const buttons = html.match(/<button\b[^>]*>[^]*?<\/button>/g) ?? [];
    const darkButton = buttons.find((b) => b.includes('Тёмная'));
    expect(darkButton, 'кнопка «Тёмная» не найдена').toBeTruthy();
    expect(darkButton).not.toContain('disabled');
    // English по-прежнему заглушка (disabled).
    const englishButton = buttons.find((b) => b.includes('English'));
    expect(englishButton).toBeTruthy();
    expect(englishButton).toContain('disabled');
  });

  it('shows the language choice with EN as a disabled stub', async () => {
    const html = await renderPage('appearance');
    expect(html).toContain('Язык');
    expect(html).toContain('Русский');
    expect(html).toContain('English');
    expect(html).toContain('скоро');
  });

  it('shows the font-size choice and the reduce-motion toggle', async () => {
    const html = await renderPage('appearance');
    expect(html).toContain('Размер шрифта');
    expect(html).toContain('Обычный');
    expect(html).toContain('Крупный');
    expect(html).toContain('Очень крупный');
    expect(html).toContain('Уменьшить анимацию');
  });
});

describe('/settings — access guard', () => {
  it('staff ctx gets the empty state (no student settings surface)', async () => {
    vi.mocked(
      (await import('@/server/data')).requireDataCtx as ReturnType<typeof vi.fn>,
    ).mockResolvedValueOnce(staffCtx);
    const html = await renderPage(undefined);
    expect(html).toContain('Раздел доступен студентам');
  });
});
