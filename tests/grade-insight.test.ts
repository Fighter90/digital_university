// DIG-66 — «Что изменилось»: AI-объяснение динамики оценок.
// Красная фаза: контракт зафиксирован ДО реализации (модуля ещё нет).
//
// Покрывается приёмка задачи:
//  - временные срезы среднего балла считаются по тем же формулам, что
//    GPA-кольцо сводки (накопленная по плану контроля, взвешенная кредитами)
//    — требование «данные совпадают с успеваемостью»;
//  - дельта месяца с базой (последняя работа до окна), направление
//    up / down / flat / new / none;
//  - детерминированные человеческие тексты без LLM;
//  - тренд строится по семестру последней оценки (чужой семестр — мимо);
//  - скоупинг: сотрудник — null + аудит ROLE_MISMATCH, студент видит
//    только свои работы; пустые оценки — null без аудита.
import { describe, expect, it } from 'vitest';

import { buildGradeInsight, type GradeInsightGradeRow } from '@/lib/grade-insight';
import { getGradeInsight } from '@/server/data/grade-insight';
import { createMemoryDataDb } from '@/server/data/memory-db';
import type { DataCtx, DisciplineElementRow, DisciplineRow } from '@/server/data/types';

// Детерминированное «сейчас»: среда 11 ноября 2026 → осенний семестр 2026/27.
const NOW = new Date(2026, 10, 11, 9, 0, 0);

const day = (offsetDays: number, hour = 12): Date => {
  const d = new Date(NOW);
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hour, 0, 0, 0);
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

const disciplines: DisciplineRow[] = [
  d('ПИ-21', 'PI21-INFO', 'Информатика', 4),
  d('ПИ-21', 'PI21-PROG', 'Программирование', 6),
  d('ПИ-21', 'PI21-DB', 'Базы данных', 5),
  d('ПИ-21', 'PI21-ALG', 'Алгоритмы и структуры данных', 5),
  d('ПИ-21', 'PI21-DISC', 'Дискретная математика', 4),
];

function d(
  groupName: string,
  disciplineCode: string,
  disciplineName: string,
  credits: number,
): DisciplineRow {
  return { groupName, disciplineCode, disciplineName, credits, teacherName: '' };
}

const elements: DisciplineElementRow[] = [
  e('ПИ-21', 'PI21-INFO', 'Информатика', 'PI21-INFO-T1', 'Тест 1', 0.3),
  e('ПИ-21', 'PI21-INFO', 'Информатика', 'PI21-INFO-K', 'Коллоквиум', 0.3),
  e('ПИ-21', 'PI21-INFO', 'Информатика', 'PI21-INFO-EX', 'Экзамен', 0.4),
  e('ПИ-21', 'PI21-PROG', 'Программирование', 'PI21-PROG-L2', 'Лабораторная 2', 0.4),
  e('ПИ-21', 'PI21-PROG', 'Программирование', 'PI21-PROG-L3', 'Лабораторная 3', 0.2),
  e('ПИ-21', 'PI21-PROG', 'Программирование', 'PI21-PROG-CR', 'Зачёт', 0.4),
  e('ПИ-21', 'PI21-DB', 'Базы данных', 'PI21-DB-P1', 'Проект', 0.3),
  e('ПИ-21', 'PI21-DB', 'Базы данных', 'PI21-DB-T2', 'Тест 2', 0.2),
  e('ПИ-21', 'PI21-DB', 'Базы данных', 'PI21-DB-EX', 'Экзамен', 0.5),
  e('ПИ-21', 'PI21-ALG', 'Алгоритмы и структуры данных', 'PI21-ALG-T', 'Тест 1', 0.3),
  e('ПИ-21', 'PI21-ALG', 'Алгоритмы и структуры данных', 'PI21-ALG-EX', 'Экзамен', 0.7),
  e('ПИ-21', 'PI21-DISC', 'Дискретная математика', 'PI21-DISC-T', 'Тест 1', 0.4),
  e('ПИ-21', 'PI21-DISC', 'Дискретная математика', 'PI21-DISC-EX', 'Экзамен', 0.6),
];

function e(
  groupName: string,
  disciplineCode: string,
  disciplineName: string,
  elementCode: string,
  elementName: string,
  weight: number,
): DisciplineElementRow {
  return {
    groupName,
    disciplineCode,
    disciplineName,
    elementCode,
    elementName,
    kind: 'TEST',
    weight,
    maxScore: 100,
  };
}

function g(elementCode: string, score: number, offsetDays: number): GradeInsightGradeRow {
  const plan = elements.find((row) => row.elementCode === elementCode)!;
  return {
    disciplineCode: plan.disciplineCode,
    disciplineName: plan.disciplineName,
    elementCode: plan.elementCode,
    elementName: plan.elementName,
    score,
    maxScore: plan.maxScore,
    weight: plan.weight,
    gradedAt: day(offsetDays),
  };
}

// Демо-набор (как у Анны из сида): три работы идущего семестра за месяц.
const monthWorks: GradeInsightGradeRow[] = [
  g('PI21-INFO-T1', 88, -14),
  g('PI21-PROG-L2', 92, -10),
  g('PI21-DB-P1', 85, -4),
];

// Завершённый весенний семестр 2025/26 (вне окна месяца).
const springWorks: GradeInsightGradeRow[] = [
  g('PI21-ALG-T', 90, -270),
  g('PI21-DISC-T', 70, -265),
  g('PI21-ALG-EX', 85, -180),
  g('PI21-DISC-EX', 77, -175),
];

const input = (grades: GradeInsightGradeRow[]) => ({
  grades,
  disciplines,
  plan: elements,
  now: NOW,
});

describe('DIG-66: buildGradeInsight — срезы среднего и месяц', () => {
  it('точки графика повторяют формулы GPA-кольца (накопленная × кредиты)', () => {
    const insight = buildGradeInsight(input(monthWorks));

    expect(insight).not.toBeNull();
    expect(insight!.points.map((p) => p.average)).toEqual([26.4, 32.64, 30.26]);
    expect(insight!.points.map((p) => p.delta)).toEqual([null, 6.24, -2.38]);
    expect(insight!.current).toBe(30.26);
    // Семестр последней оценки — идущая осень 2026/27.
    expect(insight!.semesterLabel).toBe('Осенний семестр 2026/27');
  });

  it('месяц: первые работы, направление «new», виновник по вкладу', () => {
    const insight = buildGradeInsight(input(monthWorks))!;

    expect(insight.month.direction).toBe('new');
    expect(insight.month.baseline).toBeNull();
    expect(insight.month.delta).toBeNull();
    expect(insight.month.works).toHaveLength(3);
    // Работы месяца — новые сверху.
    expect(insight.month.works[0].elementName).toBe('Проект');
    // Сильнее всего средний подняла Лабораторная 2 (+6,24).
    expect(insight.detail).toContain('Лабораторная 2');
    expect(insight.detail).toContain('Программирование');
    expect(insight.detail).toContain('92 из 100');
    expect(insight.detail).toContain('6,2');
    expect(insight.detail).toContain('подняла');
    expect(insight.headline).toContain('30,3');
    expect(insight.headline).toContain('3 новые работы');
  });

  it('разбор точки: работы до неё включительно, новые сверху', () => {
    const insight = buildGradeInsight(input(monthWorks))!;

    expect(insight.points[0].works.map((w) => w.elementName)).toEqual(['Тест 1']);
    expect(insight.points[2].works.map((w) => w.elementName)).toEqual([
      'Проект',
      'Лабораторная 2',
      'Тест 1',
    ]);
    expect(insight.points[2].works[0]).toMatchObject({
      disciplineName: 'Базы данных',
      elementName: 'Проект',
      score: 85,
      maxScore: 100,
    });
  });

  it('направление «up»: база — работа до окна месяца', () => {
    const insight = buildGradeInsight(
      input([g('PI21-INFO-T1', 88, -40), g('PI21-PROG-L2', 92, -14)]),
    )!;

    expect(insight.month.direction).toBe('up');
    expect(insight.month.baseline).toBe(26.4);
    expect(insight.month.delta).toBe(6.24);
    expect(insight.headline).toBe(
      'Средний балл за месяц вырос на 6,2 пункта: было 26,4, стало 32,6',
    );
    expect(insight.detail).toContain('Лабораторная 2');
    expect(insight.detail).toContain('подняла');
  });

  it('направление «down»: свежая работа снизила средний', () => {
    const insight = buildGradeInsight(
      input([g('PI21-PROG-L2', 92, -40), g('PI21-INFO-T1', 88, -14)]),
    )!;

    expect(insight.month.direction).toBe('down');
    expect(insight.month.baseline).toBe(36.8);
    expect(insight.month.delta).toBe(-4.16);
    expect(insight.headline).toBe(
      'Средний балл за месяц снизился на 4,2 пункта: было 36,8, стало 32,6',
    );
    expect(insight.detail).toContain('Тест 1');
    expect(insight.detail).toContain('Информатика');
    expect(insight.detail).toContain('88 из 100');
    expect(insight.detail).toContain('снизила');
  });

  it('направление «flat»: работы были, средний не сдвинули', () => {
    const insight = buildGradeInsight(
      input([g('PI21-INFO-T1', 88, -40), g('PI21-PROG-L2', 66, -14)]),
    )!;

    expect(insight.month.direction).toBe('flat');
    expect(insight.month.delta).toBe(0);
    expect(insight.headline).toBe('Средний балл за месяц не изменился: 26,4 из 100');
    expect(insight.detail).toContain('не сдвинули средний');
  });

  it('направление «none»: за месяц оценок не было', () => {
    const insight = buildGradeInsight(input([g('PI21-INFO-T1', 88, -40)]))!;

    expect(insight.month.direction).toBe('none');
    expect(insight.month.works).toHaveLength(0);
    expect(insight.headline).toBe('За месяц новых оценок не было');
    expect(insight.detail).toContain('держится на 26,4 из 100');
  });

  it('единственная работа: база и вклада нет — текст называет её', () => {
    const insight = buildGradeInsight(input([g('PI21-DB-P1', 85, -4)]))!;

    expect(insight.points).toHaveLength(1);
    expect(insight.month.direction).toBe('new');
    expect(insight.headline).toContain('появилась новая работа');
    expect(insight.headline).toContain('25,5');
    expect(insight.detail).toBe('Средний балл задаёт работа «Проект» (Базы данных, 85 из 100).');
  });

  it('пересдача: дедуп по элементу (последняя оценка), обе строки в разборе', () => {
    const insight = buildGradeInsight(
      input([g('PI21-INFO-T1', 50, -14), g('PI21-INFO-T1', 88, -4)]),
    )!;

    expect(insight.points.map((p) => p.average)).toEqual([15, 26.4]);
    expect(insight.points[1].works).toHaveLength(2);
  });

  it('тренд строится по семестру последней оценки: весна не попадает в осень', () => {
    const insight = buildGradeInsight(input([...springWorks, ...monthWorks]))!;

    expect(insight.semesterLabel).toBe('Осенний семестр 2026/27');
    expect(insight.points).toHaveLength(3);
    expect(insight.month.direction).toBe('new');
  });

  it('весенний семестр без свежих работ: честное «новых оценок не было»', () => {
    const insight = buildGradeInsight(input(springWorks))!;

    expect(insight!.semesterLabel).toBe('Весенний семестр 2025/26');
    expect(insight.month.direction).toBe('none');
    expect(insight.headline).toBe('За месяц новых оценок не было');
  });

  it('без оценок — null (карточка не рендерится)', () => {
    expect(buildGradeInsight(input([]))).toBeNull();
  });
});

describe('DIG-66: getGradeInsight — скоупинг слоя данных', () => {
  function seedDb(grades: GradeInsightGradeRow[]) {
    const db = createMemoryDataDb();
    db.seed({
      disciplines,
      elements,
      grades: grades.map((row, i) => ({
        id: `grd-${i}`,
        studentId: 'st-anna',
        comment: null,
        kind: 'TEST' as const,
        ...row,
      })),
    });
    return db;
  }

  it('студент: только свои работы, разбор по ctx.studentId', async () => {
    const db = seedDb(monthWorks);
    const insight = await getGradeInsight(db, annaCtx, NOW);

    expect(insight).not.toBeNull();
    expect(insight!.points).toHaveLength(3);
    expect(insight!.points.at(-1)!.works.map((w) => w.disciplineName)).toEqual([
      'Базы данных',
      'Программирование',
      'Информатика',
    ]);
  });

  it('чужие оценки (Илья) не попадают в разбор Анны', async () => {
    const db = seedDb(monthWorks);
    // В сиде лежат только строки Анны — контекст Ильи не находит ничего.
    const insight = await getGradeInsight(db, ilyaCtx, NOW);
    expect(insight).toBeNull();
  });

  it('сотрудник: null + аудит ROLE_MISMATCH', async () => {
    const db = seedDb(monthWorks);
    const insight = await getGradeInsight(db, staffCtx, NOW);

    expect(insight).toBeNull();
    const denied = db.auditEvents().filter((ev) => ev.resourceType === 'grade-insight');
    expect(denied).toHaveLength(1);
    expect(denied[0]).toMatchObject({ reason: 'ROLE_MISMATCH', outcome: 'DENIED' });
  });

  it('студент без оценок: null без записи в аудит (доступ разрешён)', async () => {
    const db = seedDb([]);
    const insight = await getGradeInsight(db, annaCtx, NOW);

    expect(insight).toBeNull();
    expect(db.auditEvents()).toHaveLength(0);
  });

  it('DIG-84: локаль пробрасывается в тексты (EN-заголовок из слоя данных)', async () => {
    const db = seedDb(monthWorks);
    const insight = await getGradeInsight(db, annaCtx, NOW, 'en');
    expect(insight!.headline).toContain('3 new grades');
  });
});

describe('DIG-84: buildGradeInsight — EN-тексты по словарю', () => {
  it('EN: направление «new», заголовок и разбор по-английски, RU прежний', () => {
    const en = buildGradeInsight(input(monthWorks), 'en')!;
    expect(en.semesterLabel).toBe('Fall semester 2026/27');
    expect(en.headline).toContain('3 new grades');
    expect(en.headline).toContain('out of 100');
    expect(en.detail).toContain('raised');
    expect(en.detail).toContain('92 out of 100');
    expect(en.detail).toContain('6.2');

    const ru = buildGradeInsight(input(monthWorks))!;
    expect(ru.headline).toContain('30,3');
    expect(ru.detail).toContain('подняла');
  });

  it('EN: направление «up» с базой и пунктом (point/points)', () => {
    const insight = buildGradeInsight(
      input([g('PI21-INFO-T1', 88, -40), g('PI21-PROG-L2', 92, -14)]),
      'en',
    )!;
    expect(insight.month.direction).toBe('up');
    expect(insight.headline).toBe('The average rose by 6.2 points this month: from 26.4 to 32.6');
  });

  it('EN: «flat» и «none» по словарю', () => {
    const none = buildGradeInsight(input([g('PI21-INFO-T1', 88, -40)]), 'en')!;
    expect(none.month.direction).toBe('none');
    expect(none.headline).toBe('No new grades in the last month');
    expect(none.detail).toContain('holds at 26.4 out of 100');

    const flat = buildGradeInsight(
      input([g('PI21-INFO-T1', 88, -40), g('PI21-PROG-L2', 66, -14)]),
      'en',
    )!;
    expect(flat.month.direction).toBe('flat');
    expect(flat.headline).toBe('The average is unchanged this month: 26.4 out of 100');
    expect(flat.detail).toContain('did not move the average');
  });

  it('EN: единственная работа — «The average is set by …»', () => {
    const insight = buildGradeInsight(input([g('PI21-DB-P1', 85, -4)]), 'en')!;
    // DIG-93: имена работ и дисциплин в EN-тексте — EN (ноль кириллицы
    // в EN-рендере «Успеваемости», включая карточку инсайта).
    expect(insight.detail).toBe('The average is set by “Project” (Databases, 85 out of 100).');
  });
});
