// DIG-23 — вью-логика видов «День», «Месяц» и мобильного расписания.
// Красная фаза: контракт зафиксирован ДО реализации.
//
// Приёмка DIG-23:
//  - карточка пары: время, тип, аудитория/онлайн, преподаватель, признаки
//    переноса/отмены, «было: ауд./время», причина, понятный aria-label;
//  - пустой день: подпись ближайшего учебного дня («чт, 12 ноября»);
//  - сетка месяца 7×N: недели с понедельника, «сегодня», точки пар (до 4 + «+N»);
//  - разбор и дефолты параметров URL (?view, ?date, ?month) — мусор не верит
//    на слово, всё клампится по границам семестра;
//  - лента дат мобильного вида: неделя выбранного дня, свайп → соседний день.
import { describe, expect, it } from 'vitest';

import {
  LESSON_KIND_META,
  buildViewHref,
  formatDayShort,
  formatDayTitle,
  formatMonthTitle,
  groupCardsByDate,
  monthCellViews,
  monthDots,
  neighborDay,
  parseDateKey,
  parseMonthKey,
  resolveScheduleView,
  resolveSelectedDate,
  resolveSelectedMonth,
  ribbonWeekDays,
  swipeDirection,
  toScheduleEventCards,
  weekWindow,
} from '@/lib/schedule-cards';
import { fromMoscowWallClock, moscowDateKey, semesterBounds } from '@/lib/schedule-time';
import type { ScheduleEventRow } from '@/server/data/types';

// Детерминированное «сейчас»: среда 11 ноября 2026, 09:00 по Москве.
const NOW = fromMoscowWallClock(2026, 11, 11, 9, 0);
const BOUNDS = semesterBounds(NOW); // 1 сентября 2026 — 25 января 2027

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

// ── Карточка пары ─────────────────────────────────────────────────────────────

describe('toScheduleEventCards', () => {
  it('маппит обычную пару: время, аудитория, преподаватель, aria-label', () => {
    const card = toScheduleEventCards([row()])[0]!;
    expect(card.id).toBe('ev-1');
    expect(card.dateKey).toBe('2026-11-11');
    expect(card.startLabel).toBe('10:00');
    expect(card.endLabel).toBe('11:30');
    expect(card.timeLabel).toBe('10:00–11:30');
    expect(card.discipline).toBe('Информатика');
    expect(card.teacher).toBe('Петров Пётр Петрович');
    expect(card.roomLabel).toBe('ауд. 301');
    expect(card.isMoved).toBe(false);
    expect(card.isCancelled).toBe(false);
    expect(card.ariaLabel).toBe('Лекция, Информатика, 10:00–11:30, ауд. 301');
  });

  it('онлайн-пара помечается словом «онлайн» без «ауд.»', () => {
    const card = toScheduleEventCards([row({ room: 'Онлайн' })])[0]!;
    expect(card.roomLabel).toBe('онлайн');
    expect(card.ariaLabel).toContain('онлайн');
  });

  it('перенос аудитории: isMoved, «было: ауд. 214», суффикс в aria-label', () => {
    const card = toScheduleEventCards([
      row({
        status: 'ROOM_CHANGED',
        room: '305',
        previousRoom: '214',
        changeNote: 'Аудитория занята',
      }),
    ])[0]!;
    expect(card.isMoved).toBe(true);
    expect(card.isCancelled).toBe(false);
    expect(card.previousRoomLabel).toBe('было: ауд. 214');
    expect(card.previousTimeLabel).toBeNull();
    expect(card.changeNote).toBe('Аудитория занята');
    expect(card.ariaLabel).toContain('перенос');
  });

  it('перенос времени: «было: 11:10» из previousStartsAt', () => {
    const card = toScheduleEventCards([
      row({
        status: 'TIME_CHANGED',
        startsAt: fromMoscowWallClock(2026, 11, 11, 12, 30),
        previousStartsAt: fromMoscowWallClock(2026, 11, 11, 11, 10),
      }),
    ])[0]!;
    expect(card.isMoved).toBe(true);
    expect(card.startLabel).toBe('12:30');
    expect(card.previousTimeLabel).toBe('было: 11:10');
    expect(card.previousRoomLabel).toBeNull();
  });

  it('отмена: isCancelled, суффикс «отменена» в aria-label', () => {
    const card = toScheduleEventCards([
      row({ status: 'CANCELLED', note: 'Лаборатория закрыта' }),
    ])[0]!;
    expect(card.isCancelled).toBe(true);
    expect(card.isMoved).toBe(false);
    expect(card.ariaLabel).toContain('отменена');
    expect(card.note).toBe('Лаборатория закрыта');
  });

  it('карточки идут в порядке входных строк (сервер отдаёт по времени начала)', () => {
    const cards = toScheduleEventCards([
      row({ id: 'a', startsAt: fromMoscowWallClock(2026, 11, 11, 10, 0) }),
      row({ id: 'b', startsAt: fromMoscowWallClock(2026, 11, 11, 12, 0) }),
    ]);
    expect(cards.map((c) => c.id)).toEqual(['a', 'b']);
  });
});

describe('groupCardsByDate', () => {
  it('группирует по московскому ключу дня, сохраняя порядок', () => {
    const cards = toScheduleEventCards([
      row({ id: 'a' }),
      row({ id: 'b', startsAt: fromMoscowWallClock(2026, 11, 12, 12, 0) }),
    ]);
    const byDate = groupCardsByDate(cards);
    expect([...byDate.keys()]).toEqual(['2026-11-11', '2026-11-12']);
    expect(byDate.get('2026-11-11')!.map((c) => c.id)).toEqual(['a']);
  });
});

// ── Тип занятия: пилюля и цветные классы ──────────────────────────────────────

describe('LESSON_KIND_META', () => {
  it('у каждого типа есть подпись, пилюля и цветная полоса/точка', () => {
    for (const kind of ['LECTURE', 'SEMINAR', 'LAB', 'PRACTICE', 'CONSULTATION'] as const) {
      const meta = LESSON_KIND_META[kind];
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.pill).toMatch(/text-/);
      expect(meta.dot).toMatch(/bg-/);
      expect(meta.stripe).toMatch(/bg-/);
    }
  });

  it('лекция — коралловая, семинар — синий, лабораторная — зелёный (токены DIG-13)', () => {
    expect(LESSON_KIND_META.LECTURE.dot).toContain('lesson-lecture');
    expect(LESSON_KIND_META.SEMINAR.dot).toContain('lesson-seminar');
    expect(LESSON_KIND_META.LAB.dot).toContain('lesson-lab');
    expect(LESSON_KIND_META.PRACTICE.dot).toContain('accent');
    expect(LESSON_KIND_META.CONSULTATION.dot).toContain('lesson-exam');
  });
});

// ── Форматирование дат ────────────────────────────────────────────────────────

describe('даты', () => {
  it('formatDayShort: «чт, 12 ноября»', () => {
    expect(formatDayShort(fromMoscowWallClock(2026, 11, 12))).toBe('чт, 12 ноября');
  });

  it('formatDayTitle: «Среда, 11 ноября» с большой буквы', () => {
    expect(formatDayTitle(NOW)).toBe('Среда, 11 ноября');
  });

  it('formatMonthTitle: «Ноябрь 2026»', () => {
    expect(formatMonthTitle(2026, 11)).toBe('Ноябрь 2026');
  });

  it('parseDateKey принимает валидный ключ и отбрасывает мусор', () => {
    expect(moscowDateKey(parseDateKey('2026-11-13')!)).toBe('2026-11-13');
    expect(parseDateKey('2026-13-99')).toBeNull();
    expect(parseDateKey('not-a-date')).toBeNull();
    expect(parseDateKey(undefined)).toBeNull();
  });

  it('parseMonthKey: «2026-11», мусор → null', () => {
    expect(parseMonthKey('2026-11')).toEqual({ year: 2026, month: 11 });
    expect(parseMonthKey('2026-12')).toEqual({ year: 2026, month: 12 });
    expect(parseMonthKey('2026-13')).toBeNull();
    expect(parseMonthKey('junk')).toBeNull();
  });
});

// ── Параметры URL ─────────────────────────────────────────────────────────────

describe('resolveScheduleView / resolveSelectedDate / resolveSelectedMonth', () => {
  it('вид: валидный ?view или фолбэк платформы (десктоп — неделя DIG-22, мобильный — «сегодня»)', () => {
    expect(resolveScheduleView(undefined, 'week')).toBe('week');
    expect(resolveScheduleView(undefined, 'day')).toBe('day');
    expect(resolveScheduleView('day', 'week')).toBe('day');
    expect(resolveScheduleView('week', 'day')).toBe('week');
    expect(resolveScheduleView('month', 'day')).toBe('month');
    expect(resolveScheduleView('year', 'week')).toBe('week'); // мусор → фолбэк
  });

  it('дата по умолчанию — сегодня; мусорная — сегодня', () => {
    expect(moscowDateKey(resolveSelectedDate(undefined, NOW))).toBe('2026-11-11');
    expect(moscowDateKey(resolveSelectedDate('2026-11-13', NOW))).toBe('2026-11-13');
    expect(moscowDateKey(resolveSelectedDate('junk', NOW))).toBe('2026-11-11');
  });

  it('месяц по умолчанию — текущий; мусорный — текущий', () => {
    expect(resolveSelectedMonth(undefined, NOW)).toEqual({ year: 2026, month: 11 });
    expect(resolveSelectedMonth('2025-03', NOW)).toEqual({ year: 2025, month: 3 });
    expect(resolveSelectedMonth('junk', NOW)).toEqual({ year: 2026, month: 11 });
  });
});

// ── Листание дней и границы семестра ──────────────────────────────────────────

describe('neighborDay', () => {
  it('соседний день внутри семестра', () => {
    expect(moscowDateKey(neighborDay(NOW, 1, BOUNDS)!)).toBe('2026-11-12');
    expect(moscowDateKey(neighborDay(NOW, -1, BOUNDS)!)).toBe('2026-11-10');
  });

  it('за границей семестра соседнего дня нет (стрелка отключится)', () => {
    const lastDay = fromMoscowWallClock(2027, 1, 24);
    expect(neighborDay(lastDay, 1, BOUNDS)).toBeNull();
    const firstDay = fromMoscowWallClock(2026, 9, 1);
    expect(neighborDay(firstDay, -1, BOUNDS)).toBeNull();
  });
});

// ── Окно данных ±2 недели вокруг выбранного дня ───────────────────────────────

describe('weekWindow', () => {
  it('окно — 5 полных недель с понедельника по воскресенье', () => {
    const win = weekWindow(NOW, 2);
    expect(moscowDateKey(win.from)).toBe('2026-10-26'); // понедельник −2 недели
    expect(moscowDateKey(win.to)).toBe('2026-11-30'); // понедельник +3 недели (эксклюзивно)
  });

  it('окно не обязано вылезать за семестр — клампит вызывающий код через bounds', () => {
    const september = fromMoscowWallClock(2026, 9, 3);
    const win = weekWindow(september, 2);
    expect(win.from.getTime()).toBeLessThan(BOUNDS.start.getTime());
  });
});

// ── Сетка месяца ──────────────────────────────────────────────────────────────

describe('monthCellViews', () => {
  const cells = monthCellViews({ year: 2026, month: 11 }, new Map(), '2026-11-11');

  it('полные недели с понедельника: ноябрь 2026 = 42 ячейки, первая — 26 октября', () => {
    expect(cells.length % 7).toBe(0);
    expect(cells[0]!.dateKey).toBe('2026-10-26');
    expect(cells[0]!.inMonth).toBe(false);
    expect(cells[5]!.dateKey).toBe('2026-10-31');
    expect(cells[5]!.inMonth).toBe(false);
    expect(cells[6]!.dateKey).toBe('2026-11-01');
    expect(cells[6]!.inMonth).toBe(true); // 1 ноября — воскресенье первой строки
  });

  it('в ячейках месяца: число, признак «сегодня», href вида «день»', () => {
    const today = cells.find((c) => c.dateKey === '2026-11-11')!;
    expect(today.inMonth).toBe(true);
    expect(today.isToday).toBe(true);
    expect(today.dayNumber).toBe(11);
    expect(today.href).toBe('/schedule?view=day&date=2026-11-11');
  });

  it('ячейка с парами несёт точки с цветами типов и «+N» при переполнении', () => {
    const byDate = new Map([
      [
        '2026-11-11',
        toScheduleEventCards([
          row({ id: '1', kind: 'LECTURE' }),
          row({ id: '2', kind: 'LAB' }),
          row({ id: '3', kind: 'SEMINAR' }),
          row({ id: '4', kind: 'LECTURE' }),
          row({ id: '5', kind: 'LECTURE' }),
        ]),
      ],
    ]);
    const cellsWithDots = monthCellViews({ year: 2026, month: 11 }, byDate, '2026-11-11');
    const today = cellsWithDots.find((c) => c.dateKey === '2026-11-11')!;
    expect(today.dots).toHaveLength(4);
    expect(today.extra).toBe(1);
    expect(today.dots[0]).toBe('LECTURE');
    expect(today.dots[1]).toBe('LAB');
  });

  it('пустой день — ноль точек', () => {
    const empty = cells.find((c) => c.dateKey === '2026-11-14')!;
    expect(empty.dots).toHaveLength(0);
    expect(empty.extra).toBe(0);
  });
});

describe('monthDots', () => {
  it('капит 4 точек, остальное — в extra', () => {
    const events = toScheduleEventCards(Array.from({ length: 6 }, (_, i) => row({ id: `r${i}` })));
    expect(monthDots(events)).toEqual({
      dots: ['LECTURE', 'LECTURE', 'LECTURE', 'LECTURE'],
      extra: 2,
    });
  });
});

// ── Лента дат мобильного вида ─────────────────────────────────────────────────

describe('ribbonWeekDays', () => {
  const days = weekWindow(NOW, 2);

  it('возвращает ровно 7 дней недели выбранного дня', () => {
    const week = ribbonWeekDays(days.dateKeys, '2026-11-11');
    expect(week).toHaveLength(7);
    expect(week[0]).toBe('2026-11-09');
    expect(week[6]).toBe('2026-11-15');
  });

  it('переходит на соседнюю неделю при выборе её дня', () => {
    const week = ribbonWeekDays(days.dateKeys, '2026-10-27');
    expect(week[0]).toBe('2026-10-26');
  });

  it('у границы окна не падает (кламп в доступный диапазон)', () => {
    const week = ribbonWeekDays(['2026-11-09', '2026-11-10'], '2026-11-10');
    expect(week[0]).toBe('2026-11-09');
    expect(week.length).toBeGreaterThan(0);
  });
});

// ── Свайп ─────────────────────────────────────────────────────────────────────

describe('swipeDirection', () => {
  it('горизонтальный свайп влево — «next», вправо — «prev»', () => {
    expect(swipeDirection(300, 300, 200, 300)).toBe('next');
    expect(swipeDirection(200, 300, 320, 300)).toBe('prev');
  });

  it('вертикальный жест и короткий жест — не листают', () => {
    expect(swipeDirection(300, 300, 200, 460)).toBeNull();
    expect(swipeDirection(300, 300, 280, 300)).toBeNull();
  });
});

// ── Переключатель вида: перенос контекста ─────────────────────────────────────

describe('buildViewHref', () => {
  it('день → неделя: дата превращается в ключ ISO-недели', () => {
    expect(buildViewHref(new URLSearchParams('view=day&date=2026-11-11'), 'week', NOW)).toBe(
      '/schedule?view=week&week=2026-W46',
    );
  });

  it('неделя → день: понедельник недели становится датой', () => {
    expect(buildViewHref(new URLSearchParams('view=week&week=2026-W46'), 'day', NOW)).toBe(
      '/schedule?view=day&date=2026-11-09',
    );
  });

  it('день → месяц: месяц выбранного дня', () => {
    expect(buildViewHref(new URLSearchParams('view=day&date=2026-11-11'), 'month', NOW)).toBe(
      '/schedule?view=month&month=2026-11',
    );
  });

  it('месяц → день: текущий месяц даёт «сегодня», другой — 1-е число', () => {
    expect(buildViewHref(new URLSearchParams('view=month&month=2026-11'), 'day', NOW)).toBe(
      '/schedule?view=day&date=2026-11-11',
    );
    expect(buildViewHref(new URLSearchParams('view=month&month=2026-10'), 'day', NOW)).toBe(
      '/schedule?view=day&date=2026-10-01',
    );
  });

  it('без параметров переключение не добавляет лишнего (дефолты считает страница)', () => {
    expect(buildViewHref(new URLSearchParams(), 'day', NOW)).toBe('/schedule?view=day');
    expect(buildViewHref(new URLSearchParams(), 'week', NOW)).toBe('/schedule?view=week');
    expect(buildViewHref(new URLSearchParams(), 'month', NOW)).toBe('/schedule?view=month');
  });

  it('мусорные параметры не верятся на слово', () => {
    expect(
      buildViewHref(new URLSearchParams('view=week&week=junk&date=banana'), 'day', NOW),
    ).toBe('/schedule?view=day');
  });
});
