// DIG-27 — «Зачётная книжка» и карточка дисциплины: слой данных и чистые
// функции. Красная фаза: контракт зафиксирован ДО реализации (модулей нет).
//
// Покрывается приёмка задачи:
//  - список по семестрам: тип контроля (экзамен / зачёт / диф. зачёт),
//    кредиты, итоговая оценка, дата; итог семестра: средний балл, кредиты;
//  - карточка дисциплины: шапка (преподаватель, кредиты, накопленная),
//    формула оценки полосами с текущими баллами частей, отдельные оценки
//    с пометкой пересдачи, слот калькулятора (данные экзамена);
//  - «Ошибка в оценке?» — обращение с предзаполненной дисциплиной;
//  - IDOR: чужая дисциплина — единообразный null + аудит, сотрудник —
//    ROLE_MISMATCH, студент видит только свою группу.
import { describe, expect, it } from 'vitest';

import { CONTROL_TYPE_LABELS, controlTypeOf, formulaLine, gradeParts } from '@/lib/gradebook';
import { createGradeAppeal, getDisciplineCard, getGradebook } from '@/server/data/gradebook';
import { createMemoryDataDb, type MemoryDataDb } from '@/server/data/memory-db';
import type { DataCtx, DisciplineElementRow, DisciplineRow, GradeRow } from '@/server/data/types';

// Детерминированное «сейчас»: среда 11 ноября 2026 → осенний семестр 2026/27.
const NOW = new Date(2026, 10, 11, 9, 0, 0);

const day = (offsetDays: number): Date => {
  const d = new Date(NOW);
  d.setDate(d.getDate() + offsetDays);
  d.setHours(12, 0, 0, 0);
  return d;
};
// Завершённая весна 2025/26.
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

// ── Фикстуры ────────────────────────────────────────────────────────────────

const disciplines: DisciplineRow[] = [
  d('ПИ-21', 'PI21-INFO', 'Информатика', 4, 'Петров Пётр Петрович'),
  d('ПИ-21', 'PI21-PROG', 'Программирование', 6, 'Иванова Ирина Игоревна'),
  d('ПИ-21', 'PI21-DB', 'Базы данных', 5, 'Соколов Сергей Сергеевич'),
  d('ПИ-21', 'PI21-HIST', 'История', 3, 'Орлов Олег Олегович'),
  d('ПИ-21', 'PI21-ALG', 'Алгоритмы и структуры данных', 5, 'Иванова Ирина Игоревна'),
  d('ПИ-21', 'PI21-DISC', 'Дискретная математика', 4, 'Кузнецова Ксения Кирилловна'),
  d('ЭК-11', 'EK11-MATH', 'Математический анализ', 5, 'Кузнецова Ксения Кирилловна'),
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
  e('ПИ-21', 'PI21-PROG', 'Программирование', 'PI21-PROG-CR', 'Зачёт', 'TEST', 0.6, 100),
  e('ПИ-21', 'PI21-DB', 'Базы данных', 'PI21-DB-P1', 'Проект', 'PROJECT', 0.3, 100),
  e('ПИ-21', 'PI21-DB', 'Базы данных', 'PI21-DB-T2', 'Тест 2', 'TEST', 0.2, 100),
  e('ПИ-21', 'PI21-DB', 'Базы данных', 'PI21-DB-EX', 'Экзамен', 'EXAM', 0.5, 100),
  // «Зачёт» — единственный элемент вида TEST.
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
  e('ЭК-11', 'EK11-MATH', 'Математический анализ', 'EK11-MATH-EX', 'Экзамен', 'EXAM', 0.6, 100),
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

function g(studentId: string, elementCode: string, score: number, gradedAt: Date): GradeRow {
  const plan = elementByCode.get(elementCode);
  if (!plan) throw new Error(`unknown element ${elementCode}`);
  return {
    id: `grd-${studentId}-${elementCode}-${gradedAt.getTime()}`,
    studentId,
    elementCode,
    elementName: plan.elementName,
    disciplineCode: plan.disciplineCode,
    disciplineName: plan.disciplineName,
    score,
    maxScore: plan.maxScore,
    weight: plan.weight,
    kind: plan.kind,
    gradedAt,
    comment: null,
  };
}

const grades: GradeRow[] = [
  // Анна — весна 2025/26, завершено: ALG итог 86.5→87, DISC итог 74.2→74.
  g('st-anna', 'PI21-ALG-T', 90, spring(2, 20)),
  g('st-anna', 'PI21-ALG-EX', 85, spring(4, 15)),
  g('st-anna', 'PI21-DISC-T', 70, spring(2, 25)),
  g('st-anna', 'PI21-DISC-EX', 77, spring(4, 20)),
  // Анна — осень 2026/27, накопленные: INFO (T1 пересдан 64→95), PROG 92 (40%), DB 85 (30%).
  g('st-anna', 'PI21-INFO-T1', 95, day(-14)),
  g('st-anna', 'PI21-PROG-L2', 92, day(-10)),
  g('st-anna', 'PI21-DB-P1', 85, day(-4)),
  // Пересдача: Тест 1 по Информатике первая попытка на 64 (побеждает последняя — 95).
  g('st-anna', 'PI21-INFO-T1', 64, day(-20)),
  // Илья — ЭК-11 (для проверки скоупа группы).
  g('st-ilya', 'EK11-MATH-EX', 74, day(-8)),
];

function seedGradebookDb(): MemoryDataDb {
  const db = createMemoryDataDb();
  db.seed({ disciplines, elements, grades });
  return db;
}

// ── Чистые функции ──────────────────────────────────────────────────────────

describe('gradebook (чистые функции): тип контроля', () => {
  it('есть EXAM в плане → «Экзамен»', () => {
    expect(controlTypeOf(['TEST', 'EXAM'])).toBe('EXAM');
    expect(CONTROL_TYPE_LABELS.EXAM).toBe('Экзамен');
  });

  it('единственный элемент TEST → «Зачёт», прочие без EXAM → «Диф. зачёт»', () => {
    expect(controlTypeOf(['TEST'])).toBe('CREDIT');
    expect(CONTROL_TYPE_LABELS.CREDIT).toBe('Зачёт');
    expect(controlTypeOf(['LAB', 'TEST'])).toBe('DIFF_CREDIT');
    expect(CONTROL_TYPE_LABELS.DIFF_CREDIT).toBe('Диф. зачёт');
    expect(controlTypeOf(['PROJECT'])).toBe('DIFF_CREDIT');
  });

  it('нет данных (пустой план и нет оценок) → null', () => {
    expect(controlTypeOf([])).toBeNull();
  });
});

describe('gradebook (чистые функции): части формулы', () => {
  const plan = [
    { elementCode: 'T1', kind: 'TEST' as const, weight: 0.3, maxScore: 100 },
    { elementCode: 'EX', kind: 'EXAM' as const, weight: 0.7, maxScore: 100 },
  ];

  it('группировка по видам контроля: вес части в процентах, порядок первого появления', () => {
    const parts = gradeParts(plan, []);
    expect(parts.map((p) => p.kind)).toEqual(['TEST', 'EXAM']);
    expect(parts.map((p) => p.weightPercent)).toEqual([30, 70]);
  });

  it('текущий балл части: сданный элемент — балл от максимума части', () => {
    const parts = gradeParts(plan, [
      { elementCode: 'T1', score: 88, maxScore: 100, gradedAt: day(-1) },
    ]);
    const test = parts.find((p) => p.kind === 'TEST')!;
    expect(test.earnedPercent).toBe(88);
    const exam = parts.find((p) => p.kind === 'EXAM')!;
    expect(exam.earnedPercent).toBeNull();
  });

  it('часть с несданным элементом показывает заработанную долю от максимума части', () => {
    // Контрольные: T1 0.3 (88) + K 0.3 (не сдан) → 0.3·88 / 0.6 = 44 из 100.
    const parts = gradeParts(
      [
        { elementCode: 'T1', kind: 'TEST' as const, weight: 0.3, maxScore: 100 },
        { elementCode: 'K', kind: 'TEST' as const, weight: 0.3, maxScore: 100 },
      ],
      [{ elementCode: 'T1', score: 88, maxScore: 100, gradedAt: day(-1) }],
    );
    expect(parts[0]!.earnedPercent).toBe(44);
    expect(parts[0]!.gradedCount).toBe(1);
  });

  it('пересдача: в формуле учитывается последняя оценка элемента', () => {
    const parts = gradeParts(plan, [
      { elementCode: 'T1', score: 60, maxScore: 100, gradedAt: day(-5) },
      { elementCode: 'T1', score: 90, maxScore: 100, gradedAt: day(-1) },
    ]);
    expect(parts.find((p) => p.kind === 'TEST')!.earnedPercent).toBe(90);
  });

  it('formulaLine собирает строку «Контрольные 30% · Экзамен 70%»', () => {
    const parts = gradeParts(plan, []);
    expect(formulaLine(parts)).toBe('Контрольные 30% · Экзамен 70%');
  });
});

// ── getGradebook ────────────────────────────────────────────────────────────

describe('getGradebook: семестры', () => {
  it('семестры по убыванию: осень 2026/27 раньше весны 2025/26', async () => {
    const data = await getGradebook(seedGradebookDb(), annaCtx, NOW);
    expect(data.semesters.map((s) => s.label)).toEqual([
      'Осенний семестр 2026/27',
      'Весенний семестр 2025/26',
    ]);
  });

  it('дисциплина: название, тип контроля, кредиты, итог, дата последней оценки', async () => {
    const data = await getGradebook(seedGradebookDb(), annaCtx, NOW);
    const springSemester = data.semesters.find((s) => s.key.term === 'SPRING')!;
    const alg = springSemester.disciplines.find((row) => row.disciplineCode === 'PI21-ALG')!;
    expect(alg.disciplineName).toBe('Алгоритмы и структуры данных');
    expect(alg.controlTypeLabel).toBe('Экзамен');
    expect(alg.credits).toBe(5);
    expect(alg.finalGrade).toBe(87); // 0.3·90 + 0.7·85 = 86.5 → 87
    expect(alg.completedAt!.getTime()).toBe(spring(4, 15).getTime());
    expect(alg.creditEarned).toBe(true);
  });

  it('итог семестра: средний балл по кредитам и кредиты набрано/всего', async () => {
    const data = await getGradebook(seedGradebookDb(), annaCtx, NOW);
    const springSemester = data.semesters.find((s) => s.key.term === 'SPRING')!;
    // (87·5 + 74·4) / 9 = 81.22
    expect(springSemester.average).toBe(81.22);
    expect(springSemester.creditsEarned).toBe(9);
    expect(springSemester.creditsTotal).toBe(9);
    const fall = data.semesters[0]!;
    // Накопленные (вклад в итог): INFO 28.5 (4 кр.), PROG 36.8 (6 кр.), DB 25.5 (5 кр.)
    // → (28.5·4 + 36.8·6 + 25.5·5) / 15 = 30.82; безоценочная HIST (3 кр.) —
    // в текущем семестре, но без значения, кредиты семестра: 0 из 18.
    expect(fall.average).toBe(30.82);
    expect(fall.creditsEarned).toBe(0);
    expect(fall.creditsTotal).toBe(18);
  });

  it('пересдача элемента: итог по последней оценке (INFO накопленная 28.5)', async () => {
    const data = await getGradebook(seedGradebookDb(), annaCtx, NOW);
    const info = data.semesters[0]!.disciplines.find((r) => r.disciplineCode === 'PI21-INFO')!;
    expect(info.accumulated).toBe(28.5); // Тест 1 переписан: 64 → 95 (вес 0.3)
  });

  it('скоуп группы: у Анны нет дисциплин ЭК-11, у Ильи — только ЭК-11', async () => {
    const anna = await getGradebook(seedGradebookDb(), annaCtx, NOW);
    const annaCodes = anna.semesters.flatMap((s) => s.disciplines.map((d) => d.disciplineCode));
    expect(annaCodes).not.toContain('EK11-MATH');

    const ilya = await getGradebook(seedGradebookDb(), ilyaCtx, NOW);
    const ilyaCodes = ilya.semesters.flatMap((s) => s.disciplines.map((d) => d.disciplineCode));
    expect(ilyaCodes).toEqual(['EK11-MATH']);
  });

  it('сотрудник: пустой агрегат + аудит ROLE_MISMATCH', async () => {
    const db = seedGradebookDb();
    const data = await getGradebook(db, staffCtx, NOW);
    expect(data.semesters).toEqual([]);
    expect(data.hasGrades).toBe(false);
    const audit = db.auditEvents();
    expect(
      audit.some((row) => row.resourceType === 'gradebook' && row.reason === 'ROLE_MISMATCH'),
    ).toBe(true);
  });
});

// ── getDisciplineCard ───────────────────────────────────────────────────────

describe('getDisciplineCard', () => {
  it('завершённая дисциплина: шапка, итог, части формулы, отдельные оценки', async () => {
    const card = await getDisciplineCard(seedGradebookDb(), annaCtx, 'PI21-ALG', NOW);
    expect(card).not.toBeNull();
    expect(card!.disciplineName).toBe('Алгоритмы и структуры данных');
    expect(card!.teacherName).toBe('Иванова Ирина Игоревна');
    expect(card!.credits).toBe(5);
    expect(card!.accumulated).toBe(86.5);
    expect(card!.finalGrade).toBe(87);
    expect(card!.creditEarned).toBe(true);
    // Формула: Контрольные 30% (90 из 100) · Экзамен 70% (85 из 100).
    expect(card!.parts.map((p) => p.kind)).toEqual(['TEST', 'EXAM']);
    expect(card!.parts.map((p) => p.weightPercent)).toEqual([30, 70]);
    expect(card!.parts.map((p) => p.earnedPercent)).toEqual([90, 85]);
    // Отдельные оценки: 2 строки с датами и баллами.
    expect(card!.grades).toHaveLength(2);
    expect(card!.grades.map((row) => row.elementName).sort()).toEqual(['Тест 1', 'Экзамен']);
    expect(card!.grades.every((row) => row.isLatest)).toBe(true);
  });

  it('идущая дисциплина: накопленная крупно, максимум, экзамен для калькулятора', async () => {
    const card = await getDisciplineCard(seedGradebookDb(), annaCtx, 'PI21-INFO', NOW);
    expect(card).not.toBeNull();
    expect(card!.finalGrade).toBeNull();
    // Накопленная — вклад в итог: 0.95 (доля Теста 1) × вес 0.3 = 28.5 из 100.
    expect(card!.accumulated).toBe(28.5);
    expect(card!.maxPossible).toBe(98.5);
    // Контрольные 60%: сдан только Тест 1 (95 из 100) → 0.3·95 / 0.6 = 47.5.
    const testPart = card!.parts.find((p) => p.kind === 'TEST')!;
    expect(testPart.weightPercent).toBe(60);
    expect(testPart.earnedPercent).toBe(47.5);
    const examPart = card!.parts.find((p) => p.kind === 'EXAM')!;
    expect(examPart.earnedPercent).toBeNull();
    // Слот калькулятора: экзамен 40%, максимум 100, не сдан.
    expect(card!.exam).toEqual({
      elementCode: 'PI21-INFO-EX',
      elementName: 'Экзамен',
      weightPercent: 40,
      maxScore: 100,
      graded: false,
    });
  });

  it('пересдача в списке оценок: обе попытки, старая помечена «не учитывается»', async () => {
    const card = await getDisciplineCard(seedGradebookDb(), annaCtx, 'PI21-INFO', NOW);
    const attempts = card!.grades.filter((row) => row.elementCode === 'PI21-INFO-T1');
    expect(attempts).toHaveLength(2);
    const older = attempts.find((row) => row.score === 64)!;
    const latest = attempts.find((row) => row.score === 95)!;
    expect(older.isLatest).toBe(false);
    expect(latest.isLatest).toBe(true);
    expect(card!.grades.every((row) => row.gradedAt instanceof Date)).toBe(true);
  });

  it('чужая дисциплина: единообразный null + аудит OWNERSHIP_DENIED', async () => {
    const db = seedGradebookDb();
    const card = await getDisciplineCard(db, annaCtx, 'EK11-MATH', NOW);
    expect(card).toBeNull();
    expect(
      db
        .auditEvents()
        .some(
          (row) =>
            row.resourceType === 'discipline-card' &&
            row.resourceRef === 'EK11-MATH' &&
            row.reason === 'OWNERSHIP_DENIED',
        ),
    ).toBe(true);
  });

  it('несуществующая дисциплина: тот же null + аудит NOT_FOUND', async () => {
    const db = seedGradebookDb();
    const card = await getDisciplineCard(db, annaCtx, 'PI21-NOPE', NOW);
    expect(card).toBeNull();
    expect(
      db
        .auditEvents()
        .some(
          (row) =>
            row.resourceType === 'discipline-card' &&
            row.resourceRef === 'PI21-NOPE' &&
            row.reason === 'NOT_FOUND',
        ),
    ).toBe(true);
  });

  it('сотрудник: null + аудит ROLE_MISMATCH', async () => {
    const db = seedGradebookDb();
    const card = await getDisciplineCard(db, staffCtx, 'PI21-ALG', NOW);
    expect(card).toBeNull();
    expect(
      db
        .auditEvents()
        .some(
          (row) =>
            row.resourceType === 'discipline-card' &&
            row.resourceRef === 'PI21-ALG' &&
            row.reason === 'ROLE_MISMATCH',
        ),
    ).toBe(true);
  });
});

// ── createGradeAppeal ───────────────────────────────────────────────────────

describe('createGradeAppeal: обращение с предзаполненной дисциплиной', () => {
  it('создаёт обращение: тема с дисциплиной, сообщение с накопленной', async () => {
    const db = seedGradebookDb();
    const appeal = await createGradeAppeal(db, annaCtx, 'PI21-INFO', { now: NOW });
    expect(appeal).not.toBeNull();
    expect(appeal!.subject).toContain('Информатика');
    expect(appeal!.status).toBe('OPEN');
    const messages = await db.listAppealMessages(appeal!.id);
    expect(messages).toHaveLength(1);
    expect(messages[0]!.body).toContain('Информатика');
    expect(messages[0]!.body).toContain('PI21-INFO');
    expect(messages[0]!.body).toContain('28.5');
  });

  it('чужая дисциплина: обращение не создаётся, аудит OWNERSHIP_DENIED', async () => {
    const db = seedGradebookDb();
    const appeal = await createGradeAppeal(db, annaCtx, 'EK11-MATH', { now: NOW });
    expect(appeal).toBeNull();
    expect(
      db
        .auditEvents()
        .some(
          (row) =>
            row.resourceType === 'discipline-card' &&
            row.resourceRef === 'EK11-MATH' &&
            row.reason === 'OWNERSHIP_DENIED',
        ),
    ).toBe(true);
    expect(await db.listAppealsByStudent(annaCtx.studentId!)).toHaveLength(0);
  });

  it('сотрудник: null + аудит ROLE_MISMATCH', async () => {
    const db = seedGradebookDb();
    const appeal = await createGradeAppeal(db, staffCtx, 'PI21-ALG', { now: NOW });
    expect(appeal).toBeNull();
    expect(
      db
        .auditEvents()
        .some(
          (row) =>
            row.resourceType === 'discipline-card' &&
            row.resourceRef === 'PI21-ALG' &&
            row.reason === 'ROLE_MISMATCH',
        ),
    ).toBe(true);
  });
});
