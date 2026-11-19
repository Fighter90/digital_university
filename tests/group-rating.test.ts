// DIG-103 — «Рейтинг группы» (/grades/rating): чистая логика сортировки
// и фасад слоя данных с owner-scope.
//
// Контракт задачи:
//  - таблица студентов СВОЕЙ группы: место №, ФИО, средний балл (2 знака),
//    тонкий прогресс-бар к шкале проекта (0–100, как в агрегате DIG-80);
//  - сортировка по среднему desc, при равенстве — по алфавиту; равные
//    средние — одно место (competition ranking, как «Рейтинг в группе»
//    сводки: место = 1 + число тех, кто строго выше);
//  - строка владельца помечена (isViewer) — на экране подсветка + «вы»;
//  - приватность: наружу уходят ТОЛЬКО ФИО и средний балл — чужие оценки
//    по дисциплинам не раскрываются;
//  - owner-scope: рейтинг строится только по группе из ctx (groupId из
//    сессии), студент другой группы в ответ не попадает; сотрудник —
//    null + аудит ROLE_MISMATCH;
//  - пустые состояния: в группе нет ни одной оценки — все строки без
//    места (hasAnyGrades=false → на экране honest empty-state); один
//    студент — таблица из одной строки;
//  - средний балл и место совпадают с агрегатом DIG-80
//    (getPerformance: gpa.overall и rating.rank) — единый источник.
import { describe, expect, it } from 'vitest';

import {
  buildGroupRatingRows,
  formatAverageScore,
  type GroupRatingEntry,
  type GroupRatingMember,
} from '@/lib/group-rating';
import { getGroupRating, getPerformance } from '@/server/data/performance';
import { createMemoryDataDb, type MemoryDataDb } from '@/server/data/memory-db';
import type { DataCtx, DisciplineElementRow, DisciplineRow, GradeRow } from '@/server/data/types';

// ── ctx владельца (ПИ-21) и студент чужой группы (ЭК-11) ────────────────────

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

// ── Фикстуры: одна дисциплина (3 кредита) с планом «тест + экзамен» ─────────

const discipline: DisciplineRow = {
  groupName: 'ПИ-21',
  disciplineCode: 'PI21-ALG',
  disciplineName: 'Алгоритмы',
  credits: 3,
  teacherName: 'Иванова Ирина Игоревна',
};

const elements: DisciplineElementRow[] = [
  {
    groupName: 'ПИ-21',
    disciplineCode: 'PI21-ALG',
    disciplineName: 'Алгоритмы',
    elementCode: 'PI21-ALG-T',
    elementName: 'Тест',
    kind: 'TEST',
    weight: 0.5,
    maxScore: 100,
  },
  {
    groupName: 'ПИ-21',
    disciplineCode: 'PI21-ALG',
    disciplineName: 'Алгоритмы',
    elementCode: 'PI21-ALG-EX',
    elementName: 'Экзамен',
    kind: 'EXAM',
    weight: 0.5,
    maxScore: 100,
  },
];

const g = (studentId: string, elementCode: string, score: number): GradeRow => ({
  id: `${studentId}-${elementCode}`,
  studentId,
  elementCode,
  elementName: elementCode.endsWith('-EX') ? 'Экзамен' : 'Тест',
  disciplineCode: 'PI21-ALG',
  disciplineName: 'Алгоритмы',
  score,
  maxScore: 100,
  weight: 0.5,
  kind: elementCode.endsWith('-EX') ? 'EXAM' : 'TEST',
  gradedAt: new Date(2026, 9, 20, 12),
  comment: null,
});

const member = (studentId: string, fullName: string): GroupRatingMember => ({
  studentId,
  fullName,
});

const entry = (studentId: string, fullName: string, average: number): GroupRatingEntry => ({
  studentId,
  fullName,
  average,
});

/** Полная строка StudentRow группы ПИ-21 (все поля вымышленные). */
function fullStudent(id: string, fullName: string) {
  return {
    id,
    login: id.replace(/^st-/, '') + '.demo',
    fullName,
    email: `${id}@example.edu`,
    groupName: 'ПИ-21',
    course: 2,
    faculty: 'ИТ',
    program: 'Программная инженерия',
    programCode: '09.03.04',
    studyForm: 'очная',
    funding: 'бюджет',
    gradebookNumber: `2026${id.length}${fullName.length}`,
  };
}

const GROUP_MEMBERS = [
  member('st-anna', 'Анна Ковалёва'),
  member('st-boris', 'Борис Орлов'),
  member('st-vera', 'Вера Иванова'),
  member('st-gleb', 'Глеб Фёдоров'),
];

function seedGroup(
  overrides?: Partial<{ students: GroupRatingMember[]; grades: GradeRow[] }>,
): MemoryDataDb {
  const db = createMemoryDataDb();
  const students = overrides?.students ?? GROUP_MEMBERS;
  db.seed({
    students: students.map((m) => fullStudent(m.studentId, m.fullName)),
    disciplines: [discipline],
    elements,
    grades: overrides?.grades ?? [],
  });
  return db;
}

// ── Чистая функция: сортировка, места, метка владельца ──────────────────────

describe('buildGroupRatingRows: сортировка и места', () => {
  it('сортировка по среднему desc, при равенстве — по алфавиту', () => {
    const rows = buildGroupRatingRows(
      [
        entry('st-c', 'Вера Иванова', 70),
        entry('st-a', 'Анна Ковалёва', 90),
        entry('st-b2', 'Борис Орлов', 70),
        entry('st-d', 'Глеб Фёдоров', 55),
      ],
      [
        member('st-a', 'Анна Ковалёва'),
        member('st-b2', 'Борис Орлов'),
        member('st-c', 'Вера Иванова'),
        member('st-d', 'Глеб Фёдоров'),
      ],
      'st-a',
    );
    expect(rows.map((r) => r.studentId)).toEqual(['st-a', 'st-b2', 'st-c', 'st-d']);
    expect(rows.map((r) => r.average)).toEqual([90, 70, 70, 55]);
  });

  it('равные средние — одно место (competition ranking), порядок по алфавиту', () => {
    const rows = buildGroupRatingRows(
      [
        entry('st-b2', 'Борис Орлов', 70),
        entry('st-a', 'Анна Ковалёва', 70),
        entry('st-d', 'Глеб Фёдоров', 55),
      ],
      [
        member('st-a', 'Анна Ковалёва'),
        member('st-b2', 'Борис Орлов'),
        member('st-d', 'Глеб Фёдоров'),
      ],
      null,
    );
    expect(rows.map((r) => [r.studentId, r.place])).toEqual([
      ['st-a', 1],
      ['st-b2', 1],
      ['st-d', 3], // 2 студента выше → место 3, «2» никому не достаётся
    ]);
  });

  it('студенты без оценок — после ранжированных, по алфавиту, без места', () => {
    const rows = buildGroupRatingRows(
      [entry('st-a', 'Анна Ковалёва', 90)],
      [
        member('st-a', 'Анна Ковалёва'),
        member('st-c', 'Вера Иванова'),
        member('st-b2', 'Борис Орлов'),
      ],
      'st-a',
    );
    expect(rows.map((r) => [r.studentId, r.place, r.average])).toEqual([
      ['st-a', 1, 90],
      ['st-b2', null, null],
      ['st-c', null, null],
    ]);
  });

  it('строка владельца помечена isViewer, остальные — нет', () => {
    const rows = buildGroupRatingRows(
      [entry('st-a', 'Анна Ковалёва', 90), entry('st-b2', 'Борис Орлов', 70)],
      [member('st-a', 'Анна Ковалёва'), member('st-b2', 'Борис Орлов')],
      'st-b2',
    );
    expect(rows.map((r) => r.isViewer)).toEqual([false, true]);
  });

  it('группа из одного студента — одна строка, место 1', () => {
    const rows = buildGroupRatingRows(
      [entry('st-a', 'Анна Ковалёва', 87)],
      [member('st-a', 'Анна Ковалёва')],
      'st-a',
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ studentId: 'st-a', place: 1, isViewer: true });
  });

  it('пустая группа — пустой список', () => {
    expect(buildGroupRatingRows([], [], null)).toEqual([]);
  });
});

describe('formatAverageScore: средний балл двумя знаками', () => {
  it('дробное — два знака, RU с запятой, EN с точкой', () => {
    expect(formatAverageScore(87.456)).toBe('87,46');
    expect(formatAverageScore(87.456, 'en')).toBe('87.46');
    expect(formatAverageScore(90.5)).toBe('90,50');
  });

  it('целое — тоже два знака (столбец выровнен)', () => {
    expect(formatAverageScore(87)).toBe('87,00');
    expect(formatAverageScore(87, 'en')).toBe('87.00');
  });
});

// ── Фасад слоя данных: единый агрегат + owner-scope ─────────────────────────

describe('getGroupRating: рейтинг своей группы', () => {
  it('места по GPA (единый расчёт с DIG-80), ФИО, только своя группа', async () => {
    const db = seedGroup({
      grades: [
        g('st-anna', 'PI21-ALG-T', 80),
        g('st-anna', 'PI21-ALG-EX', 90), // анна: 85
        g('st-boris', 'PI21-ALG-T', 95),
        g('st-boris', 'PI21-ALG-EX', 95), // борис: 95 — лидер
        g('st-vera', 'PI21-ALG-T', 70),
        g('st-vera', 'PI21-ALG-EX', 70), // вера: 70
        // глеб без оценок — строка без места
      ],
    });
    const view = await getGroupRating(db, annaCtx);
    expect(view).not.toBeNull();
    expect(view!.groupName).toBe('ПИ-21');
    expect(view!.hasAnyGrades).toBe(true);
    expect(view!.rows.map((r) => [r.studentId, r.place, r.average])).toEqual([
      ['st-boris', 1, 95],
      ['st-anna', 2, 85],
      ['st-vera', 3, 70],
      ['st-gleb', null, null],
    ]);
    expect(view!.rows.map((r) => r.isViewer)).toEqual([false, true, false, false]);
  });

  it('средний и место совпадают с агрегатом DIG-80 (единый источник)', async () => {
    const db = seedGroup({
      grades: [
        g('st-anna', 'PI21-ALG-T', 80),
        g('st-anna', 'PI21-ALG-EX', 90),
        g('st-boris', 'PI21-ALG-T', 95),
        g('st-boris', 'PI21-ALG-EX', 95),
        g('st-vera', 'PI21-ALG-T', 70),
        g('st-vera', 'PI21-ALG-EX', 70),
      ],
    });
    const [view, perf] = await Promise.all([
      getGroupRating(db, annaCtx),
      getPerformance(db, annaCtx, new Date(2026, 10, 11, 9)),
    ]);
    const mine = view!.rows.find((r) => r.studentId === annaCtx.studentId)!;
    expect(mine.average).not.toBeNull();
    expect(mine.average!).toBeCloseTo(perf.gpa!.overall!, 6);
    expect(mine.place).toBe(perf.rating!.rank);
    // И у соседа — то же единство расчёта.
    const boris = view!.rows.find((r) => r.studentId === 'st-boris')!;
    expect(boris.place).toBe(1);
    expect(boris.average!).toBeCloseTo(95, 6);
  });

  it('приватность: в строке только ФИО и средний — чужих оценок нет', async () => {
    const db = seedGroup({
      grades: [
        g('st-anna', 'PI21-ALG-T', 80),
        g('st-anna', 'PI21-ALG-EX', 90),
        g('st-boris', 'PI21-ALG-T', 95),
        g('st-boris', 'PI21-ALG-EX', 95),
      ],
    });
    const view = await getGroupRating(db, annaCtx);
    for (const row of view!.rows) {
      expect(Object.keys(row).sort()).toEqual(
        ['average', 'fullName', 'isViewer', 'place', 'studentId'].sort(),
      );
    }
  });

  it('owner-scope: студент чужой группы (ЭК-11) в рейтинг ПИ-21 не попадает', async () => {
    // ВНИМАНИЕ: memory-db.seed заменяет коллекции целиком — вся фикстура
    // (две группы + оценки) сеется ОДНИМ вызовом.
    const db = createMemoryDataDb();
    db.seed({
      students: [
        fullStudent('st-anna', 'Анна Ковалёва'),
        fullStudent('st-boris', 'Борис Орлов'),
        fullStudent('st-vera', 'Вера Иванова'),
        {
          id: 'st-ilya',
          login: 'ilya.petrov',
          fullName: 'Илья Петров',
          email: 'ilya.petrov@example.edu',
          groupName: 'ЭК-11',
          course: 1,
          faculty: 'ЭК',
          program: 'Экономика',
          programCode: '38.03.01',
          studyForm: 'очная',
          funding: 'контракт',
          gradebookNumber: '20254567',
        },
      ],
      disciplines: [discipline],
      elements,
      grades: [
        g('st-anna', 'PI21-ALG-T', 80),
        g('st-anna', 'PI21-ALG-EX', 90),
        // Илья из ЭК-11: сильный балл, но в рейтинг ПИ-21 попадать не должен.
        {
          id: 'st-ilya-EX',
          studentId: 'st-ilya',
          elementCode: 'EK11-MATH-EX',
          elementName: 'Экзамен',
          disciplineCode: 'EK11-MATH',
          disciplineName: 'Математический анализ',
          score: 99,
          maxScore: 100,
          weight: 1,
          kind: 'EXAM',
          gradedAt: new Date(2026, 9, 21, 12),
          comment: null,
        },
      ],
    });
    const view = await getGroupRating(db, annaCtx);
    expect(view!.rows.some((r) => r.studentId === 'st-ilya')).toBe(false);
    expect(view!.rows.map((r) => r.studentId).sort()).toEqual(['st-anna', 'st-boris', 'st-vera']);
    // И наоборот: Илья видит только свою группу.
    const ekView = await getGroupRating(db, ilyaCtx);
    expect(ekView!.groupName).toBe('ЭК-11');
    expect(ekView!.rows.map((r) => r.studentId)).toEqual(['st-ilya']);
    expect(ekView!.rows[0]!.average).toBeCloseTo(99, 6);
    expect(ekView!.rows[0]!.isViewer).toBe(true);
  });

  it('сотрудник: null + аудит ROLE_MISMATCH (студенческий скоуп недоступен)', async () => {
    const db = seedGroup({ grades: [g('st-anna', 'PI21-ALG-T', 80)] });
    expect(await getGroupRating(db, staffCtx)).toBeNull();
    const audits = db.auditEvents();
    expect(audits.length).toBeGreaterThanOrEqual(1);
    expect(
      audits.every((ev) => ev.reason === 'ROLE_MISMATCH' && ev.resourceType === 'performance'),
    ).toBe(true);
  });

  it('в группе нет ни одной оценки: все строки без места, hasAnyGrades=false', async () => {
    const db = seedGroup({});
    const view = await getGroupRating(db, annaCtx);
    expect(view!.hasAnyGrades).toBe(false);
    expect(view!.rows).toHaveLength(4);
    expect(view!.rows.every((r) => r.average === null && r.place === null)).toBe(true);
    expect(view!.rows.map((r) => r.isViewer)).toEqual([true, false, false, false]);
  });

  it('группа из одного студента: одна строка, место 1', async () => {
    const db = seedGroup({
      students: [member('st-anna', 'Анна Ковалёва')],
      grades: [g('st-anna', 'PI21-ALG-T', 80), g('st-anna', 'PI21-ALG-EX', 90)],
    });
    const view = await getGroupRating(db, annaCtx);
    expect(view!.rows).toHaveLength(1);
    expect(view!.rows[0]).toMatchObject({
      studentId: 'st-anna',
      place: 1,
      isViewer: true,
      fullName: 'Анна Ковалёва',
    });
  });
});

// ── Словарь: RU/EN парой, паритет ───────────────────────────────────────────

describe('i18n: grades.rating.*', () => {
  const RATING_KEYS = [
    'title.gradesRating',
    'meta.gradesRating',
    'loading.gradesRating',
    'grades.rating.link',
    'grades.rating.caption',
    'grades.rating.place',
    'grades.rating.student',
    'grades.rating.average',
    'grades.rating.you',
    'grades.rating.emptyTitle',
    'grades.rating.emptyDesc',
    'grades.rating.backToSummary',
  ] as const;

  it('ключи grades.rating.* есть в RU и EN (паритет, непустые)', async () => {
    const { ru } = await import('@/lib/i18n/ru');
    const { en } = await import('@/lib/i18n/en');
    for (const key of RATING_KEYS) {
      expect((ru as Record<string, string>)[key], `ru:${key}`).toBeTruthy();
      expect((en as Record<string, string>)[key], `en:${key}`).toBeTruthy();
    }
  });

  it('EN-значения новых ключей без кириллицы', async () => {
    const { en } = await import('@/lib/i18n/en');
    for (const [key, value] of Object.entries(en as Record<string, string>)) {
      if (key.startsWith('grades.rating.') || key === 'title.gradesRating') {
        expect(value, key).not.toMatch(/[а-яё]/i);
      }
    }
  });
});
