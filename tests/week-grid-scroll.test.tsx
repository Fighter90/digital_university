// DIG-56 — недельная сетка как скролл-контейнер в стиле Google Calendar
// (drag мышью, Shift+wheel, вертикальная шкала без прокрутки страницы,
// порог движения между drag и кликом). jsdom: pointer/wheel-контракты
// проверяются здесь, реальная прокрутка браузера — в e2e
// e2e/schedule-week-scroll.spec.ts (desktop-1440).
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { WeekView, type WeekDayColumnData } from '@/components/schedule/week-view';
import {
  GRID_HEIGHT_PX,
  toScheduleEventViews,
  WEEK_DRAG_THRESHOLD_PX,
  WEEK_GRID_VIEWPORT_PX,
  WEEK_GUTTER_PX,
  WEEK_MIN_COLUMN_PX,
} from '@/lib/schedule-view';
import { fromMoscowWallClock } from '@/lib/schedule-time';
import { FILTER_KIND_ORDER } from '@/lib/schedule-view';
import type { ScheduleEventRow } from '@/server/data/types';

const routerPush = vi.hoisted(() => vi.fn());
const routerRefresh = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPush, refresh: routerRefresh }),
  useSearchParams: () => new URLSearchParams(),
}));

// jsdom в юнит-прендере не знает ResizeObserver (нужен base-ui Dialog-порталу).
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub);

afterEach(cleanup);

function row(overrides: Partial<ScheduleEventRow> = {}): ScheduleEventRow {
  const startsAt = overrides.startsAt ?? fromMoscowWallClock(2026, 11, 9, 10, 0);
  return {
    id: 'ev-1',
    groupName: 'ПИ-21',
    disciplineCode: 'PI21-INFO',
    disciplineName: 'Информатика',
    date: startsAt,
    startsAt,
    endsAt: overrides.endsAt ?? fromMoscowWallClock(2026, 11, 9, 11, 30),
    kind: 'LECTURE',
    room: '301',
    teacherName: 'Петров Пётр Петрович',
    status: 'SCHEDULED',
    note: null,
    ...overrides,
  };
}

const views = toScheduleEventViews([
  row(),
  row({
    id: 'ev-2',
    disciplineName: 'Математический анализ',
    kind: 'SEMINAR',
    startsAt: fromMoscowWallClock(2026, 11, 10, 12, 0),
    endsAt: fromMoscowWallClock(2026, 11, 10, 13, 30),
    date: fromMoscowWallClock(2026, 11, 10, 12, 0),
  }),
]);

/** Недельная страница: пн–вс, события в пн и вт. */
function weekDays(): WeekDayColumnData[] {
  const base = [
    { dateKey: '2026-11-09', weekdayShort: 'пн', dayNumber: 9, isToday: true },
    { dateKey: '2026-11-10', weekdayShort: 'вт', dayNumber: 10, isToday: false },
    { dateKey: '2026-11-11', weekdayShort: 'ср', dayNumber: 11, isToday: false },
    { dateKey: '2026-11-12', weekdayShort: 'чт', dayNumber: 12, isToday: false },
    { dateKey: '2026-11-13', weekdayShort: 'пт', dayNumber: 13, isToday: false },
    { dateKey: '2026-11-14', weekdayShort: 'сб', dayNumber: 14, isToday: false },
    { dateKey: '2026-11-15', weekdayShort: 'вс', dayNumber: 15, isToday: false },
  ] as const;
  return base.map((day) => ({
    ...day,
    events: views.filter((event) => event.dateKey === day.dateKey),
  }));
}

function renderWeek() {
  return render(
    <WeekView
      weekKey="2026-W46"
      weekLabel="9–15 ноября"
      semesterLabel="Осенний семестр 2026/27"
      prevWeekKey="2026-W45"
      nextWeekKey="2026-W47"
      todayWeekKey="2026-W46"
      todayKey="2026-11-09"
      days={weekDays()}
      mini={{
        monthLabel: 'Ноябрь 2026',
        weekdays: ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'],
        cells: [],
      }}
      kindCounts={FILTER_KIND_ORDER.map((kind) => ({ kind, count: 0 }))}
      teachers={[]}
      currentQuery=""
      keepViewParam={false}
    />,
  );
}

const lesson = () =>
  screen.getByRole('button', { name: 'Лекция, Информатика, 10:00–11:30, ауд. 301' });

/** Синтетический wheel-иверт с нужными полями (jsdom не знает WheelEvent). */
function dispatchWheel(
  element: Element,
  deltas: { deltaX?: number; deltaY?: number; shiftKey?: boolean },
) {
  const event = new Event('wheel', { bubbles: true, cancelable: true });
  Object.assign(event, { deltaX: 0, deltaY: 0, shiftKey: false, ...deltas });
  fireEvent(element, event);
}

describe('WeekView — сетка-скроллконтейнер (DIG-56)', () => {
  it('окно сетки фиксированной высоты с overflow, шкала 08:00–20:00 выше окна → вертикальная прокрутка внутри сетки', () => {
    renderWeek();
    const grid = screen.getByTestId('week-grid');
    expect(grid.className).toContain('overflow-auto');
    expect(grid.style.height).toBe(`${WEEK_GRID_VIEWPORT_PX}px`);
    // шкала целиком (768 px) не влезает в окно (480 px) — сетка скроллится сама
    expect(GRID_HEIGHT_PX).toBeGreaterThan(WEEK_GRID_VIEWPORT_PX);
    // overscroll-contain: колесо у упора сетки не уводит страницу
    expect(grid.className).toContain('overscroll-contain');
    for (const hour of ['08:00', '12:00', '19:00']) {
      expect(grid).toContainElement(screen.getByText(hour, { exact: true }));
    }
  });

  it('контент сетки не уже «гуттер + N колонок × минимальную ширину» — возможен горизонтальный overflow', () => {
    renderWeek();
    const grid = screen.getByTestId('week-grid');
    const content = grid.firstElementChild as HTMLElement;
    const total = WEEK_GUTTER_PX + 7 * WEEK_MIN_COLUMN_PX;
    // jsdom может резолвить calc до итогового значения — допускаем обе записи
    const minWidth = content.style.minWidth;
    expect(
      minWidth.includes(`${total}px`) || minWidth.includes(`7 * ${WEEK_MIN_COLUMN_PX}px`),
      `min-width контента должен задавать «гуттер + 7 колонок»: получено ${minWidth}`,
    ).toBe(true);
    // при самой широкой области контента десктопа (1200 − сайдбар 260) сетка
    // всё равно шире окна → drag/Shift+wheel доступны и на 1440
    expect(total).toBeGreaterThan(1200 - 260);
  });

  it('Shift+wheel прокручивает сетку по горизонтали; вертикальное колесо горизонталь не трогает', () => {
    renderWeek();
    const grid = screen.getByTestId('week-grid');

    dispatchWheel(grid, { deltaY: 240, shiftKey: true });
    expect(grid.scrollLeft).toBe(240);

    // второй тик суммируется — «плавная» прокрутка последовательными тиками
    dispatchWheel(grid, { deltaY: 120, shiftKey: true });
    expect(grid.scrollLeft).toBe(360);

    grid.scrollLeft = 100;
    dispatchWheel(grid, { deltaY: 200, deltaX: 0, shiftKey: false });
    expect(grid.scrollLeft).toBe(100);
  });

  it('горизонтальный жест трекпада (deltaX без Shift) тоже прокручивает сетку', () => {
    renderWeek();
    const grid = screen.getByTestId('week-grid');
    // скролл вправо (к выходным) — deltaX > 0
    dispatchWheel(grid, { deltaX: 180, deltaY: 0 });
    expect(grid.scrollLeft).toBe(180);
  });

  it('drag мышью дальше порога панорамирует сетку и глушит клик по паре', () => {
    renderWeek();
    const grid = screen.getByTestId('week-grid');
    grid.scrollLeft = 100;

    // тянем содержимое вправо-вверх → scrollLeft уменьшается, scrollTop
    // увеличивается (как при перетаскивании листа в Google Calendar)
    fireEvent.pointerDown(grid, {
      button: 0,
      pointerType: 'mouse',
      clientX: 300,
      clientY: 200,
    });
    fireEvent.pointerMove(window, { clientX: 360, clientY: 180 });
    fireEvent.pointerUp(window, {});
    expect(grid.scrollLeft).toBe(100 - 60);
    expect(grid.scrollTop).toBe(20);

    // drag погасил следующий click: панель деталей НЕ открылась
    fireEvent.click(lesson());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('жест, отпущенный вне сетки, гасит только «свой» click — следующий клик по паре открывает детали', () => {
    // click после отпускания кнопки вне сетки диспатчится на общего предка
    // pointerdown/pointerup и в обработчики сетки не попадает: подавление
    // не должно «залипать» до следующего честного клика по паре
    renderWeek();
    const grid = screen.getByTestId('week-grid');
    grid.scrollLeft = 100;

    fireEvent.pointerDown(grid, {
      button: 0,
      pointerType: 'mouse',
      clientX: 300,
      clientY: 200,
    });
    fireEvent.pointerMove(window, { clientX: 400, clientY: 200 });
    // отпустили кнопку над левой колонкой (вне сетки)
    fireEvent.pointerUp(window, { clientX: 40, clientY: 20 });
    // click жеста приземлился на общего предка (вне сетки) — детали не открылись
    fireEvent.click(document.body);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // следующий честный клик по паре ДОЛЖЕН открыть детали
    fireEvent.click(lesson());
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it(`микро-сдвиг меньше ${WEEK_DRAG_THRESHOLD_PX}px сетку не двигает и клик не глушит — детали открываются`, () => {
    renderWeek();
    const grid = screen.getByTestId('week-grid');
    grid.scrollLeft = 100;

    fireEvent.pointerDown(grid, {
      button: 0,
      pointerType: 'mouse',
      clientX: 300,
      clientY: 200,
    });
    fireEvent.pointerMove(window, { clientX: 302, clientY: 202 });
    fireEvent.pointerUp(window, {});
    expect(grid.scrollLeft).toBe(100);
    expect(grid.scrollTop).toBe(0);

    fireEvent.click(lesson());
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('touch не перехватывается: нативный pan остаётся браузеру', () => {
    renderWeek();
    const grid = screen.getByTestId('week-grid');
    grid.scrollLeft = 100;
    fireEvent.pointerDown(grid, {
      button: 0,
      pointerType: 'touch',
      clientX: 300,
      clientY: 200,
    });
    fireEvent.pointerMove(window, { clientX: 200, clientY: 200 });
    fireEvent.pointerUp(window, {});
    expect(grid.scrollLeft).toBe(100);
  });
});

describe('WeekView — отклик кнопки «Синхронизировать» (DIG-85 / BUG-17)', () => {
  it('после клика появляется видимый статус обновления (role="status")', async () => {
    renderWeek();
    // Живая aria-live-область существует ДО нажатия — скринридер услышит смену.
    expect(screen.getByTestId('sync-status')).toHaveAttribute('aria-live', 'polite');

    fireEvent.click(screen.getByRole('button', { name: 'Синхронизировать' }));
    expect(routerRefresh).toHaveBeenCalled();
    await screen.findByText('Расписание обновлено', { selector: '[data-testid="sync-status"]' });
  });
});
