// DIG-22 — render-контракт экрана «Расписание: неделя» (unit, SSR).
// Страница — серверный компонент: resolveWeekPage парсит ?week=, клампит по
// границам семестра, getSchedule отдаёт пары недели; клиентский WeekView
// рисует тулбар, мини-календарь, фильтры и сетку 08:00–20:00. Проверяем
// SSR-HTML: тулбар («Сегодня», ‹ ›, подпись недели, День/Неделя/Месяц,
// «Синхронизировать»), блоки пар с aria-label, перенос (штриховка/пунктир/
// «было: ауд. 214»), отмена (зачёркнутый заголовок, «Отменена»), деление
// ширины при пересечении, мини-календарь, фильтры и мобильная заглушка.
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement, type ComponentType } from 'react';
import { prerenderToNodeStream } from 'react-dom/static';

import {
  fromMoscowWallClock,
  moscowDateKey,
  pageMoscowWeek,
  semesterBounds,
  shiftMoscowDays,
  startOfMoscowWeek,
} from '@/lib/schedule-time';
import { isoWeekKeyOf } from '@/lib/schedule-view';
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

/** Понедельник текущей (реальной «сегодня») недели. */
const monday = startOfMoscowWeek(new Date());
const day = (offset: number, hour: number, minute = 0): Date => {
  const date = shiftMoscowDays(monday, offset);
  const [y, m, d] = moscowDateKey(date).split('-').map(Number);
  return fromMoscowWallClock(y!, m!, d!, hour, minute);
};

const mk = (
  id: string,
  dayOffset: number,
  startH: number,
  startM: number,
  over: Partial<ScheduleEventRow> = {},
): ScheduleEventRow => {
  const startsAt = day(dayOffset, startH, startM);
  return {
    id,
    groupName: 'ПИ-21',
    disciplineCode: 'PI21-MATH',
    disciplineName: 'Математический анализ',
    date: shiftMoscowDays(monday, dayOffset),
    startsAt,
    endsAt: new Date(startsAt.getTime() + 90 * 60_000),
    kind: 'SEMINAR',
    room: '305',
    teacherName: 'Кузнецова Ксения Кирилловна',
    status: 'SCHEDULED',
    note: null,
    ...over,
  };
};

/** Фикстура недели: перенос (пн), отмена (вт), пересечение (ср: две пары). */
const weekRows: ScheduleEventRow[] = [
  mk('w-lecture', 0, 10, 0, { kind: 'LECTURE', disciplineName: 'Информатика' }),
  mk('w-moved', 0, 12, 0, {
    kind: 'LAB',
    disciplineName: 'Программирование',
    status: 'ROOM_CHANGED',
    room: '305',
    previousRoom: '214',
    previousStartsAt: day(0, 12, 0),
    changeNote: 'Оснащение аудитории',
  }),
  mk('w-cancelled', 1, 14, 0, {
    kind: 'LAB',
    disciplineName: 'Физика',
    status: 'CANCELLED',
    note: 'Лаборатория закрыта',
  }),
  mk('w-ov-a', 2, 10, 0, { disciplineName: 'Математический анализ' }),
  mk('w-ov-b', 2, 10, 30, { disciplineName: 'Экономика', room: '18' }),
  mk('w-later', 2, 14, 0),
];

vi.mock('@/server/auth/session', () => ({
  getAuthSession: vi.fn(async () => null),
  requireUser: vi.fn(async () => ({
    id: 'auth-anna',
    login: 'anna.smirnova',
    role: 'STUDENT' as const,
  })),
  requireStaff: vi.fn(async () => ({ id: 'x', login: 'x', role: 'STAFF' as const })),
}));

vi.mock('@/server/data/db', () => ({ dataDb: {} }));

// В юнит-прендере нет App Router — отдаём стаб роутера (поведение листания
// без перезагрузки проверяет e2e schedule.spec на реальном сервере).
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/schedule',
}));

vi.mock('@/server/data', async () => {
  const actualTypes = await import('@/server/data/types');
  return {
    requireDataCtx: vi.fn(async () => studentCtx),
    getSchedule: vi.fn(async () => weekRows),
    // schedule/page.tsx импортирует только эти имена из barrel
    __types: actualTypes,
  };
});

import SchedulePage from '@/app/(cabinet)/schedule/page';

async function renderPage(searchParams: Record<string, string> = {}): Promise<string> {
  const Page = SchedulePage as unknown as ComponentType<{
    searchParams: Promise<Record<string, string>>;
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

const thisWeekKey = isoWeekKeyOf(monday);
const prevWeekKey = isoWeekKeyOf(shiftMoscowDays(monday, -7));
const nextWeekKey = isoWeekKeyOf(shiftMoscowDays(monday, 7));

describe('/schedule (DIG-22) — неделя в стиле Google Calendar', () => {
  it('тулбар: «Сегодня», ‹ › с href соседних недель, подпись недели, День/Неделя/Месяц, «Синхронизировать»', async () => {
    const html = await renderPage();
    expect(html).toContain('Сегодня');
    expect(html).toContain('aria-label="Предыдущая неделя"');
    expect(html).toContain('aria-label="Следующая неделя"');
    expect(html).toContain(`week=${prevWeekKey}`);
    expect(html).toContain(`week=${nextWeekKey}`);
    expect(html).toContain('Синхронизировать');
    expect(html).toMatch(/role="radiogroup"/);
    expect(html).toContain('День');
    expect(html).toContain('Неделя');
    expect(html).toContain('Месяц');
    // Неделя выбрана, День и Месяц пока недоступны (десктоп-день/месяц вне DIG-22)
    expect(html).toMatch(
      /aria-checked="true"[^>]*>\s*Неделя|Неделя[\s\S]{0,80}aria-checked="true"/,
    );
    expect(html).toMatch(/aria-disabled="true"/);
    // «Сегодня» — ссылка со стилями кнопки, без вложенного <button>
    // (button внутри <a> — невалидная вложенность интерактива, ревью раунд 2)
    const todayLink = html.match(
      /<a\b[^>]*aria-label="Перейти к текущей неделе"[\s\S]*?<\/a>/,
    )?.[0];
    expect(todayLink, 'anchor «Сегодня» not found').toBeTruthy();
    expect(todayLink).not.toContain('<button');
    expect(todayLink).toMatch(/btn-secondary/);
    // ...и вообще на странице нет <a>, содержащего <button> (нет др. мест)
    for (const anchor of html.match(/<a\b[\s\S]*?<\/a>/g) ?? []) {
      expect(anchor).not.toContain('<button');
    }
  });

  it('сетка: часы 08:00–19:00, сегодня тонирован, красная линия по mount (client-only)', async () => {
    const html = await renderPage();
    expect(html).toContain('data-testid="week-grid"');
    expect(html).toContain('>08:00<');
    expect(html).toContain('>19:00<');
    const todayKey = moscowDateKey(new Date());
    expect(html).toContain(`data-today="true"`);
    expect(html).toContain(todayKey);
    // Красная линия рисуется после mount (нет SSR-мисматча): контейнер есть, линия — нет
    expect(html).not.toContain('data-testid="now-line"');
  });

  it('блоки пар — кнопки с понятным aria-label (тип, дисциплина, время, аудитория, статус)', async () => {
    const html = await renderPage();
    expect(html).toContain('aria-label="Лекция, Информатика, 10:00–11:30, ауд. 305"');
    expect(html).toContain(
      'aria-label="Лабораторная, Программирование, 12:00–13:30, ауд. 305, перенос"',
    );
    expect(html).toContain('aria-label="Лабораторная, Физика, 14:00–15:30, ауд. 305, отменена"');
  });

  it('перенос: штриховка, пунктирная рамка, бейдж «Перенос», «было: ауд. 214 / 12:00» (один префикс)', async () => {
    const html = await renderPage();
    expect(html).toMatch(/repeating-linear-gradient/); // серая штриховка
    expect(html).toMatch(/data-status="moved"/);
    expect(html).toMatch(/border-dashed/);
    expect(html).toContain('Перенос');
    expect(html).toContain('было: ауд. 214');
    // один префикс на обе части: «было: ауд. 214 / 12:00»
    // (не «было: ауд. 214 / было: 12:00») — ревью раунд 2
    expect(html).toContain('было: ауд. 214 / 12:00');
    expect(html).not.toContain('было: ауд. 214 / было:');
    expect(html).toContain('Оснащение аудитории');
  });

  it('отмена: зачёркнутый заголовок, бледный блок, бейдж «Отменена», причина', async () => {
    const html = await renderPage();
    expect(html).toMatch(/data-status="cancelled"/);
    expect(html).toMatch(/line-through/);
    expect(html).toContain('Отменена');
    expect(html).toContain('Лаборатория закрыта');
  });

  it('пересекающиеся пары делят ширину колонки (50% / 50%), соседняя — на всю (100%)', async () => {
    const html = await renderPage();
    expect(html).toMatch(/width:50%/);
    expect(html).toMatch(/width:100%/);
  });

  it('левая колонка: мини-календарь с сегодняшним днём, фильтры типов со счётчиками, фильтр преподавателя', async () => {
    const html = await renderPage();
    expect(html).toContain('data-testid="mini-calendar"');
    expect(html).toMatch(/data-today="true"/);
    // фильтры по типам с цветными чекбоксами и счётчиками
    expect(html).toMatch(/type="checkbox"/);
    expect(html).toContain('Лекция');
    expect(html).toContain('Семинар');
    expect(html).toContain('Лабораторная');
    expect(html).toContain('data-count="2"'); // 2 лабораторные в фикстуре
    // фильтр по преподавателю
    expect(html).toContain('data-testid="teacher-filter"');
    expect(html).toContain('Кузнецова Ксения Кирилловна');
  });

  it('URL: ?week= валиден — рендерится именно эта неделя (ключ в данных стрелок и атрибутах)', async () => {
    const html = await renderPage({ week: nextWeekKey });
    expect(html).toContain(`week=${isoWeekKeyOf(shiftMoscowDays(monday, 14))}`);
  });

  it('мусорный ?week= — фолбэк на текущую неделю (без редиректа и краша)', async () => {
    const html = await renderPage({ week: 'banana' });
    expect(html).toContain('data-testid="week-grid"');
    expect(html).toContain('aria-label="Лекция, Информатика, 10:00–11:30, ауд. 305"');
  });

  it('неделя за пределами семестра (?week=2027-W30) — фолбэк: рендерится неделя «сейчас» (без редиректа)', async () => {
    const html = await renderPage({ week: '2027-W30' });
    expect(html).toContain('data-testid="week-grid"');
    // именно неделя «сейчас», а не кламп к границе семестра (спека, ревью раунд 2)
    expect(html).toContain(`data-week-key="${thisWeekKey}"`);
    expect(html).toContain('aria-label="Лекция, Информатика, 10:00–11:30, ауд. 305"');
  });

  it('первая неделя семестра: страница клампится к дате начала семестра, стрелка ‹ отключена', async () => {
    const bounds = semesterBounds(new Date());
    const firstPage = pageMoscowWeek(startOfMoscowWeek(bounds.start), 0, bounds);
    // «сейчас» может оказаться вне семестра (июль/август) — сценарий вне-семестровой заглушки
    if (!firstPage) return;
    const key = isoWeekKeyOf(firstPage.from);
    const html = await renderPage({ week: key });
    // кламп: страница начинается с даты начала семестра (тот же ключ недели)
    expect(html).toContain(`data-week-key="${key}"`);
    // предыдущей недели нет — «Предыдущая неделя» отключена
    expect(html).toMatch(/<button[^>]*aria-label="Предыдущая неделя"[^>]*aria-disabled="true"/);
    // а следующая доступна
    const next = pageMoscowWeek(firstPage.from, 1, bounds);
    expect(next).not.toBeNull();
    expect(html).toContain(`week=${isoWeekKeyOf(next!.from)}`);
    expect(html).not.toMatch(/<button[^>]*aria-label="Следующая неделя"[^>]*aria-disabled="true"/);
  });

  it('клик по паре открывает боковую панель деталей (контракт клиента — исходник WeekView)', () => {
    // Поведенческое покрытие — e2e schedule.spec; здесь — контракт исходника.
    const source = readFileSync(
      resolve(import.meta.dirname, '../src/components/schedule/week-view.tsx'),
      'utf8',
    );
    expect(source).toMatch(/<Sheet/);
    expect(source).toMatch(/Escape/);
    expect(source).toMatch(/ArrowLeft/);
    expect(source).toMatch(/ArrowRight/);
  });

  it('STAFF: расписание студентам, сотруднику — явная заглушка', async () => {
    vi.mocked(
      (await import('@/server/data')).requireDataCtx as ReturnType<typeof vi.fn>,
    ).mockResolvedValueOnce(staffCtx);
    const html = await renderPage();
    expect(html).not.toContain('data-testid="week-grid"');
    expect(html).toContain('Расписание доступно студентам');
  });

  it('мобильная замена (< 768 px) присутствует в DOM, десктопный вид скрыт классом', async () => {
    const html = await renderPage();
    expect(html).toMatch(/md:hidden/);
    expect(html).toMatch(/hidden md:block/);
    expect(html).toContain('Мобильная версия расписания');
  });

  it('loading.tsx: скелетон расписания подключён', () => {
    const source = readFileSync(
      resolve(import.meta.dirname, '../src/app/(cabinet)/schedule/loading.tsx'),
      'utf8',
    );
    expect(source).toMatch(/Skeleton/);
  });

  it('пустая неделя: «На этой неделе пар нет» и листание сохраняется', async () => {
    vi.mocked(
      (await import('@/server/data')).getSchedule as ReturnType<typeof vi.fn>,
    ).mockResolvedValueOnce([]);
    const html = await renderPage({ week: nextWeekKey });
    expect(html).toContain('На этой неделе пар нет');
    expect(html).toContain(`week=${thisWeekKey}`);
  });
});
