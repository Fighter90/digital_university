// DIG-23 — контракт страницы /schedule (виды «День», «Неделя»-заглушка,
// «Месяц», мобильная лента). SSR-пререндер с изолированным слоем данных
// (тот же подход, что tests/dashboard-page.test.tsx).
import { describe, expect, it, vi } from 'vitest';
import { createElement, type ComponentType } from 'react';
import { prerenderToNodeStream } from 'react-dom/static';

import { formatMonthTitle } from '@/lib/schedule-cards';
import { fromMoscowWallClock, moscowDateKey, moscowParts } from '@/lib/schedule-time';
import type { DataCtx, ScheduleEventRow } from '@/server/data/types';

const studentCtx: DataCtx = {
  userId: 'auth-anna',
  login: 'anna.smirnova',
  role: 'STUDENT',
  studentId: 'st-anna',
  groupName: 'ПИ-21',
  faculty: 'ИТ',
};

const staffCtx: DataCtx = { ...studentCtx, role: 'STAFF', studentId: null, groupName: null };

// «Сейчас» теста — реальная дата машины, но пары фиксируем относительно неё.
const now = new Date();
const p = moscowParts(now);
const today = fromMoscowWallClock(p.year, p.month, p.day, 10, 0);
const TOMORROW_ROW_ID = 'ev-tomorrow';

function rowsFixture(): ScheduleEventRow[] {
  const mk = (
    id: string,
    startsAt: Date,
    endsAt: Date,
    overrides: Partial<ScheduleEventRow> = {},
  ): ScheduleEventRow => ({
    id,
    groupName: 'ПИ-21',
    disciplineCode: 'PI21-INFO',
    disciplineName: 'Информатика',
    date: startsAt,
    startsAt,
    endsAt,
    kind: 'LECTURE',
    room: '301',
    teacherName: 'Петров Пётр Петрович',
    status: 'SCHEDULED',
    note: null,
    ...overrides,
  });
  return [
    mk('ev-lecture', today, new Date(today.getTime() + 90 * 60_000)),
    mk(
      'ev-moved',
      new Date(today.getTime() + 120 * 60_000),
      new Date(today.getTime() + 210 * 60_000),
      {
        kind: 'LAB',
        disciplineName: 'Программирование',
        room: '305',
        status: 'ROOM_CHANGED',
        previousRoom: '214',
        changeNote: 'Аудитория занята',
      },
    ),
    mk(
      'ev-cancelled',
      new Date(today.getTime() + 240 * 60_000),
      new Date(today.getTime() + 330 * 60_000),
      {
        kind: 'LAB',
        disciplineName: 'Физика',
        status: 'CANCELLED',
        note: 'Лаборатория закрыта',
      },
    ),
    mk(
      'ev-online',
      new Date(today.getTime() + 340 * 60_000),
      new Date(today.getTime() + 430 * 60_000),
      {
        kind: 'SEMINAR',
        disciplineName: 'История',
        room: 'Онлайн',
        teacherName: 'Орлов Олег Олегович',
      },
    ),
    mk(
      TOMORROW_ROW_ID,
      fromMoscowWallClock(p.year, p.month, p.day + 1, 12, 0),
      fromMoscowWallClock(p.year, p.month, p.day + 1, 13, 30),
      { status: 'ROOM_CHANGED', room: '405', previousRoom: '310' },
    ),
  ];
}

const state = vi.hoisted(() => ({
  ctx: null as unknown,
  schedule: { ok: true as boolean, rows: [] as ScheduleEventRow[] },
  month: { ok: true as boolean, rows: [] as ScheduleEventRow[] },
  nextStudy: null as { dateKey: string; label: string } | null,
}));

vi.mock('@/server/data/db', () => ({ dataDb: {} }));

vi.mock('@/server/data', () => ({
  requireDataCtx: vi.fn(async () => state.ctx),
  getSchedule: vi.fn(async () => {
    if (!state.schedule.ok) throw new Error('db down');
    return state.schedule.rows;
  }),
  getMonth: vi.fn(async () => {
    if (!state.month.ok) throw new Error('db down');
    return state.month.rows;
  }),
  getNextStudyDay: vi.fn(async () => state.nextStudy),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import SchedulePage from '@/app/(cabinet)/schedule/page';

async function renderPage(searchParams: Record<string, string> = {}): Promise<string> {
  const Page = SchedulePage as unknown as ComponentType<{
    searchParams?: Promise<Record<string, string>>;
  }>;
  const { prelude } = await prerenderToNodeStream(
    createElement(Page, { searchParams: Promise.resolve(searchParams) }),
  );
  let html = '';
  for await (const chunk of prelude) {
    html += String(chunk);
  }
  return html;
}

function seedStudent(options: { scheduleFail?: boolean; empty?: boolean } = {}) {
  state.ctx = studentCtx;
  state.schedule = { ok: !options.scheduleFail, rows: options.empty ? [] : rowsFixture() };
  state.month = { ok: true, rows: rowsFixture().slice(0, 2) };
  state.nextStudy = null;
}

describe('/schedule (DIG-23) — вид «День» по умолчанию', () => {
  it('сегодняшний день: заголовок, 4 карточки, перенос и отмена заметны', async () => {
    seedStudent();
    const html = await renderPage();
    expect(html).toContain('data-view="day"');
    expect(html).toContain('data-testid="desktop-day"');
    expect(html).toContain('data-testid="day-card-ev-lecture"');
    expect(html).toContain('data-testid="day-card-ev-moved"');
    expect(html).toContain('data-testid="day-card-ev-cancelled"');
    expect(html).toContain('data-testid="day-card-ev-online"');
    expect(html).toContain('Перенос');
    expect(html).toContain('было: ауд. 214');
    expect(html).toContain('Отмена');
    expect(html).toContain('Лаборатория закрыта');
    expect(html).toContain('line-through');
    expect(html).toContain('онлайн · Орлов Олег Олегович');
    expect(html).toContain('Программирование');
  });

  it('переключатель вида присутствует на десктопе и на мобильном, «Неделя» недоступна на десктопе', async () => {
    seedStudent();
    const html = await renderPage();
    expect(html).toContain('data-testid="view-switcher-desktop"');
    expect(html).toContain('data-testid="view-switcher-mobile"');
    const desktop = html.slice(html.indexOf('view-switcher-desktop'));
    expect(desktop).toContain('aria-disabled');
  });

  it('мобильный блок с лентой дат и свайп-списком рендерится всегда', async () => {
    seedStudent();
    const html = await renderPage();
    expect(html).toContain('data-testid="date-ribbon"');
    expect(html).toContain('data-testid="mobile-day-list"');
    expect(html).toContain(`data-testid="ribbon-item-${moscowDateKey(now)}"`);
  });
});

describe('/schedule — вид «Месяц»', () => {
  it('сетка месяца: ячейки-ссылки на день, сегодня выделено', async () => {
    seedStudent();
    const html = await renderPage({ view: 'month' });
    expect(html).toContain('data-view="month"');
    expect(html).toContain('data-testid="month-grid"');
    expect(html).toContain(`data-testid="month-cell-${moscowDateKey(now)}"`);
    expect(html).toContain('data-today="true"');
    expect(html).toContain(`href="/schedule?view=day&amp;date=${moscowDateKey(now)}"`);
    expect(html).toContain(formatMonthTitle(moscowParts(now).year, moscowParts(now).month));
  });

  it('в ячейке today есть цветные точки пар', async () => {
    seedStudent();
    const html = await renderPage({ view: 'month' });
    const cell = html.slice(html.indexOf(`data-testid="month-cell-${moscowDateKey(now)}"`));
    expect(cell).toMatch(/month-dot/);
  });
});

describe('/schedule — вид «Неделя» (заглушка до DIG-22)', () => {
  it('на десктопе честная заглушка, мобильный компактный список работает', async () => {
    seedStudent();
    const html = await renderPage({ view: 'week' });
    expect(html).toContain('data-view="week"');
    expect(html).toContain('Вид «Неделя» готовится');
    expect(html).toContain('data-testid="mobile-week-list"');
  });
});

describe('/schedule — параметры URL не верят на слово', () => {
  it('мусорный view и date откатываются к «день/сегодня» без падения', async () => {
    seedStudent();
    const html = await renderPage({ view: 'year', date: 'junk', month: 'junk' });
    expect(html).toContain('data-view="day"');
    expect(html).toContain('data-testid="desktop-day"');
  });

  it('мусорный month откатывается к текущему месяцу', async () => {
    seedStudent();
    const html = await renderPage({ view: 'month', month: 'junk' });
    expect(html).toContain('data-view="month"');
    expect(html).toContain('data-testid="month-grid"');
  });

  it('ошибка слоя данных — ErrorState, а не падение страницы', async () => {
    seedStudent({ scheduleFail: true });
    const html = await renderPage();
    expect(html).toContain('Расписание не загрузилось');
  });
});

describe('/schedule — доступ по роли', () => {
  it('сотруднику деканата студенческое расписание не показывается', async () => {
    state.ctx = staffCtx;
    state.schedule = { ok: true, rows: [] };
    state.month = { ok: true, rows: [] };
    state.nextStudy = null;
    const html = await renderPage();
    expect(html).toContain('Расписание доступно студентам');
    expect(html).not.toContain('data-testid="day-card-ev-lecture"');
  });
});
