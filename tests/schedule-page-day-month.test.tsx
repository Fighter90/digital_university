// DIG-23 — контракт страницы /schedule (виды «День», «Неделя» (сетка DIG-22),
// «Месяц», мобильная лента). SSR-пререндер с изолированным слоем данных
// (тот же подход, что tests/dashboard-page.test.tsx).
//
// Дефолт без ?view= — платформозависимый: десктоп открывает недельную сетку
// (data-view="auto", класс week-grid), мобильный — «сегодня» с лентой дат.
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
  useSearchParams: () => new URLSearchParams(),
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

describe('/schedule (DIG-23) — без ?view= (auto: десктоп-неделя, мобильный-день)', () => {
  it('десктоп показывает недельную сетку DIG-22, мобильный — ленту дат и пары «сегодня»', async () => {
    seedStudent();
    const html = await renderPage();
    expect(html).toContain('data-view="auto"');
    // десктоп: недельная сетка DIG-22 с тулбаром
    expect(html).toContain('data-testid="week-grid"');
    expect(html).toContain('Синхронизировать');
    // мобильный: лента дат, выбранный день — сегодня, карточки пар
    expect(html).toContain('data-testid="date-ribbon"');
    expect(html).toContain(`data-testid="ribbon-item-${moscowDateKey(now)}"`);
    expect(html).toContain('data-testid="day-card-ev-lecture"');
    expect(html).toContain('data-testid="day-card-ev-moved"');
    expect(html).toContain('data-testid="day-card-ev-cancelled"');
    expect(html).toContain('data-testid="day-card-ev-online"');
    expect(html).toContain('Перенос');
    expect(html).toContain('было: ауд. 214');
    expect(html).toContain('Отмена');
    expect(html).toContain('Лаборатория закрыта');
    expect(html).toContain('line-through');
    expect(html).not.toContain('Мобильная версия расписания');
  });

  it('переключатели вида на обоих брейкпоинтах: десктоп отмечает «Неделя», мобильный — «День»', async () => {
    seedStudent();
    const html = await renderPage();
    expect(html).toContain('data-testid="view-switcher-desktop"');
    expect(html).toContain('data-testid="view-switcher-mobile"');
    const desktop = html.slice(html.indexOf('view-switcher-desktop'));
    expect(desktop).toMatch(
      /aria-checked="true"[^>]*>\s*Неделя|Неделя[\s\S]{0,80}aria-checked="true"/,
    );
    const mobile = html.slice(html.indexOf('view-switcher-mobile'));
    expect(mobile).toMatch(/aria-checked="true"[^>]*>\s*День|День[\s\S]{0,80}aria-checked="true"/);
    // маркер гидрации в SSR — "false"; клиент выставит "true" после mount
    expect(html).toContain('data-hydrated="false"');
  });
});

describe('/schedule (DIG-23) — вид «День» (?view=day)', () => {
  it('сегодняшний день: заголовок, 4 карточки, перенос и отмена заметны', async () => {
    seedStudent();
    const html = await renderPage({ view: 'day' });
    expect(html).toContain('data-view="day"');
    expect(html).toContain('data-testid="desktop-day"');
    expect(html).toContain('data-testid="day-card-ev-lecture"');
    expect(html).toContain('data-testid="day-card-ev-moved"');
    expect(html).toContain('data-testid="day-card-ev-cancelled"');
    expect(html).toContain('data-testid="day-card-ev-online"');
    expect(html).toContain('онлайн · Орлов Олег Олегович');
    expect(html).toContain('Программирование');
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

describe('/schedule — вид «Неделя» (?view=week)', () => {
  it('десктоп — недельная сетка DIG-22, мобильный — компактный список по дням', async () => {
    seedStudent();
    const html = await renderPage({ view: 'week' });
    expect(html).toContain('data-view="week"');
    expect(html).toContain('data-testid="week-grid"');
    expect(html).toContain('data-testid="mobile-week-list"');
  });
});

describe('/schedule — параметры URL не верят на слово', () => {
  it('мусорный view и date откатываются к auto (десктоп — неделя) без падения', async () => {
    seedStudent();
    const html = await renderPage({ view: 'year', date: 'junk', month: 'junk' });
    expect(html).toContain('data-view="auto"');
    expect(html).toContain('data-testid="week-grid"');
    expect(html).toContain('data-testid="date-ribbon"');
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
