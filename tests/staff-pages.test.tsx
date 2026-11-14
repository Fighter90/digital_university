// DIG-48 — контракт страниц кабинета сотрудника (SSR-рендер, слой данных
// замокан). Очередь (фильтры, SLA-подсветка, «Взять в работу»), карточка
// (только разрешённые переходы, причина, PDF), сводка, обращения (чат,
// шаблоны, «Решено»), объявления (форма, предпросмотр, список).
import { describe, expect, it, vi } from 'vitest';
import { createElement, type ComponentType, type ReactElement } from 'react';
import { prerenderToNodeStream } from 'react-dom/static';

import type {
  AppealMessageRow,
  AppealRow,
  AnnouncementRow,
  DataCtx,
  RequestEventRow,
  ServiceRequestRow,
  StudentRow,
} from '@/server/data/types';

const staffCtx: DataCtx = {
  userId: 'auth-dean',
  login: 'dean.kovaleva',
  role: 'STAFF',
  studentId: null,
  groupName: null,
  faculty: 'ИТ',
};

const anna: StudentRow = {
  id: 'st-anna',
  login: 'anna.smirnova',
  fullName: 'Анна Ковалёва',
  email: 'anna.kovaleva@example.edu',
  groupName: 'ПИ-21',
  course: 2,
  faculty: 'ИТ',
  program: 'Прикладная информатика',
  programCode: '09.03.04',
  studyForm: 'очная',
  funding: 'бюджет',
  gradebookNumber: '20231234',
};

function request(overrides: Partial<ServiceRequestRow> = {}): ServiceRequestRow {
  const createdAt = new Date('2026-11-10T10:15:00');
  return {
    id: 'req-anna-4',
    studentId: 'st-anna',
    number: 'SR-2026-K9L8M',
    type: 'CERTIFICATE',
    title: 'Справка для военкомата',
    status: 'SUBMITTED',
    assignee: null,
    resultNote: null,
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

function event(overrides: Partial<RequestEventRow> = {}): RequestEventRow {
  return {
    id: 'evt-1',
    requestId: 'req-anna-4',
    actorRole: 'STUDENT',
    actorName: 'Анна Ковалёва',
    statusFrom: null,
    statusTo: 'SUBMITTED',
    message: 'Заявка подана через личный кабинет',
    createdAt: new Date('2026-11-10T10:15:00'),
    ...overrides,
  };
}

const state = vi.hoisted(() => ({
  ctx: null as unknown,
  queue: [] as Array<{ request: ServiceRequestRow; student: StudentRow }>,
  detail: null as unknown,
  appeals: [] as Array<{ appeal: AppealRow; student: StudentRow; lastAt: Date }>,
  thread: null as unknown,
  announcements: [] as AnnouncementRow[],
  groups: [] as string[],
  summary: null as unknown,
}));

vi.mock('@/server/data/db', () => ({ dataDb: {} }));

vi.mock('@/server/data', () => ({
  requireDataCtx: vi.fn(async () => state.ctx),
  getStaffSummaryData: vi.fn(async () => state.summary),
  getStaffQueue: vi.fn(async () => state.queue),
  getStaffRequestDetail: vi.fn(async () => state.detail),
  getStaffAppeals: vi.fn(async () => state.appeals),
  getStaffAppealThread: vi.fn(async () => state.thread),
  listStaffAnnouncements: vi.fn(async () => state.announcements),
  listFacultyGroups: vi.fn(async () => state.groups),
  normalizeRequestNumber: (value: string) => value.trim(),
  changeStaffRequestStatus: vi.fn(),
  answerStaffAppeal: vi.fn(),
  resolveStaffAppeal: vi.fn(),
  createStaffAnnouncement: vi.fn(),
}));

import StaffSummaryPage from '@/app/(cabinet)/staff/page';
import StaffQueuePage from '@/app/(cabinet)/staff/requests/page';
import StaffRequestCardPage from '@/app/(cabinet)/staff/requests/[number]/page';
import StaffAppealsPage from '@/app/(cabinet)/staff/appeals/page';
import StaffAppealThreadPage from '@/app/(cabinet)/staff/appeals/[id]/page';
import StaffAnnouncementsPage from '@/app/(cabinet)/staff/announcements/page';

const DAY = 24 * 60 * 60 * 1000;

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

async function renderPageNoProps(Page: () => Promise<ReactElement>): Promise<string> {
  return renderPage(Page, {});
}

beforeEachState();

function beforeEachState() {
  state.ctx = staffCtx;
}

// ── Сводка /staff ───────────────────────────────────────────────────────────

/** Сырые данные getStaffSummaryData, из которых сводка считает метрики. */
function summaryDataFixture(now: Date) {
  const created = (offsetDays: number) => new Date(now.getTime() - offsetDays * DAY);
  const requests = [
    request({
      id: 'today-1',
      number: 'SR-2026-TODAY',
      type: 'STATEMENT',
      createdAt: new Date(now.getTime() - 3600000),
    }),
    request({ id: 'old-1', number: 'SR-2026-OLDONE', createdAt: created(9) }),
    request({ id: 'done-1', number: 'SR-2026-DONEIT', status: 'COMPLETED', createdAt: created(9) }),
    request({
      id: 'wip-1',
      number: 'SR-2026-WORKIT',
      status: 'IN_PROGRESS',
      type: 'PRACTICE',
      createdAt: created(2),
    }),
  ];
  const eventsByRequestId: Record<string, RequestEventRow[]> = {
    'done-1': [
      { ...event({ requestId: 'done-1' }), actorRole: 'STUDENT', createdAt: created(9) },
      {
        ...event({ requestId: 'done-1' }),
        actorRole: 'STAFF',
        actorName: 'Мария Петрова',
        createdAt: new Date(created(9).getTime() + 20 * 3600000),
      },
    ],
    'wip-1': [
      { ...event({ requestId: 'wip-1' }), actorRole: 'STUDENT', createdAt: created(2) },
      {
        ...event({ requestId: 'wip-1' }),
        actorRole: 'STAFF',
        actorName: 'Мария Петрова',
        createdAt: new Date(created(2).getTime() + 4 * 3600000),
      },
    ],
  };
  const appeals: AppealRow[] = [
    { id: 'apl-1', studentId: 'st-anna', subject: 'Вопрос', status: 'OPEN', createdAt: created(1) },
    {
      id: 'apl-2',
      studentId: 'st-anna',
      subject: 'Вопрос',
      status: 'ANSWERED',
      createdAt: created(2),
    },
    {
      id: 'apl-3',
      studentId: 'st-anna',
      subject: 'Вопрос',
      status: 'CLOSED',
      createdAt: created(3),
    },
  ];
  return { requests, eventsByRequestId, appeals };
}

describe('страница /staff — сводка', () => {
  it('показывает метрики: заявок сегодня, среднее время ответа, просрочено', async () => {
    const now = new Date('2026-11-14T15:00:00');
    state.summary = summaryDataFixture(now);

    const html = await renderPageNoProps(StaffSummaryPage);
    expect(html).toContain('Сводка деканата');
    const today = html.match(/data-testid="staff-metric-today"[\s\S]*?<\/div>/)![0];
    expect(today).toMatch(/Заявок сегодня/);
    expect(today).toMatch(/>\s*1\s*</);
    const avg = html.match(/data-testid="staff-metric-avg"[\s\S]*?<\/div>/)![0];
    expect(avg).toContain('12 ч');
    const overdue = html.match(/data-testid="staff-metric-overdue"[\s\S]*?<\/div>/)![0];
    expect(overdue).toMatch(/Просрочено/);
    expect(html).toContain('href="/staff/requests?due=overdue"');
    expect(html).toContain('href="/staff/appeals"');
  });

  it('прочерк вместо среднего времени, когда данных нет', async () => {
    state.summary = { requests: [], eventsByRequestId: {}, appeals: [] };

    const html = await renderPageNoProps(StaffSummaryPage);
    const avg = html.match(/data-testid="staff-metric-avg"[\s\S]*?<\/div>/)![0];
    expect(avg).toContain('—');
    expect(html).toContain('Пока нет открытых заявок');
  });
});

function initState() {
  state.ctx = staffCtx;
}

initState();
// ── Очередь /staff/requests ─────────────────────────────────────────────────

function queueFixture() {
  const overdue = request(); // CERTIFICATE от 10-го, SLA 3 дн → просрочена 13-го
  const fresh = request({
    id: 'req-anna-5',
    number: 'SR-2026-N4P5Q',
    type: 'STATEMENT',
    title: 'Заявление на перезачёт',
    status: 'IN_PROGRESS',
    assignee: 'Мария Петрова',
    createdAt: new Date('2026-11-14T09:40:00'),
  });
  return [
    { request: overdue, student: anna },
    { request: fresh, student: anna },
  ];
}

describe('страница /staff/requests — очередь', () => {
  it('группировка по статусам, SLA-подсветка просроченной, «Взять в работу»', async () => {
    state.queue = queueFixture();
    const html = await renderPage(StaffQueuePage, {
      searchParams: Promise.resolve({}),
    });
    expect(html).toContain('data-testid="staff-queue"');
    expect(html).toContain('Просрочено');
    expect(html).toContain('data-testid="sla-overdue-SR-2026-K9L8M"');
    expect(html).toContain('Анна Ковалёва');
    expect(html).toContain('ПИ-21');
    // Взять в работу — форма с номером и целевым статусом.
    const form = html.match(/<form[^>]*data-testid="take-SR-2026-K9L8M"[\s\S]*?<\/form>/)![0];
    expect(form).toContain('name="number" value="SR-2026-K9L8M"');
    expect(form).toContain('value="IN_PROGRESS"');
    expect(form).toContain('Взять в работу');
    // Для уже взятой кнопки «Взять в работу» нет.
    expect(html).not.toContain('data-testid="take-SR-2026-N4P5Q"');
  });

  it('фильтры: форма по типу и срока, выбранное сохраняется', async () => {
    state.queue = queueFixture();
    const html = await renderPage(StaffQueuePage, {
      searchParams: Promise.resolve({ type: 'CERTIFICATE', due: 'overdue' }),
    });
    expect(html).toContain('action="/staff/requests"');
    const typeSelect = html.match(/<select[^>]*name="type"[\s\S]*?<\/select>/)![0];
    expect(typeSelect).toMatch(/<option[^>]*value="CERTIFICATE"[^>]*selected/);
    const dueRadioTag = html.match(/<input[^>]*value="overdue"[^>]*>/)![0];
    expect(dueRadioTag).toMatch(/checked/);
    expect(html).toContain('Просроченные');
  });

  it('фильтр overdue скрывает не-просроченные заявки', async () => {
    state.queue = queueFixture();
    const html = await renderPage(StaffQueuePage, {
      searchParams: Promise.resolve({ due: 'overdue' }),
    });
    expect(html).toContain('SR-2026-K9L8M');
    expect(html).not.toContain('SR-2026-N4P5Q');
  });

  it('пустая очередь после фильтра — нейтральное состояние', async () => {
    state.queue = [];
    const html = await renderPage(StaffQueuePage, {
      searchParams: Promise.resolve({}),
    });
    expect(html).toContain('Заявок по фильтру нет');
  });
});

// ── Карточка /staff/requests/[number] ───────────────────────────────────────

describe('страница карточки сотрудника', () => {
  it('данные студента и параметры, только разрешённые переходы для SUBMITTED', async () => {
    state.detail = {
      request: request(),
      student: anna,
      events: [event()],
      contacts: { email: anna.email, phone: '+7 900 010-20-30' },
    };
    const html = await renderPage(StaffRequestCardPage, {
      params: Promise.resolve({ number: 'SR-2026-K9L8M' }),
    });
    expect(html).toContain('Анна Ковалёва');
    expect(html).toContain('ПИ-21');
    expect(html).toContain('20231234');
    expect(html).toContain('Прикладная информатика');
    expect(html).toContain('Справка для военкомата');
    // Переходы SUBMITTED: в работу / доработка / отказ; COMPLETED нет.
    expect(html).toContain('value="IN_PROGRESS"');
    expect(html).toContain('value="NEEDS_REVISION"');
    expect(html).toContain('value="REJECTED"');
    expect(html).not.toContain('value="COMPLETED"');
    // PDF недоступен: заявка не выполнена.
    expect(html).not.toContain('/api/staff/requests/SR-2026-K9L8M/certificate');
    expect(html).toContain('История заявки');
  });

  it('COMPLETED + CERTIFICATE: PDF-кнопка, переходов нет', async () => {
    state.detail = {
      request: request({ status: 'COMPLETED', assignee: 'Мария Петрова', resultNote: 'Готова' }),
      student: anna,
      events: [event()],
      contacts: { email: anna.email, phone: null },
    };
    const html = await renderPage(StaffRequestCardPage, {
      params: Promise.resolve({ number: 'SR-2026-K9L8M' }),
    });
    expect(html).toContain('/api/staff/requests/SR-2026-K9L8M/certificate');
    expect(html).toContain('Сформировать PDF');
    expect(html).not.toContain('value="REJECTED"');
  });

  it('NEEDS_REVISION: причина обязательна (textarea required), в работу и отказ доступны', async () => {
    state.detail = {
      request: request({
        status: 'NEEDS_REVISION',
        resultNote: 'Приложите договор о практике',
      }),
      student: anna,
      events: [event()],
      contacts: { email: null, phone: null },
    };
    const html = await renderPage(StaffRequestCardPage, {
      params: Promise.resolve({ number: 'SR-2026-K9L8M' }),
    });
    const form = html.match(/<form[^>]*data-testid="status-form"[\s\S]*?<\/form>/)![0];
    expect(form).toMatch(/<textarea[^>]*name="reason"[\s\S]*?required/);
    expect(form).toContain('value="IN_PROGRESS"');
    expect(form).toContain('value="REJECTED"');
    expect(form).not.toContain('value="NEEDS_REVISION"');
  });

  it('несуществующий номер — notFound (пустой рендер недоступен, бросаем)', async () => {
    state.detail = null;
    await expect(
      renderPage(StaffRequestCardPage, { params: Promise.resolve({ number: 'SR-2026-XXXXX' }) }),
    ).rejects.toThrow();
  });
});

// ── Обращения ───────────────────────────────────────────────────────────────

describe('страницы обращений сотрудника', () => {
  it('список: тема, студент, статус, ссылка на чат', async () => {
    state.appeals = [
      {
        appeal: {
          id: 'apl-anna-1',
          studentId: 'st-anna',
          subject: 'Вопрос по зачёту по физкультуре',
          status: 'OPEN',
          createdAt: new Date('2026-11-12T19:00:00'),
        },
        student: anna,
        lastAt: new Date('2026-11-12T19:00:00'),
      },
    ];
    const html = await renderPageNoProps(StaffAppealsPage);
    expect(html).toContain('Обращения студентов');
    expect(html).toContain('Вопрос по зачёту по физкультуре');
    expect(html).toContain('Анна Ковалёва');
    expect(html).toContain('href="/staff/appeals/apl-anna-1"');
    expect(html).toContain('Новое');
  });

  it('чат: сообщения, шаблоны ответов, обязательный текст, «Решено»', async () => {
    const messages: AppealMessageRow[] = [
      {
        id: 'msg-anna-1a',
        appealId: 'apl-anna-1',
        authorRole: 'STUDENT',
        authorName: 'Анна Ковалёва',
        body: 'Здравствуйте! Зачли ли зачёт?',
        createdAt: new Date('2026-11-12T19:00:00'),
      },
    ];
    state.thread = {
      appeal: {
        id: 'apl-anna-1',
        studentId: 'st-anna',
        subject: 'Вопрос по зачёту по физкультуре',
        status: 'OPEN',
        createdAt: new Date('2026-11-12T19:00:00'),
      },
      student: anna,
      messages,
    };
    const html = await renderPage(StaffAppealThreadPage, {
      params: Promise.resolve({ id: 'apl-anna-1' }),
    });
    expect(html).toContain('Здравствуйте! Зачли ли зачёт?');
    // Шаблоны ответов: минимум три кнопки с текстом.
    const templates = html.match(/data-testid="template-[a-z-]+"/g) ?? [];
    expect(templates.length).toBeGreaterThanOrEqual(3);
    const form = html.match(/<form[^>]*data-testid="appeal-reply-form"[\s\S]*?<\/form>/)![0];
    expect(form).toMatch(/<textarea[^>]*name="body"[\s\S]*?required/);
    expect(form).toContain('name="appealId" value="apl-anna-1"');
    expect(html).toContain('Решено');
  });

  it('закрытое обращение — только чтение (формы нет)', async () => {
    state.thread = {
      appeal: {
        id: 'apl-anna-1',
        studentId: 'st-anna',
        subject: 'Вопрос',
        status: 'CLOSED',
        createdAt: new Date('2026-11-12T19:00:00'),
      },
      student: anna,
      messages: [],
    };
    const html = await renderPage(StaffAppealThreadPage, {
      params: Promise.resolve({ id: 'apl-anna-1' }),
    });
    expect(html).toContain('Обращение решено и закрыто');
    expect(html).not.toContain('data-testid="appeal-reply-form"');
  });
});

// ── Объявления ──────────────────────────────────────────────────────────────

describe('страница /staff/announcements', () => {
  it('форма: аудитория (факультет/группа), группы факультета, заголовок, текст, предпросмотр', async () => {
    state.groups = ['ПИ-21'];
    state.announcements = [];
    const html = await renderPageNoProps(StaffAnnouncementsPage);
    const form = html.match(/<form[^>]*data-testid="announcement-form"[\s\S]*?<\/form>/)![0];
    expect(form).toContain('name="scope"');
    expect(form).toContain('value="FACULTY"');
    expect(form).toContain('value="GROUP"');
    expect(form).toMatch(/<select[^>]*name="groupName"/);
    expect(form).toMatch(/<option[^>]*value="ПИ-21"/);
    expect(form).toMatch(/<input[^>]*name="title"[\s\S]*?required/);
    expect(form).toMatch(/<textarea[^>]*name="body"[\s\S]*?required/);
    // Предпросмотр живёт в клиентском компоненте с этим контейнером.
    expect(html).toContain('data-testid="announcement-preview"');
  });

  it('список опубликованных с аудиторией и автором', async () => {
    state.groups = ['ПИ-21'];
    state.announcements = [
      {
        id: 'ann-1',
        faculty: 'ИТ',
        groupName: 'ПИ-21',
        title: 'Собрание группы ПИ-21',
        body: 'Завтра в 10:00, ауд. 305.',
        authorLogin: 'dean.kovaleva',
        authorName: 'Мария Петрова',
        createdAt: new Date('2026-11-14T09:00:00'),
      },
    ];
    const html = await renderPageNoProps(StaffAnnouncementsPage);
    expect(html).toContain('Собрание группы ПИ-21');
    expect(html).toContain('группа ПИ-21');
    expect(html).toContain('Мария Петрова');
  });
});
