// DIG-20 — render contract of the dashboard screen (unit, SSR).
// The page is an async server component streamed behind a Suspense skeleton;
// we prerender it with mocked session/data modules (same approach as
// tests/profile-settings-page.test.tsx) and pin the visible contract:
// dark week hero with tiles, today timeline with transfer/cancel/online,
// deadlines, progress panel, quick actions, deanery news — and per-block
// error states when a section of the aggregate fails.
import { describe, expect, it, vi } from 'vitest';
import { createElement, type ComponentType } from 'react';
import { prerenderToNodeStream } from 'react-dom/static';

import type {
  DashboardData,
  DashboardSection,
} from '@/server/data/dashboard';

const studentCtx = {
  userId: 'auth-anna',
  login: 'anna.smirnova',
  role: 'STUDENT' as const,
  studentId: 'st-anna',
  groupName: 'ПИ-21',
  faculty: 'ИТ',
};

const ok = <T,>(value: T): DashboardSection<T> => ({ ok: true, value });
const fail = (error: string): DashboardSection<never> => ({ ok: false, error });

const fullDashboard: DashboardData = {
  firstName: 'Анна',
  greeting: 'Добрый день',
  headingDate: 'среда, 11 ноября',
  summary: 'Сегодня 4 пары, одна перенесена, одна отменена. До пересдачи 7 дней.',
  today: ok({
    lessons: [
      {
        id: 'sch-1',
        startsAt: new Date(2026, 10, 11, 10, 0),
        endsAt: new Date(2026, 10, 11, 11, 30),
        kind: 'LECTURE',
        kindLabel: 'Лекция',
        disciplineName: 'Информатика',
        room: '301',
        teacherName: 'Петров Пётр Петрович',
        isRescheduled: false,
        isCancelled: false,
        isOnline: false,
        transferNote: null,
        note: null,
      },
      {
        id: 'sch-2',
        startsAt: new Date(2026, 10, 11, 12, 0),
        endsAt: new Date(2026, 10, 11, 13, 30),
        kind: 'LAB',
        kindLabel: 'Лабораторная',
        disciplineName: 'Программирование',
        room: '305',
        teacherName: 'Иванова Ирина Игоревна',
        isRescheduled: true,
        isCancelled: false,
        isOnline: false,
        transferNote: 'Перенос: ауд. 214 → 305',
        note: null,
      },
      {
        id: 'sch-3',
        startsAt: new Date(2026, 10, 11, 14, 0),
        endsAt: new Date(2026, 10, 11, 15, 30),
        kind: 'LAB',
        kindLabel: 'Лабораторная',
        disciplineName: 'Физика',
        room: '212',
        teacherName: 'Соколов Сергей Сергеевич',
        isRescheduled: false,
        isCancelled: true,
        isOnline: false,
        transferNote: null,
        note: 'Лаборатория закрыта',
      },
      {
        id: 'sch-4',
        startsAt: new Date(2026, 10, 11, 15, 40),
        endsAt: new Date(2026, 10, 11, 17, 10),
        kind: 'SEMINAR',
        kindLabel: 'Семинар',
        disciplineName: 'История',
        room: 'Онлайн',
        teacherName: 'Орлов Олег Олегович',
        isRescheduled: false,
        isCancelled: false,
        isOnline: true,
        transferNote: null,
        note: null,
      },
    ],
    movedCount: 1,
    cancelledCount: 1,
    nearestStudyDay: null,
  }),
  deadlines: ok([
    {
      id: 'exm-1',
      disciplineName: 'Информатика',
      kindLabel: 'Пересдача',
      date: new Date(2026, 10, 18, 9, 0),
      dayBadge: '18',
      monthBadge: 'нояб.',
      daysLeft: 7,
    },
    {
      id: 'exm-2',
      disciplineName: 'Программирование',
      kindLabel: 'Зачёт',
      date: new Date(2026, 10, 13, 12, 0),
      dayBadge: '13',
      monthBadge: 'нояб.',
      daysLeft: 2,
    },
  ]),
  progress: ok({
    average: 88.7,
    averageDelta: 2.3,
    credits: 120,
    creditsTotal: 240,
    debts: [
      { disciplineName: 'Информатика', dateLabel: '18 ноября', daysLeft: 7 },
    ],
    disciplines: [
      { code: 'PI21-PROG', disciplineName: 'Программирование', average: 92, level: 'good' },
      { code: 'PI21-INFO', disciplineName: 'Информатика', average: 88, level: 'good' },
      { code: 'PI21-DB', disciplineName: 'Базы данных', average: 62, level: 'risk' },
    ],
  }),
  requests: ok({ inWork: 2, total: 3 }),
};

const emptyDashboard: DashboardData = {
  firstName: 'Анна',
  greeting: 'Доброе утро',
  headingDate: 'среда, 11 ноября',
  summary: 'Сегодня пар нет.',
  today: ok({
    lessons: [],
    movedCount: 0,
    cancelledCount: 0,
    nearestStudyDay: { label: 'четверг, 12 ноября', count: 1 },
  }),
  deadlines: ok([]),
  progress: ok({
    average: null,
    averageDelta: null,
    credits: 60,
    creditsTotal: 240,
    debts: [],
    disciplines: [],
  }),
  requests: ok({ inWork: 0, total: 0 }),
};

const brokenDashboard: DashboardData = {
  ...fullDashboard,
  summary: null,
  today: fail('schedule db down'),
  deadlines: fail('exams db down'),
};

const newsFixture = [
  {
    id: 'news-1',
    title: 'Пересдачи: расписание опубликовано',
    excerpt: 'Пересдача по информатике — 18 ноября, ауд. 305. Возьмите зачётку.',
    publishedAt: new Date(2026, 10, 10, 12, 0),
  },
  {
    id: 'news-2',
    title: 'Приём заявлений на летнюю практику',
    excerpt: 'Заявления принимаются до 30 ноября через личный кабинет.',
    publishedAt: new Date(2026, 10, 8, 12, 0),
  },
];

vi.mock('@/server/auth/session', () => ({
  getAuthSession: vi.fn(async () => null),
  requireUser: vi.fn(async () => ({ id: 'auth-anna', login: 'anna.smirnova', role: 'STUDENT' as const })),
  requireStaff: vi.fn(async () => ({ id: 'x', login: 'x', role: 'STAFF' as const })),
}));

vi.mock('@/server/data/db', () => ({ dataDb: {} }));

vi.mock('@/server/data', async () => {
  const { listDeaneryNews } = await import('@/server/data/news');
  return {
    requireDataCtx: vi.fn(async () => studentCtx),
    getDashboard: vi.fn(async () => fullDashboard),
    listDeaneryNews,
  };
});

vi.mock('@/server/data/news', () => ({
  listDeaneryNews: vi.fn(() => newsFixture),
}));

import DashboardPage from '@/app/(cabinet)/dashboard/page';

async function renderPage(Page: ComponentType): Promise<string> {
  const { prelude } = await prerenderToNodeStream(createElement(Page));
  let html = '';
  for await (const chunk of prelude) {
    html += String(chunk);
  }
  return html;
}

describe('/dashboard (DIG-20) — «Ваша неделя»', () => {
  it('hero: greeting by name, deterministic summary, 4 tiles leading to their sections', async () => {
    const html = await renderPage(DashboardPage);
    expect(html).toContain('Ваша неделя · среда, 11 ноября');
    expect(html).toContain('Добрый день, Анна');
    expect(html).toContain('Сегодня 4 пары, одна перенесена, одна отменена. До пересдачи 7 дней.');
    // Плитки и их значения
    expect(html).toContain('Средний балл');
    expect(html).toContain('88,7');
    expect(html).toContain('+2,3');
    expect(html).toContain('Кредиты');
    expect(html).toContain('120');
    expect(html).toContain('из 240');
    expect(html).toContain('Долги');
    expect(html).toContain('Заявки в работе');
    // Ссылки плиток ведут в свои разделы
    expect(html).toContain('href="/grades"');
    expect(html).toContain('href="/profile"');
    expect(html).toContain('href="/requests"');
  });

  it('today: timeline with transfer, cancellation and online link', async () => {
    const html = await renderPage(DashboardPage);
    expect(html).toContain('Сегодня');
    expect(html).toContain('Информатика');
    // Время пары: начало жирным, конец мелкой строкой под ним
    expect(html).toContain('>10:00<');
    expect(html).toContain('>11:30<');
    expect(html).toContain('Перенос: ауд. 214 → 305');
    expect(html).toMatch(/line-through/); // отменённая пара зачёркнута
    expect(html).toContain('Лаборатория закрыта');
    // Онлайн-пара даёт ссылку «Онлайн» в раздел расписания
    expect(html).toMatch(/Онлайн/);
    expect(html).toContain('href="/schedule"');
    expect(html).toContain('Петров Пётр Петрович');
  });

  it('deadlines: date badge, discipline, days left, action button', async () => {
    const html = await renderPage(DashboardPage);
    expect(html).toContain('Ближайшие дедлайны');
    expect(html).toContain('Пересдача');
    expect(html).toContain('Информатика');
    expect(html).toContain('осталось 7 дней');
    expect(html).toMatch(/data-urgent="true"/); // ≤3 дней подсвечивается красным
    expect(html).toContain('href="/schedule"');
  });

  it('progress: ring with average, debt badge, discipline bars', async () => {
    const html = await renderPage(DashboardPage);
    expect(html).toContain('Как у меня дела');
    expect(html).toMatch(/role="progressbar"/);
    expect(html).toContain('1 долг — пересдача 18 ноября');
    expect(html).toContain('Программирование');
    expect(html).toMatch(/data-level="good"/);
    expect(html).toMatch(/data-level="risk"/);
  });

  it('quick actions and deanery news lead to their sections', async () => {
    const html = await renderPage(DashboardPage);
    expect(html).toContain('Быстрые действия');
    expect(html).toContain('Заказать справку');
    expect(html).toContain('Подать заявление');
    expect(html).toContain('Написать в деканат');
    expect(html).toContain('Спросить AI');
    expect(html).toContain('href="/deanery"');
    expect(html).toContain('href="/ai-assistant"');
    expect(html).toContain('Новости деканата');
    expect(html).toContain('Пересдачи: расписание опубликовано');
    expect(html).toContain('href="/notifications"');
  });

  it('page stays a section inside the shell main (no own <main> landmark)', async () => {
    const html = await renderPage(DashboardPage);
    expect(html).toContain('<section');
    expect(html).not.toContain('<main');
  });

  it('empty today: «Нет пар сегодня» illustration and the nearest study day', async () => {
    vi.mocked(
      (await import('@/server/data')).getDashboard as ReturnType<typeof vi.fn>,
    ).mockResolvedValueOnce(emptyDashboard);
    const html = await renderPage(DashboardPage);
    expect(html).toContain('Нет пар сегодня');
    expect(html).toContain('четверг, 12 ноября');
    expect(html).toContain('Дедлайнов нет');
    expect(html).toContain('Долгов нет');
  });

  it('failed block renders its own error state, the rest of the page survives', async () => {
    vi.mocked(
      (await import('@/server/data')).getDashboard as ReturnType<typeof vi.fn>,
    ).mockResolvedValueOnce(brokenDashboard);
    const html = await renderPage(DashboardPage);
    expect(html).toMatch(/role="alert"/);
    expect(html).toContain('Блок «Сегодня» не загрузился');
    expect(html).toContain('Блок «Дедлайны» не загрузился');
    // Блоки без сбоя отрисованы
    expect(html).toContain('Как у меня дела');
    expect(html).toContain('Средний балл');
  });

  it('skeleton fallback is wired: страница оборачивает агрегат в Suspense со скелетоном', () => {
    // Поведенческое покрытие — e2e dashboard.spec (real server, settled waits).
    // Здесь — контракт исходника: page.tsx оборачивает DashboardContent
    // в Suspense с fallback = DashboardSkeleton.
    const { readFileSync } = require('node:fs');
    const { resolve } = require('node:path');
    const source = readFileSync(resolve(import.meta.dirname, '../src/app/(cabinet)/dashboard/page.tsx'), 'utf8');
    expect(source).toContain('<Suspense fallback={<DashboardSkeleton />}>');
    expect(source).toContain('<DashboardContent />');
  });

  it('STAFF-ветка: источник содержит явную заглушку «Кабинет сотрудника»', () => {
    // В юнит-среде нет request scope (cookies) — рендер страницы недоступен;
    // поведение покрывает e2e prod-auth, здесь — контракт исходника.
    const { readFileSync } = require('node:fs');
    const { resolve } = require('node:path');
    const source = readFileSync(resolve(import.meta.dirname, '../src/app/(cabinet)/dashboard/page.tsx'), 'utf8');
    expect(source).toContain('Кабинет сотрудника');
    expect(source).toMatch(/role === 'STAFF'/);
  });
});
