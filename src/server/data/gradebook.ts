// DIG-27 — серверная часть «Зачётной книжки»: список по семестрам,
// карточка дисциплины и обращение «Ошибка в оценке?».
//
// Расчёты переиспользуют computeDisciplines DIG-25 (export из
// performance.ts) и чистые функции performance-math / gradebook —
// правила зафиксированы в docs/grading.md и openspec-спеке change.
//
// Доступ (тот же контракт, что grades.ts / performance.ts): ctx строится
// из живой сессии (requireDataCtx), персональные выборки скоуплены
// ctx.studentId, справочники — ctx.groupName. Чужая и несуществующая
// дисциплина отвечают одинаковым null (страница → единый 404), причина
// различается только в AuditLog (probe без скоупа, как у appeals).

import {
  CREDIT_PASS_PERCENT,
  roundGrade,
  semesterKeyLabel,
  semesterKeyOf,
  semesterSortNumber,
  weightedAverage,
  type SemesterKey,
} from '@/lib/performance-math';
import {
  CONTROL_TYPE_LABELS,
  controlTypeOf,
  gradeParts,
  PART_LABELS,
  type ControlType,
  type GradePart,
  type GradeElementKind,
} from '@/lib/gradebook';
import { denyAccess } from './access';
import { computeDisciplines, type DisciplineComputation } from './performance';
import type { DataDb } from './port';
import type { AppealRow, DataCtx, DisciplineElementRow, GradeRow } from './types';

const RESOURCE = 'gradebook';
const DISCIPLINE_RESOURCE = 'discipline-card';

// ── View-типы (то, что читают экраны) ───────────────────────────────────────

export interface GradebookStudentView {
  fullName: string;
  groupName: string;
  course: number;
  program: string;
  gradebookNumber: string;
}

export interface GradebookDisciplineView {
  disciplineCode: string;
  disciplineName: string;
  credits: number;
  /** null — ни плана, ни оценок (метка «—»). */
  controlType: ControlType | null;
  controlTypeLabel: string;
  /** Итог арифметическим округлением — только у завершённой дисциплины. */
  finalGrade: number | null;
  /** Накопленная (вклад в итог), % — для идущей дисциплины. */
  accumulated: number | null;
  /** Дата выставления итога = последняя оценка; null — оценок нет. */
  completedAt: Date | null;
  creditEarned: boolean;
}

export interface GradebookSemesterView {
  key: SemesterKey;
  label: string;
  disciplines: GradebookDisciplineView[];
  /** Средний балл семестра (взвешенный кредитами); null — нет значений. */
  average: number | null;
  creditsEarned: number;
  creditsTotal: number;
}

export interface GradebookData {
  student: GradebookStudentView | null;
  /** Свежие семестры сверху. */
  semesters: GradebookSemesterView[];
  overallAverage: number | null;
  creditsEarned: number;
  creditsRequired: number;
  hasGrades: boolean;
}

const EMPTY_GRADEBOOK: GradebookData = {
  student: null,
  semesters: [],
  overallAverage: null,
  creditsEarned: 0,
  creditsRequired: 0,
  hasGrades: false,
};

/** Часть формулы оценки на карточке (см. gradebook.ts в lib). */
export type DisciplineCardPart = GradePart;

/** Отдельная оценка в списке карточки (все попытки, свежие сверху). */
export interface DisciplineGradeRowView {
  id: string;
  elementCode: string;
  elementName: string;
  kindLabel: string;
  score: number;
  maxScore: number;
  gradedAt: Date;
  /** Не superseded пересдачей — учитывается в накопленной. */
  isLatest: boolean;
  comment: string | null;
}

/** Экзаменационный элемент плана — данные для слота калькулятора. */
export interface DisciplineExamView {
  elementCode: string;
  elementName: string;
  weightPercent: number;
  maxScore: number;
  graded: boolean;
}

export interface DisciplineCardData {
  disciplineCode: string;
  disciplineName: string;
  teacherName: string | null;
  credits: number;
  semesterLabel: string | null;
  /** Накопленная крупно (вклад в итог, %). */
  accumulated: number | null;
  maxPossible: number | null;
  finalGrade: number | null;
  isComplete: boolean;
  creditEarned: boolean;
  /** Формула оценки полосами (группы видов контроля). */
  parts: DisciplineCardPart[];
  /** Отдельные оценки — все попытки, свежие сверху. */
  grades: DisciplineGradeRowView[];
  /** Экзамен плана для калькулятора «Что нужно на экзамене»; null — экзамена нет. */
  exam: DisciplineExamView | null;
}

// ── Внутренние помощники ────────────────────────────────────────────────────

/** Значение дисциплины для средних: итог (завершена) или накопленная. */
function disciplineValue(computed: DisciplineComputation): number | null {
  if (computed.acc.accumulated === null) return null;
  return computed.isComplete ? roundGrade(computed.acc.accumulated) : computed.acc.accumulated;
}

const isCreditEarned = (computed: DisciplineComputation): boolean =>
  computed.isComplete &&
  computed.acc.accumulated !== null &&
  roundGrade(computed.acc.accumulated) >= CREDIT_PASS_PERCENT;

const latestGradedAt = (rows: GradeRow[]): Date | null =>
  rows.reduce<Date | null>(
    (latest, row) => (latest === null || row.gradedAt > latest ? row.gradedAt : latest),
    null,
  );

const planKinds = (
  plan: DisciplineElementRow[],
  gradedRows: GradeRow[],
): GradeElementKind[] => {
  if (plan.length > 0) return plan.map((el) => el.kind);
  // Старые сиды без плана контроля — выводим из сданных элементов.
  return gradedRows.map((row) => row.kind);
};

// ── Публичные функции (контракт слоя данных) ────────────────────────────────

/**
 * Зачётная книжка студента: дисциплины по семестрам (московский календарь
 * DIG-25; безоценочные дисциплины — в текущем семестре, как в
 * getPerformance), итоги семестров (средний балл по кредитам, кредиты) и
 * сводка за всё время. Сотрудник — пустой агрегат + аудит (ROLE_MISMATCH).
 */
export async function getGradebook(
  db: DataDb,
  ctx: DataCtx,
  now: Date = new Date(),
): Promise<GradebookData> {
  if (ctx.studentId === null || ctx.groupName === null) {
    await denyAccess(db, {
      ctx,
      resourceType: RESOURCE,
      resourceRef: 'list',
      reason: 'ROLE_MISMATCH',
    });
    return EMPTY_GRADEBOOK;
  }

  const [ownGrades, disciplines, elements, student] = await Promise.all([
    db.listGradesByStudent(ctx.studentId),
    db.listDisciplinesByGroup(ctx.groupName),
    db.listDisciplineElementsByGroup(ctx.groupName),
    db.findStudentById(ctx.studentId),
  ]);

  const computed = computeDisciplines(ownGrades, disciplines, elements);
  const currentKey = semesterKeyOf(now);
  const creditsRequired = computed.reduce((sum, item) => sum + item.credits, 0);

  const semesterByKey = new Map<string, GradebookSemesterView>();
  for (const item of computed) {
    const key = item.semester ?? currentKey;
    const bucketId = `${key.startYear}:${key.term}`;
    let bucket = semesterByKey.get(bucketId);
    if (!bucket) {
      bucket = {
        key,
        label: semesterKeyLabel(key),
        disciplines: [],
        average: null,
        creditsEarned: 0,
        creditsTotal: 0,
      };
      semesterByKey.set(bucketId, bucket);
    }
    const kinds = planKinds(
      elements.filter((el) => el.disciplineCode === item.code),
      ownGrades.filter((row) => row.disciplineCode === item.code),
    );
    const controlType = controlTypeOf(kinds);
    bucket.disciplines.push({
      disciplineCode: item.code,
      disciplineName: item.name,
      credits: item.credits,
      controlType,
      controlTypeLabel: controlType ? CONTROL_TYPE_LABELS[controlType] : '—',
      finalGrade:
        item.isComplete && item.acc.accumulated !== null ? roundGrade(item.acc.accumulated) : null,
      accumulated: item.acc.accumulated,
      completedAt: latestGradedAt(ownGrades.filter((row) => row.disciplineCode === item.code)),
      creditEarned: isCreditEarned(item),
    });
    bucket.creditsTotal += item.credits;
    if (isCreditEarned(item)) bucket.creditsEarned += item.credits;
  }

  const semesters = [...semesterByKey.values()]
    .map((bucket) => {
      const items = bucket.disciplines
        .map((discipline) => {
          const item = computed.find((c) => c.code === discipline.disciplineCode)!;
          const value = disciplineValue(item);
          return value === null ? null : { value, weight: item.credits };
        })
        .filter((entry): entry is { value: number; weight: number } => entry !== null);
      return {
        ...bucket,
        disciplines: bucket.disciplines.sort((a, b) =>
          a.disciplineName.localeCompare(b.disciplineName, 'ru'),
        ),
        average: weightedAverage(items),
      };
    })
    .sort((a, b) => semesterSortNumber(b.key) - semesterSortNumber(a.key));

  const overallItems = computed
    .map((item) => {
      const value = disciplineValue(item);
      return value === null ? null : { value, weight: item.credits };
    })
    .filter((entry): entry is { value: number; weight: number } => entry !== null);

  return {
    student: student
      ? {
          fullName: student.fullName,
          groupName: student.groupName,
          course: student.course,
          program: student.program,
          gradebookNumber: student.gradebookNumber,
        }
      : null,
    semesters,
    overallAverage: weightedAverage(overallItems),
    creditsEarned: computed
      .filter(isCreditEarned)
      .reduce((sum, item) => sum + item.credits, 0),
    creditsRequired,
    hasGrades: ownGrades.length > 0,
  };
}

/**
 * Карточка дисциплины текущего студента: шапка, формула оценки полосами,
 * отдельные оценки (все попытки) и данные экзамена для слота калькулятора.
 *
 * Чужая группа и несуществующий код — единообразный null (uniform 404);
 * причина отказа — только в AuditLog (OWNERSHIP_DENIED / NOT_FOUND),
 * как у needForTarget DIG-25 и appeals DIG-12.
 */
export async function getDisciplineCard(
  db: DataDb,
  ctx: DataCtx,
  disciplineCode: string,
  now: Date = new Date(),
): Promise<DisciplineCardData | null> {
  if (ctx.studentId === null || ctx.groupName === null) {
    await denyAccess(db, {
      ctx,
      resourceType: DISCIPLINE_RESOURCE,
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

  const plan = elements.filter((el) => el.disciplineCode === disciplineCode);
  const gradedRows = ownGrades.filter((row) => row.disciplineCode === disciplineCode);
  const knownInGroup = disciplines.some((row) => row.disciplineCode === disciplineCode);

  if (!knownInGroup && plan.length === 0) {
    // Чужая и несуществующая дисциплина неразличимы снаружи; различение —
    // только для аудита (probe смотрит без скоупа группы).
    const globalRow = await db.probeDisciplineByCode(disciplineCode);
    await denyAccess(db, {
      ctx,
      resourceType: DISCIPLINE_RESOURCE,
      resourceRef: disciplineCode,
      reason: globalRow ? 'OWNERSHIP_DENIED' : 'NOT_FOUND',
      now,
    });
    return null;
  }

  const computed = computeDisciplines(ownGrades, disciplines, elements).find(
    (item) => item.code === disciplineCode,
  );
  if (!computed) {
    await denyAccess(db, {
      ctx,
      resourceType: DISCIPLINE_RESOURCE,
      resourceRef: disciplineCode,
      reason: 'NOT_FOUND',
      now,
    });
    return null;
  }

  const reference = disciplines.find((row) => row.disciplineCode === disciplineCode) ?? null;
  const partsSource =
    plan.length > 0
      ? plan.map((el) => ({
          elementCode: el.elementCode,
          kind: el.kind,
          weight: el.weight,
          maxScore: el.maxScore,
        }))
      : gradedRows.map((row) => ({
          elementCode: row.elementCode,
          kind: row.kind,
          weight: row.weight,
          maxScore: row.maxScore,
        }));

  // Свежая попытка по элементу — для метки «пересдача» в списке.
  const latestByElement = new Map<string, GradeRow>();
  for (const row of gradedRows) {
    const prev = latestByElement.get(row.elementCode);
    if (!prev || row.gradedAt.getTime() >= prev.gradedAt.getTime()) {
      latestByElement.set(row.elementCode, row);
    }
  }
  const grades: DisciplineGradeRowView[] = [...gradedRows]
    .sort((a, b) => b.gradedAt.getTime() - a.gradedAt.getTime())
    .map((row) => ({
      id: row.id,
      elementCode: row.elementCode,
      elementName: row.elementName,
      kindLabel: PART_LABELS[row.kind],
      score: row.score,
      maxScore: row.maxScore,
      gradedAt: row.gradedAt,
      isLatest: latestByElement.get(row.elementCode)?.id === row.id,
      comment: row.comment,
    }));

  const examElement = plan.find((el) => el.kind === 'EXAM') ?? null;
  const exam: DisciplineExamView | null = examElement
    ? {
        elementCode: examElement.elementCode,
        elementName: examElement.elementName,
        weightPercent: Math.round(examElement.weight * 100),
        maxScore: examElement.maxScore,
        graded: latestByElement.has(examElement.elementCode),
      }
    : null;

  return {
    disciplineCode,
    disciplineName: computed.name,
    teacherName: reference?.teacherName ?? null,
    credits: computed.credits,
    semesterLabel: computed.semester ? semesterKeyLabel(computed.semester) : null,
    accumulated: computed.acc.accumulated,
    maxPossible: computed.acc.maxPossible,
    finalGrade:
      computed.isComplete && computed.acc.accumulated !== null
        ? roundGrade(computed.acc.accumulated)
        : null,
    isComplete: computed.isComplete,
    creditEarned: isCreditEarned(computed),
    parts: gradeParts(partsSource, gradedRows),
    grades,
    exam,
  };
}

/**
 * «Ошибка в оценке?» — обращение в деканат с предзаполненной дисциплиной.
 * Проверка владельца та же, что у карточки (чужая дисциплина — null +
 * аудит, обращение не создаётся).
 */
export async function createGradeAppeal(
  db: DataDb,
  ctx: DataCtx,
  disciplineCode: string,
  options: { now?: Date } = {},
): Promise<AppealRow | null> {
  const now = options.now ?? new Date();
  const card = await getDisciplineCard(db, ctx, disciplineCode, now);
  if (!card) return null;

  const profile = ctx.studentId === null ? null : await db.findStudentById(ctx.studentId);
  const accumulated =
    card.finalGrade !== null
      ? `итог ${card.finalGrade} из 100`
      : `накопленная ${card.accumulated ?? '—'} из 100`;

  return db.appendAppealByStudent(ctx.studentId!, {
    subject: `Ошибка в оценке — ${card.disciplineName}`,
    message:
      `Прошу проверить оценку по дисциплине «${card.disciplineName}» ` +
      `(код ${card.disciplineCode}, преподаватель ${card.teacherName ?? '—'}). ` +
      `В кабинете сейчас ${accumulated}. ` +
      'Список отдельных оценок — на карточке дисциплины в зачётной книжке.',
    authorName: profile?.fullName ?? ctx.login,
    createdAt: now,
  });
}
