// DIG-124 — EN-аудит кабинета сотрудника: ноль кириллицы на пяти поверхностях
// (/staff, /staff/requests, /staff/appeals, /staff/announcements, /ai-assistant).
//
// Красный-первый контур: страницы рендерятся с locale=en и СИД-данными
// (факультет «ИТ», имена «Анна Смирнова»/«Мария Ковалёва», группы «ПИ-21»,
// названия заявок/обращений/объявлений сида) — в видимом тексте не должно
// быть ни одного символа [А-Яа-яЁё]. Атрибуты (value канонических select)
// не являются видимым текстом — проверяется текстовый эквивалент innerText.
// Приветствие ассистента на EN строится из ПОЛНОГО ФИО (словарь персон
// хранит полные имена): «Анна Смирнова» → «Hello, Anna!». RU-рендер
// байт-в-байт прежний.
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prerenderToNodeStream } from 'react-dom/static';
import { cleanup, render } from '@testing-library/react';
import { createElement, type ComponentType, type ReactElement } from 'react';

// Локаль кабинета в юнит-среде: подменяем серверное чтение cookie.
const localeState = vi.hoisted(() => ({ locale: 'en' as 'ru' | 'en' }));
vi.mock('@/lib/i18n/server', () => ({
  getLocale: vi.fn(async () => localeState.locale),
}));

// Слой данных сотрудника — hoisted-состояние (каждый тест ставит фикстуру).
const dataState = vi.hoisted(() => ({
  ctx: null as unknown,
  queue: [] as Array<{ request: unknown; student: unknown }>,
  appeals: [] as Array<{ appeal: unknown; student: unknown; lastAt: Date }>,
  announcements: [] as unknown[],
  groups: [] as string[],
  summary: null as unknown,
}));

vi.mock('@/server/data/db', () => ({ dataDb: {} }));

vi.mock('@/server/data', () => ({
  requireDataCtx: vi.fn(async () => dataState.ctx),
  getStaffSummaryData: vi.fn(async () => dataState.summary),
  getStaffQueue: vi.fn(async () => dataState.queue),
  getStaffQueueUnified: vi.fn(async () => dataState.queue),
  getStaffAppeals: vi.fn(async () => dataState.appeals),
  listStaffAnnouncements: vi.fn(async () => dataState.announcements),
  listFacultyGroups: vi.fn(async () => dataState.groups),
}));

import StaffSummaryPage from '@/app/(cabinet)/staff/(dashboard)/page';
import StaffQueuePage from '@/app/(cabinet)/staff/(dashboard)/requests/page';
import StaffAppealsPage from '@/app/(cabinet)/staff/(dashboard)/appeals/page';
import StaffAnnouncementsPage from '@/app/(cabinet)/staff/(dashboard)/announcements/page';
import { AssistantChat } from '@/components/assistant/assistant-chat';
import type { AssistantContext } from '@/lib/assistant-engine';
import type { AppealRow, AnnouncementRow, StudentRow } from '@/server/data/types';

const CYRILLIC = /[А-Яа-яЁё]/;

/** Текстовый эквивалент innerText из SSR-HTML: атрибуты не входят. */
function visibleText(html: string): string {
  return html.replace(/<[^>]*>/g, ' ');
}

function expectNoCyrillic(html: string, what: string) {
  const text = visibleText(html);
  const hit = CYRILLIC.exec(text);
  expect(
    hit,
    `${what}: кириллица в EN-рендере: …${text.slice(Math.max(0, (hit?.index ?? 0) - 40), (hit?.index ?? 0) + 60)}…`,
  ).toBeNull();
}

async function renderPage<P>(
  Page: (props: P) => Promise<ReactElement> | ReactElement,
  props: P,
): Promise<string> {
  const { prelude } = await prerenderToNodeStream(
    createElement(Page as unknown as ComponentType, props as Record<string, unknown>),
  );
  let html = '';
  for await (const chunk of prelude) {
    html += String(chunk);
  }
  return html.replaceAll('<!-- -->', '');
}

// ── сид-фикстуры прод-аудита (demo-seed, факультет «ИТ») ─────────────────────

const staffCtx = {
  userId: 'auth-dean',
  login: 'dean.kovaleva',
  role: 'STAFF' as const,
  studentId: null,
  groupName: null,
  faculty: 'ИТ',
};

const anna: StudentRow = {
  id: 'st-anna',
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

/** Четыре заявки сида Анны из очереди сотрудника факультета «ИТ» (единая
 * очередь DIG-126: легаси «SR-…» + канон «ЗД-…» со SLA-дедлайном строки). */
function seedQueue(): Array<{ request: Record<string, unknown>; student: StudentRow }> {
  const request = (
    id: string,
    number: string,
    type: string,
    title: string,
    status: string,
    assignee: string | null,
    daysAgo: number,
  ): Record<string, unknown> => {
    const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    return {
      id,
      studentId: 'st-anna',
      number,
      type,
      title,
      status,
      assignee,
      resultNote: null,
      createdAt,
      updatedAt: new Date(),
      // Контракт единой очереди DIG-126: мир строки + готовый SLA-дедлайн.
      kind: 'legacy',
      typeCode: null,
      typeName: null,
      slaDeadline: new Date(createdAt.getTime() + 3 * 24 * 60 * 60 * 1000),
    };
  };
  // Канон «ЗД-…» (DIG-30) в очереди сотрудника: SLA из etaDays РАБОЧИМИ днями.
  const canonical = {
    id: 'creq-anna-3',
    number: 'ЗД-2026-000003',
    type: 'STATEMENT',
    title: 'Справка об обучении · для военкомата',
    status: 'NEEDS_FIX',
    studentId: 'st-anna',
    assignee: null,
    resultNote: null,
    kind: 'canonical',
    typeCode: 'CERT_ENROLLMENT',
    typeName: 'Справка об обучении',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    slaDeadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
  };
  return [
    {
      request: request(
        'req-anna-1',
        'SR-2026-A1B2C',
        'CERTIFICATE',
        'Справка об обучении для налоговой',
        'ISSUED',
        'Мария Ковалёва',
        9,
      ),
      student: anna,
    },
    {
      request: request(
        'req-anna-2',
        'SR-2026-D3E4F',
        'DORMITORY',
        'Заявление на место в общежитии',
        'IN_PROGRESS',
        'Мария Ковалёва',
        3,
      ),
      student: anna,
    },
    {
      request: request(
        'req-anna-4',
        'SR-2026-G5H6I',
        'CERTIFICATE',
        'Справка для военкомата',
        'SUBMITTED',
        null,
        9,
      ),
      student: anna,
    },
    {
      request: request(
        'req-anna-5',
        'SR-2026-J7K8L',
        'STATEMENT',
        'Заявление на перезачёт дисциплины',
        'SUBMITTED',
        null,
        0,
      ),
      student: anna,
    },
    { request: canonical, student: anna },
  ];
}

const seedAppeals: Array<{ appeal: AppealRow; student: StudentRow; lastAt: Date }> = [
  {
    appeal: {
      id: 'apl-anna-1',
      studentId: 'st-anna',
      subject: 'Вопрос по зачёту по физкультуре',
      status: 'OPEN',
      createdAt: new Date('2026-11-18T19:00:00'),
    },
    student: anna,
    lastAt: new Date('2026-11-18T19:05:00'),
  },
  {
    appeal: {
      id: 'apl-anna-2',
      studentId: 'st-anna',
      subject: 'Перенос лабораторной по программированию',
      status: 'ANSWERED',
      createdAt: new Date('2026-11-17T09:30:00'),
    },
    student: anna,
    lastAt: new Date('2026-11-19T10:15:00'),
  },
];

const seedAnnouncements: AnnouncementRow[] = [
  {
    id: 'ann-demo-pi21',
    faculty: 'ИТ',
    groupName: 'ПИ-21',
    title: 'Собрание группы ПИ-21',
    body: 'Завтра в 10:00, ауд. 305: вопросы сессии и практики. Возьмите зачётные книжки.',
    authorLogin: 'dean.kovaleva',
    authorName: 'Мария Ковалёва',
    createdAt: new Date('2026-11-19T13:00:00'),
  },
];

beforeEach(() => {
  localeState.locale = 'en';
  dataState.ctx = staffCtx;
  dataState.queue = seedQueue();
  dataState.appeals = seedAppeals;
  dataState.announcements = seedAnnouncements;
  dataState.groups = ['ПИ-21'];
  dataState.summary = { requests: [], eventsByRequestId: {}, appeals: [] };
});

afterEach(cleanup);

// ── EN: пять поверхностей прод-аудита — ноль кириллицы ───────────────────────

describe('DIG-124: /staff — EN без кириллицы', () => {
  it('сводка: факультет «ИТ» в подзаголовке → «IT»', async () => {
    const html = await renderPageNoProps(StaffSummaryPage);
    expect(html).toContain('Faculty IT');
    expectNoCyrillic(html, 'StaffSummaryPage');
  });

  it('очередь: названия заявок сида, имена и группа — EN', async () => {
    const html = await renderPage(StaffQueuePage, { searchParams: Promise.resolve({}) });
    // Названия заявок сида (включая «Заявление на перезачёт дисциплины»).
    expect(html).toContain('Military deferment certificate');
    expect(html).toContain('Discipline credit transfer application');
    expect(html).toContain('Enrollment certificate for the tax office');
    expect(html).toContain('Dormitory residence application');
    // Канон «ЗД-…» (DIG-126): название по словарю, номер транслитом, пилюля EN.
    expect(html).toContain('Enrollment certificate · for the military office');
    expect(html).toContain('ZD-2026-000003');
    expect(html).toContain('Wizard request');
    // Люди и группы.
    expect(html).toContain('Anna Smirnova');
    expect(html).toContain('PI-21');
    expect(html).toContain('Maria Kovaleva');
    expect(html).toContain('Requests of the IT faculty students');
    expectNoCyrillic(html, 'StaffQueuePage');
  });

  it('обращения: темы сида и профиль владельца — EN', async () => {
    const html = await renderPageNoProps(StaffAppealsPage);
    expect(html).toContain('Physical education credit question');
    expect(html).toContain('Moving a Programming lab');
    expect(html).toContain('Anna Smirnova');
    expectNoCyrillic(html, 'StaffAppealsPage');
  });

  it('объявления: сид-объявление, аудитория и автор — EN', async () => {
    const html = await renderPageNoProps(StaffAnnouncementsPage);
    expect(html).toContain('PI-21 group meeting');
    expect(html).toContain('Tomorrow at 10:00, room 305');
    expect(html).toContain('Maria Kovaleva');
    expect(html).toContain('group PI-21');
    expectNoCyrillic(html, 'StaffAnnouncementsPage');
  });
});

async function renderPageNoProps(Page: () => Promise<ReactElement>): Promise<string> {
  return renderPage(Page, {});
}

// ── EN: приветствие ассистента из полного ФИО ────────────────────────────────

function assistantContextFixture(overrides: Partial<AssistantContext> = {}): AssistantContext {
  return {
    role: 'STUDENT',
    firstName: 'Анна',
    fullName: 'Анна Смирнова',
    groupLabel: 'ПИ-21',
    tomorrow: null,
    nextStudyDayLabel: null,
    disciplines: [],
    ...overrides,
  };
}

describe('DIG-124: приветствие ассистента — EN по полному ФИО', () => {
  beforeEach(() => {
    // jsdom не реализует matchMedia, а чат читает prefers-reduced-motion.
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: () => ({
        matches: false,
        media: '',
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  });

  it('«Анна Смирнова» → «Hello, Anna!» — без кириллицы', () => {
    const view = render(
      createElement(AssistantChat, {
        context: assistantContextFixture(),
        locale: 'en',
      }),
    );
    const messages = view.getByTestId('assistant-messages').textContent ?? '';
    expect(messages).toContain('Hello, Anna!');
    expectNoCyrillic(messages, 'assistant greeting EN');
  });

  it('сотрудник «Мария Ковалёва» → «Hello, Maria!»', () => {
    const view = render(
      createElement(AssistantChat, {
        context: assistantContextFixture({
          role: 'STAFF',
          firstName: 'Мария',
          fullName: 'Мария Ковалёва',
          groupLabel: null,
        }),
        locale: 'en',
      }),
    );
    const messages = view.getByTestId('assistant-messages').textContent ?? '';
    expect(messages).toContain('Hello, Maria!');
    expectNoCyrillic(messages, 'assistant staff greeting EN');
  });

  it('RU байт-в-байт: «Здравствуйте, Анна!» по прежнему имени', async () => {
    localeState.locale = 'ru';
    const view = render(
      createElement(AssistantChat, { context: assistantContextFixture(), locale: 'ru' }),
    );
    const messages = view.getByTestId('assistant-messages').textContent ?? '';
    expect(messages).toContain('Здравствуйте, Анна!');
    expect(messages).not.toContain('Anna');
  });
});
