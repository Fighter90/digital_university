// DIG-14 — каркас кабинета: верхняя панель, боковое меню, мобильная навигация.
// Пиним контракты приёмки: состав меню и таб-бара, подсветка активного раздела
// (единая логика для меню и таб-бара) и поведение страниц (композишн внутри
// main-региона Shell).
import { describe, expect, it, vi } from 'vitest';
import { createElement, type ComponentType } from 'react';
import { prerenderToNodeStream } from 'react-dom/static';

// Страницы кабинета защищены requireUser() → cookies() (Next request scope).
// В юнит-тесте рендера скоупа нет — мокаем сессию студентом: цель теста —
// структура landmark'ов, а не авторизация (её покрывают auth-* и e2e).
// DIG-19: профиль/настройки читают getOwnProfile/getOwnSettings и список
// сессий — даём минимальные фикстуры, чтобы все страницы отрисовались.
vi.mock('@/server/auth/session', () => ({
  requireUser: vi.fn(async () => ({ id: 'u_test', login: 'student1', role: 'STUDENT' as const })),
  requireStaff: vi.fn(async () => ({ id: 'u_test', login: 'staff1', role: 'STAFF' as const })),
  getAuthSession: vi.fn(async () => null),
  listActiveUserSessions: vi.fn(async () => []),
}));
vi.mock('@/server/data', () => ({
  requireDataCtx: vi.fn(async () => ({
    userId: 'u_test',
    studentId: 's_test',
    role: 'STUDENT' as const,
    login: 'student1',
  })),
  getOwnProfile: vi.fn(async () => ({
    id: 's_test',
    login: 'student1',
    fullName: 'Анна Ковалёва',
    email: 'anna@example.edu',
    groupName: 'ПИ-21',
    course: 2,
    faculty: 'ИТ',
    program: 'Прикладная информатика',
    programCode: '09.03.04',
    studyForm: 'очная',
    funding: 'бюджет',
    gradebookNumber: '20231234',
  })),
  getOwnSettings: vi.fn(async () => ({
    studentId: 's_test',
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
    updatedAt: new Date('2026-11-11T10:00:00Z'),
  })),
  listRequests: vi.fn(async () => [
    {
      // id обязателен: RequestsPage строит <li key={request.id}> — без него
      // React роняет предупреждение «Each child in a list should have a
      // unique "key" prop» в рендер-тестах каркаса (замечание ревью DIG-19).
      id: 'req-1',
      number: 'ЗД-2026-000001',
      type: 'SPRAVKA' as const,
      status: 'NEW' as const,
      title: 'Справка об обучении',
      createdAt: new Date('2026-11-01T10:00:00Z'),
      updatedAt: new Date('2026-11-01T10:00:00Z'),
    },
  ]),
  // DIG-20: главная кабинета читает агрегат getDashboard и новости деканата.
  getDashboard: vi.fn(async () => ({
    firstName: 'Анна',
    greeting: 'Добрый день',
    headingDate: 'среда, 11 ноября',
    summary: 'Сегодня 2 пары.',
    today: { ok: true, value: { lessons: [], movedCount: 0, cancelledCount: 0, nearestStudyDay: null } },
    deadlines: { ok: true, value: [] },
    progress: {
      ok: true,
      value: {
        average: 88.7,
        averageDelta: null,
        credits: 120,
        creditsTotal: 240,
        debts: [],
        disciplines: [],
      },
    },
    requests: { ok: true, value: { inWork: 1, total: 1 } },
  })),
  listDeaneryNews: vi.fn(() => []),
}));
import { Readable } from 'node:stream';
import {
  CABINET_SECTIONS,
  MORE_SECTIONS,
  TAB_SECTIONS,
  resolveActiveSection,
  resolveActiveTab,
} from '@/components/shell/nav-items';
import DashboardPage from '@/app/(cabinet)/dashboard/page';
import SchedulePage from '@/app/(cabinet)/schedule/page';
import GradesPage from '@/app/(cabinet)/grades/page';
import RequestsPage from '@/app/(cabinet)/requests/page';
import NotificationsPage from '@/app/(cabinet)/notifications/page';
import DeaneryPage from '@/app/(cabinet)/deanery/page';
import AiAssistantPage from '@/app/(cabinet)/ai-assistant/page';
import ProfilePage from '@/app/(cabinet)/profile/page';
import SettingsPage from '@/app/(cabinet)/settings/page';
import MorePage from '@/app/(cabinet)/more/page';

describe('nav config (cabinet shell)', () => {
  it('exposes the 8 mandated cabinet sections with unique hrefs', () => {
    const expected = [
      ['/dashboard', 'Главная'],
      ['/schedule', 'Расписание'],
      ['/grades', 'Успеваемость'],
      ['/requests', 'Заявки и справки'],
      ['/notifications', 'Уведомления'],
      ['/deanery', 'Связь с деканатом'],
      ['/ai-assistant', 'AI-ассистент'],
      ['/profile', 'Профиль'],
    ] as const;
    for (const [href, label] of expected) {
      const section = CABINET_SECTIONS.find((s) => s.href === href);
      expect(section, `section ${href} missing`).toBeTruthy();
      expect(section?.label, `label of ${href}`).toBe(label);
    }
    const hrefs = CABINET_SECTIONS.map((s) => s.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it('mobile tab bar is exactly: Главная, Расписание, Оценки, Заявки, Ещё', () => {
    expect(TAB_SECTIONS.map((t) => t.label)).toEqual([
      'Главная',
      'Расписание',
      'Оценки',
      'Заявки',
      'Ещё',
    ]);
  });

  it('«Ещё» covers Уведомления, Связь с деканатом, AI-ассистент, Профиль, Настройки', () => {
    expect(MORE_SECTIONS.map((s) => s.href)).toEqual([
      '/notifications',
      '/deanery',
      '/ai-assistant',
      '/profile',
      '/settings',
    ]);
  });
});

describe('resolveActiveSection (shared active-state logic)', () => {
  it('matches exact href and nested paths', () => {
    expect(resolveActiveSection('/dashboard', CABINET_SECTIONS)).toBe('/dashboard');
    expect(resolveActiveSection('/schedule/week', CABINET_SECTIONS)).toBe('/schedule');
    expect(resolveActiveSection('/requests/42', CABINET_SECTIONS)).toBe('/requests');
    expect(resolveActiveSection('/notifications', CABINET_SECTIONS)).toBe('/notifications');
  });

  it('does not false-positive on prefixes of other routes', () => {
    expect(resolveActiveSection('/schedule-extra', CABINET_SECTIONS)).toBeNull();
    expect(resolveActiveSection('/grades-mock', CABINET_SECTIONS)).toBeNull();
    expect(resolveActiveSection('/totally/unknown', CABINET_SECTIONS)).toBeNull();
  });
});

describe('resolveActiveTab (menu and tab bar stay in sync)', () => {
  it('highlights primary tabs for their own routes', () => {
    expect(resolveActiveTab('/dashboard')).toBe('/dashboard');
    expect(resolveActiveTab('/schedule')).toBe('/schedule');
    expect(resolveActiveTab('/grades')).toBe('/grades');
    expect(resolveActiveTab('/requests')).toBe('/requests');
    expect(resolveActiveTab('/grades/semester/3')).toBe('/grades');
  });

  it('routes the extra sections through the «Ещё» tab', () => {
    for (const href of MORE_SECTIONS.map((s) => s.href)) {
      expect(resolveActiveTab(href), `${href} must highlight «Ещё»`).toBe('/more');
    }
    expect(resolveActiveTab('/more')).toBe('/more');
    expect(resolveActiveTab('/unknown')).toBeNull();
  });
});

// Поведенческий рендер всех страниц (cabinet): единственный main-регион
// принадлежит Shell (#main-content), страницы не должны заводить свой <main>,
// иначе получится невалидный вложенный landmark (ревью DIG-14, раунд 1).
describe('cabinet pages render inside the shell main region', () => {
  const PAGES: Array<[string, ComponentType]> = [
    ['/dashboard', DashboardPage],
    ['/schedule', SchedulePage],
    ['/grades', GradesPage],
    ['/requests', RequestsPage],
    ['/notifications', NotificationsPage],
    ['/deanery', DeaneryPage],
    ['/ai-assistant', AiAssistantPage],
    ['/profile', ProfilePage],
    ['/settings', SettingsPage],
    ['/more', MorePage],
  ];

  // Страницы кабинета — асинхронные серверные компоненты (RSC): синхронный
  // renderToStaticMarkup на них падает («component suspended»), рендерим
  // через prerender (React 19) и собираем прелюдию в строку.
  async function renderPage(Page: ComponentType): Promise<string> {
    const { prelude } = await prerenderToNodeStream(createElement(Page));
    let html = '';
    for await (const chunk of prelude) {
      html += String(chunk);
    }
    return html;
  }

  it('no cabinet page renders its own <main> landmark', async () => {
    for (const [href, Page] of PAGES) {
      const html = await renderPage(Page);
      expect(html, `${href} must not nest <main> inside the shell main region`).not.toContain(
        '<main',
      );
    }
  });

  it('dashboard keeps its content on a section wrapper (DIG-20 «Ваша неделя»)', async () => {
    const html = await renderPage(DashboardPage);
    expect(html).toContain('<section');
    expect(html).toContain('Ваша неделя');
  });
});
