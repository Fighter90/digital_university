// DIG-23 — render-контракты компонентов экрана «Расписание» (день / месяц /
// мобильный вид с лентой дат). jsdom: интерактив ленты и свайпа проверяется
// здесь, интеграция с реальным браузером — в e2e/schedule-day-month.spec.ts.
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';

import { EventCard } from '@/components/schedule/event-card';
import { EventTypePill } from '@/components/schedule/event-type-pill';
import { DayView } from '@/components/schedule/day-view';
import { MonthView } from '@/components/schedule/month-view';
import { MobileSchedule, type MobileDayView } from '@/components/schedule/mobile-schedule';
import { toScheduleEventCards } from '@/lib/schedule-cards';
import { fromMoscowWallClock } from '@/lib/schedule-time';
import type { ScheduleEventRow } from '@/server/data/types';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

afterEach(cleanup);

function row(overrides: Partial<ScheduleEventRow> = {}): ScheduleEventRow {
  const startsAt = overrides.startsAt ?? fromMoscowWallClock(2026, 11, 11, 10, 0);
  return {
    id: 'ev-1',
    groupName: 'ПИ-21',
    disciplineCode: 'PI21-INFO',
    disciplineName: 'Информатика',
    date: startsAt,
    startsAt,
    endsAt: overrides.endsAt ?? fromMoscowWallClock(2026, 11, 11, 11, 30),
    kind: 'LECTURE',
    room: '301',
    teacherName: 'Петров Пётр Петрович',
    status: 'SCHEDULED',
    note: null,
    ...overrides,
  };
}

// ── EventTypePill ─────────────────────────────────────────────────────────────

describe('EventTypePill', () => {
  it('показывает подпись типа и цвет типа (data-kind)', () => {
    render(<EventTypePill kind="SEMINAR" />);
    const pill = screen.getByText('Семинар').closest('span')!;
    expect(pill).toHaveAttribute('data-kind', 'SEMINAR');
    expect(pill.className).toContain('lesson-seminar');
  });
});

// ── EventCard ─────────────────────────────────────────────────────────────────

describe('EventCard', () => {
  it('время слева, тип, аудитория и преподаватель видны', () => {
    render(
      <ul>
        <EventCard event={toScheduleEventCards([row()])[0]!} />
      </ul>,
    );
    expect(screen.getByText('10:00')).toBeVisible();
    expect(screen.getByText('до 11:30')).toBeVisible();
    expect(screen.getByText('Информатика')).toBeVisible();
    expect(screen.getByText('Лекция')).toBeVisible();
    expect(screen.getByText('ауд. 301 · Петров Пётр Петрович')).toBeVisible();
  });

  it('перенос: бейдж «Перенос», «было: ауд. 214», причина и штриховка', () => {
    const moved = toScheduleEventCards([
      row({
        id: 'ev-moved',
        status: 'ROOM_CHANGED',
        room: '305',
        previousRoom: '214',
        changeNote: 'Аудитория занята факультетским мероприятием',
      }),
    ])[0]!;
    const { container } = render(
      <ul>
        <EventCard event={moved} />
      </ul>,
    );
    expect(screen.getByText('Перенос')).toBeVisible();
    expect(screen.getByText('было: ауд. 214')).toBeVisible();
    expect(screen.getByText('Аудитория занята факультетским мероприятием')).toBeVisible();
    expect(container.querySelector('[data-status="ROOM_CHANGED"]')!.className).toContain(
      'hatch-rescheduled',
    );
  });

  it('перенос времени показывает «было: 11:10»', () => {
    const moved = toScheduleEventCards([
      row({
        id: 'ev-time',
        status: 'TIME_CHANGED',
        startsAt: fromMoscowWallClock(2026, 11, 11, 12, 30),
        previousStartsAt: fromMoscowWallClock(2026, 11, 11, 11, 10),
      }),
    ])[0]!;
    render(
      <ul>
        <EventCard event={moved} />
      </ul>,
    );
    expect(screen.getByText('было: 11:10')).toBeVisible();
  });

  it('отмена: бейдж «Отмена», зачёркнутое название, причина видна', () => {
    const cancelled = toScheduleEventCards([
      row({ id: 'ev-cancel', status: 'CANCELLED', note: 'Лаборатория закрыта' }),
    ])[0]!;
    render(
      <ul>
        <EventCard event={cancelled} />
      </ul>,
    );
    expect(screen.getByText('Отмена')).toBeVisible();
    expect(screen.getByText('Информатика').className).toContain('line-through');
    expect(screen.getByText('Лаборатория закрыта')).toBeVisible();
  });

  it('онлайн-пара подписывается «онлайн» вместо аудитории', () => {
    const online = toScheduleEventCards([row({ room: 'Онлайн' })])[0]!;
    render(
      <ul>
        <EventCard event={online} />
      </ul>,
    );
    expect(screen.getByText('онлайн · Петров Пётр Петрович')).toBeVisible();
  });

  it('компактный режим (мобильная неделя) помечается data-compact', () => {
    const { container } = render(
      <ul>
        <EventCard event={toScheduleEventCards([row()])[0]!} compact />
      </ul>,
    );
    expect(container.querySelector('[data-compact="true"]')).not.toBeNull();
  });
});

// ── DayView (десктоп) ─────────────────────────────────────────────────────────

describe('DayView', () => {
  const base = {
    title: 'Среда, 11 ноября',
    isToday: true,
    prevHref: '/schedule?view=day&date=2026-11-10',
    nextHref: '/schedule?view=day&date=2026-11-12',
    todayHref: '/schedule?view=day',
  };

  it('заголовок дня, стрелки-соседние дни и карточки пар', () => {
    const events = toScheduleEventCards([
      row(),
      row({
        id: 'ev-2',
        startsAt: fromMoscowWallClock(2026, 11, 11, 12, 0),
        endsAt: fromMoscowWallClock(2026, 11, 11, 13, 30),
      }),
    ]);
    render(<DayView {...base} events={events} nextStudy={null} />);
    const title = screen.getByTestId('day-title');
    expect(title).toHaveTextContent('Среда, 11 ноября');
    expect(screen.getByLabelText('Предыдущий день')).toHaveAttribute(
      'href',
      '/schedule?view=day&date=2026-11-10',
    );
    expect(screen.getByLabelText('Следующий день')).toHaveAttribute(
      'href',
      '/schedule?view=day&date=2026-11-12',
    );
    expect(screen.getByTestId('day-card-ev-1')).toBeVisible();
    expect(screen.getByTestId('day-card-ev-2')).toBeVisible();
  });

  it('пустой день: иллюстрация и «Ближайшие пары: чт, 12 ноября»', () => {
    render(
      <DayView
        {...base}
        events={[]}
        nextStudy={{ dateKey: '2026-11-12', label: 'чт, 12 ноября' }}
      />,
    );
    expect(screen.getByTestId('day-empty')).toBeVisible();
    expect(screen.getByText('Ближайшие пары: чт, 12 ноября')).toBeVisible();
  });

  it('пар впереди нет — честный текст вместо даты', () => {
    render(<DayView {...base} events={[]} nextStudy={null} />);
    expect(screen.getByText('В семестре пар больше нет')).toBeVisible();
  });

  it('за границей семестра стрелка отключается', () => {
    render(<DayView {...base} prevHref={null} events={[]} nextStudy={null} />);
    expect(screen.getByLabelText('Предыдущий день')).toHaveAttribute('aria-disabled', 'true');
  });
});

// ── MonthView ─────────────────────────────────────────────────────────────────

describe('MonthView', () => {
  const grid = [
    {
      dateKey: '2026-11-10',
      dayNumber: 10,
      inMonth: true,
      isToday: false,
      dots: ['SEMINAR'] as const,
      extra: 0,
      href: '/schedule?view=day&date=2026-11-10',
    },
    {
      dateKey: '2026-11-11',
      dayNumber: 11,
      inMonth: true,
      isToday: true,
      dots: ['LECTURE'] as const,
      extra: 2,
      href: '/schedule?view=day&date=2026-11-11',
    },
    {
      dateKey: '2026-10-26',
      dayNumber: 26,
      inMonth: false,
      isToday: false,
      dots: [],
      extra: 0,
      href: '',
    },
  ];

  it('сетка 7 колонок, подписи дней недели с понедельника', () => {
    render(
      <MonthView
        monthLabel="Ноябрь 2026"
        semesterLabel="Осенний семестр 2026/27"
        prevHref="/schedule?view=month&month=2026-10"
        nextHref="/schedule?view=month&month=2026-12"
        cells={grid as never}
      />,
    );
    const gridEl = screen.getByTestId('month-grid');
    expect(gridEl).toHaveClass('grid-cols-7');
    const header = screen.getByTestId('month-weekdays');
    expect(within(header).getByText('пн')).toBeVisible();
    expect(within(header).getByText('вс')).toBeVisible();
  });

  it('клик по дню открывает вид «День» (href с date)', () => {
    render(
      <MonthView
        monthLabel="Ноябрь 2026"
        semesterLabel=""
        prevHref={null}
        nextHref={null}
        cells={grid as never}
      />,
    );
    expect(screen.getByTestId('month-cell-2026-11-10')).toHaveAttribute(
      'href',
      '/schedule?view=day&date=2026-11-10',
    );
  });

  it('сегодня выделено, переполнение пар — «+2»', () => {
    render(
      <MonthView
        monthLabel="Ноябрь 2026"
        semesterLabel=""
        prevHref={null}
        nextHref={null}
        cells={grid as never}
      />,
    );
    expect(screen.getByTestId('month-cell-2026-11-11')).toHaveAttribute('data-today', 'true');
    expect(screen.getByText('+2')).toBeVisible();
  });

  it('дни вне месяца не кликабельны и не выделяются', () => {
    render(
      <MonthView
        monthLabel="Ноябрь 2026"
        semesterLabel=""
        prevHref={null}
        nextHref={null}
        cells={grid as never}
      />,
    );
    expect(screen.queryByTestId('month-cell-2026-10-26')).toBeNull();
    expect(screen.getByText('26')).toBeInTheDocument();
  });
});

// ── MobileSchedule ────────────────────────────────────────────────────────────

function mobileDays(): MobileDayView[] {
  const make = (dateKey: string, weekdayShort: string, dayNumber: number): MobileDayView => ({
    dateKey,
    weekdayShort,
    dayNumber,
    listLabel: `${weekdayShort}, ${dayNumber} ноября`,
    isToday: dateKey === '2026-11-11',
    events:
      dateKey === '2026-11-11'
        ? toScheduleEventCards([row()])
        : dateKey === '2026-11-12'
          ? toScheduleEventCards([
              row({ id: 'ev-thu', startsAt: fromMoscowWallClock(2026, 11, 12, 12, 0) }),
            ])
          : [],
  });
  return [
    make('2026-11-09', 'пн', 9),
    make('2026-11-10', 'вт', 10),
    make('2026-11-11', 'ср', 11),
    make('2026-11-12', 'чт', 12),
    make('2026-11-13', 'пт', 13),
    make('2026-11-14', 'сб', 14),
    make('2026-11-15', 'вс', 15),
  ];
}

describe('MobileSchedule — вид «день» с лентой', () => {
  it('лента дат недели: 7 дней, выбранный отмечен', () => {
    render(
      <MobileSchedule
        mode="day"
        days={mobileDays()}
        initialDateKey="2026-11-11"
        nextStudy={null}
      />,
    );
    const ribbon = screen.getByTestId('date-ribbon');
    expect(within(ribbon).getAllByRole('button')).toHaveLength(7);
    expect(screen.getByTestId('ribbon-item-2026-11-11')).toHaveAttribute('data-selected', 'true');
    expect(screen.getByTestId('mobile-day-title')).toHaveTextContent('Среда, 11 ноября');
    expect(screen.getByTestId('day-card-ev-1')).toBeVisible();
  });

  it('клик по дню ленты переключает выбранный день', () => {
    render(
      <MobileSchedule
        mode="day"
        days={mobileDays()}
        initialDateKey="2026-11-11"
        nextStudy={null}
      />,
    );
    fireEvent.click(screen.getByTestId('ribbon-item-2026-11-12'));
    expect(screen.getByTestId('ribbon-item-2026-11-12')).toHaveAttribute('data-selected', 'true');
    expect(screen.getByTestId('mobile-day-title')).toHaveTextContent('Четверг, 12 ноября');
    expect(screen.getByTestId('day-card-ev-thu')).toBeVisible();
  });

  it('свайп влево по списку листает на следующий день, вправо — на предыдущий', () => {
    render(
      <MobileSchedule
        mode="day"
        days={mobileDays()}
        initialDateKey="2026-11-11"
        nextStudy={null}
      />,
    );
    const list = screen.getByTestId('mobile-day-list');

    fireEvent.touchStart(list, {
      touches: [{ clientX: 300, clientY: 300, identifier: 1 }],
      changedTouches: [{ clientX: 300, clientY: 300, identifier: 1 }],
    });
    fireEvent.touchEnd(list, {
      touches: [],
      changedTouches: [{ clientX: 180, clientY: 300, identifier: 1 }],
    });
    expect(screen.getByTestId('mobile-day-title')).toHaveTextContent('Четверг, 12 ноября');

    fireEvent.touchStart(list, {
      touches: [{ clientX: 180, clientY: 300, identifier: 1 }],
      changedTouches: [{ clientX: 180, clientY: 300, identifier: 1 }],
    });
    fireEvent.touchEnd(list, {
      touches: [],
      changedTouches: [{ clientX: 320, clientY: 300, identifier: 1 }],
    });
    expect(screen.getByTestId('mobile-day-title')).toHaveTextContent('Среда, 11 ноября');
  });

  it('вертикальный свайп день не листает', () => {
    render(
      <MobileSchedule
        mode="day"
        days={mobileDays()}
        initialDateKey="2026-11-11"
        nextStudy={null}
      />,
    );
    const list = screen.getByTestId('mobile-day-list');
    fireEvent.touchStart(list, {
      touches: [{ clientX: 300, clientY: 200, identifier: 1 }],
      changedTouches: [{ clientX: 300, clientY: 200, identifier: 1 }],
    });
    fireEvent.touchEnd(list, {
      touches: [],
      changedTouches: [{ clientX: 300, clientY: 400, identifier: 1 }],
    });
    expect(screen.getByTestId('mobile-day-title')).toHaveTextContent('Среда, 11 ноября');
  });

  it('пустой выбранный день показывает ближайшие пары', () => {
    render(
      <MobileSchedule
        mode="day"
        days={mobileDays()}
        initialDateKey="2026-11-14"
        nextStudy={{ dateKey: '2026-11-20', label: 'пт, 20 ноября' }}
      />,
    );
    expect(screen.getByText(/Ближайшие пары/)).toBeVisible();
  });

  it('лента скроллится сама: контейнер с overflow-x-auto и без влияния на страницу', () => {
    const { container } = render(
      <MobileSchedule
        mode="day"
        days={mobileDays()}
        initialDateKey="2026-11-11"
        nextStudy={null}
      />,
    );
    const ribbon = container.querySelector('[data-testid="date-ribbon"]') as HTMLElement;
    expect(ribbon.className).toContain('overflow-x-auto');
  });
});

describe('MobileSchedule — компактный вид «неделя»', () => {
  it('список по дням: заголовки дней и пары карточками', () => {
    render(
      <MobileSchedule
        mode="week"
        days={mobileDays()}
        initialDateKey="2026-11-11"
        nextStudy={null}
      />,
    );
    const week = screen.getByTestId('mobile-week-list');
    expect(within(week).getAllByTestId(/^compact-day-/)).toHaveLength(7);
    expect(screen.getByTestId('day-card-ev-1')).toBeVisible();
    expect(screen.getByTestId('day-card-ev-thu')).toBeVisible();
  });

  it('у дня без пар — подпись «Нет пар»', () => {
    render(
      <MobileSchedule
        mode="week"
        days={mobileDays()}
        initialDateKey="2026-11-11"
        nextStudy={null}
      />,
    );
    const empties = screen.getAllByText('Нет пар');
    expect(empties.length).toBeGreaterThanOrEqual(2); // сб и вс без пар
    for (const node of empties) expect(node).toBeVisible();
  });
});
