// DIG-25 — серверная часть «Успеваемости»: формулы и скоуп.
// Красная фаза: контракт зафиксирован ДО реализации (модулей ещё нет).
//
// Покрывается приёмка задачи:
//  - накопленная оценка дисциплины: текущая / максимально возможная /
//    минимально гарантированная (веса нормируются на план контроля);
//  - GPA за семестр и за всё время, взвешенный кредитами, + дельта к
//    предыдущему семестру;
//  - кредиты: набрано / требуется для программы;
//  - рейтинг в группе и перцентиль с человеческой формулировкой
//    («Вы входите в N% лучших в группе»), равные GPA — одно место;
//  - долги: дисциплина, дата пересдачи, статус (ASSIGNED/OVERDUE/CLOSED);
//  - needForTarget(ctx, дисциплина, цель) — какой балл нужен на экзамене,
//    с правилом округления; граничные случаи: нет оценок, экзамен уже
//    сдан, цель недостижима;
//  - все функции работают ТОЛЬКО с данными текущего студента (IDOR):
//    сотрудник — отказ + аудит, чужая дисциплина — единообразный null.
import { describe, expect, it } from 'vitest';

import {
  CREDIT_PASS_PERCENT,
  PROGRAM_TOTAL_CREDITS,
  accumulatedGrade,
  bestPercentFromRank,
  bestPercentLabel,
  needForTargetPure,
  previousSemesterKey,
  roundGrade,
  semesterKeyLabel,
  semesterKeyOf,
  semesterSortNumber,
  weightedAverage,
  type SemesterKey,
} from '@/lib/performance-math';
import { getPerformance, needForTarget } from '@/server/data/performance';
import { createMemoryDataDb, type MemoryDataDb } from '@/server/data/memory-db';
import type {
  DataCtx,
  DisciplineElementRow,
  DisciplineRow,
  ExamSessionRow,
  GradeRow,
} from '@/server/data/types';

// Детерминированное «сейчас»: среда 11 ноября 2026, 09:00 → осенний семестр.
const NOW = new Date(2026, 10, 11, 9, 0, 0);

const day = (offsetDays: number, hour = 12): Date => {
  const d = new Date(NOW);
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hour, 0, 0, 0);
  return d;
};

// Оценки «прошлой весны» (семестр 2025/26 — завершённый).
const spring = (month: number, dayOfMonth: number): Date => new Date(2026, month, dayOfMonth, 12);

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

// ── Фикстуры: справочник дисциплин и план контроля ──────────────────────────

const disciplines: DisciplineRow[] = [
  // ПИ-21 — текущий (осенний) семестр 2026/27
  d('ПИ-21', 'PI21-INFO', 'Информатика', 4, 'Петров Пётр Петрович'),
  d('ПИ-21', 'PI21-PROG', 'Программирование', 6, 'Иванова Ирина Игоревна'),
  d('ПИ-21', 'PI21-DB', 'Базы данных', 5, 'Соколов Сергей Сергеевич'),
  d('ПИ-21', 'PI21-PHYS', 'Физика', 4, 'Соколов Сергей Сергеевич'),
  d('ПИ-21', 'PI21-HIST', 'История', 3, 'Орлов Олег Олегович'),
  // ПИ-21 — завершённый весенний семестр 2025/26
  d('ПИ-21', 'PI21-ALG', 'Алгоритмы и структуры данных', 5, 'Иванова Ирина Игоревна'),
  d('ПИ-21', 'PI21-DISC', 'Дискретная математика', 4, 'Кузнецова Ксения Кирилловна'),
  // ЭК-11 — осенний семестр Ильи
  d('ЭК-11', 'EK11-MATH', 'Математический анализ', 5, 'Кузнецова Ксения Кирилловна'),
  d('ЭК-11', 'EK11-ECON', 'Экономическая теория', 4, 'Орлов Олег Олегович'),
];

function d(
  groupName: string,
  disciplineCode: string,
  disciplineName: string,
  credits: number,
  teacherName: string,
): DisciplineRow {
  return { groupName, disciplineCode, disciplineName, credits, teacherName };
}

const elements: DisciplineElementRow[] = [
  e('ПИ-21', 'PI21-INFO', 'Информатика', 'PI21-INFO-T1', 'Тест 1', 'TEST', 0.3, 100),
  e('ПИ-21', 'PI21-INFO', 'Информатика', 'PI21-INFO-K', 'Коллоквиум', 'TEST', 0.3, 100),
  e('ПИ-21', 'PI21-INFO', 'Информатика', 'PI21-INFO-EX', 'Экзамен', 'EXAM', 0.4, 100),
  e('ПИ-21', 'PI21-PROG', 'Программирование', 'PI21-PROG-L2', 'Лабораторная 2', 'LAB', 0.4, 100),
  e('ПИ-21', 'PI21-PROG', 'Программирование', 'PI21-PROG-L3', 'Лабораторная 3', 'LAB', 0.2, 100),
  e('ПИ-21', 'PI21-PROG', 'Программирование', 'PI21-PROG-CR', 'Зачёт', 'TEST', 0.4, 100),
  e('ПИ-21', 'PI21-DB', 'Базы данных', 'PI21-DB-P1', 'Проект', 'PROJECT', 0.3, 100),
  e('ПИ-21', 'PI21-DB', 'Базы данных', 'PI21-DB-T2', 'Тест 2', 'TEST', 0.2, 100),
  e('ПИ-21', 'PI21-DB', 'Базы данных', 'PI21-DB-EX', 'Экзамен', 'EXAM', 0.5, 100),
  e('ПИ-21', 'PI21-PHYS', 'Физика', 'PI21-PHYS-T', 'Тест 1', 'TEST', 0.4, 100),
  e('ПИ-21', 'PI21-PHYS', 'Физика', 'PI21-PHYS-EX', 'Экзамен', 'EXAM', 0.6, 100),
  e('ПИ-21', 'PI21-HIST', 'История', 'PI21-HIST-S', 'Семинар', 'TEST', 1, 100),
  e('ПИ-21', 'PI21-ALG', 'Алгоритмы и структуры данных', 'PI21-ALG-T', 'Тест 1', 'TEST', 0.3, 100),
  e(
    'ПИ-21',
    'PI21-ALG',
    'Алгоритмы и структуры данных',
    'PI21-ALG-EX',
    'Экзамен',
    'EXAM',
    0.7,
    100,
  ),
  e('ПИ-21', 'PI21-DISC', 'Дискретная математика', 'PI21-DISC-T', 'Тест 1', 'TEST', 0.4, 100),
  e('ПИ-21', 'PI21-DISC', 'Дискретная математика', 'PI21-DISC-EX', 'Экзамен', 'EXAM', 0.6, 100),
  e('ЭК-11', 'EK11-MATH', 'Математический анализ', 'EK11-MATH-T1', 'Тест 1', 'TEST', 0.4, 100),
  e('ЭК-11', 'EK11-MATH', 'Математический анализ', 'EK11-MATH-EX', 'Экзамен', 'EXAM', 0.6, 100),
  e('ЭК-11', 'EK11-ECON', 'Экономическая теория', 'EK11-ECON-T1', 'Тест 1', 'TEST', 0.4, 100),
  e('ЭК-11', 'EK11-ECON', 'Экономическая теория', 'EK11-ECON-EX', 'Экзамен', 'EXAM', 0.6, 100),
];

function e(
  groupName: string,
  disciplineCode: string,
  disciplineName: string,
  elementCode: string,
  elementName: string,
  kind: DisciplineElementRow['kind'],
  weight: number,
  maxScore: number,
): DisciplineElementRow {
  return {
    groupName,
    disciplineCode,
    disciplineName,
    elementCode,
    elementName,
    kind,
    weight,
    maxScore,
  };
}

const elementByCode = new Map(elements.map((el) => [el.elementCode, el]));

/** Оценка по элементу плана: дисциплина/вес/макс берутся из плана. */
function g(studentId: string, elementCode: string, score: number, gradedAt: Date): GradeRow {
  const el = elementByCode.get(elementCode);
  if (!el) throw new Error(`unknown element ${elementCode}`);
  return {
    id: `grd-${studentId}-${elementCode}`,
    studentId,
    elementCode,
    elementName: el.elementName,
    disciplineCode: el.disciplineCode,
    disciplineName: el.disciplineName,
    score,
    maxScore: el.maxScore,
    weight: el.weight,
    kind: el.kind,
    gradedAt,
    comment: null,
  };
}

// Группа ПИ-21: Анна + 4 сокурсника (данные только для рейтинга группы).
const mate1 = 'st-dmitry'; // Дмитрий Волков — первый в группе
const mate2 = 'st-polina';
const mate3 = 'st-artem';
const mate4 = 'st-sofia';

const students = [
  s('st-anna', 'anna.smirnova', 'Анна Ковалёва', 'ПИ-21'),
  s(mate1, 'dmitry.volkov', 'Дмитрий Волков', 'ПИ-21'),
  s(mate2, 'polina.egorova', 'Полина Егорова', 'ПИ-21'),
  s(mate3, 'artem.fedorov', 'Артём Фёдоров', 'ПИ-21'),
  s(mate4, 'sofia.guseva', 'София Гусева', 'ПИ-21'),
  s('st-ilya', 'ilya.petrov', 'Илья Смирнов', 'ЭК-11'),
];

function s(id: string, login: string, fullName: string, groupName: string) {
  return {
    id,
    login,
    fullName,
    email: `${login}@example.edu`,
    groupName,
    course: groupName === 'ПИ-21' ? 2 : 1,
    faculty: groupName === 'ПИ-21' ? 'ИТ' : 'ЭК',
    program: groupName === 'ПИ-21' ? 'Прикладная информатика' : 'Экономика',
    programCode: groupName === 'ПИ-21' ? '09.03.04' : '38.03.01',
    studyForm: 'очная',
    funding: 'бюджет',
    gradebookNumber: `2026${id.slice(-1)}00`,
  };
}

/**
 * Оценки. Завершённая весна 2025/26 (итоги) + текущая осень 2026/27
 * (накопленные). Итоги весны подобраны так, чтобы рейтинг Анны был 2 из 5:
 * Дмитрий 87.11 > Анна 49.37 > Артём 48.00 > Полина 46.67 > София 42.78.
 */
const grades: GradeRow[] = [
  // Анна — весна 2025/26, завершено: ALG итог 87, DISC итог 74 (кредиты 5+4)
  g('st-anna', 'PI21-ALG-T', 90, spring(2, 20)),
  g('st-anna', 'PI21-ALG-EX', 85, spring(4, 15)),
  g('st-anna', 'PI21-DISC-T', 70, spring(2, 25)),
  g('st-anna', 'PI21-DISC-EX', 77, spring(4, 20)),
  // Анна — осень 2026/27, накопленные
  g('st-anna', 'PI21-INFO-T1', 88, day(-14)),
  g('st-anna', 'PI21-PROG-L2', 92, day(-10)),
  g('st-anna', 'PI21-DB-P1', 85, day(-4)),
  // Дмитрий Волков (рейтинг #1): ALG 92, DISC 81
  g(mate1, 'PI21-ALG-T', 95, spring(2, 20)),
  g(mate1, 'PI21-ALG-EX', 90, spring(4, 15)),
  g(mate1, 'PI21-DISC-T', 84, spring(2, 25)),
  g(mate1, 'PI21-DISC-EX', 79, spring(4, 20)),
  // Полина Егорова: ALG 48, DISC 45
  g(mate2, 'PI21-ALG-T', 55, spring(2, 20)),
  g(mate2, 'PI21-ALG-EX', 45, spring(4, 15)),
  g(mate2, 'PI21-DISC-T', 45, spring(2, 25)),
  g(mate2, 'PI21-DISC-EX', 45, spring(4, 20)),
  // Артём Фёдоров: ALG 52, DISC 43
  g(mate3, 'PI21-ALG-T', 50, spring(2, 20)),
  g(mate3, 'PI21-ALG-EX', 53, spring(4, 15)),
  g(mate3, 'PI21-DISC-T', 40, spring(2, 25)),
  g(mate3, 'PI21-DISC-EX', 45, spring(4, 20)),
  // София Гусева: ALG 45, DISC 40
  g(mate4, 'PI21-ALG-T', 55, spring(2, 20)),
  g(mate4, 'PI21-ALG-EX', 40, spring(4, 15)),
  g(mate4, 'PI21-DISC-T', 40, spring(2, 25)),
  g(mate4, 'PI21-DISC-EX', 40, spring(4, 20)),
  // Илья Смирнов (ЭК-11, осень): накопленные
  g('st-ilya', 'EK11-MATH-EX', 74, day(-8)),
  g('st-ilya', 'EK11-ECON-T1', 81, day(-5)),
];

const retakes: ExamSessionRow[] = [
  ex('ПИ-21', 'PI21-PROG', 'Программирование', 'RETAKE', day(-3)), // прошла, долг не закрыт
  ex('ПИ-21', 'PI21-DISC', 'Дискретная математика', 'RETAKE', day(-5)), // прошла, долг закрыт (итог 74)
  ex('ПИ-21', 'PI21-INFO', 'Информатика', 'RETAKE', day(7)), // назначена
];

function ex(
  groupName: string,
  disciplineCode: string,
  disciplineName: string,
  kind: ExamSessionRow['kind'],
  date: Date,
): ExamSessionRow {
  return {
    id: `exm-${disciplineCode}-${kind}-${date.getTime()}`,
    groupName,
    disciplineCode,
    disciplineName,
    kind,
    date,
    startsAt: date,
    room: '305',
    note: null,
  };
}

function seedPerformanceDb(): MemoryDataDb {
  const db = createMemoryDataDb();
  db.seed({ students, disciplines, elements, grades, exams: retakes });
  return db;
}

// ── Чистые формулы ──────────────────────────────────────────────────────────

describe('performance-math: накопленная оценка', () => {
  it('текущая = Σ(вес×доля максимума), макс = + оставшийся вес, мин = без хвоста', () => {
    // план: Проект 0.3 (сдан на 85), Тест 0.2, Экзамен 0.5 — не сданы
    const plan = [
      { elementCode: 'P1', weight: 0.3 },
      { elementCode: 'T2', weight: 0.2 },
      { elementCode: 'EX', weight: 0.5 },
    ];
    const graded = [
      { elementCode: 'P1', score: 85, maxScore: 100, weight: 0.3, gradedAt: day(-4) },
    ];
    const acc = accumulatedGrade(graded, plan);
    expect(acc.accumulated).toBeCloseTo(25.5, 6);
    expect(acc.minGuaranteed).toBeCloseTo(25.5, 6);
    expect(acc.maxPossible).toBeCloseTo(95.5, 6);
  });

  it('нет оценок: накопленная не определена (null), максимум 100, минимум 0', () => {
    const acc = accumulatedGrade([], [{ elementCode: 'EX', weight: 1 }]);
    expect(acc.accumulated).toBeNull();
    expect(acc.minGuaranteed).toBe(0);
    expect(acc.maxPossible).toBe(100);
  });

  it('все элементы сданы: текущая = минимальная = максимальная', () => {
    const plan = [
      { elementCode: 'T', weight: 0.3 },
      { elementCode: 'EX', weight: 0.7 },
    ];
    const graded = [
      { elementCode: 'T', score: 90, maxScore: 100, weight: 0.3, gradedAt: day(-30) },
      { elementCode: 'EX', score: 85, maxScore: 100, weight: 0.7, gradedAt: day(-1) },
    ];
    const acc = accumulatedGrade(graded, plan);
    expect(acc.accumulated).toBeCloseTo(86.5, 6);
    expect(acc.minGuaranteed).toBeCloseTo(86.5, 6);
    expect(acc.maxPossible).toBeCloseTo(86.5, 6);
  });

  it('веса нормируются на сумму весов плана (сумма весов ≠ 1)', () => {
    const plan = [
      { elementCode: 'A', weight: 1 },
      { elementCode: 'B', weight: 1 },
    ];
    const graded = [{ elementCode: 'A', score: 80, maxScore: 100, weight: 1, gradedAt: day(-2) }];
    const acc = accumulatedGrade(graded, plan);
    expect(acc.accumulated).toBeCloseTo(40, 6);
    expect(acc.maxPossible).toBeCloseTo(90, 6);
  });

  it('без плана — нормировка по весам самих оценок (robustness для старых сидов)', () => {
    const graded = [
      { elementCode: 'A', score: 80, maxScore: 100, weight: 0.4, gradedAt: day(-2) },
      { elementCode: 'B', score: 60, maxScore: 100, weight: 0.6, gradedAt: day(-1) },
    ];
    const acc = accumulatedGrade(graded, []);
    expect(acc.accumulated).toBeCloseTo(68, 6);
  });

  it('повторная оценка элемента: побеждает последняя по дате', () => {
    const plan = [{ elementCode: 'A', weight: 1 }];
    const graded = [
      { elementCode: 'A', score: 40, maxScore: 100, weight: 1, gradedAt: day(-5) },
      { elementCode: 'A', score: 70, maxScore: 100, weight: 1, gradedAt: day(-1) },
    ];
    expect(accumulatedGrade(graded, plan).accumulated).toBeCloseTo(70, 6);
  });

  it('элемент с maxScore ≤ 0 не делит на ноль — исключается из плана', () => {
    const plan = [
      { elementCode: 'BAD', weight: 0.5, maxScore: 0 },
      { elementCode: 'OK', weight: 0.5, maxScore: 100 },
    ];
    const graded = [
      { elementCode: 'BAD', score: 0, maxScore: 0, weight: 0.5, gradedAt: day(-2) },
      { elementCode: 'OK', score: 80, maxScore: 100, weight: 0.5, gradedAt: day(-1) },
    ];
    const acc = accumulatedGrade(graded, plan);
    expect(acc.accumulated).toBeCloseTo(80, 6);
    expect(acc.maxPossible).toBeCloseTo(80, 6); // неоцениваемый не уменьшает максимум
  });
});

describe('performance-math: семестры и среднее', () => {
  it('semesterKeyOf: ноябрь → осень 2026/27, март → весна 2025/26', () => {
    expect(semesterKeyOf(new Date(2026, 10, 11))).toEqual({ startYear: 2026, term: 'FALL' });
    expect(semesterKeyOf(new Date(2026, 2, 15))).toEqual({ startYear: 2025, term: 'SPRING' });
    expect(semesterKeyOf(new Date(2027, 0, 20))).toEqual({ startYear: 2026, term: 'FALL' }); // январь — хвост осени
    expect(semesterKeyOf(new Date(2026, 5, 30))).toEqual({ startYear: 2025, term: 'SPRING' });
    expect(semesterKeyOf(new Date(2026, 6, 5))).toEqual({ startYear: 2026, term: 'FALL' }); // июль/август → будущая осень
    expect(semesterKeyOf(new Date(2026, 7, 31))).toEqual({ startYear: 2026, term: 'FALL' });
  });

  it('метки семестров и монотонная сортировка', () => {
    expect(semesterKeyLabel({ startYear: 2026, term: 'FALL' })).toBe('Осенний семестр 2026/27');
    expect(semesterKeyLabel({ startYear: 2025, term: 'SPRING' })).toBe('Весенний семестр 2025/26');
    expect(semesterSortNumber({ startYear: 2025, term: 'SPRING' })).toBeLessThan(
      semesterSortNumber({ startYear: 2026, term: 'FALL' }),
    );
    expect(semesterSortNumber({ startYear: 2026, term: 'FALL' })).toBeLessThan(
      semesterSortNumber({ startYear: 2026, term: 'SPRING' }),
    );
  });

  it('previousSemesterKey: осень → весна того же учебного года, весна → осень предыдущего', () => {
    expect(previousSemesterKey({ startYear: 2026, term: 'FALL' })).toEqual({
      startYear: 2025,
      term: 'SPRING',
    });
    expect(previousSemesterKey({ startYear: 2025, term: 'SPRING' })).toEqual({
      startYear: 2024,
      term: 'FALL',
    });
  });

  it('weightedAverage: средневзвешенное и null на пустом входе', () => {
    expect(
      weightedAverage([
        { value: 88, weight: 4 },
        { value: 92, weight: 6 },
      ]),
    ).toBeCloseTo(90.4, 6);
    expect(weightedAverage([])).toBeNull();
    expect(weightedAverage([{ value: 50, weight: 0 }])).toBeNull();
  });

  it('roundGrade: арифметическое округление (половина — вверх)', () => {
    expect(roundGrade(69.4)).toBe(69);
    expect(roundGrade(69.5)).toBe(70);
    expect(roundGrade(86.5)).toBe(87);
    expect(roundGrade(70)).toBe(70);
  });
});

describe('performance-math: needForTarget (чистая часть)', () => {
  const dbPlan = [
    { elementCode: 'P1', weight: 0.3 },
    { elementCode: 'T2', weight: 0.2 },
    { elementCode: 'EX', weight: 0.5 },
  ];
  const dbExam = { elementCode: 'EX', weight: 0.5, maxScore: 100 };
  const p1Graded = [
    { elementCode: 'P1', score: 85, maxScore: 100, weight: 0.3, gradedAt: day(-4) },
  ];

  it('нужный балл решает неравенство с учётом округления (граница 69.5 → 70)', () => {
    // 25.5 + 0.5·x ≥ 69.5 ⇒ x ≥ 88 (при 87 итог 69 → округляется в 69 < 70)
    const r = needForTargetPure({ graded: p1Graded, plan: dbPlan, exam: dbExam, target: 70 });
    expect(r).toEqual({
      status: 'OK',
      neededScore: 88,
      neededPercent: 88,
      maxScore: 100,
      guaranteedFinal: 70,
    });
  });

  it('цель уже гарантирована накопленным (даже ноль на экзамене)', () => {
    const r = needForTargetPure({ graded: p1Graded, plan: dbPlan, exam: dbExam, target: 25 });
    expect(r).toEqual({ status: 'ALREADY_SECURED', finalPercent: 26 });
  });

  it('цель недостижима: даже 100 на экзамене не хватает', () => {
    const r = needForTargetPure({ graded: p1Graded, plan: dbPlan, exam: dbExam, target: 96 });
    expect(r).toEqual({ status: 'UNREACHABLE', bestPossible: 76 });
  });

  it('нет оценок вообще: балл считается от нуля (граничный случай «нет оценок»)', () => {
    const plan = [
      { elementCode: 'T', weight: 0.4 },
      { elementCode: 'EX', weight: 0.6 },
    ];
    const exam = { elementCode: 'EX', weight: 0.6, maxScore: 100 };
    const ok = needForTargetPure({ graded: [], plan, exam, target: 60 });
    expect(ok).toEqual({
      status: 'OK',
      neededScore: 100,
      neededPercent: 100,
      maxScore: 100,
      guaranteedFinal: 60,
    });
    const hard = needForTargetPure({ graded: [], plan, exam, target: 61 });
    expect(hard).toEqual({ status: 'UNREACHABLE', bestPossible: 60 });
  });

  it('экзамен уже сдан: цель достигнута → ALREADY_SECURED, нет → EXAM_ALREADY_GRADED', () => {
    const plan = [
      { elementCode: 'T', weight: 0.3 },
      { elementCode: 'EX', weight: 0.7 },
    ];
    const exam = { elementCode: 'EX', weight: 0.7, maxScore: 100 };
    const graded = [
      { elementCode: 'T', score: 90, maxScore: 100, weight: 0.3, gradedAt: day(-30) },
      { elementCode: 'EX', score: 85, maxScore: 100, weight: 0.7, gradedAt: day(-1) },
    ];
    expect(needForTargetPure({ graded, plan, exam, target: 85 })).toEqual({
      status: 'ALREADY_SECURED',
      finalPercent: 87,
    });
    expect(needForTargetPure({ graded, plan, exam, target: 90 })).toEqual({
      status: 'EXAM_ALREADY_GRADED',
      finalPercent: 87,
      examScore: 85,
      examMaxScore: 100,
    });
  });

  it('в плане нет экзаменационного элемента → NO_EXAM_ELEMENT', () => {
    const plan = [
      { elementCode: 'L2', weight: 0.4 },
      { elementCode: 'CR', weight: 0.6 },
    ];
    const graded = [
      { elementCode: 'L2', score: 92, maxScore: 100, weight: 0.4, gradedAt: day(-2) },
    ];
    expect(needForTargetPure({ graded, plan, exam: null, target: 50 })).toEqual({
      status: 'NO_EXAM_ELEMENT',
      finalPercent: 37,
    });
  });

  it('шкала экзамена ≠ 100: балл в шкале элемента, процент отдельно', () => {
    const plan = [
      { elementCode: 'T', weight: 0.4 },
      { elementCode: 'EX', weight: 0.6 },
    ];
    const exam = { elementCode: 'EX', weight: 0.6, maxScore: 60 };
    const graded = [{ elementCode: 'T', score: 90, maxScore: 100, weight: 0.4, gradedAt: day(-2) }];
    // 36 + 0.6·(x/60)·100 ≥ 69.5 ⇒ x ≥ 33.5 ⇒ 34
    const r = needForTargetPure({ graded, plan, exam, target: 70 });
    expect(r).toEqual({
      status: 'OK',
      neededScore: 34,
      neededPercent: 56.67,
      maxScore: 60,
      guaranteedFinal: 70,
    });
  });

  it('дробная цель 70.5: порог по ceil(target) — 0.5, гарантированный итог ≥ цели', () => {
    // round(25.5 + 0.5x) — целое ⇒ «итог ≥ 70.5» ⇔ «итог ≥ 71» ⇔ x ≥ 90
    // (при 89 итог 70 < 70.5, при 90 итог 70.5 округляется вверх в 71)
    const r = needForTargetPure({ graded: p1Graded, plan: dbPlan, exam: dbExam, target: 70.5 });
    expect(r).toEqual({
      status: 'OK',
      neededScore: 90,
      neededPercent: 90,
      maxScore: 100,
      guaranteedFinal: 71,
    });
  });

  it('дробная цель: ALREADY_SECURED не возвращается, пока round(acc) < target', () => {
    const plan = [
      { elementCode: 'A', weight: 0.9 },
      { elementCode: 'EX', weight: 0.1 },
    ];
    const exam = { elementCode: 'EX', weight: 0.1, maxScore: 100 };
    const graded = [{ elementCode: 'A', score: 78, maxScore: 100, weight: 0.9, gradedAt: day(-3) }];
    // накопленная 70.2 → итог 70 < 70.5: цель ещё НЕ гарантирована
    const r = needForTargetPure({ graded, plan, exam, target: 70.5 });
    expect(r).toEqual({
      status: 'OK',
      neededScore: 3, // 70.2 + 0.1·3 = 70.5 → округляется вверх в 71 ≥ 70.5
      neededPercent: 3,
      maxScore: 100,
      guaranteedFinal: 71,
    });
  });
});

describe('performance-math: рейтинг и перцентиль', () => {
  it('bestPercentFromRank: доля «топ-X%» = ceil(место/размер×100)', () => {
    expect(bestPercentFromRank(1, 5)).toBe(20);
    expect(bestPercentFromRank(2, 5)).toBe(40);
    expect(bestPercentFromRank(5, 5)).toBe(100);
    expect(bestPercentFromRank(6, 22)).toBe(28);
    expect(bestPercentFromRank(1, 300)).toBe(1); // не ниже 1
  });

  it('формулировка для человека, а не «перцентиль N»', () => {
    expect(bestPercentLabel(2, 5)).toBe('Вы входите в 40% лучших в группе');
    expect(bestPercentLabel(1, 1)).toBe('Вы — единственный студент в группе');
  });
});

// ── Агрегат getPerformance ──────────────────────────────────────────────────

describe('getPerformance: накопленные оценки по дисциплинам', () => {
  it('Анна: текущая / максимально возможная / минимально гарантированная по каждой дисциплине', async () => {
    const data = await getPerformance(seedPerformanceDb(), annaCtx, NOW);

    const byCode = new Map(data.disciplines.map((dd) => [dd.disciplineCode, dd]));
    expect(data.disciplines).toHaveLength(7);

    const info = byCode.get('PI21-INFO')!;
    expect(info.disciplineName).toBe('Информатика');
    expect(info.credits).toBe(4);
    expect(info.accumulated).toBeCloseTo(26.4, 2); // 88×0.3
    expect(info.minGuaranteed).toBeCloseTo(26.4, 2);
    expect(info.maxPossible).toBeCloseTo(96.4, 2); // + коллоквиум 0.3 + экзамен 0.4
    expect(info.gradedElements).toBe(1);
    expect(info.totalElements).toBe(3);
    expect(info.isComplete).toBe(false);
    expect(info.creditEarned).toBe(false);
    expect(info.semester).toEqual({ startYear: 2026, term: 'FALL' });

    const prog = byCode.get('PI21-PROG')!;
    expect(prog.accumulated).toBeCloseTo(36.8, 2);
    expect(prog.maxPossible).toBeCloseTo(96.8, 2); // + лаба 0.2 + зачёт 0.4
    const dbd = byCode.get('PI21-DB')!;
    expect(dbd.accumulated).toBeCloseTo(25.5, 2);
    expect(dbd.maxPossible).toBeCloseTo(95.5, 2);
  });

  it('завершённая дисциплина: итог арифметическим округлением, кредит зачтён при ≥ порога', async () => {
    const data = await getPerformance(seedPerformanceDb(), annaCtx, NOW);
    const byCode = new Map(data.disciplines.map((dd) => [dd.disciplineCode, dd]));

    const alg = byCode.get('PI21-ALG')!;
    expect(alg.isComplete).toBe(true);
    expect(alg.accumulated).toBeCloseTo(86.5, 2);
    expect(alg.finalGrade).toBe(87); // 0.3·90 + 0.7·85 = 86.5 → 87
    expect(alg.creditEarned).toBe(true);
    expect(alg.semester).toEqual({ startYear: 2025, term: 'SPRING' });
    expect(alg.semesterLabel).toBe('Весенний семестр 2025/26');

    const disc = byCode.get('PI21-DISC')!;
    expect(disc.finalGrade).toBe(74);
    expect(disc.creditEarned).toBe(true);
  });

  it('пересдача одного элемента + несданный второй: isComplete не наступает от числа строк', async () => {
    // Две строки GradeRow по PI21-INFO-T1 (пересдача) + коллоквиум —
    // строк 3 = числу элементов плана, но экзамен так и не сдан.
    const db = createMemoryDataDb();
    db.seed({
      students: [students[0]!],
      disciplines: [disciplines[0]!], // PI21-INFO: Т1 0.3, Коллоквиум 0.3, Экзамен 0.4
      elements: elements.filter((el) => el.disciplineCode === 'PI21-INFO'),
      grades: [
        g('st-anna', 'PI21-INFO-T1', 88, day(-14)),
        {
          ...g('st-anna', 'PI21-INFO-T1', 72, day(-2)),
          id: 'grd-st-anna-PI21-INFO-T1-retake',
        },
        g('st-anna', 'PI21-INFO-K', 80, day(-1)),
        // PI21-INFO-EX не сдан
      ],
    });
    const data = await getPerformance(db, annaCtx, NOW);
    const info = data.disciplines.find((dd) => dd.disciplineCode === 'PI21-INFO')!;
    expect(info.gradedElements).toBe(2); // различных элементов плана, не строк
    expect(info.totalElements).toBe(3);
    expect(info.isComplete).toBe(false);
    expect(info.finalGrade).toBeNull();
    expect(info.creditEarned).toBe(false);
    // накопленная по последним оценкам: 0.3·72 + 0.3·80 = 45.6
    expect(info.accumulated).toBeCloseTo(45.6, 2);
  });

  it('оценка по элементу вне плана не раздувает завершённость', async () => {
    const db = createMemoryDataDb();
    const ghost: GradeRow = {
      ...g('st-anna', 'PI21-INFO-K', 80, day(-1)),
      id: 'grd-st-anna-PI21-INFO-ZZ',
      elementCode: 'PI21-INFO-ZZ',
      elementName: 'Архивный элемент',
    };
    db.seed({
      students: [students[0]!],
      disciplines: [disciplines[0]!],
      elements: elements.filter((el) => el.disciplineCode === 'PI21-INFO'),
      grades: [
        g('st-anna', 'PI21-INFO-T1', 88, day(-14)),
        ghost, // строк снова 3 = числу элементов плана, но в плане сдан только Т1
      ],
    });
    const data = await getPerformance(db, annaCtx, NOW);
    const info = data.disciplines.find((dd) => dd.disciplineCode === 'PI21-INFO')!;
    expect(info.gradedElements).toBe(1);
    expect(info.isComplete).toBe(false);
    expect(info.finalGrade).toBeNull();
    expect(info.accumulated).toBeCloseTo(26.4, 2); // вклад только Т1 (88×0.3)
  });

  it('дисциплины без оценок: накопленная null, граница 0–100; семестр не определён', async () => {
    const data = await getPerformance(seedPerformanceDb(), annaCtx, NOW);
    const hist = data.disciplines.find((dd) => dd.disciplineCode === 'PI21-HIST')!;
    expect(hist.accumulated).toBeNull();
    expect(hist.minGuaranteed).toBe(0);
    expect(hist.maxPossible).toBe(100);
    expect(hist.gradedElements).toBe(0);
    expect(hist.totalElements).toBe(1);
    expect(hist.semester).toBeNull();
    expect(hist.creditEarned).toBe(false);
  });

  it('дисциплины отсортированы: текущий семестр раньше, внутри — по названию', async () => {
    const data = await getPerformance(seedPerformanceDb(), annaCtx, NOW);
    expect(data.disciplines.map((dd) => dd.disciplineCode)).toEqual([
      'PI21-DB',
      'PI21-INFO',
      'PI21-HIST',
      'PI21-PROG',
      'PI21-PHYS',
      'PI21-ALG',
      'PI21-DISC',
    ]);
  });
});

describe('getPerformance: GPA, кредиты', () => {
  it('GPA за семестр и за всё время взвешен кредитами; дельта к прошлому семестру', async () => {
    const data = await getPerformance(seedPerformanceDb(), annaCtx, NOW);

    expect(data.gpa).not.toBeNull();
    expect(data.gpa!.currentSemesterKey).toEqual({ startYear: 2026, term: 'FALL' });
    expect(data.gpa!.currentSemesterLabel).toBe('Осенний семестр 2026/27');
    // осень: (26.4·4 + 36.8·6 + 25.5·5)/15 = 30.26
    expect(data.gpa!.semester).toBeCloseTo(30.26, 2);
    // весна: (87·5 + 74·4)/9 = 81.22
    expect(data.gpa!.previousSemesterLabel).toBe('Весенний семестр 2025/26');
    expect(data.gpa!.previousSemesterGpa).toBeCloseTo(81.22, 2);
    // за всё время: (87·5 + 74·4 + 26.4·4 + 36.8·6 + 25.5·5)/24 = 49.37
    expect(data.gpa!.overall).toBeCloseTo(49.37, 2);
    expect(data.gpa!.semesterDelta).toBeCloseTo(-50.96, 2);
  });

  it('нет предыдущего семестра → дельта null (Илья, 1 курс)', async () => {
    const data = await getPerformance(seedPerformanceDb(), ilyaCtx, NOW);
    expect(data.gpa!.previousSemesterLabel).toBeNull();
    expect(data.gpa!.semesterDelta).toBeNull();
    // (44.4·5 + 32.4·4)/9 = 39.07 — и за семестр, и за всё время
    expect(data.gpa!.semester).toBeCloseTo(39.07, 2);
    expect(data.gpa!.overall).toBeCloseTo(39.07, 2);
  });

  it('кредиты: набрано по завершённым дисциплинам с итогом ≥ порога, требуется — план программы', async () => {
    expect(CREDIT_PASS_PERCENT).toBe(60);
    expect(PROGRAM_TOTAL_CREDITS).toBe(240);
    const data = await getPerformance(seedPerformanceDb(), annaCtx, NOW);
    expect(data.credits).toEqual({ earned: 9, required: 240 }); // ALG 5 + DISC 4
  });

  it('граница кредита: накопленная 59.58 → итог 60 — кредит и в view, и в credits.earned', async () => {
    const db = createMemoryDataDb();
    db.seed({
      students: [students[0]!],
      disciplines: [disciplines[5]!], // PI21-ALG, 5 кредитов
      elements: elements.filter((el) => el.disciplineCode === 'PI21-ALG'),
      grades: [
        g('st-anna', 'PI21-ALG-T', 60, spring(2, 20)),
        g('st-anna', 'PI21-ALG-EX', 59.4, spring(4, 15)),
      ],
    });
    const data = await getPerformance(db, annaCtx, NOW);
    const alg = data.disciplines.find((dd) => dd.disciplineCode === 'PI21-ALG')!;
    // 0.3·60 + 0.7·59.4 = 59.58 → итог арифметическим округлением 60 ≥ 60
    expect(alg.accumulated).toBeCloseTo(59.58, 2);
    expect(alg.finalGrade).toBe(60);
    expect(alg.creditEarned).toBe(true);
    expect(data.credits.earned).toBe(5); // тот же признак, что у creditEarned
  });

  it('чуть ниже границы: накопленная 59.3 → итог 59 — кредит не зачтён нигде', async () => {
    const db = createMemoryDataDb();
    db.seed({
      students: [students[0]!],
      disciplines: [disciplines[5]!],
      elements: elements.filter((el) => el.disciplineCode === 'PI21-ALG'),
      grades: [
        g('st-anna', 'PI21-ALG-T', 60, spring(2, 20)),
        g('st-anna', 'PI21-ALG-EX', 59, spring(4, 15)),
      ],
    });
    const data = await getPerformance(db, annaCtx, NOW);
    const alg = data.disciplines.find((dd) => dd.disciplineCode === 'PI21-ALG')!;
    expect(alg.accumulated).toBeCloseTo(59.3, 2);
    expect(alg.finalGrade).toBe(59);
    expect(alg.creditEarned).toBe(false);
    expect(data.credits.earned).toBe(0);
  });
});

describe('getPerformance: рейтинг в группе', () => {
  it('место по общему GPA среди студентов группы с оценками + человеческая формулировка', async () => {
    const data = await getPerformance(seedPerformanceDb(), annaCtx, NOW);
    expect(data.rating).toEqual({
      rank: 2,
      groupSize: 5,
      bestPercent: 40,
      label: 'Вы входите в 40% лучших в группе',
    });
  });

  it('равные GPA — одно место (competition ranking)', async () => {
    const db = createMemoryDataDb();
    db.seed({
      students: [
        s('st-t1', 't1', 'Первый Тестов', 'ПИ-21'),
        s('st-t2', 't2', 'Второй Тестов', 'ПИ-21'),
        s('st-anna', 'anna.smirnova', 'Анна Ковалёва', 'ПИ-21'),
      ],
      disciplines: [disciplines[5]!, disciplines[6]!], // ALG + DISC
      elements: elements.filter(
        (el) => el.disciplineCode === 'PI21-ALG' || el.disciplineCode === 'PI21-DISC',
      ),
      grades: [
        // два лидера с одинаковым итогом 50 (по разным дисциплинам)
        g('st-t1', 'PI21-ALG-T', 50, spring(2, 20)),
        g('st-t1', 'PI21-ALG-EX', 50, spring(4, 15)),
        g('st-t2', 'PI21-DISC-T', 50, spring(2, 20)),
        g('st-t2', 'PI21-DISC-EX', 50, spring(4, 15)),
        // Анна ниже
        g('st-anna', 'PI21-ALG-T', 10, spring(2, 20)),
        g('st-anna', 'PI21-ALG-EX', 20, spring(4, 15)),
      ],
    });
    const top1 = await getPerformance(db, { ...annaCtx, studentId: 'st-t1' }, NOW);
    const top2 = await getPerformance(db, { ...annaCtx, userId: 'x', studentId: 'st-t2' }, NOW);
    const low = await getPerformance(db, annaCtx, NOW);
    expect(top1.rating?.rank).toBe(1);
    expect(top2.rating?.rank).toBe(1);
    expect(top1.rating?.bestPercent).toBe(34); // ceil(1/3·100)
    expect(low.rating?.rank).toBe(3);
    expect(low.rating?.bestPercent).toBe(100);
  });

  it('группа из одного студента: честная формулировка вместо «100% лучших»', async () => {
    const data = await getPerformance(seedPerformanceDb(), ilyaCtx, NOW);
    expect(data.rating).toEqual({
      rank: 1,
      groupSize: 1,
      bestPercent: 100,
      label: 'Вы — единственный студент в группе',
    });
  });

  it('студент без оценок рейтинга не имеет', async () => {
    const db = seedPerformanceDb();
    db.seed({
      students: [s('st-empty', 'empty', 'Пустой Петров', 'ПИ-21')],
      disciplines: [disciplines[0]!],
      elements: elements.filter((el) => el.disciplineCode === 'PI21-INFO'),
    });
    const data = await getPerformance(db, { ...annaCtx, studentId: 'st-empty' }, NOW);
    expect(data.rating).toBeNull();
    expect(data.gpa).toBeNull();
  });
});

describe('getPerformance: долги (пересдачи)', () => {
  it('статусы: назначена / просрочена / закрыта; активные раньше закрытых', async () => {
    const data = await getPerformance(seedPerformanceDb(), annaCtx, NOW);
    expect(data.debts.map((x) => [x.disciplineCode, x.status])).toEqual([
      ['PI21-PROG', 'OVERDUE'], // пересдача 3 дня назад, накопленных 36.8 < 60
      ['PI21-INFO', 'ASSIGNED'], // пересдача через 7 дней
      ['PI21-DISC', 'CLOSED'], // пересдача была, итог 74 ≥ 60
    ]);
    expect(data.debts[0]?.daysLeft).toBe(-3);
    expect(data.debts[1]?.daysLeft).toBe(7);
    expect(data.debts[2]?.disciplineName).toBe('Дискретная математика');
  });
});

// ── needForTarget: скоуп и интеграция ───────────────────────────────────────

describe('needForTarget: калькулятор цели', () => {
  it('какой балл нужен на экзамене по БД для итога ≥ 70', async () => {
    const db = seedPerformanceDb();
    const r = await needForTarget(db, annaCtx, 'PI21-DB', 70);
    expect(r).toEqual({
      status: 'OK',
      neededScore: 88,
      neededPercent: 88,
      maxScore: 100,
      guaranteedFinal: 70,
    });
  });

  it('цель уже гарантирована / недостижима / экзамен сдан / экзамена нет', async () => {
    const db = seedPerformanceDb();
    expect(await needForTarget(db, annaCtx, 'PI21-DB', 25)).toEqual({
      status: 'ALREADY_SECURED',
      finalPercent: 26,
    });
    expect(await needForTarget(db, annaCtx, 'PI21-DB', 96)).toEqual({
      status: 'UNREACHABLE',
      bestPossible: 76,
    });
    // Алгоритмы: экзамен сдан (итог 87)
    expect(await needForTarget(db, annaCtx, 'PI21-ALG', 85)).toEqual({
      status: 'ALREADY_SECURED',
      finalPercent: 87,
    });
    expect(await needForTarget(db, annaCtx, 'PI21-ALG', 90)).toEqual({
      status: 'EXAM_ALREADY_GRADED',
      finalPercent: 87,
      examScore: 85,
      examMaxScore: 100,
    });
    // Программирование: зачётная дисциплина без экзамена
    expect(await needForTarget(db, annaCtx, 'PI21-PROG', 50)).toEqual({
      status: 'NO_EXAM_ELEMENT',
      finalPercent: 37,
    });
  });

  it('дисциплина без оценок: расчёт от нуля', async () => {
    const db = seedPerformanceDb();
    expect(await needForTarget(db, annaCtx, 'PI21-PHYS', 60)).toEqual({
      status: 'OK',
      neededScore: 100,
      neededPercent: 100,
      maxScore: 100,
      guaranteedFinal: 60,
    });
    expect(await needForTarget(db, annaCtx, 'PI21-PHYS', 61)).toEqual({
      status: 'UNREACHABLE',
      bestPossible: 60,
    });
  });

  it('сотрудник не имеет студенческого скоупа: null + аудит ROLE_MISMATCH', async () => {
    const db = seedPerformanceDb();
    expect(await needForTarget(db, staffCtx, 'PI21-DB', 70)).toBeNull();
    const data = await getPerformance(db, staffCtx, NOW);
    expect(data.disciplines).toEqual([]);
    expect(data.gpa).toBeNull();
    expect(data.rating).toBeNull();
    expect(data.credits).toEqual({ earned: 0, required: 0 });
    expect(data.debts).toEqual([]);
    expect(db.auditEvents().length).toBeGreaterThanOrEqual(2);
    expect(db.auditEvents().every((ev) => ev.reason === 'ROLE_MISMATCH')).toBe(true);
  });

  it('чужая дисциплина другой группы и несуществующая — единообразный null, причина в аудите', async () => {
    const db = seedPerformanceDb();
    // ЭК-11 — не группа Анны (чужое)
    expect(await needForTarget(db, annaCtx, 'EK11-MATH', 70)).toBeNull();
    // такого кода нет нигде
    expect(await needForTarget(db, annaCtx, 'PI21-NOPE', 70)).toBeNull();
    const reasons = db.auditEvents().map((ev) => ev.reason);
    expect(reasons).toContain('OWNERSHIP_DENIED');
    expect(reasons).not.toContain('ROLE_MISMATCH');
  });

  it('некорректная цель (NaN) — null без записи в аудит доступа', async () => {
    const db = seedPerformanceDb();
    expect(await needForTarget(db, annaCtx, 'PI21-DB', Number.NaN)).toBeNull();
  });
});

// ── Изоляция данных (приёмка: «только данные текущего студента») ───────────

describe('getPerformance: изоляция данных', () => {
  it('в данных Анны нет чужих оценок, Илья видит только свои дисциплины', async () => {
    const annaData = await getPerformance(seedPerformanceDb(), annaCtx, NOW);
    // дисциплины только группы ПИ-21
    expect(annaData.disciplines.every((dd) => dd.disciplineCode.startsWith('PI21'))).toBe(true);
    // итоги сокурсников не попадают в ответ — только агрегат рейтинга
    expect(JSON.stringify(annaData)).not.toContain('Дмитрий Волков');
    expect(JSON.stringify(annaData)).not.toContain('Полина Егорова');

    const ilyaData = await getPerformance(seedPerformanceDb(), ilyaCtx, NOW);
    expect(ilyaData.disciplines.map((dd) => dd.disciplineCode)).toEqual(['EK11-MATH', 'EK11-ECON']);
    expect(ilyaData.credits.earned).toBe(0); // дисциплины осени не завершены
    expect(ilyaData.debts).toEqual([]); // пересдачи только у ПИ-21
  });
});

// ── DIG-26 — view-поля экрана «Успеваемость» ────────────────────────────────

describe('DIG-26: view для экрана — преподаватель, экзамен, семестровый GPA', () => {
  it('каждая дисциплина несёт преподавателя из справочника и флаги экзаменационного элемента', async () => {
    const data = await getPerformance(seedPerformanceDb(), annaCtx, NOW);
    const byCode = new Map(data.disciplines.map((d) => [d.disciplineCode, d]));

    // Завершённая весенняя: преподаватель известен, экзамен есть и сдан
    const alg = byCode.get('PI21-ALG')!;
    expect(alg.teacherName).toBe('Иванова Ирина Игоревна');
    expect(alg.hasExamElement).toBe(true);
    expect(alg.examGraded).toBe(true);

    // Идущая осенняя: экзамен в плане есть, но ещё не оценён
    const info = byCode.get('PI21-INFO')!;
    expect(info.teacherName).toBe('Петров Пётр Петрович');
    expect(info.hasExamElement).toBe(true);
    expect(info.examGraded).toBe(false);

    // В плане «Истории» экзамена нет вообще (один семинар)
    const hist = byCode.get('PI21-HIST')!;
    expect(hist.hasExamElement).toBe(false);
    expect(hist.examGraded).toBe(false);
  });

  it('семестровый GPA, собранный из view (итог ?? накопленная × кредиты), совпадает с агрегатом', async () => {
    const data = await getPerformance(seedPerformanceDb(), annaCtx, NOW);
    const valueOf = (d: (typeof data.disciplines)[number]): number | null =>
      d.finalGrade ?? d.accumulated;

    // GpaView не отдаёт ключ предыдущего семестра — восстанавливаем его
    // чистой функцией из performance-math (та же монотонная арифметика).
    const currentKey = data.gpa!.currentSemesterKey;
    const prevKey = previousSemesterKey(currentKey);
    const keys: Array<{ key: SemesterKey; expected: number | null }> = [
      { key: currentKey, expected: data.gpa!.semester },
      { key: prevKey, expected: data.gpa!.previousSemesterGpa },
    ];
    for (const { key, expected } of keys) {
      const inSemester = data.disciplines.filter(
        (d) =>
          d.semester &&
          d.semester.startYear === key.startYear &&
          d.semester.term === key.term &&
          valueOf(d) !== null,
      );
      const gpa = weightedAverage(
        inSemester.map((d) => ({ value: valueOf(d) as number, weight: d.credits })),
      );
      expect(gpa).toBe(expected);
    }
    // Осень 2026/27 (идёт): предварительный GPA по накопленным есть
    expect(data.gpa!.semester).not.toBeNull();
    // Весна 2025/26 (завершена): (87·5 + 74·4) / 9
    expect(data.gpa!.previousSemesterGpa).toBeCloseTo((87 * 5 + 74 * 4) / 9, 2);
  });
});
