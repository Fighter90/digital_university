// DIG-22 — недельный вид расписания в стиле Google Calendar: чистая вью-логика.
// Красная фаза: контракт зафиксирован ДО реализации (src/lib/schedule-view.ts).
//
// Приёмка DIG-22, покрываемая здесь:
//  - URL отражает неделю: ключ «2026-W46» (ISO), парсинг/обратное
//    преобразование, невалидные и несуществующие недели → null;
//  - подпись недели «9 – 15 ноября 2026» (в т.ч. переход месяца/года);
//  - сетка 08:00–20:00, 64 px на час: top = (start − 480)/60·64,
//    height = duration/60·64, кламп за границы сетки;
//  - пересекающиеся пары делят ширину колонки, соседние «встык» — нет;
//  - блоки пар — кнопки с понятным aria-label
//    («Семинар, Математический анализ, 11:10–12:30, ауд. 305, перенос»);
//  - перенос: previousRoom/previousStartsAt превращаются в «было: ауд. 214»
//    и «было: 11:10»; отмена: пометка «отменена» в aria-label;
//  - мини-календарь месяца: строки целыми неделями (Пн–Вс), месяц по
//    четвергу отображаемой недели, «Ноябрь 2026».
import { describe, expect, it } from 'vitest';

import {
  GRID_END_MINUTES,
  GRID_HEIGHT_PX,
  GRID_START_MINUTES,
  PX_PER_HOUR,
  eventHeightPx,
  eventTopPx,
  formatWeekKey,
  isoWeekKeyOf,
  layoutDayEvents,
  lessonKindMeta,
  miniCalendarCells,
  mondayOfIsoWeekKey,
  toScheduleEventViews,
  weekLabel,
} from '@/lib/schedule-view';
import { fromMoscowWallClock, shiftMoscowDays, toMoscowIso } from '@/lib/schedule-time';
import type { ScheduleEventRow } from '@/server/data/types';

/** Пара из московских настенных компонент (как в tests/schedule.test.ts). */
const ev = (
  id: string,
  dayKey: string,
  startHour: number,
  startMinute: number,
  endHour: number,
  endMinute: number,
  over: Partial<ScheduleEventRow> = {},
): ScheduleEventRow => {
  const [y, m, d] = dayKey.split('-').map(Number);
  const startsAt = fromMoscowWallClock(y!, m!, d!, startHour, startMinute);
  return {
    id,
    groupName: 'ПИ-21',
    disciplineCode: 'PI21-MATH',
    disciplineName: 'Математический анализ',
    date: fromMoscowWallClock(y!, m!, d!),
    startsAt,
    endsAt: fromMoscowWallClock(y!, m!, d!, endHour, endMinute),
    kind: 'SEMINAR',
    room: '305',
    teacherName: 'Кузнецова Ксения Кирилловна',
    status: 'SCHEDULED',
    note: null,
    ...over,
  };
};

// ── 1. Ключ недели в URL (?week=2026-W46) ────────────────────────────────────

describe('weekKey: ISO-неделя в URL', () => {
  it('среда 11 ноября 2026 — неделя W46 с понедельником 9 ноября', () => {
    const wed = fromMoscowWallClock(2026, 11, 11, 12, 0);
    expect(isoWeekKeyOf(wed)).toBe('2026-W46');
    const monday = mondayOfIsoWeekKey('2026-W46');
    expect(monday).not.toBeNull();
    expect(toMoscowIso(monday!)).toBe('2026-11-09T00:00:00+03:00');
  });

  it('границы года: 29 дек 2025 → 2026-W01 (1 января 2026 — четверг), 2026-W53 существует', () => {
    expect(isoWeekKeyOf(fromMoscowWallClock(2025, 12, 29))).toBe('2026-W01');
    expect(isoWeekKeyOf(fromMoscowWallClock(2026, 1, 1))).toBe('2026-W01');
    expect(isoWeekKeyOf(fromMoscowWallClock(2026, 12, 28))).toBe('2026-W53');
    // Обратное преобразование тоже знает про 53-недельный 2026-й.
    expect(toMoscowIso(mondayOfIsoWeekKey('2026-W53')!)).toBe('2026-12-28T00:00:00+03:00');
    // А вот в 2027-м (1 января — пятница) 53-й недели нет.
    expect(mondayOfIsoWeekKey('2027-W53')).toBeNull();
    expect(isoWeekKeyOf(fromMoscowWallClock(2024, 12, 30))).toBe('2025-W01');
  });

  it('мусор в параметре — null: не-ключ, W00, W54, лишний формат', () => {
    expect(mondayOfIsoWeekKey('banana')).toBeNull();
    expect(mondayOfIsoWeekKey('2026-W00')).toBeNull();
    expect(mondayOfIsoWeekKey('2026-W54')).toBeNull();
    expect(mondayOfIsoWeekKey('2026-11-09')).toBeNull();
    expect(mondayOfIsoWeekKey('')).toBeNull();
    expect(formatWeekKey({ year: 2026, week: 46 })).toBe('2026-W46');
    expect(formatWeekKey({ year: 2026, week: 1 })).toBe('2026-W01');
  });

  it('round-trip: каждый понедельник 2026–2027 годов даёт ключ, парсящийся обратно', () => {
    let cursor = fromMoscowWallClock(2026, 1, 5); // понедельник
    for (let i = 0; i < 104; i += 1) {
      const key = isoWeekKeyOf(cursor);
      expect(mondayOfIsoWeekKey(key)).not.toBeNull();
      const back = mondayOfIsoWeekKey(key)!;
      expect(toMoscowIso(back)).toBe(toMoscowIso(cursor));
      cursor = shiftMoscowDays(cursor, 7);
    }
  });
});

// ── 2. Подпись недели («10 – 16 ноября 2026» из макета) ─────────────────────

describe('weekLabel: подпись недели', () => {
  it('один месяц: «9 – 15 ноября 2026»', () => {
    expect(weekLabel(fromMoscowWallClock(2026, 11, 9))).toBe('9 – 15 ноября 2026');
  });

  it('переход месяца: «30 ноября – 6 декабря 2026»', () => {
    expect(weekLabel(fromMoscowWallClock(2026, 11, 30))).toBe('30 ноября – 6 декабря 2026');
  });

  it('переход года: «28 декабря 2026 – 3 января 2027»', () => {
    expect(weekLabel(fromMoscowWallClock(2026, 12, 28))).toBe('28 декабря 2026 – 3 января 2027');
  });
});

// ── 3. Сетка 08:00–20:00, 64 px на час ───────────────────────────────────────

describe('позиционирование блока: формула из задачи', () => {
  it('константы сетки: 08:00–20:00 по 64 px на час', () => {
    expect(GRID_START_MINUTES).toBe(480);
    expect(GRID_END_MINUTES).toBe(1200);
    expect(PX_PER_HOUR).toBe(64);
  });

  it('top = (startMinutes − 480) / 60 · 64', () => {
    expect(eventTopPx(480)).toBe(0); // 08:00
    expect(eventTopPx(600)).toBe(128); // 10:00
    expect(eventTopPx(670)).toBe(202.66666666666666); // 11:10
  });

  it('height = duration / 60 · 64; до сетки — 0; кламп низа сетки', () => {
    expect(eventHeightPx(600, 690)).toBe(96); // 90 минут
    expect(eventHeightPx(600, 600)).toBe(0);
    expect(eventHeightPx(600, 500)).toBe(0);
    // Пара 23:40 вне сетки 08:00–20:00: top клампится к низу сетки (768 px),
    // высота внутри сетки — 0 (блок за пределами видимой сетки не рисуется).
    const top = eventTopPx(23 * 60 + 40);
    expect(top).toBe(GRID_HEIGHT_PX);
    expect(eventHeightPx(23 * 60 + 40, 25 * 60)).toBe(0);
  });
});

// ── 4. Пересекающиеся пары делят колонку ─────────────────────────────────────

describe('layoutDayEvents: пересечения', () => {
  it('без пересечений — каждая пара на всю ширину', () => {
    const laid = layoutDayEvents([
      { id: 'a', start: 600, end: 690 },
      { id: 'b', start: 720, end: 810 },
    ]);
    expect(laid.map((l) => ({ id: l.event.id, column: l.column, columns: l.columns }))).toEqual([
      { id: 'a', column: 0, columns: 1 },
      { id: 'b', column: 0, columns: 1 },
    ]);
  });

  it('две пересекающиеся пары делят ширину пополам', () => {
    const laid = layoutDayEvents([
      { id: 'a', start: 600, end: 720 },
      { id: 'b', start: 660, end: 780 },
    ]);
    expect(laid.map((l) => [l.event.id, l.column, l.columns])).toEqual([
      ['a', 0, 2],
      ['b', 1, 2],
    ]);
  });

  it('цепочка a→b→c: кластер из двух колонок, c возвращается в первую', () => {
    const laid = layoutDayEvents([
      { id: 'a', start: 540, end: 600 }, // 09:00–10:00
      { id: 'b', start: 570, end: 660 }, // 09:30–11:00
      { id: 'c', start: 630, end: 720 }, // 10:30–12:00
    ]);
    expect(laid.map((l) => [l.event.id, l.column, l.columns])).toEqual([
      ['a', 0, 2],
      ['b', 1, 2],
      ['c', 0, 2],
    ]);
  });

  it('пары «встык» (start = end соседа) не считаются пересечением', () => {
    const laid = layoutDayEvents([
      { id: 'a', start: 600, end: 690 },
      { id: 'b', start: 690, end: 780 },
    ]);
    expect(laid.every((l) => l.columns === 1)).toBe(true);
  });

  it('вход не обязан быть отсортированным', () => {
    const laid = layoutDayEvents([
      { id: 'b', start: 660, end: 780 },
      { id: 'a', start: 600, end: 720 },
    ]);
    expect(laid[0]?.event.id).toBe('a');
    expect(laid[0]?.columns).toBe(2);
  });
});

// ── 5. aria-label блоков пар ─────────────────────────────────────────────────

describe('toScheduleEventViews: модель блока и aria-label', () => {
  it('пример из приёмки: «Семинар, Математический анализ, 11:10–12:30, ауд. 305, перенос»', () => {
    const [view] = toScheduleEventViews([
      ev('x', '2026-11-11', 11, 10, 12, 30, {
        status: 'ROOM_CHANGED',
        room: '305',
        previousRoom: '214',
        previousStartsAt: fromMoscowWallClock(2026, 11, 11, 11, 10),
        changeNote: 'Оснащение аудитории',
      }),
    ]);
    expect(view?.ariaLabel).toBe('Семинар, Математический анализ, 11:10–12:30, ауд. 305, перенос');
    expect(view?.startMinutes).toBe(670);
    expect(view?.endMinutes).toBe(750);
    expect(view?.timeLabel).toBe('11:10–12:30');
    expect(view?.previousRoomLabel).toBe('было: ауд. 214');
    expect(view?.previousTimeLabel).toBe('было: 11:10');
    expect(view?.isMoved).toBe(true);
    expect(view?.isCancelled).toBe(false);
  });

  it('перенос времени: «было: 09:00», дата-ключ по московскому дню', () => {
    const [view] = toScheduleEventViews([
      ev('x', '2026-11-14', 11, 20, 12, 50, {
        status: 'TIME_CHANGED',
        previousStartsAt: fromMoscowWallClock(2026, 11, 13, 9, 0),
      }),
    ]);
    expect(view?.dateKey).toBe('2026-11-14');
    expect(view?.previousTimeLabel).toBe('было: 09:00');
    expect(view?.previousRoomLabel).toBeNull();
  });

  it('отменённая пара: «отменена» в aria-label, isCancelled', () => {
    const [view] = toScheduleEventViews([
      ev('x', '2026-11-11', 14, 0, 15, 30, { status: 'CANCELLED', note: 'Лаборатория закрыта' }),
    ]);
    expect(view?.ariaLabel).toBe('Семинар, Математический анализ, 14:00–15:30, ауд. 305, отменена');
    expect(view?.isCancelled).toBe(true);
    expect(view?.note).toBe('Лаборатория закрыта');
  });

  it('обычная пара без суффиксов; онлайн-пара без «ауд.»', () => {
    const views = toScheduleEventViews([
      ev('a', '2026-11-11', 10, 0, 11, 30),
      ev('b', '2026-11-11', 15, 40, 17, 10, { room: 'Онлайн' }),
    ]);
    expect(views[0]?.ariaLabel).toBe('Семинар, Математический анализ, 10:00–11:30, ауд. 305');
    expect(views[1]?.ariaLabel).toBe('Семинар, Математический анализ, 15:40–17:10, онлайн');
    expect(views[1]?.roomLabel).toBe('онлайн');
  });
});

// ── 6. Тип занятия: подпись и цвет дизайн-токенов ────────────────────────────

describe('lessonKindMeta: типы занятий из макета', () => {
  it('лекция коралловая, семинар синий, лабораторная зелёная, консультация янтарная', () => {
    expect(lessonKindMeta('LECTURE').label).toBe('Лекция');
    expect(lessonKindMeta('LECTURE').block).toContain('lesson-lecture');
    expect(lessonKindMeta('SEMINAR').label).toBe('Семинар');
    expect(lessonKindMeta('SEMINAR').block).toContain('lesson-seminar');
    expect(lessonKindMeta('LAB').label).toBe('Лабораторная');
    expect(lessonKindMeta('LAB').block).toContain('lesson-lab');
    expect(lessonKindMeta('CONSULTATION').block).toContain('lesson-exam');
    expect(lessonKindMeta('PRACTICE').label).toBe('Практика');
  });

  it('все пять типов имеют отличимые цвета блоков', () => {
    const blocks = (['LECTURE', 'SEMINAR', 'LAB', 'PRACTICE', 'CONSULTATION'] as const).map(
      (k) => lessonKindMeta(k).block,
    );
    expect(new Set(blocks).size).toBe(5);
  });
});

// ── 7. Мини-календарь месяца ─────────────────────────────────────────────────

describe('miniCalendarCells: месяц недели целыми строками Пн–Вс', () => {
  it('ноябрь 2026 (неделя 9–15 ноября): с 26 октября по 6 декабря, 6 строк', () => {
    const mini = miniCalendarCells(fromMoscowWallClock(2026, 11, 9));
    expect(mini.monthLabel).toBe('Ноябрь 2026');
    expect(mini.cells.length % 7).toBe(0);
    expect(mini.cells[0]?.dateKey).toBe('2026-10-26'); // понедельник перед 1 ноября (вс)
    expect(mini.cells.at(-1)?.dateKey).toBe('2026-12-06'); // воскресенье
    expect(mini.cells.length).toBe(42); // 1 ноября — воскресенье: 6 недель
    const keys = mini.cells.map((c) => c.dateKey);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain('2026-11-09');
    expect(keys).toContain('2026-11-15');
    // Ячейки вне месяца помечены
    expect(mini.cells[0]?.inMonth).toBe(false);
    expect(mini.cells.find((c) => c.dateKey === '2026-11-09')?.inMonth).toBe(true);
    expect(mini.cells.find((c) => c.dateKey === '2026-11-09')?.day).toBe(9);
    expect(mini.cells.find((c) => c.dateKey === '2026-11-30')?.inMonth).toBe(true);
    expect(mini.cells.find((c) => c.dateKey === '2026-10-26')?.inMonth).toBe(false);
  });

  it('переход месяца: неделя 30 ноября – 6 декабря показывает декабрь', () => {
    const mini = miniCalendarCells(fromMoscowWallClock(2026, 11, 30));
    expect(mini.monthLabel).toBe('Декабрь 2026');
    expect(mini.cells[0]?.dateKey).toBe('2026-11-30');
    expect(mini.cells.at(-1)?.dateKey).toBe('2027-01-03');
    expect(mini.cells.length).toBe(35);
  });
});
