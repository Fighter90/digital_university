// DIG-66 — «Что изменилось»: AI-объяснение динамики оценок с интерактивным
// визуалом. Чистый модуль без серверных импортов (импортируется и серверным
// агрегатом, и клиентским компонентом, и unit-тестами).
//
// Тренд Product Hunt: AI-анализ данных → интерактивные визуалы. Здесь это
// детерминированный прототип без сети и LLM: временные срезы среднего балла
// и готовые человеческие формулировки. Данные вымышленные, мутаций нет.
//
// Ключевое требование приёмки — «данные совпадают с успеваемостью»: средний
// балл в каждой точке считается РОВНО как GPA-кольцо сводки (накопленная
// дисциплины по плану контроля из accumulatedGrade, взвешенная кредитами
// через weightedAverage). Поэтому число карточки и число кольца совпадают.
//
// DTO сознательно сериализуемый (ISO-строки вместо Date) — его получает
// клиентский компонент через границу RSC.
import {
  accumulatedGrade,
  semesterKeyLabel,
  semesterKeyOf,
  weightedAverage,
  type GradedElementLike,
  type SemesterKey,
} from '@/lib/performance-math';
import { formatScore } from '@/lib/performance-format';

// ── Вход (структурно совместим со строками слоя данных) ─────────────────────

/** Оценка студента (минимальный срез GradeRow). */
export interface GradeInsightGradeRow {
  disciplineCode: string;
  disciplineName: string;
  elementCode: string;
  elementName: string;
  score: number;
  maxScore: number;
  weight: number;
  gradedAt: Date;
}

/** Справочник дисциплин группы (минимальный срез DisciplineRow). */
export interface GradeInsightDisciplineRow {
  disciplineCode: string;
  disciplineName: string;
  credits: number;
}

/** План контроля дисциплины (минимальный срез DisciplineElementRow). */
export interface GradeInsightPlanRow {
  disciplineCode: string;
  elementCode: string;
  weight: number;
  maxScore: number;
}

export interface GradeInsightInput {
  grades: GradeInsightGradeRow[];
  disciplines: GradeInsightDisciplineRow[];
  /** ПОЛНЫЙ план семестра — несданные элементы считаются нулями, как на экране. */
  plan: GradeInsightPlanRow[];
  now: Date;
  /** Окно «за месяц», дней (по умолчанию 30). */
  windowDays?: number;
}

// ── Выход (DTO для клиентского компонента) ──────────────────────────────────

/** Работа в разборе точки: что и на сколько повлияло. */
export interface InsightWork {
  disciplineName: string;
  elementName: string;
  score: number;
  maxScore: number;
  /** ISO-дата оценки (сериализуемая замена Date). */
  dateISO: string;
}

/** Точка графика: накопленный средний после очередной работы. */
export interface InsightPoint {
  dateISO: string;
  /** Средний балл после этой работы (та же формула, что GPA-кольцо). */
  average: number;
  /** Изменение к предыдущей точке (null — первая). */
  delta: number | null;
  /** Все работы до этой точки включительно, новые сверху — «что повлияло». */
  works: InsightWork[];
}

export type InsightDirection = 'up' | 'down' | 'flat' | 'new' | 'none';

export interface GradeInsight {
  /** «Осенний семестр 2026/27» — семестр последней оценки. */
  semesterLabel: string;
  /** Хронологический ряд точек графика. */
  points: InsightPoint[];
  /** Текущий средний (последняя точка). */
  current: number;
  month: {
    direction: InsightDirection;
    /** Работы за окно месяца, новые сверху. */
    works: InsightWork[];
    /** Средний на момент последней работы ДО окна (null — окно открывает семестр). */
    baseline: number | null;
    /** current − baseline (null — базы нет). */
    delta: number | null;
  };
  /** Заголовок-объяснение («Что изменилось»). */
  headline: string;
  /** Пояснение с именованной работой-влиянием. */
  detail: string;
}

const round2 = (x: number): number => Math.round(x * 100) / 100;

const sameSemester = (a: SemesterKey, b: SemesterKey): boolean =>
  a.startYear === b.startYear && a.term === b.term;

const toWork = (row: GradeInsightGradeRow): InsightWork => ({
  disciplineName: row.disciplineName,
  elementName: row.elementName,
  score: row.score,
  maxScore: row.maxScore,
  dateISO: row.gradedAt.toISOString(),
});

/** Русские формы: pluralRu(3, ['пункт','пункта','пунктов']) → «пункта». */
function pluralRu(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (last === 1) return forms[0];
  if (last > 1 && last < 5) return forms[1];
  return forms[2];
}

/** «6,2 пункта» (дробное) / «2 пункта» / «1 пункт» / «5 пунктов». */
function pointsWord(value: number): string {
  return Number.isInteger(value) ? pluralRu(value, ['пункта', 'пункта', 'пунктов']) : 'пункта';
}

/**
 * AI-инсайт «Что изменилось»: ряд накопленного среднего по датам работ
 * семестра последней оценки + детерминированное объяснение динамики за
 * окно месяца. Нет оценок — null (карточка не рендерится).
 */
export function buildGradeInsight(inp: GradeInsightInput): GradeInsight | null {
  const windowDays = inp.windowDays ?? 30;

  // Оцениваемые события по возрастанию даты; maxScore ≤ 0 неоцениваемы —
  // так же, как в accumulatedGrade (делить на ноль нельзя).
  const events = inp.grades
    .filter((row) => row.maxScore > 0)
    .sort((a, b) => a.gradedAt.getTime() - b.gradedAt.getTime());
  if (events.length === 0) return null;

  // Тренд — по семестру ПОСЛЕДНЕЙ оценки (идущий семестр); оценки других
  // семестров в график и месяц не попадают.
  const semester = semesterKeyOf(events[events.length - 1].gradedAt);
  const scoped = events.filter((row) => sameSemester(semesterKeyOf(row.gradedAt), semester));

  const creditsByCode = new Map(inp.disciplines.map((row) => [row.disciplineCode, row.credits]));

  /** Средний балл по первым `upto+1` событиям — формулы GPA-кольца. */
  const averageAt = (upto: number): number => {
    const byDiscipline = new Map<string, GradedElementLike[]>();
    for (const row of scoped.slice(0, upto + 1)) {
      const bucket = byDiscipline.get(row.disciplineCode) ?? [];
      bucket.push({
        elementCode: row.elementCode,
        score: row.score,
        maxScore: row.maxScore,
        weight: row.weight,
        gradedAt: row.gradedAt,
      });
      byDiscipline.set(row.disciplineCode, bucket);
    }
    const items: { value: number; weight: number }[] = [];
    for (const [code, rows] of byDiscipline) {
      // Как computeDisciplines: есть план — нормируем на него, нет — на веса оценок.
      const plan = inp.plan
        .filter((el) => el.disciplineCode === code)
        .map((el) => ({ elementCode: el.elementCode, weight: el.weight, maxScore: el.maxScore }));
      const planForCalc =
        plan.length > 0
          ? plan
          : rows.map((row) => ({ elementCode: row.elementCode, weight: row.weight }));
      const acc = accumulatedGrade(rows, planForCalc);
      if (acc.accumulated !== null) {
        items.push({ value: acc.accumulated, weight: creditsByCode.get(code) ?? 1 });
      }
    }
    // Каждое событие имеет maxScore > 0, значит по своей дисциплине
    // accumulated не null — массив пустым не бывает.
    return weightedAverage(items)!;
  };

  const points: InsightPoint[] = [];
  let prev: number | null = null;
  for (let i = 0; i < scoped.length; i += 1) {
    const average = averageAt(i);
    points.push({
      dateISO: scoped[i].gradedAt.toISOString(),
      average,
      delta: prev === null ? null : round2(average - prev),
      works: scoped
        .slice(0, i + 1)
        .map(toWork)
        .reverse(),
    });
    prev = average;
  }

  const current = points[points.length - 1].average;

  // ── Месяц: окно, база, направление ────────────────────────────────────────
  const cutoff = inp.now.getTime() - windowDays * 86_400_000;
  const monthStartIdx = scoped.findIndex((row) => row.gradedAt.getTime() >= cutoff);
  const baselineIdx = monthStartIdx - 1; // последняя работа до окна
  const baseline = baselineIdx >= 0 ? points[baselineIdx].average : null;
  const monthWorks = (monthStartIdx >= 0 ? scoped.slice(monthStartIdx) : []).map(toWork).reverse();
  const delta = baseline === null ? null : round2(current - baseline);

  let direction: InsightDirection;
  if (monthWorks.length === 0) {
    direction = 'none';
  } else if (baseline === null || delta === null) {
    direction = 'new';
  } else if (delta > 0) {
    direction = 'up';
  } else if (delta < 0) {
    direction = 'down';
  } else {
    direction = 'flat';
  }

  // ── Вклады работ месяца (движение среднего, вызванное каждой) ─────────────
  let topWork: InsightWork | null = null;
  let topContribution = 0;
  if (monthStartIdx >= 0) {
    for (let i = monthStartIdx; i < scoped.length; i += 1) {
      const contribution = points[i].delta;
      if (contribution === null || contribution === 0) continue;
      if (Math.abs(contribution) > Math.abs(topContribution)) {
        topContribution = contribution;
        topWork = toWork(scoped[i]);
      }
    }
  }

  const f = formatScore;
  const firstMonth = monthWorks[monthWorks.length - 1] ?? null; // хронологически первая

  let headline: string;
  let detail: string;
  switch (direction) {
    case 'none': {
      headline = 'За месяц новых оценок не было';
      detail = `Средний балл держится на ${f(current)} из 100.`;
      break;
    }
    case 'new': {
      headline =
        monthWorks.length === 1
          ? `За месяц появилась новая работа — средний балл достиг ${f(current)} из 100`
          : `За месяц появились ${monthWorks.length} ${pluralRu(monthWorks.length, ['новая работа', 'новые работы', 'новых работ'])} — средний балл достиг ${f(current)} из 100`;
      detail =
        topWork && topContribution !== 0
          ? detailTopWork(topWork, topContribution)
          : `Средний балл задаёт работа «${firstMonth!.elementName}» (${firstMonth!.disciplineName}, ${firstMonth!.score} из ${firstMonth!.maxScore}).`;
      break;
    }
    case 'up': {
      headline = `Средний балл за месяц вырос на ${f(delta!)} ${pointsWord(delta!)}: было ${f(baseline!)}, стало ${f(current)}`;
      detail = detailTopWork(topWork!, topContribution);
      break;
    }
    case 'down': {
      headline = `Средний балл за месяц снизился на ${f(Math.abs(delta!))} ${pointsWord(Math.abs(delta!))}: было ${f(baseline!)}, стало ${f(current)}`;
      detail = detailTopWork(topWork!, topContribution);
      break;
    }
    case 'flat': {
      headline = `Средний балл за месяц не изменился: ${f(current)} из 100`;
      detail = `Свежие работы (${monthWorks.length}) не сдвинули средний.`;
      break;
    }
  }

  return {
    semesterLabel: semesterKeyLabel(semester),
    points,
    current,
    month: { direction, works: monthWorks, baseline, delta },
    headline,
    detail,
  };
}

/** Пояснение с сильнейшим влиянием: работа, дисциплина, балл, вклад. */
function detailTopWork(work: InsightWork, contribution: number): string {
  const verb = contribution > 0 ? 'подняла' : 'снизила';
  const value = Math.abs(contribution);
  return `Сильнее всего средний ${verb} «${work.elementName}» (${work.disciplineName}, ${work.score} из ${work.maxScore}): ${formatScore(value)} ${pointsWord(value)}.`;
}
