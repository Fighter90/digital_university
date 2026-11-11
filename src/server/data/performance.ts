// DIG-25 — серверная часть «Успеваемости»: накопленные оценки, GPA,
// кредиты, рейтинг в группе, долги и калькулятор цели.
//
// Экраны «Успеваемость» (DIG-26), «Зачётная книжка» (DIG-27), «Сессия»
// (DIG-28) и калькулятор «что нужно на экзамене» читают данные отсюда.
//
// Формулы и правила округления — чистые функции в src/lib/performance-math.ts,
// словесные правила зафиксированы в docs/grading.md.
//
// Доступ: ctx строится из живой сессии (requireDataCtx) — все персональные
// выборки скоуплены ctx.studentId, справочники и сессии группы —
// ctx.groupName. Оценки сокурсников читаются ТОЛЬКО как вход агрегата
// рейтинга: наружу уходят место/перцентиль владельца ctx, но не чужие
// строки (тот же контракт, что requests.ts / schedule.ts / grades.ts).
// Сотрудник (без studentId) получает пустой агрегат с записью в аудите.

import {
  CREDIT_PASS_PERCENT,
  PROGRAM_TOTAL_CREDITS,
  accumulatedGrade,
  bestPercentFromRank,
  bestPercentLabel,
  disciplineSemesterOf,
  needForTargetPure,
  previousSemesterKey,
  roundGrade,
  semesterKeyLabel,
  semesterKeyOf,
  semesterSortNumber,
  weightedAverage,
  type AccumulatedGrade,
  type GradedElementLike,
  type NeedForTargetOutcome,
  type SemesterKey,
} from '@/lib/performance-math';
import { denyAccess } from './access';
import type { DataDb } from './port';
import type {
  DataCtx,
  DisciplineElementRow,
  DisciplineRow,
  ExamSessionRow,
  GradeRow,
} from './types';

const RESOURCE = 'performance';

// ── View-типы (то, что читают экраны) ───────────────────────────────────────

export interface DisciplinePerformance {
  disciplineCode: string;
  disciplineName: string;
  credits: number;
  /** Семестр дисциплины — по дате последней оценки (null — оценок нет). */
  semester: SemesterKey | null;
  semesterLabel: string | null;
  /** Накопленная сейчас, % итога (null — оценок нет). */
  accumulated: number | null;
  /** Минимально гарантированная, % (несданные элементы — нули). */
  minGuaranteed: number | null;
  /** Максимально возможная, % (несданные — на максимум). */
  maxPossible: number | null;
  /** Итог арифметическим округлением — только у завершённой дисциплины. */
  finalGrade: number | null;
  gradedElements: number;
  totalElements: number;
  /** Все элементы плана оценены. */
  isComplete: boolean;
  /** Итог ≥ порога зачтения кредита (docs/grading.md). */
  creditEarned: boolean;
  /** Преподаватель из справочника группы (null — дисциплина синтезирована из оценок). */
  teacherName: string | null;
  /** В плане контроля есть экзаменационный элемент (DIG-26, бейдж допуска). */
  hasExamElement: boolean;
  /** Экзаменационный элемент уже оценён. */
  examGraded: boolean;
}

export interface GpaView {
  /** За всё время, взвешенный кредитами, % (null — нет оценок). */
  overall: number | null;
  /** Текущий семестр по московскому календарю на момент запроса. */
  currentSemesterKey: SemesterKey;
  currentSemesterLabel: string;
  /** GPA текущего семестра (незавершённые дисциплины — по накопленной). */
  semester: number | null;
  previousSemesterLabel: string | null;
  previousSemesterGpa: number | null;
  /** Изменение к предыдущему семестру, пункты (null — не с чем сравнивать). */
  semesterDelta: number | null;
}

export interface CreditsView {
  /** Кредиты набрано (завершённые дисциплины с итогом ≥ порога). */
  earned: number;
  /** Кредиты на всю программу. */
  required: number;
}

export interface RatingView {
  /** Место по общему GPA среди студентов группы с оценками (1-базированное). */
  rank: number;
  /** Размер группы (все студенты). */
  groupSize: number;
  /** «Топ-X%» = ceil(место / размер × 100). */
  bestPercent: number;
  /** Готовая формулировка: «Вы входите в 40% лучших в группе». */
  label: string;
}

export type DebtStatus = 'ASSIGNED' | 'OVERDUE' | 'CLOSED';

export interface DebtItem {
  disciplineCode: string;
  disciplineName: string;
  /** Дата пересдачи. */
  retakeDate: Date;
  /** Календарных дней до пересдачи (отрицательное — прошла). */
  daysLeft: number;
  /** Назначена / просрочена (долг не закрыт) / закрыта (итог ≥ порога). */
  status: DebtStatus;
}

export interface PerformanceData {
  studentId: string | null;
  disciplines: DisciplinePerformance[];
  gpa: GpaView | null;
  credits: CreditsView;
  rating: RatingView | null;
  debts: DebtItem[];
}

const EMPTY_PERFORMANCE: PerformanceData = {
  studentId: null,
  disciplines: [],
  gpa: null,
  credits: { earned: 0, required: 0 },
  rating: null,
  debts: [],
};

// ── Внутренние помощники ────────────────────────────────────────────────────

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function calendarDaysLeft(date: Date, now: Date): number {
  return Math.round((startOfDay(date).getTime() - startOfDay(now).getTime()) / 86_400_000);
}

const gradeToElement = (row: GradeRow): GradedElementLike => ({
  elementCode: row.elementCode,
  score: row.score,
  maxScore: row.maxScore,
  weight: row.weight,
  gradedAt: row.gradedAt,
});

/** Группировка оценок по коду дисциплины (сортировка внутри — по дате). */
function groupGradesByDiscipline(rows: GradeRow[]): Map<string, GradeRow[]> {
  const map = new Map<string, GradeRow[]>();
  for (const row of rows) {
    const bucket = map.get(row.disciplineCode) ?? [];
    bucket.push(row);
    map.set(row.disciplineCode, bucket);
  }
  return map;
}

interface DisciplineComputation {
  code: string;
  name: string;
  credits: number;
  acc: AccumulatedGrade;
  gradedCount: number;
  totalElements: number;
  isComplete: boolean;
  semester: SemesterKey | null;
  /** Преподаватель из справочника группы (null — дисциплина синтезирована). */
  teacherName: string | null;
  /** В плане контроля есть экзаменационный элемент (DIG-26, бейдж допуска). */
  hasExamElement: boolean;
  /** Экзаменационный элемент уже оценён (пересдача — по последней оценке). */
  examGraded: boolean;
}

/**
 * Расчёт по одной дисциплине: план контроля (все элементы, включая
 * неоценённые) + оценки студента. Дисциплины, которых нет в справочнике
 * группы (старые сиды), синтезируются из оценок с весом 1 кредит и
 * планом «только сданные элементы».
 */
function computeDisciplines(
  ownGrades: GradeRow[],
  disciplines: DisciplineRow[],
  elements: DisciplineElementRow[],
): DisciplineComputation[] {
  const byCode = groupGradesByDiscipline(ownGrades);
  const known = new Map(disciplines.map((row) => [row.disciplineCode, row]));
  const elementsByDiscipline = new Map<string, DisciplineElementRow[]>();
  for (const el of elements) {
    const bucket = elementsByDiscipline.get(el.disciplineCode) ?? [];
    bucket.push(el);
    elementsByDiscipline.set(el.disciplineCode, bucket);
  }

  const codes = [...new Set([...known.keys(), ...byCode.keys()])];
  return codes.map((code) => {
    const knownRow = known.get(code);
    const plan = elementsByDiscipline.get(code) ?? [];
    const gradedRows = byCode.get(code) ?? [];
    const graded = gradedRows.map(gradeToElement);

    const planForCalc =
      plan.length > 0
        ? plan.map((el) => ({
            elementCode: el.elementCode,
            weight: el.weight,
            maxScore: el.maxScore,
          }))
        : graded.map((row) => ({ elementCode: row.elementCode, weight: row.weight }));
    const acc = accumulatedGrade(graded, planForCalc);

    // Завершённость — по РАЗЛИЧНЫМ элементам плана с оценкой (тот же
    // latest-дедуп, что в accumulatedGrade), а не по числу строк GradeRow:
    // пересдача даёт две строки на один элемент (ложная завершённость при
    // несданном другом), а оценка по элементу вне плана счётчик раздувает.
    // Элементы с maxScore ≤ 0 неоцениваемы и в счёт не идут — как и в
    // расчёте накопленной.
    const gradeablePlanCodes = new Set(
      plan.filter((el) => el.maxScore > 0).map((el) => el.elementCode),
    );
    const gradedCodes = new Set(gradedRows.map((row) => row.elementCode));
    // Старые сиды без плана контроля: план синтезируется из сданных элементов.
    const totalElements = plan.length > 0 ? gradeablePlanCodes.size : gradedCodes.size;
    const gradedCount =
      plan.length > 0
        ? [...gradedCodes].filter((code) => gradeablePlanCodes.has(code)).length
        : gradedCodes.size;
    const isComplete = totalElements > 0 && gradedCount >= totalElements;

    // Экзаменационный элемент плана: бейдж допуска экрана «Успеваемость»
    // (DIG-26). Оценён — по тем же строкам GradeRow (пересдача даёт
    // последнюю по дате, для флага достаточно самого факта оценки).
    const examElement = plan.find((el) => el.kind === 'EXAM') ?? null;

    return {
      code,
      name: knownRow?.disciplineName ?? gradedRows[0]?.disciplineName ?? code,
      credits: knownRow?.credits ?? 1,
      acc,
      gradedCount,
      totalElements,
      isComplete,
      semester: disciplineSemesterOf(graded),
      teacherName: knownRow?.teacherName ?? null,
      hasExamElement: examElement !== null,
      examGraded: examElement !== null && gradedCodes.has(examElement.elementCode),
    };
  });
}

/** Значение дисциплины для GPA: итог (завершена) или накопленная (в процессе). */
function disciplineValue(computed: DisciplineComputation): number | null {
  if (computed.acc.accumulated === null) return null;
  return computed.isComplete ? roundGrade(computed.acc.accumulated) : computed.acc.accumulated;
}

/**
 * Элементы GPA {значение, кредиты} по студенту. Используется и для самого
 * студента, и (внутри агрегата рейтинга) для сокурсников.
 */
function gpaItems(
  ownGrades: GradeRow[],
  disciplines: DisciplineRow[],
  elements: DisciplineElementRow[],
): { value: number; weight: number; semester: SemesterKey | null }[] {
  return computeDisciplines(ownGrades, disciplines, elements)
    .map((computed) => {
      const value = disciplineValue(computed);
      return value === null
        ? null
        : { value, weight: computed.credits, semester: computed.semester };
    })
    .filter((item): item is { value: number; weight: number; semester: SemesterKey | null } =>
      Boolean(item),
    );
}

function gpaOfStudent(
  ownGrades: GradeRow[],
  disciplines: DisciplineRow[],
  elements: DisciplineElementRow[],
): number | null {
  return weightedAverage(gpaItems(ownGrades, disciplines, elements));
}

function buildDisciplineViews(
  computed: DisciplineComputation[],
  now: Date,
): DisciplinePerformance[] {
  // Дисциплины без оценок при сортировке остаются в блоке текущего семестра
  // (точных данных о семестре нет — семестр выводится из дат оценок).
  const currentSort = semesterSortNumber(semesterKeyOf(now));
  const sortNumber = (semester: SemesterKey | null): number =>
    semester ? semesterSortNumber(semester) : currentSort;
  return computed
    .map((item): DisciplinePerformance => {
      const finalGrade =
        item.isComplete && item.acc.accumulated !== null ? roundGrade(item.acc.accumulated) : null;
      return {
        disciplineCode: item.code,
        disciplineName: item.name,
        credits: item.credits,
        semester: item.semester,
        semesterLabel: item.semester ? semesterKeyLabel(item.semester) : null,
        accumulated: item.acc.accumulated,
        minGuaranteed: item.acc.minGuaranteed,
        maxPossible: item.acc.maxPossible,
        finalGrade,
        gradedElements: item.gradedCount,
        totalElements: item.totalElements,
        isComplete: item.isComplete,
        creditEarned: item.isComplete && finalGrade !== null && finalGrade >= CREDIT_PASS_PERCENT,
        teacherName: item.teacherName,
        hasExamElement: item.hasExamElement,
        examGraded: item.examGraded,
      };
    })
    .sort((a, b) => {
      const semesterA = sortNumber(a.semester);
      const semesterB = sortNumber(b.semester);
      if (semesterA !== semesterB) return semesterB - semesterA; // текущий семестр раньше
      return a.disciplineName.localeCompare(b.disciplineName, 'ru');
    });
}

function buildGpaView(computed: DisciplineComputation[], now: Date): GpaView | null {
  const items = computed
    .map((item) => {
      const value = disciplineValue(item);
      return value === null ? null : { value, weight: item.credits, semester: item.semester };
    })
    .filter((item): item is { value: number; weight: number; semester: SemesterKey | null } =>
      Boolean(item),
    );
  if (items.length === 0) return null;

  const currentKey = semesterKeyOf(now);
  const gpaFor = (key: SemesterKey | null): number | null => {
    if (!key) return null;
    return weightedAverage(
      items.filter((item) => item.semester && sameSemester(item.semester, key)),
    );
  };

  const prevKey = previousSemesterKey(currentKey);
  const semester = gpaFor(currentKey);
  const previous = gpaFor(prevKey);
  return {
    overall: weightedAverage(items),
    currentSemesterKey: currentKey,
    currentSemesterLabel: semesterKeyLabel(currentKey),
    semester,
    previousSemesterLabel: previous === null ? null : semesterKeyLabel(prevKey),
    previousSemesterGpa: previous,
    semesterDelta:
      semester === null || previous === null ? null : Math.round((semester - previous) * 100) / 100,
  };
}

const sameSemester = (a: SemesterKey, b: SemesterKey) =>
  a.startYear === b.startYear && a.term === b.term;

function buildCredits(computed: DisciplineComputation[]): CreditsView {
  const earned = computed
    .filter((item) => {
      if (!item.isComplete || item.acc.accumulated === null) return false;
      // Порог зачтения — по ИТОГУ (округлённой накопленной), ровно как
      // creditEarned в view: иначе агрегат противоречит сам себе при
      // накопленной 59.x ≥ 59.5 (итог 60, кредит не зачтён).
      return roundGrade(item.acc.accumulated) >= CREDIT_PASS_PERCENT;
    })
    .reduce((sum, item) => sum + item.credits, 0);
  return { earned, required: PROGRAM_TOTAL_CREDITS };
}

function buildDebts(
  exams: ExamSessionRow[],
  computed: DisciplineComputation[],
  now: Date,
): DebtItem[] {
  const valueByCode = new Map<string, number | null>();
  for (const item of computed) {
    valueByCode.set(item.code, disciplineValue(item));
  }

  const retakes = exams.filter((exam) => exam.kind === 'RETAKE');
  const statusOf = (exam: ExamSessionRow): DebtStatus => {
    const value = valueByCode.get(exam.disciplineCode) ?? null;
    if (value !== null && value >= CREDIT_PASS_PERCENT) return 'CLOSED';
    return startOfDay(exam.date).getTime() >= startOfDay(now).getTime() ? 'ASSIGNED' : 'OVERDUE';
  };

  return retakes
    .map((exam) => ({
      disciplineCode: exam.disciplineCode,
      disciplineName: exam.disciplineName,
      retakeDate: exam.date,
      daysLeft: calendarDaysLeft(exam.date, now),
      status: statusOf(exam),
    }))
    .sort((a, b) => {
      // Активные долги раньше закрытых; внутри — по дате пересдачи.
      const closedA = a.status === 'CLOSED' ? 1 : 0;
      const closedB = b.status === 'CLOSED' ? 1 : 0;
      if (closedA !== closedB) return closedA - closedB;
      return a.retakeDate.getTime() - b.retakeDate.getTime();
    });
}

function buildRating(
  ctx: DataCtx,
  db: DataDb,
  ownGrades: GradeRow[],
  disciplines: DisciplineRow[],
  elements: DisciplineElementRow[],
  groupStudents: { id: string }[],
): Promise<RatingView | null> {
  const ownGpa = gpaOfStudent(ownGrades, disciplines, elements);
  if (ownGpa === null) return Promise.resolve(null);

  // Оценки группы — вход агрегата рейтинга; наружу идёт только место ctx-студента.
  return (async () => {
    const groupGrades = await db.listGradesByGroup(ctx.groupName!);
    const byStudent = new Map<string, GradeRow[]>();
    for (const row of groupGrades) {
      if (row.studentId === ctx.studentId) continue; // свой GPA уже посчитан
      const bucket = byStudent.get(row.studentId) ?? [];
      bucket.push(row);
      byStudent.set(row.studentId, bucket);
    }
    const better = [...byStudent.keys()].filter((studentId) => {
      const gpa = gpaOfStudent(byStudent.get(studentId)!, disciplines, elements);
      return gpa !== null && gpa > ownGpa;
    });
    const rank = 1 + better.length;
    const groupSize = Math.max(1, groupStudents.length);
    return {
      rank,
      groupSize,
      bestPercent: bestPercentFromRank(rank, groupSize),
      label: bestPercentLabel(rank, groupSize),
    };
  })();
}

// ── Публичные функции (контракт слоя данных) ────────────────────────────────

/**
 * Полный агрегат успеваемости текущего студента: накопленные оценки по
 * дисциплинам (текущая / максимальная / минимальная), GPA за семестр и за
 * всё время с дельтой, кредиты, рейтинг в группе и долги. Сотрудник —
 * пустой агрегат + аудит (ROLE_MISMATCH).
 */
export async function getPerformance(
  db: DataDb,
  ctx: DataCtx,
  now: Date = new Date(),
): Promise<PerformanceData> {
  if (ctx.studentId === null || ctx.groupName === null) {
    await denyAccess(db, {
      ctx,
      resourceType: RESOURCE,
      resourceRef: 'aggregate',
      reason: 'ROLE_MISMATCH',
    });
    return EMPTY_PERFORMANCE;
  }

  const [ownGrades, disciplines, elements, exams, groupStudents] = await Promise.all([
    db.listGradesByStudent(ctx.studentId),
    db.listDisciplinesByGroup(ctx.groupName),
    db.listDisciplineElementsByGroup(ctx.groupName),
    db.listExamsByGroup(ctx.groupName),
    db.listStudentsByGroup(ctx.groupName),
  ]);

  const computed = computeDisciplines(ownGrades, disciplines, elements);
  const rating = await buildRating(ctx, db, ownGrades, disciplines, elements, groupStudents);

  return {
    studentId: ctx.studentId,
    disciplines: buildDisciplineViews(computed, now),
    gpa: buildGpaView(computed, now),
    credits: buildCredits(computed),
    rating,
    debts: buildDebts(exams, computed, now),
  };
}

/**
 * Калькулятор цели: какой балл нужен на экзамене по дисциплине, чтобы итог
 * (с арифметическим округлением) стал ≥ target. Правила — docs/grading.md.
 *
 * Скоуп: дисциплина должна принадлежать группе из ctx; чужая или
 * несуществующая — единообразный null (uniform 404), причина — только в
 * AuditLog. Некорректный target (NaN/∞) — null без записи в аудит.
 */
export async function needForTarget(
  db: DataDb,
  ctx: DataCtx,
  disciplineCode: string,
  target: number,
): Promise<NeedForTargetOutcome | null> {
  if (!Number.isFinite(target)) return null;

  if (ctx.studentId === null || ctx.groupName === null) {
    await denyAccess(db, {
      ctx,
      resourceType: RESOURCE,
      resourceRef: disciplineCode,
      reason: 'ROLE_MISMATCH',
    });
    return null;
  }

  const [ownGrades, disciplines, elements] = await Promise.all([
    db.listGradesByStudent(ctx.studentId),
    db.listDisciplinesByGroup(ctx.groupName),
    db.listDisciplineElementsByGroup(ctx.groupName),
  ]);

  const known = disciplines.some((row) => row.disciplineCode === disciplineCode);
  const plan = elements.filter((el) => el.disciplineCode === disciplineCode);
  if (!known && plan.length === 0) {
    // Чужая группа и несуществующая дисциплина неразличимы снаружи (uniform 404).
    await denyAccess(db, {
      ctx,
      resourceType: RESOURCE,
      resourceRef: disciplineCode,
      reason: 'OWNERSHIP_DENIED',
    });
    return null;
  }

  const graded = ownGrades
    .filter((row) => row.disciplineCode === disciplineCode)
    .map(gradeToElement);
  const examElement = plan.find((el) => el.kind === 'EXAM') ?? null;

  return needForTargetPure({
    graded,
    plan: plan.map((el) => ({
      elementCode: el.elementCode,
      weight: el.weight,
      maxScore: el.maxScore,
    })),
    exam: examElement
      ? {
          elementCode: examElement.elementCode,
          weight: examElement.weight,
          maxScore: examElement.maxScore,
        }
      : null,
    target,
  });
}
