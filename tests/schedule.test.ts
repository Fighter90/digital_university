// DIG-21 — серверная часть расписания: день/неделя/месяц, изменения, заметки.
// Красная фаза: контракт зафиксирован ДО реализации.
//
// Приёмка DIG-21:
//  - листание недель вперёд/назад в пределах семестра (pageMoscowWeek + кламп);
//  - перенос (previousRoom/previousStartsAt), отмена, пара на стыке недель;
//  - чужая группа → uniform null (404) + аудит OWNERSHIP_DENIED;
//  - ответ недели ≤ 100 мс на сидовых данных (сетка семестра ~700 пар);
//  - время в Europe/Moscow, наружу — ISO с офсетом +03:00.
import { describe, expect, it } from 'vitest';

import {
  MOSCOW_TZ,
  dayRange,
  formatMoscowTime,
  fromMoscowWallClock,
  monthRange,
  moscowDateKey,
  moscowParts,
  pageMoscowWeek,
  semesterBounds,
  startOfMoscowDay,
  startOfMoscowWeek,
  toMoscowIso,
  weekRange,
} from '@/lib/schedule-time';
import { createMemoryDataDb } from '@/server/data/memory-db';
import type { MemoryDataDb } from '@/server/data/memory-db';
import {
  applyScheduleChange,
  deleteEventNote,
  getDay,
  getEventDetails,
  getMonth,
  getNextStudyDay,
  getSchedule,
  getToday,
  getWeek,
  saveEventNote,
} from '@/server/data/schedule';
import type { DataCtx, ScheduleEventRow, StudentSettingsRow } from '@/server/data/types';

// Детерминированное «сейчас»: среда 11 ноября 2026, 09:00 по Москве.
const NOW = fromMoscowWallClock(2026, 11, 11, 9, 0);

const annaCtx: DataCtx = {
  userId: 'auth-anna',
  login: 'anna.smirnova',
  role: 'STUDENT',
  studentId: 'st-anna',
  groupName: 'ПИ-21',
  faculty: 'ИТ',
};

const ilyaCtx: DataCtx = {
  userId: 'auth-ilya',
  login: 'ilya.petrov',
  role: 'STUDENT',
  studentId: 'st-ilya',
  groupName: 'ЭК-11',
  faculty: 'ЭК',
};

const staffCtx: DataCtx = {
  userId: 'auth-dean',
  login: 'dean.kovaleva',
  role: 'STAFF',
  studentId: null,
  groupName: null,
  faculty: 'ИТ',
};

const student = (
  id: string,
  login: string,
  fullName: string,
  groupName: string,
): import('@/server/data/types').StudentRow => ({
  id,
  login,
  fullName,
  email: `${login}@example.edu`,
  groupName,
  course: 2,
  faculty: 'ИТ',
  program: 'Прикладная информатика',
  programCode: '09.03.04',
  studyForm: 'очная',
  funding: 'бюджет',
  gradebookNumber: '2023' + id.slice(-4),
});

const channelMatrix = (schedulePush: boolean): StudentSettingsRow['notificationChannels'] => {
  const on = { PUSH: true, EMAIL: true, TELEGRAM: false };
  return {
    SCHEDULE: { PUSH: schedulePush, EMAIL: true, TELEGRAM: false },
    GRADE: on,
    REQUEST: on,
    NEWS: on,
    DEADLINE: on,
    SYSTEM: on,
  };
};

/** Пара: московские день/час/минуты → инстанты startsAt/endsAt/date. */
const ev = (
  id: string,
  dayKey: string,
  hour: number,
  minute = 0,
  over: Partial<ScheduleEventRow> = {},
): ScheduleEventRow => {
  const [y, m, d] = dayKey.split('-').map(Number);
  const startsAt = fromMoscowWallClock(y, m!, d!, hour, minute);
  return {
    id,
    groupName: 'ПИ-21',
    disciplineCode: 'PI21-PROG',
    disciplineName: 'Программирование',
    date: startOfMoscowDay(startsAt),
    startsAt,
    endsAt: new Date(startsAt.getTime() + 90 * 60_000),
    kind: 'LECTURE',
    room: '301',
    teacherName: 'Петров Пётр Петрович',
    status: 'SCHEDULED',
    note: null,
    ...over,
  };
};

const lastDenial = (db: MemoryDataDb) => {
  const events = db.auditEvents();
  return events[events.length - 1];
};

/** Основной фикстурный набор недели 9–16 ноября 2026 + соседи. */
function seedScheduleDb(): MemoryDataDb {
  const db = createMemoryDataDb();
  db.seed({
    students: [
      student('st-anna', 'anna.smirnova', 'Анна Ковалёва', 'ПИ-21'),
      student('st-boris', 'boris.orlov', 'Борис Орлов', 'ПИ-21'),
      student('st-ilya', 'ilya.petrov', 'Илья Смирнов', 'ЭК-11'),
    ],
    staff: [
      {
        id: 'stf-maria',
        login: 'dean.kovaleva',
        fullName: 'Мария Петрова',
        position: 'Специалист деканата',
        email: 'maria.petrova@example.edu',
        faculty: 'ИТ',
      },
    ],
    settings: [
      {
        studentId: 'st-boris',
        phone: null,
        emailVisibleToStaff: true,
        phoneVisibleToStaff: true,
        // Борис отключил PUSH по расписанию — fan-out обязан его пропустить.
        notificationChannels: channelMatrix(false),
        theme: 'SYSTEM',
        widgets: [
          { id: 'today', enabled: true },
          { id: 'deadlines', enabled: true },
          { id: 'performance', enabled: true },
          { id: 'requests', enabled: true },
          { id: 'news', enabled: true },
          { id: 'events', enabled: true },
        ],
        quietHours: { enabled: false, from: '22:00', to: '08:00' },
        language: 'RU',
        fontSize: 'NORMAL',
        reduceMotion: false,
        updatedAt: NOW,
      },
    ],
    schedule: [
      ev('ev-prev-week', '2026-11-05', 10),
      ev('ev-move', '2026-11-11', 12, 0, {
        disciplineName: 'Информатика',
        disciplineCode: 'PI21-INFO',
        status: 'ROOM_CHANGED',
        room: '305',
        previousRoom: '214',
        changeNote: 'Оснащение аудитории',
      }),
      ev('ev-cancel', '2026-11-11', 14, 0, {
        disciplineName: 'Физика',
        disciplineCode: 'PI21-PHYS',
        kind: 'LAB',
        room: '212',
        status: 'CANCELLED',
        note: 'Лаборатория закрыта',
      }),
      ev('ev-nextstudy-1', '2026-11-12', 10, 40),
      ev('ev-staff-target', '2026-11-12', 12, 0, { room: '401' }),
      ev('ev-nextstudy-2', '2026-11-13', 9, 0, {
        disciplineName: 'Физика',
        disciplineCode: 'PI21-PHYS',
        kind: 'LAB',
        room: '212',
      }),
      ev('ev-boundary-sun', '2026-11-15', 23, 40),
      ev('ev-boundary-mon', '2026-11-16', 8, 10),
      ev('ev-month-dec', '2026-12-01', 10),
      ev('ev-foreign', '2026-11-12', 9, 0, {
        groupName: 'ЭК-11',
        disciplineCode: 'EK11-MATH',
        disciplineName: 'Математический анализ',
        room: '12',
      }),
    ],
    exams: [],
  });
  return db;
}

// ── 1. Время: Europe/Moscow, ISO ─────────────────────────────────────────────

describe('schedule-time: Europe/Moscow', () => {
  it('константа пояса и ISO с офсетом +03:00', () => {
    expect(MOSCOW_TZ).toBe('Europe/Moscow');
    const instant = fromMoscowWallClock(2026, 11, 11, 10, 0);
    expect(toMoscowIso(instant)).toBe('2026-11-11T10:00:00+03:00');
  });

  it('fromMoscowWallClock ↔ moscowParts: туда-обратно (включая високосный день)', () => {
    const instant = fromMoscowWallClock(2028, 2, 29, 23, 59, 59);
    expect(moscowParts(instant)).toEqual({
      year: 2028,
      month: 2,
      day: 29,
      hour: 23,
      minute: 59,
      second: 59,
    });
  });

  it('moscowDateKey: 23:30 UTC 10 ноября — это уже 11 ноября в Москве', () => {
    expect(moscowDateKey(new Date('2026-11-10T23:30:00Z'))).toBe('2026-11-11');
  });

  it('formatMoscowTime: HH:mm с ведущими нулями', () => {
    expect(formatMoscowTime(fromMoscowWallClock(2026, 11, 11, 9, 5))).toBe('09:05');
    expect(formatMoscowTime(fromMoscowWallClock(2026, 11, 11, 23, 40))).toBe('23:40');
  });

  it('startOfMoscowDay / shiftMoscowDays: границы московского дня', () => {
    const start = startOfMoscowDay(NOW);
    expect(toMoscowIso(start)).toBe('2026-11-11T00:00:00+03:00');
    expect(toMoscowIso(shiftDay(start, 1))).toBe('2026-11-12T00:00:00+03:00');
    expect(toMoscowIso(shiftDay(start, -1))).toBe('2026-11-10T00:00:00+03:00');
  });

  it('startOfMoscowWeek: неделя начинается с понедельника 00:00 MSK', () => {
    expect(toMoscowIso(startOfMoscowWeek(NOW))).toBe('2026-11-09T00:00:00+03:00');
    // Воскресенье 15 ноября 23:40 принадлежит неделе, начавшейся 9 ноября.
    expect(toMoscowIso(startOfMoscowWeek(fromMoscowWallClock(2026, 11, 15, 23, 40)))).toBe(
      '2026-11-09T00:00:00+03:00',
    );
  });

  it('weekRange/dayRange/monthRange: полуинтервалы [from, to)', () => {
    expect(weekRange(NOW)).toEqual({
      from: fromMoscowWallClock(2026, 11, 9),
      to: fromMoscowWallClock(2026, 11, 16),
    });
    expect(dayRange(NOW)).toEqual({
      from: fromMoscowWallClock(2026, 11, 11),
      to: fromMoscowWallClock(2026, 11, 12),
    });
    expect(monthRange(2026, 11)).toEqual({
      from: fromMoscowWallClock(2026, 11, 1),
      to: fromMoscowWallClock(2026, 12, 1),
    });
    // Ролловер месяца: декабрь → 1 января следующего года.
    expect(monthRange(2026, 12)).toEqual({
      from: fromMoscowWallClock(2026, 12, 1),
      to: fromMoscowWallClock(2027, 1, 1),
    });
  });

  it('semesterBounds: осень 2026/27 (ноябрь), весна 2026/27 (март), будущая осень (июль)', () => {
    const autumn = semesterBounds(NOW);
    expect(autumn.label).toBe('Осенний семестр 2026/27');
    expect(toMoscowIso(autumn.start)).toBe('2026-09-01T00:00:00+03:00');
    expect(toMoscowIso(autumn.end)).toBe('2027-01-25T00:00:00+03:00');

    const spring = semesterBounds(fromMoscowWallClock(2027, 3, 15, 12, 0));
    expect(spring.label).toBe('Весенний семестр 2026/27');
    expect(toMoscowIso(spring.start)).toBe('2027-02-09T00:00:00+03:00');
    expect(toMoscowIso(spring.end)).toBe('2027-06-30T00:00:00+03:00');

    const nextAutumn = semesterBounds(fromMoscowWallClock(2027, 7, 20, 12, 0));
    expect(nextAutumn.label).toBe('Осенний семестр 2027/28');
    expect(toMoscowIso(nextAutumn.start)).toBe('2027-09-01T00:00:00+03:00');
  });

  it('pageMoscowWeek: листание недели вперёд и назад', () => {
    const bounds = semesterBounds(NOW);
    const prev = pageMoscowWeek(NOW, -1, bounds);
    expect(prev && toMoscowIso(prev.from)).toBe('2026-11-02T00:00:00+03:00');
    const next = pageMoscowWeek(NOW, 1, bounds);
    expect(next && toMoscowIso(next.from)).toBe('2026-11-16T00:00:00+03:00');
    expect(next && toMoscowIso(next.to)).toBe('2026-11-23T00:00:00+03:00');
  });

  it('pageMoscowWeek: кламп в начало семестра и null за его пределами', () => {
    const bounds = semesterBounds(NOW);
    // Первая учебная неделя начинается 1 сентября (вторник) — интервал обрезается.
    const first = pageMoscowWeek(fromMoscowWallClock(2026, 9, 4, 12, 0), 0, bounds);
    expect(first && toMoscowIso(first.from)).toBe('2026-09-01T00:00:00+03:00');
    expect(first && toMoscowIso(first.to)).toBe('2026-09-07T00:00:00+03:00');
    // Неделя до начала семестра не существует.
    expect(pageMoscowWeek(fromMoscowWallClock(2026, 9, 4, 12, 0), -1, bounds)).toBeNull();
    // Последняя неделя семестра — 18–24 января; следующей страницы нет.
    const last = pageMoscowWeek(fromMoscowWallClock(2027, 1, 20, 12, 0), 0, bounds);
    expect(last && toMoscowIso(last.to)).toBe('2027-01-25T00:00:00+03:00');
    expect(pageMoscowWeek(fromMoscowWallClock(2027, 1, 20, 12, 0), 1, bounds)).toBeNull();
  });
});

function shiftDay(date: Date, days: number): Date {
  const p = moscowParts(date);
  return fromMoscowWallClock(p.year, p.month, p.day + days, p.hour, p.minute);
}

// ── 2. getSchedule: период, сортировка, скоуп группы ─────────────────────────

describe('getSchedule: пары группы за период', () => {
  it('возвращает пары только своей группы за [from, to), отсортированные по времени', async () => {
    const db = seedScheduleDb();
    const rows = await getSchedule(db, annaCtx, {
      from: fromMoscowWallClock(2026, 11, 9),
      to: fromMoscowWallClock(2026, 11, 16),
    });
    expect(rows.map((r) => r.id)).toEqual([
      'ev-move',
      'ev-cancel',
      'ev-nextstudy-1',
      'ev-staff-target',
      'ev-nextstudy-2',
      'ev-boundary-sun',
    ]);
    expect(rows.every((r) => r.groupName === 'ПИ-21')).toBe(true);
  });

  it('время наружу — ISO в часовом поясе Europe/Moscow (+03:00)', async () => {
    const db = seedScheduleDb();
    const rows = await getSchedule(db, annaCtx, {
      from: fromMoscowWallClock(2026, 11, 11),
      to: fromMoscowWallClock(2026, 11, 12),
    });
    expect(rows).toHaveLength(2);
    expect(toMoscowIso(rows[0]!.startsAt)).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+03:00$/);
    expect(toMoscowIso(rows[0]!.startsAt)).toBe('2026-11-11T12:00:00+03:00');
  });

  it('перенос: previousRoom/previousStartsAt и changeNote доходят до клиента', async () => {
    const db = seedScheduleDb();
    const rows = await getSchedule(db, annaCtx, {
      from: fromMoscowWallClock(2026, 11, 11),
      to: fromMoscowWallClock(2026, 11, 12),
    });
    const moved = rows.find((r) => r.id === 'ev-move');
    expect(moved?.status).toBe('ROOM_CHANGED');
    expect(moved?.room).toBe('305');
    expect(moved?.previousRoom).toBe('214');
    expect(moved?.changeNote).toBe('Оснащение аудитории');
    const cancelled = rows.find((r) => r.id === 'ev-cancel');
    expect(cancelled?.status).toBe('CANCELLED');
    expect(cancelled?.note).toBe('Лаборатория закрыта');
  });

  it('вырожденный интервал (from >= to) — пусто', async () => {
    const db = seedScheduleDb();
    const rows = await getSchedule(db, annaCtx, {
      from: fromMoscowWallClock(2026, 11, 12),
      to: fromMoscowWallClock(2026, 11, 11),
    });
    expect(rows).toEqual([]);
  });

  it('сотрудник без группы — пусто + аудит ROLE_MISMATCH', async () => {
    const db = seedScheduleDb();
    const rows = await getSchedule(db, staffCtx, {
      from: fromMoscowWallClock(2026, 11, 9),
      to: fromMoscowWallClock(2026, 11, 16),
    });
    expect(rows).toEqual([]);
    expect(lastDenial(db)?.reason).toBe('ROLE_MISMATCH');
    expect(lastDenial(db)?.resourceType).toBe('schedule');
  });
});

// ── 3. Неделя/день/месяц и стык недель ───────────────────────────────────────

describe('getWeek/getDay/getMonth: виды расписания', () => {
  it('неделя: воскресенье 23:40 внутри, понедельник 08:10 следующей недели — нет', async () => {
    const db = seedScheduleDb();
    const week1 = await getWeek(db, annaCtx, NOW, NOW);
    expect(week1.map((r) => r.id)).toContain('ev-boundary-sun');
    expect(week1.map((r) => r.id)).not.toContain('ev-boundary-mon');

    const week2 = await getWeek(db, annaCtx, fromMoscowWallClock(2026, 11, 18, 12, 0), NOW);
    expect(week2.map((r) => r.id)).toEqual(['ev-boundary-mon']);
  });

  it('листание недели назад через getSchedule: прошлонедельная пара находится', async () => {
    const db = seedScheduleDb();
    const page = pageMoscowWeek(NOW, -1, semesterBounds(NOW));
    expect(page).not.toBeNull();
    const rows = await getSchedule(db, annaCtx, page!);
    expect(rows.map((r) => r.id)).toEqual(['ev-prev-week']);
    // А «текущая» неделя её не содержит.
    const week1 = await getWeek(db, annaCtx, NOW, NOW);
    expect(week1.map((r) => r.id)).not.toContain('ev-prev-week');
  });

  it('неделя за пределами семестра — пусто (страницы нет)', async () => {
    const db = seedScheduleDb();
    const july = await getWeek(db, annaCtx, fromMoscowWallClock(2027, 7, 15, 12, 0), NOW);
    expect(july).toEqual([]);
  });

  it('день и «сегодня» — только пары московского сегодняшнего дня', async () => {
    const db = seedScheduleDb();
    const day = await getDay(db, annaCtx, NOW, NOW);
    expect(day.map((r) => r.id)).toEqual(['ev-move', 'ev-cancel']);
    const today = await getToday(db, annaCtx, NOW);
    expect(today.map((r) => r.id)).toEqual(['ev-move', 'ev-cancel']);
  });

  it('месяц: ноябрь целиком, без декабрьской и чужой группы', async () => {
    const db = seedScheduleDb();
    const rows = await getMonth(db, annaCtx, { year: 2026, month: 11 }, NOW);
    expect(rows.map((r) => r.id)).toEqual([
      'ev-prev-week',
      'ev-move',
      'ev-cancel',
      'ev-nextstudy-1',
      'ev-staff-target',
      'ev-nextstudy-2',
      'ev-boundary-sun',
      'ev-boundary-mon',
    ]);
    expect(rows.map((r) => r.id)).not.toContain('ev-month-dec');
    expect(rows.map((r) => r.id)).not.toContain('ev-foreign');
  });

  it('getNextStudyDay: ближайший день с парами после сегодня', async () => {
    const db = seedScheduleDb();
    const next = await getNextStudyDay(db, annaCtx, NOW);
    expect(next?.dateKey).toBe('2026-11-12');
    expect(next?.count).toBe(2);
    expect(next?.events.map((r) => r.id)).toEqual(['ev-nextstudy-1', 'ev-staff-target']);
  });

  it('getNextStudyDay: пустые дни пропускаются', async () => {
    const db = seedScheduleDb();
    // Убираем пары 12 ноября — ближайший учебный день станет 13-м.
    const rows = await getSchedule(db, annaCtx, {
      from: fromMoscowWallClock(2026, 11, 1),
      to: fromMoscowWallClock(2026, 12, 1),
    });
    const without12 = rows.filter((r) => moscowDateKey(r.startsAt) !== '2026-11-12');
    const db2 = createMemoryDataDb();
    db2.seed({ schedule: without12 });
    const next = await getNextStudyDay(db2, annaCtx, NOW);
    expect(next?.dateKey).toBe('2026-11-13');
    expect(next?.count).toBe(1);
  });

  it('getNextStudyDay: пар впереди нет — null', async () => {
    const db = createMemoryDataDb();
    db.seed({
      schedule: [ev('ev-only-today', '2026-11-11', 10)],
    });
    expect(await getNextStudyDay(db, annaCtx, NOW)).toBeNull();
  });
});

// ── 4. Детали пары: чужая группа → uniform 404 ───────────────────────────────

describe('getEventDetails: изоляция группы (IDOR)', () => {
  it('своя пара — детали с заметкой null', async () => {
    const db = seedScheduleDb();
    const details = await getEventDetails(db, annaCtx, 'ev-move');
    expect(details?.event.id).toBe('ev-move');
    expect(details?.event.previousRoom).toBe('214');
    expect(details?.note).toBeNull();
  });

  it('чужая группа — null + аудит OWNERSHIP_DENIED (ответ неотличим от 404)', async () => {
    const db = seedScheduleDb();
    expect(await getEventDetails(db, annaCtx, 'ev-foreign')).toBeNull();
    expect(await getEventDetails(db, ilyaCtx, 'ev-move')).toBeNull();
    expect(lastDenial(db)?.reason).toBe('OWNERSHIP_DENIED');
    expect(lastDenial(db)?.resourceRef).toBe('ev-move');
    expect(lastDenial(db)?.resourceType).toBe('schedule-event');
  });

  it('несуществующий id — null + аудит NOT_FOUND', async () => {
    const db = seedScheduleDb();
    expect(await getEventDetails(db, annaCtx, 'ev-nope')).toBeNull();
    expect(lastDenial(db)?.reason).toBe('NOT_FOUND');
  });

  it('сотрудник — null + аудит ROLE_MISMATCH', async () => {
    const db = seedScheduleDb();
    expect(await getEventDetails(db, staffCtx, 'ev-move')).toBeNull();
    expect(lastDenial(db)?.reason).toBe('ROLE_MISMATCH');
  });
});

// ── 5. Заметки студента к паре ───────────────────────────────────────────────

describe('заметки к паре: создать/изменить/удалить (только свои)', () => {
  it('создать → детали возвращают текст (trim), изменить → текст заменяется', async () => {
    const db = seedScheduleDb();
    const created = await saveEventNote(db, annaCtx, 'ev-move', '  Принести ноутбук  ', NOW);
    expect(created?.text).toBe('Принести ноутбук');

    let details = await getEventDetails(db, annaCtx, 'ev-move');
    expect(details?.note?.text).toBe('Принести ноутбук');

    const updated = await saveEventNote(db, annaCtx, 'ev-move', 'Взять конспект', NOW);
    expect(updated?.id).toBe(created?.id);
    expect(updated?.createdAt?.getTime()).toBe(created?.createdAt?.getTime());
    details = await getEventDetails(db, annaCtx, 'ev-move');
    expect(details?.note?.text).toBe('Взять конспект');
  });

  it('удалить своей пары → true, повторно → false (и аудит)', async () => {
    const db = seedScheduleDb();
    await saveEventNote(db, annaCtx, 'ev-move', 'Принести ноутбук', NOW);
    expect(await deleteEventNote(db, annaCtx, 'ev-move')).toBe(true);
    const details = await getEventDetails(db, annaCtx, 'ev-move');
    expect(details?.note).toBeNull();
    expect(await deleteEventNote(db, annaCtx, 'ev-move')).toBe(false);
    expect(lastDenial(db)?.reason).toBe('NOT_FOUND');
  });

  it('заметка к чужой паре — null + аудит OWNERSHIP_DENIED; удалить — false', async () => {
    const db = seedScheduleDb();
    expect(await saveEventNote(db, ilyaCtx, 'ev-move', 'Чужое', NOW)).toBeNull();
    expect(lastDenial(db)?.reason).toBe('OWNERSHIP_DENIED');
    expect(await deleteEventNote(db, ilyaCtx, 'ev-move')).toBe(false);
    expect(lastDenial(db)?.reason).toBe('OWNERSHIP_DENIED');
  });

  it('сотрудник заметки не пишет; пустой и слишком длинный текст — отказ без записи', async () => {
    const db = seedScheduleDb();
    expect(await saveEventNote(db, staffCtx, 'ev-move', 'Хм', NOW)).toBeNull();
    expect(lastDenial(db)?.reason).toBe('ROLE_MISMATCH');
    expect(await saveEventNote(db, annaCtx, 'ev-move', '   ', NOW)).toBeNull();
    expect(await saveEventNote(db, annaCtx, 'ev-move', 'x'.repeat(501), NOW)).toBeNull();
    const details = await getEventDetails(db, annaCtx, 'ev-move');
    expect(details?.note).toBeNull();
  });
});

// ── 6. Изменение пары сотрудником → событие изменения + уведомления группе ───

describe('applyScheduleChange: перенос/отмена сотрудником', () => {
  it('смена аудитории: статус/previousRoom, уведомление всем студентам группы', async () => {
    const db = seedScheduleDb();
    const saved = await applyScheduleChange(
      db,
      staffCtx,
      'ev-staff-target',
      { status: 'ROOM_CHANGED', room: '402', changeNote: 'Замена аудитории' },
      NOW,
    );
    expect(saved?.status).toBe('ROOM_CHANGED');
    expect(saved?.room).toBe('402');
    expect(saved?.previousRoom).toBe('401');
    expect(saved?.changeNote).toBe('Замена аудитории');

    const annaNotes = await db.listNotificationsByStudent('st-anna');
    expect(annaNotes).toHaveLength(1);
    expect(annaNotes[0]?.type).toBe('SCHEDULE');
    expect(annaNotes[0]?.title).toBe('Пара перенесена');
    expect(annaNotes[0]?.body).toBe(
      'Программирование (ПИ-21, 12:00): ауд. 401 → 402. Причина: Замена аудитории',
    );
    expect(annaNotes[0]?.link).toBe('/schedule');
    // Борис отключил PUSH по расписанию; Илья — другая группа.
    expect(await db.listNotificationsByStudent('st-boris')).toEqual([]);
    expect(await db.listNotificationsByStudent('st-ilya')).toEqual([]);
  });

  it('смена времени: previousStartsAt, date переезжает на новый московский день, длительность сохраняется', async () => {
    const db = seedScheduleDb();
    const saved = await applyScheduleChange(
      db,
      staffCtx,
      'ev-nextstudy-2',
      { status: 'TIME_CHANGED', startsAt: fromMoscowWallClock(2026, 11, 14, 11, 20) },
      NOW,
    );
    expect(saved?.status).toBe('TIME_CHANGED');
    expect(formatMoscowTime(saved!.previousStartsAt!)).toBe('09:00');
    expect(formatMoscowTime(saved!.startsAt)).toBe('11:20');
    expect(moscowDateKey(saved!.startsAt)).toBe('2026-11-14');
    expect(moscowDateKey(saved!.date)).toBe('2026-11-14');
    // Длительность пары сохраняется: было 09:00–10:30, стало 11:20–12:50.
    expect(formatMoscowTime(saved!.endsAt)).toBe('12:50');

    const annaNotes = await db.listNotificationsByStudent('st-anna');
    expect(annaNotes[0]?.title).toBe('Изменено время пары');
    expect(annaNotes[0]?.body).toBe('Физика (ПИ-21): время изменено — было 09:00, стало 11:20.');
  });

  it('отмена: статус CANCELLED, уведомление с причиной', async () => {
    const db = seedScheduleDb();
    const saved = await applyScheduleChange(
      db,
      staffCtx,
      'ev-nextstudy-1',
      { status: 'CANCELLED', changeNote: 'Заболевание преподавателя' },
      NOW,
    );
    expect(saved?.status).toBe('CANCELLED');
    const annaNotes = await db.listNotificationsByStudent('st-anna');
    expect(annaNotes[0]?.title).toBe('Пара отменена');
    expect(annaNotes[0]?.body).toBe(
      'Программирование (ПИ-21, 10:40) отменена. Причина: Заболевание преподавателя',
    );
  });

  it('студент менять пару не может: null + аудит ROLE_MISMATCH, данные не тронуты', async () => {
    const db = seedScheduleDb();
    const saved = await applyScheduleChange(
      db,
      annaCtx,
      'ev-staff-target',
      { status: 'CANCELLED' },
      NOW,
    );
    expect(saved).toBeNull();
    expect(lastDenial(db)?.reason).toBe('ROLE_MISMATCH');
    const details = await getEventDetails(db, annaCtx, 'ev-staff-target');
    expect(details?.event.status).toBe('SCHEDULED');
    expect(await db.listNotificationsByStudent('st-anna')).toEqual([]);
  });

  it('несуществующая пара и неполный ввод — null без записи и уведомлений', async () => {
    const db = seedScheduleDb();
    expect(
      await applyScheduleChange(db, staffCtx, 'ev-nope', { status: 'CANCELLED' }, NOW),
    ).toBeNull();
    expect(lastDenial(db)?.reason).toBe('NOT_FOUND');
    expect(
      await applyScheduleChange(db, staffCtx, 'ev-staff-target', { status: 'ROOM_CHANGED' }, NOW),
    ).toBeNull();
    expect(
      await applyScheduleChange(db, staffCtx, 'ev-staff-target', { status: 'TIME_CHANGED' }, NOW),
    ).toBeNull();
    const details = await getEventDetails(db, annaCtx, 'ev-staff-target');
    expect(details?.event.status).toBe('SCHEDULED');
    expect(await db.listNotificationsByStudent('st-anna')).toEqual([]);
  });
});

// ── 7. Производительность: ответ недели ≤ 100 мс на сидовых данных ──────────

describe('производительность недели (приёмка DIG-21)', () => {
  it('неделя из сетки семестра (~700 пар) считается быстрее 100 мс', async () => {
    const db = createMemoryDataDb();
    const events: ScheduleEventRow[] = [];
    const gridStart = fromMoscowWallClock(2026, 9, 7, 9, 0); // понедельник
    for (let w = 0; w < 16; w += 1) {
      for (let d = 0; d < 5; d += 1) {
        for (let p = 0; p < 4; p += 1) {
          const dayStart = shiftDay(gridStart, w * 7 + d);
          const startsAt = new Date(dayStart.getTime() + p * 2 * 60 * 60_000);
          events.push({
            id: `perf-pi21-${w}-${d}-${p}`,
            groupName: 'ПИ-21',
            disciplineCode: 'PI21-PROG',
            disciplineName: 'Программирование',
            date: startOfMoscowDay(startsAt),
            startsAt,
            endsAt: new Date(startsAt.getTime() + 90 * 60_000),
            kind: 'LECTURE',
            room: '301',
            teacherName: 'Петров Пётр Петрович',
            status: 'SCHEDULED',
            note: null,
          });
        }
      }
    }
    // Шум другой группы — фильтр не должен её возвращать.
    for (let i = 0; i < 100; i += 1) {
      const noise = { ...events[i]!, id: `perf-ek11-${i}`, groupName: 'ЭК-11' };
      events.push(noise);
    }
    db.seed({
      students: [student('st-anna', 'anna.smirnova', 'Анна Ковалёва', 'ПИ-21')],
      schedule: events,
    });

    const perfNow = fromMoscowWallClock(2026, 9, 20, 12, 0);
    const target = fromMoscowWallClock(2026, 10, 14, 12, 0); // неделя 12–18 октября

    await getWeek(db, annaCtx, target, perfNow); // прогрев
    const N = 25;
    const t0 = performance.now();
    for (let i = 0; i < N; i += 1) {
      const rows = await getWeek(db, annaCtx, target, perfNow);
      expect(rows).toHaveLength(20); // 5 дней × 4 пары, шум ЭК-11 отфильтрован
    }
    const averageMs = (performance.now() - t0) / N;
    expect(averageMs).toBeLessThan(100);
  });
});
