// DIG-104 — регресс: вложенные <a> в карточке пары ломали гидрацию расписания
// (React #418: браузерный парсер переставляет невалидное «<a> внутри <a>»,
// SSR HTML расходится с клиентским деревом, React перерисовывает всё на клиенте).
// Контракт: карточка-ссылка не содержит вложенных якорей; преподаватель
// остаётся ссылкой (DIG-37) и не перекрывается stretched-ссылкой деталей.
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';

import { EventCard } from '@/components/schedule/event-card';
import { MobileSchedule, type MobileDayView } from '@/components/schedule/mobile-schedule';
import { toScheduleEventCards } from '@/lib/schedule-cards';
import { fromMoscowWallClock } from '@/lib/schedule-time';
import type { ScheduleEventRow } from '@/server/data/types';

const routerPush = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPush, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams('view=day&date=2026-11-11'),
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

function mobileDays(): MobileDayView[] {
  const events = toScheduleEventCards([row()]);
  return [
    {
      dateKey: '2026-11-11',
      weekdayShort: 'ср',
      dayNumber: 11,
      listLabel: 'ср, 11 ноября',
      isToday: true,
      events,
    },
  ];
}

describe('EventCard — гидрация: без вложенных <a> (DIG-104)', () => {
  it('карточка-ссылка (href) не содержит вложенных якорей', () => {
    const { container } = render(
      <ul>
        <EventCard
          event={toScheduleEventCards([row()])[0]!}
          href="/schedule?view=day&date=2026-11-11&event=ev-1"
        />
      </ul>,
    );
    // Дефект DIG-104: <Link> преподавателя внутри <a>-карточки — невалидный HTML.
    expect(container.querySelectorAll('a a').length, 'найдены вложенные <a>').toBe(0);
  });

  it('карточка-ссылка сохраняет контракт деталей: href, data-event-id, aria-метка', () => {
    render(
      <ul>
        <EventCard
          event={toScheduleEventCards([row()])[0]!}
          href="/schedule?view=day&date=2026-11-11&event=ev-1"
        />
      </ul>,
    );
    const details = screen.getByRole('link', { name: /Лекция, Информатика/ });
    expect(details).toHaveAttribute('href', '/schedule?view=day&date=2026-11-11&event=ev-1');
    expect(details).toHaveAttribute('data-event-id', 'ev-1');
  });

  it('преподаватель остаётся ссылкой (DIG-37) и кликабелен поверх stretched-ссылки', () => {
    render(
      <ul>
        <EventCard
          event={toScheduleEventCards([row()])[0]!}
          href="/schedule?view=day&date=2026-11-11&event=ev-1"
        />
      </ul>,
    );
    const teacher = screen.getByTestId('event-teacher-ev-1');
    expect(teacher).toHaveAttribute('href', '/people/teacher-petrov');
    // поверх stretched-ссылки деталей: клик по преподавателю не перекрывается
    expect(teacher.className).toContain('pointer-events-auto');
  });

  it('мобильный вид «день» (MobileSchedule) — во всём документе нет вложенных <a>', () => {
    render(
      <MobileSchedule
        mode="day"
        days={mobileDays()}
        initialDateKey="2026-11-11"
        nextStudy={null}
        eventQuery="view=day"
      />,
    );
    expect(document.querySelectorAll('a a').length, 'найдены вложенные <a>').toBe(0);
  });
});
