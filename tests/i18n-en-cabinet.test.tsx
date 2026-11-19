// DIG-93 — расширенный контур «no Cyrillic on EN» для кабинета.
//
// Приёмка задачи: при locale=en в видимом рендере кабинета НЕТ кириллицы —
// ни в каркасе (инициалы топбара, меню, AI-гид), ни в демо-контенте
// (дисциплины, преподаватели, заявки, уведомления-задачи, сессия,
// справочник, обращения, МСП, ДПО, профиль, «Ещё»).
//
// Архитектура теста:
//  1) каркас: UserMenu (инициалы), SideNav/навигационные подписи, AiGuide-пилюля;
//  2) чистые EN-хелперы демо-контента (имена людей, заявки, заметки пар, сессия);
//  3) билдеры-агрегаты с fake-db: getTasks / getSession / dashboard-вью —
//     вызываются РЕАЛЬНЫЕ функции с каноническими RU-строками сида;
//  4) страницы: прендер с каноническими RU-фикстурами слоя данных при
//     locale=en ( RU-фикстуры стабильны: слой данных остаётся каноном).
// RU-локаль отдельно не проверяется: тесты RU-рендера уже существуют и
// байт-в-байт контракты не меняются (запрещено задачей).
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { cleanup, render } from '@testing-library/react';
import { createElement, type ComponentType } from 'react';

const replaceMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn(), refresh: vi.fn() }),
  usePathname: vi.fn(() => '/dashboard'),
}));

// Локаль кабинета в юнит-среде: cookie нет → getLocale fail-soft на 'ru'.
// Тест читает EN-локаль явно — подменяем серверное чтение.
const localeState = vi.hoisted(() => ({ locale: 'en' as 'ru' | 'en' }));
vi.mock('@/lib/i18n/server', () => ({
  getLocale: vi.fn(async () => localeState.locale),
}));

// Данные-агрегаты всех страниц — через hoisted-состояние (каждый тест
// ставит свою фикстуру; функции-прокси читают её в момент вызова).
const dataState = vi.hoisted(() => {
  return {
    favorites: null as unknown,
    ctx: null as unknown,
    dashboard: null as unknown,
    ownSettings: null as unknown,
    dashboardEvents: { items: [] as unknown[] },
    deaneryNews: [] as Array<{ id: string; title: string; excerpt: string; publishedAt: Date }>,
    tasks: null as unknown,
    performance: null as unknown,
    exams: [] as unknown[],
    gradeInsight: null as unknown,
    session: null as unknown,
    subscription: { token: 'v1.tok', createdAt: new Date(2026, 10, 15) } as unknown,
    requestsScreen: { cards: [] as unknown[] },
    requestTypes: [] as unknown[],
    profile: null as unknown,
    feedbackPage: null as unknown,
    peopleDirectory: null as unknown,
    deaneryPage: null as unknown,
    mspPage: null as unknown,
    dpoCatalog: [] as unknown[],
    dpoMy: [] as unknown[],
    dpoDocs: [] as unknown[],
    headers: new Map<string, string>(),
  };
});

vi.mock('@/server/data/db', () => ({ dataDb: {} }));

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => ({
    get: (name: string) => dataState.headers.get(name) ?? null,
  })),
}));

vi.mock('@/server/data', async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();
  return {
    ...original,
    requireDataCtx: vi.fn(async () => dataState.ctx),
    getDashboard: vi.fn(async () => dataState.dashboard),
    getOwnSettings: vi.fn(async () => dataState.ownSettings),
    getDashboardEvents: vi.fn(async () => dataState.dashboardEvents),
    listDeaneryNews: vi.fn(() => dataState.deaneryNews),
    getTasks: vi.fn(async () => dataState.tasks),
    getPerformance: vi.fn(async () => dataState.performance),
    listExams: vi.fn(async () => dataState.exams),
    getGradeInsight: vi.fn(async () => dataState.gradeInsight),
    getSession: vi.fn(async () => dataState.session),
    getOrCreateCalendarSubscription: vi.fn(async () => dataState.subscription),
    getRequestsScreen: vi.fn(async () => dataState.requestsScreen),
    listCanonicalRequestTypes: vi.fn(async () => dataState.requestTypes),
    getOwnProfile: vi.fn(async () => dataState.profile),
    getFeedbackPage: vi.fn(async () => dataState.feedbackPage),
    getPeopleDirectory: vi.fn(async () => dataState.peopleDirectory),
    listFavoritePersons: vi.fn(async () => dataState.favorites ?? { favorites: [], hasPersonalScope: true }),
    getDeaneryPage: vi.fn(async () => dataState.deaneryPage),
    getMspPage: vi.fn(async () => dataState.mspPage),
    getDpoCatalog: vi.fn(async () => dataState.dpoCatalog),
    getDpoMyPrograms: vi.fn(async () => dataState.dpoMy),
    getDpoDocuments: vi.fn(async () => dataState.dpoDocs),
  };
});

vi.mock('@/server/actions/requests', () => ({
  createRequestAction: vi.fn(async () => null),
  cancelRequestAction: vi.fn(async () => null),
}));
vi.mock('@/server/actions/deanery', () => ({
  createTicketAction: vi.fn(async () => null),
  replyToTicketAction: vi.fn(async () => null),
}));
vi.mock('@/server/actions/msp', () => ({
  toggleMspVoteAction: vi.fn(async () => null),
  createMspProjectAction: vi.fn(async () => null),
  addMspCommentAction: vi.fn(async () => null),
}));
vi.mock('@/server/actions/dpo', () => ({
  enrollDpoAction: vi.fn(async () => null),
}));

import { en } from '@/lib/i18n/en';
import { ru as ruDict } from '@/lib/i18n/ru';
import { navLabel } from '@/lib/i18n';
import { UserMenu } from '@/components/shell/user-menu';
import { SideNav } from '@/components/shell/side-nav';
import { AiGuide } from '@/components/shell/ai-guide';
import { NewsSection } from '@/components/dashboard/sections';
import { RequestCard } from '@/components/requests/request-card';
import { FeedbackList } from '@/components/feedback/feedback-list';
import { TicketList } from '@/components/deanery/ticket-list';
import { MspProjectCard } from '@/components/msp/msp-project-card';
import { MspCommentList } from '@/components/msp/msp-comment-list';
import { DpoProgramCard } from '@/components/dpo/dpo-program-card';
import { PeopleBrowser } from '@/components/people/people-browser';
import { localizeRequestCardTitle } from '@/lib/en-demo-content';
import { enDisciplineName } from '@/lib/en-demo-content';
import {
  enCountdownLabel,
  enPersonName,
  enSeasonTitle,
  localizeInitials,
  localizePersonName,
  localizeSessionData,
  localizeTasksData,
} from '@/lib/en-demo-content';
import { localizeProfileFullName } from '@/lib/en-demo-content';
// Реальные билдеры (чистые функции поверх fake-строк сида):
import { toDeadlineViews, toTodayView } from '@/server/data/dashboard';
import type { DashboardSection } from '@/server/data/dashboard';
import type {
  DataCtx,
  ScheduleEventRow,
  TicketRow,
} from '@/server/data/types';
import type { TaskView, TasksData } from '@/server/data/tasks';
import type { FeedbackRow } from '@/server/data/types';
import type { PersonListEntry } from '@/server/data/people';
import type { DpoCatalogView } from '@/server/data';
import type { MspProjectView } from '@/server/data';

import DashboardPage from '@/app/(cabinet)/dashboard/page';
import TasksPage from '@/app/(cabinet)/tasks/page';
import GradesPage from '@/app/(cabinet)/grades/(summary)/page';
import SessionPage from '@/app/(cabinet)/grades/session/page';
import RequestsPage from '@/app/(cabinet)/requests/page';
import FeedbackPage from '@/app/(cabinet)/feedback/(list)/page';
import PeoplePage from '@/app/(cabinet)/people/(list)/page';
import DeaneryPage from '@/app/(cabinet)/deanery/(list)/page';
import MspPage from '@/app/(cabinet)/msp/(feed)/page';
import DpoPage from '@/app/(cabinet)/dpo/page';
import ProfilePage from '@/app/(cabinet)/profile/page';
import MorePage from '@/app/(cabinet)/more/page';

const CYRILLIC = /[А-Яа-яЁё]/;

function expectNoCyrillic(html: string, what: string) {
  const hit = CYRILLIC.exec(html);
  expect(
    hit,
    `${what}: кириллица в EN-рендере: …${html.slice(Math.max(0, (hit?.index ?? 0) - 40), (hit?.index ?? 0) + 60)}…`,
  ).toBeNull();
}

async function renderPage(Page: ComponentType): Promise<string> {
  return prerenderOf(createElement(Page as ComponentType));
}

async function prerenderOf(node: React.ReactElement): Promise<string> {
  const { prerenderToNodeStream } = await import('react-dom/static');
  const { prelude } = await prerenderToNodeStream(node);
  let html = '';
  for await (const chunk of prelude) html += String(chunk);
  return html.replaceAll('<!-- -->', '');
}

afterEach(cleanup);

// ── общий студенческий контекст сессии ───────────────────────────────────────

const studentCtx: DataCtx = {
  userId: 'auth-anna',
  login: 'anna.smirnova',
  role: 'STUDENT',
  studentId: 'st-anna',
  groupName: 'ПИ-21',
  faculty: 'ИТ',
};

const ok = <T,>(value: T): DashboardSection<T> => ({ ok: true, value });

// ── 1. каркас: словарь, навигация, инициалы, AI-гид ──────────────────────────

describe('DIG-93: EN-словарь и навигационные подписи без кириллицы', () => {
  it('EN-словарь по-прежнему без кириллицы (кроме locale.*)', () => {
    for (const [key, value] of Object.entries(en)) {
      if (key.startsWith('locale.')) continue;
      expect(CYRILLIC.test(value), `ключ ${key}: «${value}»`).toBe(false);
    }
  });

  it('наборы ключей RU/EN совпадают после добавления новых меню-ключей', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(ruDict).sort());
  });

  it('меню-подписи новых разделов (/finance /msp /events) на EN латиницей', () => {
    // RU-фолбэк — прежние подписи nav-items (байт-в-байт RU не меняется).
    expect(navLabel('en', '/finance', 'Финансы')).toBe('Finance');
    expect(navLabel('en', '/msp', 'МСП')).toBe('Startups');
    expect(navLabel('en', '/events', 'Мероприятия')).toBe('Events');
    // RU — как есть.
    expect(navLabel('ru', '/finance', 'Финансы')).toBe('Финансы');
    expect(navLabel('ru', '/msp', 'МСП')).toBe('МСП');
    expect(navLabel('ru', '/events', 'Мероприятия')).toBe('Мероприятия');
  });

  it('боковое меню (desktop-рельс) на EN без кириллицы', () => {
    const html = renderToStaticMarkup(
      createElement(SideNav, { unreadCount: 0, tasksCount: 0, role: 'STUDENT', locale: 'en' }),
    );
    expectNoCyrillic(html, 'SideNav');
  });

  it('инициалы топбара: EN — латиница «AS» из EN-имени, RU — как было', () => {
    expect(localizeInitials('en', 'Анна Смирнова', 'anna.smirnova@example.edu')).toBe('AS');
    expect(localizeInitials('ru', 'Анна Смирнова', 'anna.smirnova@example.edu')).toBe('АС');
    // Неизвестное имя: EN-инициалы из логина/email-префикса.
    expect(localizeInitials('en', 'Пётр Новый', 'petr.novy@example.edu')).toBe('PN');
    expect(localizeInitials('ru', 'Пётр Новый', '')).toBe('ПН');
  });

  it('UserMenu на EN: кнопка-инициалы и пункты меню без кириллицы', () => {
    const html = renderToStaticMarkup(
      createElement(UserMenu, {
        user: {
          name: 'Анна Смирнова',
          email: 'anna.smirnova@example.edu',
          group: 'ПИ-21',
          role: 'STUDENT',
          voiceAssistant: true,
        },
        locale: 'en',
      }),
    );
    expectNoCyrillic(html, 'UserMenu trigger');
    expect(html).toContain('>AS<');
  });

  it('AI-гид: пилюля и панель на EN без кириллицы', () => {
    const pill = renderToStaticMarkup(
      createElement(AiGuide, { userName: 'Анна Смирнова', role: 'STUDENT', locale: 'en' }),
    );
    expectNoCyrillic(pill, 'AiGuide pill');
    expect(pill).toContain('AI guide');
  });
});

// ── 2. EN-хелперы демо-контента ──────────────────────────────────────────────

describe('DIG-93: EN-имена людей и демо-подписи', () => {
  it('имена студентов, преподавателей, сотрудников и авторов МСП — транслитом', () => {
    expect(enPersonName('Анна Смирнова')).toBe('Anna Smirnova');
    expect(enPersonName('Илья Петров')).toBe('Ilya Petrov');
    expect(enPersonName('Петров Пётр Петрович')).toBe('Pyotr Petrov');
    expect(enPersonName('Иванова Ирина Игоревна')).toBe('Irina Ivanova');
    expect(enPersonName('Соколов Сергей Сергеевич')).toBe('Sergey Sokolov');
    expect(enPersonName('Орлов Олег Олегович')).toBe('Oleg Orlov');
    expect(enPersonName('Кузнецова Ксения Кирилловна')).toBe('Ksenia Kuznetsova');
    expect(enPersonName('Мария Ковалёва')).toBe('Maria Kovaleva');
    expect(enPersonName('Андрей Семёнов')).toBe('Andrey Semyonov');
    expect(enPersonName('Наталья Белова')).toBe('Natalia Belova');
    expect(enPersonName('Сергей Гаврилов')).toBe('Sergey Gavrilov');
    expect(enPersonName('Елена Романова')).toBe('Elena Romanova');
    expect(enPersonName('Ольга Титова')).toBe('Olga Titova');
    expect(enPersonName('Виктор Никитин')).toBe('Viktor Nikitin');
    expect(enPersonName('Дмитрий Волков')).toBe('Dmitry Volkov');
    expect(enPersonName('Полина Егорова')).toBe('Polina Egorova');
    expect(enPersonName('Артём Фёдоров')).toBe('Artem Fedorov');
    expect(enPersonName('София Гусева')).toBe('Sofia Guseva');
    expect(localizePersonName('ru', 'Анна Смирнова')).toBe('Анна Смирнова');
    expect(localizeProfileFullName('en', 'Анна Смирнова')).toBe('Anna Smirnova');
  });

  it('титул сессии и отсчёт — EN по каноническим RU-строкам', () => {
    expect(enSeasonTitle('Сессия')).toBe('Exam session');
    expect(enSeasonTitle('Зимняя сессия')).toBe('Winter exam session');
    expect(enSeasonTitle('Летняя сессия')).toBe('Summer session');
    expect(enCountdownLabel('До первого экзамена 2 дня')).toBe('The first exam is in 2 days');
    expect(enCountdownLabel('До первого экзамена 1 день')).toBe('The first exam is in 1 day');
    expect(enCountdownLabel('Первый экзамен сегодня')).toBe('The first exam is today');
    expect(enCountdownLabel('Сессия уже идёт')).toBe('The exam session is under way');
  });

  it('название заявки с параметром — EN (имя + адресат)', () => {
    expect(localizeRequestCardTitle('en', 'Справка об обучении · для военкомата')).toBe(
      'Enrollment certificate · for the military office',
    );
    expect(localizeRequestCardTitle('en', 'Дубликат диплома · утрата оригинала')).toBe(
      'Diploma copy · original lost',
    );
    expect(localizeRequestCardTitle('en', 'Справка для военкомата')).toBe(
      'Military deferment certificate',
    );
    // RU — байт-в-байт.
    expect(localizeRequestCardTitle('ru', 'Справка об обучении · для военкомата')).toBe(
      'Справка об обучении · для военкомата',
    );
  });
});

// ── 3. билдеры с каноническими RU-строками сида → EN ─────────────────────────

const scheduleRow = (overrides: Partial<ScheduleEventRow> = {}): ScheduleEventRow => ({
  id: 'sch-1',
  groupName: 'ПИ-21',
  disciplineCode: 'PI21-INFO',
  disciplineName: 'Информатика',
  teacherName: 'Петров Пётр Петрович',
  room: '301',
  building: null,
  onlineUrl: null,
  date: new Date(2026, 10, 11, 10, 0),
  startsAt: new Date(2026, 10, 11, 10, 0),
  endsAt: new Date(2026, 10, 11, 11, 30),
  kind: 'LECTURE',
  status: 'SCHEDULED',
  previousRoom: null,
  previousStartsAt: null,
  note: null,
  changeNote: null,
  homework: null,
  materials: null,
  teacherEmail: null,
  changeAuthor: null,
  ...overrides,
});

describe('DIG-93: dashboard-вью (toTodayView/toDeadlineViews) на EN без кириллицы', () => {
  it('сегодня: дисциплина, преподаватель, заметка пары — EN', () => {
    const view = toTodayView(
      [
        scheduleRow({
          disciplineCode: 'PI21-DB',
          disciplineName: 'Базы данных',
          teacherName: 'Соколов Сергей Сергеевич',
          status: 'CANCELLED',
          note: 'Лаборатория закрыта',
        }),
        scheduleRow({
          id: 'sch-2',
          disciplineCode: 'PI21-PHYS',
          disciplineName: 'Физика',
          teacherName: 'Соколов Сергей Сергеевич',
          kind: 'LAB',
        }),
      ],
      new Date(2026, 10, 11, 12, 0),
      'en',
    );
    expectNoCyrillic(JSON.stringify(view), 'toTodayView(en)');
  });

  it('дедлайны: дисциплина и тип — EN', () => {
    const views = toDeadlineViews(
      [
        {
          id: 'exm-1',
          groupName: 'ПИ-21',
          disciplineCode: 'PI21-PROG',
          disciplineName: 'Программирование',
          kind: 'RETAKE',
          date: new Date(2026, 10, 18, 9, 0),
          startsAt: new Date(2026, 10, 18, 9, 0),
          room: '305',
          note: null,
        },
      ],
      new Date(2026, 10, 11, 12, 0),
      3,
      'en',
    );
    expectNoCyrillic(JSON.stringify(views), 'toDeadlineViews(en)');
  });
});

// ── 4. /tasks: getTasks-вью — EN-глаголы и EN-источники ─────────────────────

function taskFixture(): TasksData {
  const view = (
    id: string,
    source: TaskView['source'],
    verb: string,
    origin: string,
    daysLeft: number | null,
    manual = false,
  ): TaskView => ({
    id,
    source,
    verb,
    origin,
    dueAt: daysLeft === null ? null : new Date(2026, 10, 11 + daysLeft, 18, 0),
    daysLeft,
    href: '/tasks',
    manual,
  });
  return {
    overdue: [
      view('manual-task-anna-sign', 'MANUAL', 'Подписать согласие на обработку персональных данных', 'Деканат', -1, true),
    ],
    today: [
      view('request-creq-1', 'REQUEST', 'Доработать заявку', 'Справка об обучении · для военкомата · ЗД-2026-000003', null),
      view('deanery-apl-anna-2', 'DEANERY', 'Ответить на обращение', 'Перенос лабораторной по программированию', null),
    ],
    week: [
      view('course-dl-pi21-phys-test', 'COURSE', 'Сдать: Тест 1 «Кинематика»', 'Физика', 5),
      view('session-exm-1', 'SESSION', 'Сдать: Тест 2', 'Базы данных', 6),
      view('retake-exm-2', 'RETAKE', 'Записаться на пересдачу', 'Информатика', 7),
    ],
    later: [
      view('manual-task-anna-pay', 'MANUAL', 'Оплатить обучение по договору', 'Договор об образовании У-2026-114', 9, true),
    ],
    openCount: 6,
  };
}

describe('DIG-93: /tasks — локализованные задачи на EN без кириллицы', () => {
  it('localizeTasksData: глаголы и источники всех шести типов — EN', () => {
    const localized = localizeTasksData(taskFixture(), 'en');
    expectNoCyrillic(JSON.stringify(localized), 'localizeTasksData(en)');
    expect(localized.week[0]!.verb).toBe('Submit: Test 1: Kinematics');
    expect(localized.week[0]!.origin).toBe('Physics');
    expect(localized.today[1]!.origin).toBe('Moving a Programming lab');
    expect(localized.overdue[0]!.verb).toBe('Sign the personal data processing consent');
    expect(localizeTasksData(taskFixture(), 'ru')).toEqual(taskFixture());
  });

  it('localizeTasksData: глагол, уже собранный словарём с RU-титулом внутри', () => {
    // Реальный порядок getTasks на EN: глагол t('tasks.verb.submit', {title})
    // собирается ДО локализации — титул внутри остаётся каноничным RU.
    const enBuilt = localizeTasksData(
      {
        overdue: [],
        today: [],
        week: [
          {
            id: 'course-dl-pi21-phys-test',
            source: 'COURSE' as const,
            verb: 'Submit: Тест 1 «Кинематика»',
            origin: 'Физика',
            dueAt: new Date(2026, 10, 16, 18, 0),
            daysLeft: 5,
            href: '/grades/PI21-PHYS',
            manual: false,
          },
          {
            id: 'session-exm-1',
            source: 'SESSION' as const,
            verb: 'Submit: Тест 2',
            origin: 'Базы данных',
            dueAt: new Date(2026, 10, 17, 18, 0),
            daysLeft: 6,
            href: '/grades/PI21-DB',
            manual: false,
          },
        ],
        later: [],
        openCount: 2,
      },
      'en',
    );
    expect(enBuilt.week[0]!.verb).toBe('Submit: Test 1: Kinematics');
    expect(enBuilt.week[1]!.verb).toBe('Submit: Test 2');
    expectNoCyrillic(JSON.stringify(enBuilt), 'localizeTasksData(en-built verbs)');
  });

  it('страница /tasks (мок агрегата с EN-задачами) — без кириллицы', async () => {
    dataState.ctx = studentCtx;
    dataState.tasks = localizeTasksData(taskFixture(), 'en');
    const html = await renderPage(TasksPage);
    expectNoCyrillic(html, 'TasksPage');
  });

  it('страница /tasks передаёт locale в агрегат getTasks', async () => {
    dataState.ctx = studentCtx;
    dataState.tasks = { overdue: [], today: [], week: [], later: [], openCount: 0 };
    await renderPage(TasksPage);
    const { getTasks } = await import('@/server/data');
    expect(vi.mocked(getTasks as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[3]).toBe('en');
  });
});

// ── 5. /dashboard: страница с EN-агрегатом (собранным реальными билдерами) ────

describe('DIG-93: /dashboard при locale=en — ноль кириллицы', () => {
  it('страница (герой, сегодня, дедлайны, прогресс, новости, задачи) — без кириллицы', async () => {
    dataState.ctx = studentCtx;
    dataState.ownSettings = null;
    dataState.dashboardEvents = { items: [] };
    dataState.deaneryNews = [
      {
        id: 'university-library-night',
        title: 'Ночь библиотеки: программа и запись',
        excerpt: '20 ноября библиотека работает до полуночи.',
        publishedAt: new Date(2026, 10, 14, 12, 0),
      },
    ];
    const todayView = toTodayView(
      [
        scheduleRow({
          disciplineCode: 'PI21-INFO',
          disciplineName: 'Информатика',
          teacherName: 'Петров Пётр Петрович',
        }),
        scheduleRow({
          id: 'sch-2',
          disciplineCode: 'PI21-PROG',
          disciplineName: 'Программирование',
          teacherName: 'Иванова Ирина Игоревна',
          kind: 'LAB',
        }),
        scheduleRow({
          id: 'sch-3',
          disciplineCode: 'PI21-PHYS',
          disciplineName: 'Физика',
          teacherName: 'Соколов Сергей Сергеевич',
          status: 'CANCELLED',
          note: 'Лаборатория закрыта',
        }),
      ],
      new Date(2026, 10, 11, 12, 0),
      'en',
    );
    dataState.dashboard = {
      firstName: localizeProfileFullName('en', 'Анна Смирнова')?.split(' ')[0] ?? null,
      greeting: 'Good evening',
      headingDate: 'Wednesday, November 11',
      summary: 'Today 3 classes, one cancelled.',
      today: ok(todayView),
      deadlines: ok(
        toDeadlineViews(
          [
            {
              id: 'exm-1',
              groupName: 'ПИ-21',
              disciplineCode: 'PI21-DB',
              disciplineName: 'Базы данных',
              kind: 'EXAM',
              date: new Date(2026, 10, 18, 9, 0),
              startsAt: new Date(2026, 10, 18, 9, 0),
              room: '305',
              note: null,
            },
          ],
          new Date(2026, 10, 11, 12, 0),
          3,
          'en',
        ),
      ),
      progress: ok({
        average: 88.7,
        averageDelta: 2.3,
        credits: 120,
        creditsTotal: 240,
        debts: [
          {
            disciplineName: enDisciplineName({ name: 'Программирование' }),
            dateLabel: 'November 26',
            daysLeft: 15,
          },
        ],
        disciplines: [
          {
            code: 'PI21-PROG',
            disciplineName: enDisciplineName({ code: 'PI21-PROG', name: 'Программирование' }),
            average: 92,
            level: 'good' as const,
          },
          {
            code: 'PI21-INFO',
            disciplineName: enDisciplineName({ code: 'PI21-INFO', name: 'Информатика' }),
            average: 88,
            level: 'good' as const,
          },
        ],
      }),
      requests: ok({ inWork: 2, total: 3 }),
      tasks: ok({ openCount: 0, top: [] }),
    };
    const html = await renderPage(DashboardPage);
    expectNoCyrillic(html, 'DashboardPage');
    expect(html).toContain('Anna');
    expect(html).toContain('Computer Science');
  });

  it('виджет новостей: EN-заголовки и описания по id сида', () => {
    const html = renderToStaticMarkup(
      createElement(NewsSection, {
        news: [
          {
            id: 'university-library-night',
            title: 'Ночь библиотеки: программа и запись',
            excerpt: '20 ноября библиотека работает до полуночи: квесты и тихая зона.',
            publishedAt: new Date(2026, 10, 14, 12, 0),
          },
          {
            id: 'demo-news-unknown',
            title: 'Fallback stays RU-safe',
            excerpt: 'Unknown id keeps the source text.',
            publishedAt: new Date(2026, 10, 14, 12, 0),
          },
        ],
        locale: 'en',
      }),
    );
    expect(html).toContain('Library Night');
    expect(html).toContain('Fallback stays RU-safe');
  });
});

// ── 6. /grades: сводка при EN — дисциплины, преподаватели, долги, инсайт ─────

describe('DIG-93: /grades при locale=en — без кириллицы', () => {
  it('страница успеваемости с каноническими RU-данными — без кириллицы', async () => {
    dataState.ctx = studentCtx;
    dataState.performance = {
      studentId: 'st-anna',
      disciplines: [
        {
          disciplineCode: 'PI21-DB',
          disciplineName: 'Базы данных',
          credits: 5,
          semester: { startYear: 2026, term: 'FALL' },
          semesterLabel: 'Осенний семестр 2026/27',
          accumulated: 82,
          minGuaranteed: 70,
          maxPossible: 100,
          finalGrade: null,
          gradedElements: 2,
          totalElements: 3,
          isComplete: false,
          creditEarned: true,
          teacherName: 'Соколов Сергей Сергеевич',
        },
        {
          disciplineCode: 'PI21-PROG',
          disciplineName: 'Программирование',
          credits: 6,
          semester: { startYear: 2026, term: 'FALL' },
          semesterLabel: 'Осенний семестр 2026/27',
          accumulated: 95,
          minGuaranteed: 90,
          maxPossible: 100,
          finalGrade: 95,
          gradedElements: 3,
          totalElements: 3,
          isComplete: true,
          creditEarned: true,
          teacherName: 'Иванова Ирина Игоревна',
        },
      ],
      gpa: {
        overall: 88.5,
        currentSemesterKey: { startYear: 2026, term: 'FALL' },
      },
      credits: { earned: 120, required: 240 },
      rating: { rank: 2, groupSize: 5 },
      debts: [
        {
          disciplineCode: 'PI21-ALG',
          disciplineName: 'Алгоритмы и структуры данных',
          retakeDate: new Date(2026, 10, 26, 9, 0),
          daysLeft: 7,
          status: 'ASSIGNED' as const,
        },
      ],
    };
    dataState.exams = [
      {
        id: 'exm-next',
        groupName: 'ПИ-21',
        disciplineCode: 'PI21-DB',
        disciplineName: 'Базы данных',
        kind: 'EXAM',
        date: new Date(2026, 10, 20, 9, 0),
        startsAt: new Date(2026, 10, 20, 9, 0),
        room: '401',
        note: null,
      },
    ];
    dataState.gradeInsight = {
      semesterLabel: 'Fall semester 2026/27',
      points: [
        {
          dateISO: '2026-11-01',
          average: 86.4,
          delta: null,
          works: [],
        },
        {
          dateISO: '2026-11-10',
          average: 88.7,
          delta: 2.3,
          works: [
            {
              disciplineName: 'Programming',
              elementName: 'Lab 2',
              score: 92,
              maxScore: 100,
              dateISO: '2026-11-10',
            },
          ],
        },
      ],
      current: 88.7,
      month: {
        direction: 'up',
        works: [
          {
            disciplineName: 'Программирование',
            elementName: 'Лабораторная 2',
            score: 92,
            maxScore: 100,
            dateISO: '2026-11-10',
          },
        ],
        baseline: 86.4,
        delta: 2.3,
      },
      headline: 'The average rose by 2.3 points this month: from 86.4 to 88.7',
      detail:
        '“Lab 2” (Programming, 92 out of 100) raised the average the most: 2.3 points.',
    };
    const html = await renderPage(GradesPage);
    expectNoCyrillic(html, 'GradesPage');
    expect(html).toContain('Databases');
    expect(html).toContain('Lab 2');
  });
});

// ── 7. /grades/session: сессия при EN ────────────────────────────────────────

function sessionCanonicalFixture() {
  const day = (offset: number, hour = 10): Date => new Date(2026, 11, 20 + offset, hour, 0);
  return {
    studentId: 'st-anna',
    seasonTitle: 'Зимняя сессия',
    rangeLabel: '23 декабря – 1 января',
    countdown: { days: 3, label: 'До первого экзамена 3 дня' },
    exams: [
      {
        examId: 'exm-db-ex',
        disciplineCode: 'PI21-DB',
        disciplineName: 'Базы данных',
        kind: 'EXAM' as const,
        kindLabel: 'Экзамен',
        date: day(3),
        startsAt: day(3, 9),
        room: '401',
        teacherName: 'Соколов Сергей Сергеевич',
        status: 'NOT_ADMITTED' as const,
        statusLabel: 'Не допущен',
        statusBadge: 'error' as const,
        score: null,
        admissionReason: 'Не сдано: Тест 2',
        actionHref: '/grades/PI21-DB',
      },
      {
        examId: 'exm-info-cr',
        disciplineCode: 'PI21-INFO',
        disciplineName: 'Информатика',
        kind: 'CREDIT' as const,
        kindLabel: 'Зачёт',
        date: day(5),
        startsAt: day(5, 9),
        room: '210',
        teacherName: 'Петров Пётр Петрович',
        status: 'ADMITTED' as const,
        statusLabel: 'Допущен',
        statusBadge: 'success' as const,
        score: null,
        admissionReason: null,
        actionHref: null,
      },
    ],
    retakes: [
      {
        examId: 'exm-alg-ret',
        disciplineCode: 'PI21-ALG',
        disciplineName: 'Алгоритмы и структуры данных',
        date: day(10),
        startsAt: day(10, 9),
        room: '305',
        note: 'Пересдача экзамена (закрыто)',
        requested: false,
        requestNumber: null,
        signUpAvailable: false,
      },
    ],
    consultations: [
      {
        eventId: 'sch-cons-1',
        disciplineCode: 'PI21-DB',
        disciplineName: 'Базы данных',
        date: day(1),
        startsAt: day(1, 15),
        endsAt: day(1, 16),
        room: '212',
        teacherName: 'Соколов Сергей Сергеевич',
      },
    ],
  };
}

describe('DIG-93: /grades/session при locale=en — без кириллицы', () => {
  it('localizeSessionData: шапка, статусы, причины, преподаватели — EN', () => {
    const localized = localizeSessionData('en', sessionCanonicalFixture());
    expectNoCyrillic(JSON.stringify(localized), 'localizeSessionData(en)');
    expect(localized.seasonTitle).toBe('Winter exam session');
    expect(localized.exams[0]!.admissionReason).toBe('Missing: Test 2');
    expect(localized.retakes[0]!.note).toBe('Exam retake (closed)');
    expect(localizeSessionData('ru', sessionCanonicalFixture())).toEqual(
      sessionCanonicalFixture(),
    );
  });

  it('страница сессии с EN-агрегатом — без кириллицы', async () => {
    dataState.ctx = studentCtx;
    dataState.session = localizeSessionData('en', sessionCanonicalFixture());
    dataState.headers = new Map([['host', 'localhost:3000']]);
    const html = await renderPage(SessionPage);
    expectNoCyrillic(html, 'SessionPage');
  });
});

// ── 8. /requests: карточки заявок при EN ─────────────────────────────────────

describe('DIG-93: /requests при locale=en — без кириллицы', () => {
  const card = (overrides: Record<string, unknown> = {}) => ({
    id: 'creq-1',
    number: 'ЗД-2026-000003',
    title: 'Справка об обучении · для военкомата',
    typeName: 'CERT_ENROLLMENT',
    iconKind: 'certificate' as const,
    status: 'NEEDS_FIX' as const,
    createdAtISO: new Date(2026, 10, 10, 10, 0).toISOString(),
    createdAtLabel: '10 ноября',
    readyByISO: null,
    readyByLabel: null,
    updatedAtISO: new Date(2026, 10, 11, 9, 0).toISOString(),
    action: 'FIX' as const,
    pipelineStep: null,
    nextAction: 'Нужна доработка: Укажите ФИО латиницей',
    reason: 'Укажите ФИО латиницей',
    isFix: true,
    ...overrides,
  });

  it('карточка: название, причина, следующий шаг — EN', () => {
    const html = renderToStaticMarkup(
      createElement(RequestCard, {
        request: card(),
        locale: 'en',
      }),
    );
    expectNoCyrillic(html, 'RequestCard');
    expect(html).toContain('Enrollment certificate · for the military office');
  });

  it('страница заявок с каноническими карточками — без кириллицы', async () => {
    dataState.ctx = studentCtx;
    dataState.requestsScreen = {
      cards: [
        card(),
        card({
          id: 'creq-2',
          number: 'SR-2026-E63VN',
          title: 'Заявление на место в общежитии',
          status: 'IN_PROGRESS' as const,
          action: 'CANCEL' as const,
          isFix: false,
          reason: null,
          nextAction: 'Деканат готовит документ',
        }),
      ],
    };
    const html = await renderPage(RequestsPage);
    expectNoCyrillic(html, 'RequestsPage');
  });
});

// ── 9. /feedback при EN ──────────────────────────────────────────────────────

describe('DIG-93: /feedback при locale=en — без кириллицы', () => {
  const feedbackItem = (overrides: Partial<FeedbackRow> = {}): FeedbackRow =>
    ({
      id: 'fb-anna-1',
      studentId: 'st-anna',
      number: 'FB-2026-XYZ',
      kind: 'SUGGESTION',
      target: 'DEANERY',
      status: 'NEW',
      text: 'Добавьте, пожалуйста, в расписание фильтр по корпусу — удобно видеть только пары рядом.',
      anonymous: false,
      createdAt: new Date(2026, 10, 14, 12, 0),
      dueAt: new Date(2026, 10, 19, 12, 0),
      answeredAt: null,
      resolvedAt: null,
      replyText: null,
      ...overrides,
    }) as FeedbackRow;

  it('список обращений: тексты сида — EN по id', () => {
    const html = renderToStaticMarkup(
      createElement(FeedbackList, {
        items: [feedbackItem()],
        locale: 'en',
      }),
    );
    expectNoCyrillic(html, 'FeedbackList');
    expect(html).toContain('building filter');
  });

  it('страница обратной связи — без кириллицы', async () => {
    dataState.ctx = studentCtx;
    dataState.feedbackPage = {
      items: [feedbackItem()],
      feed: [
        {
          number: 'FB-2026-ZC33S',
          kind: 'SUGGESTION' as const,
          target: 'ACADEMIC_OFFICE' as const,
          suggestion: 'Добавьте в расписание фильтр по корпусу.',
          outcome: 'В расписании появился выбор корпуса.',
          resolvedAt: new Date(2026, 9, 30, 12, 0),
        },
      ],
    };
    const html = await renderPage(FeedbackPage);
    expectNoCyrillic(html, 'FeedbackPage');
  });
});

// ── 10. /deanery при EN ──────────────────────────────────────────────────────

describe('DIG-93: /deanery при locale=en — без кириллицы', () => {
  const ticket = (overrides: Partial<TicketRow> = {}): TicketRow =>
    ({
      id: 'tkt-a',
      studentId: 'st-anna',
      number: 'T-2026-001',
      subject: 'GRADES',
      status: 'WAITING_STUDENT',
      linkedRequestNumber: null,
      linkedDisciplineCode: null,
      createdAt: new Date(2026, 10, 12, 10, 0),
      updatedAt: new Date(2026, 10, 14, 12, 0),
      readAt: null,
      ...overrides,
    }) as TicketRow;

  it('список обращений: превью последнего сообщения — EN по id', () => {
    const html = renderToStaticMarkup(
      createElement(TicketList, {
        tickets: [
          {
            ...ticket(),
            unreadStaffCount: 1,
            lastMessage: {
              id: 'tktmsg-a-2',
              authorRole: 'STAFF' as const,
              body: 'Добрый день! Заявление принято в работу, проверяем места.',
              createdAt: new Date(2026, 10, 14, 12, 0),
            },
          },
        ],
        locale: 'en',
      }),
    );
    expectNoCyrillic(html, 'TicketList');
    expect(html).toContain('Good afternoon');
  });

  it('страница обращений — без кириллицы', async () => {
    dataState.ctx = studentCtx;
    dataState.deaneryPage = {
      tickets: [
        {
          ...ticket(),
          unreadStaffCount: 0,
          lastMessage: {
            id: 'tktmsg-b-1',
            authorRole: 'STUDENT' as const,
            body: 'Проверьте, пожалуйста, оценку за проект по «Базам данных».',
            createdAt: new Date(2026, 10, 12, 10, 0),
          },
        },
      ],
      requests: [
        { number: 'SR-2026-7M0ZH', title: 'Справка об обучении для налоговой' },
      ],
      disciplines: [
        { code: 'PI21-DB', name: 'Базы данных' },
        { code: 'PI21-INFO', name: 'Информатика' },
      ],
    };
    const html = await renderPage(DeaneryPage);
    expectNoCyrillic(html, 'DeaneryPage');
  });
});

// ── 11. /people при EN ───────────────────────────────────────────────────────

describe('DIG-93: /people при locale=en — без кириллицы', () => {
  const person = (overrides: Partial<PersonListEntry> = {}): PersonListEntry =>
    ({
      id: 'teacher-ivanova',
      kind: 'TEACHER' as const,
      fullName: 'Иванова Ирина Игоревна',
      position: 'Старший преподаватель',
      department: 'Кафедра программной инженерии',
      email: 'irina.ivanova@example.edu',
      disciplines: ['Программирование', 'Алгоритмы и структуры данных'],
      isMyTeacher: true,
      isMyDeanery: false,
      isMyManager: false,
      myDisciplines: ['Программирование', 'Алгоритмы и структуры данных'],
      ...overrides,
    }) as PersonListEntry;

  it('карточка справочника: имя, дисциплины — EN', () => {
    render(
      createElement(PeopleBrowser, {
        people: [person()],
        groupmates: [],
        favorites: [],
        showPersonal: true,
        locale: 'en',
      }),
    );
    expectNoCyrillic(document.body.innerHTML, 'PeopleBrowser');
    expect(document.body.innerHTML).toContain('Irina Ivanova');
  });

  it('страница справочника — без кириллицы', async () => {
    dataState.ctx = studentCtx;
    dataState.peopleDirectory = {
      people: [
        person(),
        person({
          id: 'staff-kovaleva',
          kind: 'STAFF',
          fullName: 'Мария Ковалёва',
          position: 'Специалист деканата',
          department: 'Деканат факультета ИТ',
          isMyTeacher: false,
          isMyDeanery: true,
        }),
      ],
      groupmates: [],
      favorites: { favorites: [], hasPersonalScope: true },
      totalCount: 2,
    };
    const html = await renderPage(PeoplePage);
    expectNoCyrillic(html, 'PeoplePage');
  });
});

// ── 12. /msp при EN ──────────────────────────────────────────────────────────

describe('DIG-93: /msp при locale=en — без кириллицы', () => {
  const mspView = (): MspProjectView => ({
    project: {
      id: 'msp-konspekt',
      slug: 'konspekt-bot',
      title: 'ИИ-конспекты лекций за минуту',
      tagline: 'Конспект лекции из записи — за минуту',
      description: 'Студент загружает запись, бот собирает конспект.',
      tags: ['ai', 'учёба'],
      authorStudentId: 'st-anna',
      authorName: 'Анна Смирнова',
      createdAt: new Date(2026, 10, 10, 12, 0),
      letter: 'И',
    },
    votes: 12,
    votedByMe: false,
    comments: 2,
  });

  it('карточка проекта: автор, логотип-буква — EN', () => {
    const view = mspView();
    const html = renderToStaticMarkup(
      createElement(MspProjectCard, { view, canVote: false, locale: 'en' }),
    );
    expectNoCyrillic(html, 'MspProjectCard');
    expect(html).toContain('Anna Smirnova');
  });

  it('комментарии: автор и текст — EN', () => {
    const html = renderToStaticMarkup(
      createElement(MspCommentList, {
        comments: [
          {
            id: 'msp-cmt-1',
            projectId: 'msp-konspekt',
            studentId: 'st-mate-sofia',
            authorName: 'София Гусева',
            body: 'Загрузил вчерашнюю лекцию — конспект собрался за минуту.',
            createdAt: new Date(2026, 10, 18, 12, 0),
          },
        ],
        locale: 'en',
      }),
    );
    expectNoCyrillic(html, 'MspCommentList');
    expect(html).toContain('Sofia Guseva');
  });

  it('страница каталога — без кириллицы', async () => {
    dataState.ctx = studentCtx;
    dataState.mspPage = {
      sort: 'new' as const,
      items: [mspView()],
      launchOfDay: mspView(),
    };
    const html = await renderPage(MspPage);
    expectNoCyrillic(html, 'MspPage');
  });
});

// ── 13. /dpo при EN ──────────────────────────────────────────────────────────

describe('DIG-93: /dpo при locale=en — без кириллицы', () => {
  const dpoView = (): DpoCatalogView => ({
    program: {
      id: 'dpo-analytics',
      slug: 'data-analytics',
      title: 'Аналитика данных',
      description: 'Сбор, чистка и визуализация данных.',
      format: 'ONLINE' as const,
      hours: 36,
      startsAt: new Date(2026, 11, 3),
      price: 0,
      tags: ['данные'],
      facultyTag: 'ИТ',
    },
    enrolledByMe: false,
  });

  it('карточка программы: факультет-тег — EN', () => {
    // Фикстура = выход localizeProgram страницы (EN-словарь по id + тег факультета).
    const view = dpoView();
    const html = renderToStaticMarkup(
      createElement(DpoProgramCard, {
        view: {
          ...view,
          program: {
            ...view.program,
            title: 'Data Analytics',
            description: 'Collecting, cleaning and visualizing data.',
            tags: ['data'],
            facultyTag: 'IT',
          },
        },
        canEnroll: false,
        locale: 'en',
      }),
    );
    expectNoCyrillic(html, 'DpoProgramCard');
    expect(html).toContain('IT');
  });

  it('страница ДПО — без кириллицы', async () => {
    dataState.ctx = studentCtx;
    dataState.dpoCatalog = [dpoView()];
    dataState.dpoMy = [];
    dataState.dpoDocs = [];
    const html = await renderPage(DpoPage);
    expectNoCyrillic(html, 'DpoPage');
  });
});

// ── 14. /profile при EN ──────────────────────────────────────────────────────

describe('DIG-93: /profile при locale=en — без кириллицы', () => {
  it('страница профиля: имя, семестр — EN', async () => {
    dataState.ctx = studentCtx;
    dataState.profile = {
      studentId: 'st-anna',
      login: 'anna.smirnova',
      fullName: 'Анна Смирнова',
      email: 'anna.smirnova@example.edu',
      groupName: 'ПИ-21',
      course: 2,
      faculty: 'ИТ',
      program: 'Прикладная информатика',
      programCode: '09.03.04',
      studyForm: 'очная',
      funding: 'бюджет',
      gradebookNumber: '20231234',
    };
    dataState.ownSettings = {
      studentId: 'st-anna',
      phone: null,
      emailVisibleToStaff: true,
      phoneVisibleToStaff: true,
      notificationChannels: {},
      theme: 'SYSTEM',
      widgets: [],
      quietHours: { enabled: false, from: '22:00', to: '08:00' },
      language: 'RU',
      fontSize: 'NORMAL',
      reduceMotion: false,
      updatedAt: new Date(2026, 10, 10),
    };
    const html = await renderPage(ProfilePage);
    expectNoCyrillic(html, 'ProfilePage');
    expect(html).toContain('Anna Smirnova');
  });
});

// ── 15. /more при EN ─────────────────────────────────────────────────────────

describe('DIG-93: /more при locale=en — без кириллицы', () => {
  it('страница «Ещё»: подписи разделов без кириллицы', async () => {
    const html = await renderPage(MorePage);
    expectNoCyrillic(html, 'MorePage');
  });
});
