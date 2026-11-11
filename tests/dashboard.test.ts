// DIG-20 — «Ваша неделя»: агрегат главной и чистые помощники формата.
// Красная фаза: контракт зафиксирован ДО реализации — агрегат обязан
// собирать главную одним параллельным залпом (Promise.all по порту данных,
// никакого водопада), изолировать сбой каждого блока (settle → ok:false)
// и выводить сводку-строку детерминированно из данных, без LLM.
import { describe, expect, it } from 'vitest';

import {
  LESSON_KIND_LABELS,
  buildWeekSummary,
  daysLeftLabel,
  formatAverage,
  formatDateBadge,
  formatDelta,
  formatTimeRange,
  greetingFor,
  nearestStudyDayLabel,
  pluralRu,
  weekHeading,
} from '@/lib/dashboard-format';
import { getDashboard } from '@/server/data/dashboard';
import { createMemoryDataDb } from '@/server/data/memory-db';
import type { DataCtx, ScheduleEventRow } from '@/server/data/types';

// Детерминированное «сейчас»: среда 11 ноября 2026, 09:00 (локальное время).
const NOW = new Date(2026, 10, 11, 9, 0, 0);

const day = (offsetDays: number, hour: number, minute = 0): Date => {
  const d = new Date(NOW);
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hour, minute, 0, 0);
  return d;
};

const annaCtx: DataCtx = {
  userId: 'auth-anna',
  login: 'anna.smirnova',
  role: 'STUDENT',
  studentId: 'st-anna',
  groupName: 'ПИ-21',
  faculty: 'ИТ',
};

const lesson = (over: Partial<ScheduleEventRow> & { id: string }): ScheduleEventRow => ({
  groupName: 'ПИ-21',
  disciplineCode: 'PI21-X',
  disciplineName: 'Дисциплина',
  date: day(0, 10),
  startsAt: day(0, 10),
  endsAt: day(0, 11, 30),
  kind: 'LECTURE',
  room: '301',
  teacherName: 'Петров Пётр Петрович',
  status: 'SCHEDULED',
  note: null,
  ...over,
});

function seedDashboardDb() {
  const db = createMemoryDataDb();
  db.seed({
    students: [
      {
        id: 'st-anna',
        login: 'anna.smirnova',
        fullName: 'Анна Ковалёва',
        email: 'anna@example.edu',
        groupName: 'ПИ-21',
        course: 2,
        faculty: 'ИТ',
        program: 'Прикладная информатика',
        programCode: '09.03.04',
        studyForm: 'очная',
        funding: 'бюджет',
        gradebookNumber: '20231234',
      },
    ],
    grades: [
      {
        id: 'grd-1',
        studentId: 'st-anna',
        elementCode: 'E1',
        elementName: 'Тест 1',
        disciplineCode: 'PI21-INFO',
        disciplineName: 'Информатика',
        score: 88,
        maxScore: 100,
        weight: 0.3,
        kind: 'TEST',
        gradedAt: day(-14, 12),
        comment: null,
      },
      {
        id: 'grd-2',
        studentId: 'st-anna',
        elementCode: 'E2',
        elementName: 'Лабораторная 2',
        disciplineCode: 'PI21-PROG',
        disciplineName: 'Программирование',
        score: 92,
        maxScore: 100,
        weight: 0.4,
        kind: 'LAB',
        gradedAt: day(-10, 12),
        comment: null,
      },
      {
        id: 'grd-3',
        studentId: 'st-anna',
        elementCode: 'E3',
        elementName: 'Проект',
        disciplineCode: 'PI21-DB',
        disciplineName: 'Базы данных',
        score: 85,
        maxScore: 100,
        weight: 0.3,
        kind: 'PROJECT',
        gradedAt: day(-4, 12),
        comment: null,
      },
    ],
    schedule: [
      lesson({ id: 'sch-1', disciplineName: 'Информатика', startsAt: day(0, 10), endsAt: day(0, 11, 30) }),
      // Перенесённая пара: ауд. 214 → 305
      lesson({
        id: 'sch-2',
        disciplineName: 'Программирование',
        kind: 'LAB',
        startsAt: day(0, 12),
        endsAt: day(0, 13, 30),
        room: '305',
        previousRoom: '214',
        status: 'ROOM_CHANGED',
        note: 'Пара перенесена',
      }),
      // Отменённая пара
      lesson({
        id: 'sch-3',
        disciplineName: 'Физика',
        kind: 'LAB',
        startsAt: day(0, 14),
        endsAt: day(0, 15, 30),
        room: '212',
        status: 'CANCELLED',
        note: 'Лаборатория закрыта',
      }),
      // Онлайн-пара
      lesson({
        id: 'sch-4',
        disciplineName: 'История',
        kind: 'SEMINAR',
        startsAt: day(0, 15, 40),
        endsAt: day(0, 17, 10),
        room: 'Онлайн',
      }),
      // Завтра (не «сегодня»)
      lesson({
        id: 'sch-5',
        disciplineName: 'Базы данных',
        date: day(1, 12),
        startsAt: day(1, 12),
        endsAt: day(1, 13, 30),
      }),
    ],
    exams: [
      {
        id: 'exm-1',
        groupName: 'ПИ-21',
        disciplineCode: 'PI21-INFO',
        disciplineName: 'Информатика',
        kind: 'RETAKE',
        date: day(7, 9),
        startsAt: day(7, 9),
        room: '305',
        note: 'Пересдача теста 1',
      },
      {
        id: 'exm-2',
        groupName: 'ПИ-21',
        disciplineCode: 'PI21-PROG',
        disciplineName: 'Программирование',
        kind: 'CREDIT',
        date: day(9, 12),
        startsAt: day(9, 12),
        room: '405',
        note: null,
      },
      {
        id: 'exm-3',
        groupName: 'ПИ-21',
        disciplineCode: 'PI21-DB',
        disciplineName: 'Базы данных',
        kind: 'EXAM',
        date: day(12, 10),
        startsAt: day(12, 10),
        room: '301',
        note: null,
      },
      {
        id: 'exm-old',
        groupName: 'ПИ-21',
        disciplineCode: 'PI21-X',
        disciplineName: 'Прошедший зачёт',
        kind: 'CREDIT',
        date: day(-2, 12),
        startsAt: day(-2, 12),
        room: '301',
        note: null,
      },
    ],
    requests: [
      {
        id: 'req-1',
        studentId: 'st-anna',
        number: 'SR-2026-A1B2C1',
        type: 'CERTIFICATE',
        title: 'Справка об обучении',
        status: 'COMPLETED',
        assignee: null,
        resultNote: null,
        createdAt: day(-9, 10, 15),
        updatedAt: day(-8, 12),
      },
      {
        id: 'req-2',
        studentId: 'st-anna',
        number: 'SR-2026-A1B2C2',
        type: 'DORMITORY',
        title: 'Заявление на общежитие',
        status: 'IN_PROGRESS',
        assignee: null,
        resultNote: null,
        createdAt: day(-3, 10, 15),
        updatedAt: day(-2, 12),
      },
      {
        id: 'req-3',
        studentId: 'st-anna',
        number: 'SR-2026-A1B2C3',
        type: 'STATEMENT',
        title: 'Заявление на перезачёт',
        status: 'SUBMITTED',
        assignee: null,
        resultNote: null,
        createdAt: day(-1, 10, 15),
        updatedAt: day(-1, 12),
      },
    ],
  });
  return db;
}

describe('dashboard-format: чистые помощники', () => {
  it('pluralRu: 1 пара, 2 пары, 5 пар, 11 пар, 21 пара', () => {
    const forms = ['пара', 'пары', 'пар'] as const;
    expect(pluralRu(1, forms)).toBe('пара');
    expect(pluralRu(2, forms)).toBe('пары');
    expect(pluralRu(4, forms)).toBe('пары');
    expect(pluralRu(5, forms)).toBe('пар');
    expect(pluralRu(11, forms)).toBe('пар');
    expect(pluralRu(21, forms)).toBe('пара');
  });

  it('greetingFor: время суток определяет приветствие', () => {
    expect(greetingFor(new Date(2026, 10, 11, 7, 0))).toBe('Доброе утро');
    expect(greetingFor(new Date(2026, 10, 11, 14, 0))).toBe('Добрый день');
    expect(greetingFor(new Date(2026, 10, 11, 20, 0))).toBe('Добрый вечер');
    expect(greetingFor(new Date(2026, 10, 11, 2, 0))).toBe('Доброй ночи');
  });

  it('weekHeading: «Ваша неделя · <день недели, дата>»', () => {
    expect(weekHeading(NOW)).toBe('Ваша неделя · среда, 11 ноября');
  });

  it('formatTimeRange: интервал пары через тире', () => {
    expect(formatTimeRange(day(0, 10), day(0, 11, 30))).toBe('10:00–11:30');
  });

  it('formatDateBadge: число и короткий месяц для бейджа дедлайна', () => {
    const badge = formatDateBadge(day(7, 9));
    expect(badge.day).toBe('18');
    expect(badge.month).toBe('нояб.');
  });

  it('daysLeftLabel: сегодня/завтра/осталось N дн. с плюрализацией', () => {
    expect(daysLeftLabel(0)).toBe('Сегодня');
    expect(daysLeftLabel(1)).toBe('Завтра');
    expect(daysLeftLabel(2)).toBe('осталось 2 дня');
    expect(daysLeftLabel(3)).toBe('осталось 3 дня');
    expect(daysLeftLabel(7)).toBe('осталось 7 дней');
    expect(daysLeftLabel(11)).toBe('осталось 11 дней');
  });

  it('formatAverage/formatDelta: десятичная запятая и знак дельты', () => {
    expect(formatAverage(88.7)).toBe('88,7');
    expect(formatAverage(null)).toBe('—');
    expect(formatDelta(2.3)).toBe('+2,3');
    expect(formatDelta(-1.6)).toBe('−1,6');
    expect(formatDelta(null)).toBe('');
  });

  it('buildWeekSummary: детерминированная строка-резюме из данных', () => {
    expect(
      buildWeekSummary({ pairs: 4, moved: 1, cancelled: 1, retakeDaysLeft: 7 }),
    ).toBe('Сегодня 4 пары, одна перенесена, одна отменена. До пересдачи 7 дней.');
    expect(buildWeekSummary({ pairs: 2, moved: 0, cancelled: 0, retakeDaysLeft: null })).toBe(
      'Сегодня 2 пары.',
    );
    expect(buildWeekSummary({ pairs: 1, moved: 0, cancelled: 0, retakeDaysLeft: null })).toBe(
      'Сегодня 1 пара.',
    );
    expect(buildWeekSummary({ pairs: 3, moved: 2, cancelled: 0, retakeDaysLeft: 1 })).toBe(
      'Сегодня 3 пары, перенесено пар: 2. До пересдачи 1 день.',
    );
    expect(buildWeekSummary({ pairs: 0, moved: 0, cancelled: 0, retakeDaysLeft: null })).toBe(
      'Сегодня пар нет.',
    );
    expect(buildWeekSummary({ pairs: 0, moved: 0, cancelled: 0, retakeDaysLeft: 0 })).toBe(
      'Сегодня пар нет. Пересдача сегодня.',
    );
  });

  it('nearestStudyDayLabel: ближайший учебный день по-человечески', () => {
    expect(nearestStudyDayLabel(day(1, 12))).toBe('четверг, 12 ноября');
  });

  it('LESSON_KIND_LABELS: русские подписи типов занятий', () => {
    expect(LESSON_KIND_LABELS.LECTURE).toBe('Лекция');
    expect(LESSON_KIND_LABELS.PRACTICE).toBe('Практика');
    expect(LESSON_KIND_LABELS.LAB).toBe('Лабораторная');
    expect(LESSON_KIND_LABELS.SEMINAR).toBe('Семинар');
    expect(LESSON_KIND_LABELS.CONSULTATION).toBe('Консультация');
  });
});

describe('getDashboard: один параллельный агрегат', () => {
  it('«Сегодня»: только пары сегодняшнего дня, отсортированы по времени', async () => {
    const db = seedDashboardDb();
    const data = await getDashboard(db, annaCtx, NOW);

    expect(data.today.ok).toBe(true);
    if (!data.today.ok) return;
    const lessons = data.today.value.lessons;
    expect(lessons).toHaveLength(4);
    expect(lessons.map((l) => l.disciplineName)).toEqual([
      'Информатика',
      'Программирование',
      'Физика',
      'История',
    ]);
    // Хронология: 10:00 → 12:00 → 14:00 → 15:40
    const starts = lessons.map((l) => l.startsAt.getHours() * 60 + l.startsAt.getMinutes());
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
  });

  it('перенесённая пара: флаг и подпись «Перенос: ауд. 214 → 305»', async () => {
    const data = await getDashboard(seedDashboardDb(), annaCtx, NOW);
    if (!data.today.ok) throw new Error('today section must be ok');
    const moved = data.today.value.lessons.find((l) => l.disciplineName === 'Программирование');
    expect(moved?.isRescheduled).toBe(true);
    expect(moved?.transferNote).toBe('Перенос: ауд. 214 → 305');
    expect(moved?.isCancelled).toBe(false);
  });

  it('отменённая пара помечена, онлайн-пара распознана', async () => {
    const data = await getDashboard(seedDashboardDb(), annaCtx, NOW);
    if (!data.today.ok) throw new Error('today section must be ok');
    const cancelled = data.today.value.lessons.find((l) => l.disciplineName === 'Физика');
    expect(cancelled?.isCancelled).toBe(true);
    const online = data.today.value.lessons.find((l) => l.disciplineName === 'История');
    expect(online?.isOnline).toBe(true);
    // Сводка считает переносы/отмены
    expect(data.today.value.movedCount).toBe(1);
    expect(data.today.value.cancelledCount).toBe(1);
  });

  it('если пар нет — найден ближайший учебный день', async () => {
    // Отдельный адаптер: только завтрашняя пара, «сегодня» пусто.
    const dbNoToday = createMemoryDataDb();
    dbNoToday.seed({
      students: [
        {
          id: 'st-anna',
          login: 'anna.smirnova',
          fullName: 'Анна Ковалёва',
          email: 'anna@example.edu',
          groupName: 'ПИ-21',
          course: 2,
          faculty: 'ИТ',
          program: 'Прикладная информатика',
          programCode: null,
          studyForm: 'очная',
          funding: 'бюджет',
          gradebookNumber: '20231234',
        },
      ],
      schedule: [
        lesson({ id: 'sch-future', disciplineName: 'Базы данных', startsAt: day(1, 12), endsAt: day(1, 13, 30), date: day(1, 12) }),
      ],
    });
    const data = await getDashboard(dbNoToday, annaCtx, NOW);
    expect(data.today.ok).toBe(true);
    if (!data.today.ok) return;
    expect(data.today.value.lessons).toHaveLength(0);
    expect(data.today.value.nearestStudyDay).not.toBeNull();
    expect(data.today.value.nearestStudyDay?.count).toBe(1);
    expect(data.summary).toBe('Сегодня пар нет.');
  });

  it('«Ближайшие дедлайны»: только будущие, по возрастанию даты, максимум 3', async () => {
    const data = await getDashboard(seedDashboardDb(), annaCtx, NOW);
    expect(data.deadlines.ok).toBe(true);
    if (!data.deadlines.ok) return;
    const items = data.deadlines.value;
    expect(items).toHaveLength(3); // прошедший зачёт (−2 дня) отфильтрован
    expect(items.map((d) => d.disciplineName)).toEqual([
      'Информатика',
      'Программирование',
      'Базы данных',
    ]);
    expect(items[0]?.daysLeft).toBe(7);
    expect(items[0]?.kindLabel).toBe('Пересдача');
    expect(items[1]?.kindLabel).toBe('Зачёт');
    expect(items[2]?.kindLabel).toBe('Экзамен');
  });

  it('«Как у меня дела»: взвешенный средний балл, дельта, дисциплины, кредиты, долги', async () => {
    const data = await getDashboard(seedDashboardDb(), annaCtx, NOW);
    expect(data.progress.ok).toBe(true);
    if (!data.progress.ok) return;
    const progress = data.progress.value;
    // 88·0.3 + 92·0.4 + 85·0.3 = 88.7
    expect(progress.average).toBeCloseTo(88.7, 1);
    // Две последние работы (92·0.4 + 85·0.3)/0.7 = 89.0 против предыдущих (88): +1.0
    expect(progress.averageDelta).toBeCloseTo(1, 1);
    expect(progress.credits).toBe(120); // курс 2 × 60 кредитов
    expect(progress.creditsTotal).toBe(240);
    // Долг = ближайшая пересдача
    expect(progress.debts).toHaveLength(1);
    expect(progress.debts[0]?.disciplineName).toBe('Информатика');
    expect(progress.debts[0]?.daysLeft).toBe(7);
    // Полоски по дисциплинам с уровнем
    expect(progress.disciplines).toHaveLength(3);
    const prog = progress.disciplines.find((d) => d.disciplineName === 'Программирование');
    expect(prog?.average).toBeCloseTo(92, 1);
    expect(prog?.level).toBe('good');
  });

  it('«Заявки в работе»: SUBMITTED/IN_PROGRESS/NEEDS_REVISION считаются, COMPLETED/REJECTED — нет', async () => {
    const data = await getDashboard(seedDashboardDb(), annaCtx, NOW);
    expect(data.requests.ok).toBe(true);
    if (!data.requests.ok) return;
    expect(data.requests.value.inWork).toBe(2);
    expect(data.requests.value.total).toBe(3);
  });

  it('сводка-строка собрана из данных (без LLM) и приветствие — по имени', async () => {
    const data = await getDashboard(seedDashboardDb(), annaCtx, NOW);
    expect(data.summary).toBe(
      'Сегодня 4 пары, одна перенесена, одна отменена. До пересдачи 7 дней.',
    );
    expect(data.firstName).toBe('Анна');
    expect(data.greeting).toBe('Доброе утро');
    expect(data.headingDate).toBe('среда, 11 ноября');
  });

  it('сбой одного источника не роняет остальные блоки (изоляция ошибки блока)', async () => {
    const db = seedDashboardDb();
    db.listGradesByStudent = async () => {
      throw new Error('grades db down');
    };
    const data = await getDashboard(db, annaCtx, NOW);
    expect(data.progress.ok).toBe(false);
    if (!data.progress.ok) expect(data.progress.error).toContain('grades db down');
    // Остальные блоки живы
    expect(data.today.ok).toBe(true);
    expect(data.deadlines.ok).toBe(true);
    expect(data.requests.ok).toBe(true);
  });
});
