// DIG-19 — render contract of the /profile screen (unit, SSR).
// The page is an async server component; we prerender it with mocked session
// and data modules (same approach as tests/cabinet-shell.test.ts) and pin
// the visible contract: masked student badge, one «Нашли ошибку» entry point,
// the contacts form. The /settings screen contract moved to
// tests/settings-page.test.tsx (DIG-44 rebuilt it as a tabbed screen).
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

const annaProfile = {
  id: 'st-anna',
  login: 'anna',
  fullName: 'Анна Ковалёва',
  email: 'anna.k@example.edu',
  groupName: 'ПИ-21',
  course: 2,
  faculty: 'ИТ',
  program: 'Прикладная информатика',
  programCode: '09.03.04',
  studyForm: 'очная',
  funding: 'бюджет',
  gradebookNumber: '20231234',
};

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
  theme: 'LIGHT' as const,
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
    ip: null,
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
  getOwnProfile: vi.fn(async () => annaProfile),
  getOwnSettings: vi.fn(async () => annaSettings),
}));

vi.mock('@/server/data/db', () => ({ dataDb: {} }));

// Фиксируем учебный период, чтобы тест не зависел от календаря.
vi.mock('@/lib/profile-format', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/profile-format')>()),
  currentAcademicPeriod: () => ({ year: '2026/2027', term: 'осенний семестр' }),
}));

import ProfilePage from '@/app/(cabinet)/profile/page';

async function renderPage(Page: ComponentType): Promise<string> {
  const { prelude } = await prerenderToNodeStream(createElement(Page));
  let html = '';
  for await (const chunk of prelude) {
    html += String(chunk);
  }
  return html;
}

describe('/profile (DIG-19)', () => {
  it('renders the student card: name, program code, group, study form, academic year', async () => {
    const html = await renderPage(ProfilePage);
    for (const text of [
      'Анна Ковалёва',
      '09.03.04',
      'Прикладная информатика',
      'ПИ-21',
      'очная',
      'бюджет',
      '2026/2027',
      'осенний семестр',
      'ИТ',
    ]) {
      expect(html, `profile must show ${text}`).toContain(text);
    }
    expect(html).toContain('<section');
    expect(html).not.toContain('<main');
  });

  it('masks the student badge and hides the raw number until «Показать»', async () => {
    const html = await renderPage(ProfilePage);
    expect(html).toContain('••••34');
    expect(html).not.toContain('20231234');
    expect(html).toContain('Показать');
  });

  it('contacts are editable with visibility switches prefilled from the server', async () => {
    const html = await renderPage(ProfilePage);
    expect(html).toContain('anna.k@example.edu');
    expect(html).toContain('+7 900 010-20-30');
    expect(html).toContain('преподавателям');
  });

  it('has exactly one «Нашли ошибку в данных?» entry point', async () => {
    const html = await renderPage(ProfilePage);
    expect(html.match(/Нашли ошибку в данных\?/g)?.length).toBe(1);
  });
});
