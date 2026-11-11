// DIG-25 — чистые формулы успеваемости (без серверных импортов).
//
// Правила шкалы и округления зафиксированы в docs/grading.md:
//  - все оценки — проценты от максимума элемента (0..100);
//  - итог дисциплины — АРИФМЕТИЧЕСКОЕ округление до целого процента
//    (половина — вверх, Math.round); блокирующих элементов в прототипе нет;
//  - веса элементов нормируются на сумму весов плана контроля дисциплины;
//  - GPA — средневзвешенное кредитами; семестр — по московскому календарю
//    (осень 1.09–25.01, весна 9.02–30.06, июль/август — будущая осень,
//    январь — хвост осени; как semesterBounds из src/lib/schedule-time.ts),
//    дисциплина относится к семестру по дате последней оценки.
//
// Модуль используется слоем данных (src/server/data/performance.ts) и
// покрыт юнит-тестами напрямую (tests/performance.test.ts).

/** Порог зачтения кредита по дисциплине («удовлетворительно» прототипа). */
export const CREDIT_PASS_PERCENT = 60;

/** Кредиты на всю программу (4 года × 60, вымышленный план прототипа). */
export const PROGRAM_TOTAL_CREDITS = 240;

export type SemesterTerm = 'FALL' | 'SPRING';

/** Ключ семестра: год начала учебного года и термина. */
export interface SemesterKey {
  startYear: number;
  term: SemesterTerm;
}

/**
 * Семестр московской даты: месяцы 9–12 и январь — осень (учебный год
 * начинается в сентябре), 2–6 — весна, 7–8 — будущая осень (как в
 * semesterBounds). January belongs to the fall semester of the PREVIOUS
 * calendar year (хвост сессии).
 */
export function semesterKeyOf(date: Date): SemesterKey {
  const p = moscowMonth(date);
  if (p >= 9) return { startYear: yearOf(date), term: 'FALL' };
  if (p >= 2 && p <= 6) return { startYear: yearOf(date) - 1, term: 'SPRING' };
  if (p >= 7) return { startYear: yearOf(date), term: 'FALL' };
  return { startYear: yearOf(date) - 1, term: 'FALL' }; // январь
}

function yearOf(date: Date): number {
  return Number(
    new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Moscow', year: 'numeric' })
      .formatToParts(date)
      .find((part) => part.type === 'year')?.value ?? 0,
  );
}

function moscowMonth(date: Date): number {
  return Number(
    new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Moscow', month: '2-digit' })
      .formatToParts(date)
      .find((part) => part.type === 'month')?.value ?? 0,
  );
}

/** «Осенний семестр 2026/27» / «Весенний семестр 2025/26». */
export function semesterKeyLabel(key: SemesterKey): string {
  const short = (y: number) => String(y % 100).padStart(2, '0');
  return key.term === 'FALL'
    ? `Осенний семестр ${key.startYear}/${short(key.startYear + 1)}`
    : `Весенний семестр ${key.startYear}/${short(key.startYear + 1)}`;
}

/** Монотонное число для сортировки семестров по возрастанию. */
export function semesterSortNumber(key: SemesterKey): number {
  return key.startYear * 2 + (key.term === 'SPRING' ? 1 : 0);
}

/** Предыдущий семестр: осень → весна того же учебного года, весна → осень прошлого. */
export function previousSemesterKey(key: SemesterKey): SemesterKey {
  return key.term === 'FALL'
    ? { startYear: key.startYear - 1, term: 'SPRING' }
    : { startYear: key.startYear - 1, term: 'FALL' };
}

/** Арифметическое округление итога до целого процента (половина — вверх). */
export function roundGrade(percent: number): number {
  return Math.round(percent);
}

const round2 = (x: number): number => Math.round(x * 100) / 100;

/** Оцененный элемент контроля (строка GradeRow в минимальном срезе). */
export interface GradedElementLike {
  elementCode: string;
  score: number;
  maxScore: number;
  weight: number;
  gradedAt: Date;
}

/** Элемент плана контроля дисциплины. */
export interface PlannedElementLike {
  elementCode: string;
  weight: number;
  /**
   * Максимум элемента — нужен, чтобы исключить из плана элементы, которые
   * не могут быть оценены (maxScore ≤ 0): они не должны уменьшать
   * «максимально возможную» оценку. Опционально для старых сидов.
   */
  maxScore?: number;
}

/** Экзаменационный элемент плана (для needForTarget). */
export interface ExamPlanLike {
  elementCode: string;
  weight: number;
  maxScore: number;
}

export interface AccumulatedGrade {
  /** Накопленная сейчас, % итога (null — оценок нет). */
  accumulated: number | null;
  /** Минимально гарантированная: все несданные элементы — нули. */
  minGuaranteed: number | null;
  /** Максимально возможная: все несданные — на максимум. */
  maxPossible: number | null;
}

/**
 * Дедупликация оценок по элементу: при пересдачах побеждает последняя
 * по gradedAt. Элементы с maxScore ≤ 0 пропускаются (делить на ноль нельзя).
 */
function latestByElement(graded: GradedElementLike[]): Map<string, GradedElementLike> {
  const latest = new Map<string, GradedElementLike>();
  for (const row of graded) {
    if (row.maxScore <= 0) continue;
    const prev = latest.get(row.elementCode);
    if (!prev || row.gradedAt.getTime() > prev.gradedAt.getTime()) {
      latest.set(row.elementCode, row);
    }
  }
  return latest;
}

/**
 * Накопленная оценка дисциплины. Веса нормируются на сумму весов плана;
 * если план пуст (старые сиды без плана контроля) — на сумму весов самих
 * оценок. Оценки по элементам вне плана при непустом плане игнорируются.
 */
export function accumulatedGrade(
  graded: GradedElementLike[],
  planRaw: PlannedElementLike[],
): AccumulatedGrade {
  const latest = latestByElement(graded);
  // Элементы, которые не могут быть оценены (maxScore ≤ 0), из плана
  // исключаются — они не участвуют ни в числителе, ни в нормировке.
  const plan = planRaw.filter((el) => el.maxScore === undefined || el.maxScore > 0);
  const planWeightSum = plan.reduce((acc, el) => acc + el.weight, 0);
  const usePlan = plan.length > 0 && planWeightSum > 0;

  let gradedSum = 0;
  let gradedWeightSum = 0;
  let remainingWeight = 0;

  if (usePlan) {
    for (const el of plan) {
      const row = latest.get(el.elementCode);
      const share = row ? row.score / row.maxScore : 0;
      gradedSum += share * el.weight;
      gradedWeightSum += row ? el.weight : 0;
      if (!row) remainingWeight += el.weight;
    }
    const normalized = (gradedSum / planWeightSum) * 100;
    const remaining = (remainingWeight / planWeightSum) * 100;
    return {
      // Накопленная уже исключает несданные элементы (их вклад — ноль),
      // поэтому «минимально гарантированная» совпадает с накопленной.
      accumulated: gradedWeightSum > 0 ? round2(normalized) : null,
      minGuaranteed: gradedWeightSum > 0 ? round2(normalized) : 0,
      maxPossible: round2(normalized + remaining),
    };
  }

  for (const row of latest.values()) {
    gradedSum += (row.score / row.maxScore) * row.weight;
    gradedWeightSum += row.weight;
  }
  if (gradedWeightSum <= 0) {
    return { accumulated: null, minGuaranteed: 0, maxPossible: 100 };
  }
  const normalized = round2((gradedSum / gradedWeightSum) * 100);
  return { accumulated: normalized, minGuaranteed: normalized, maxPossible: normalized };
}

/** Средневзвешенное значение (округление до 0.01); null — нет положительных весов. */
export function weightedAverage(items: { value: number; weight: number }[]): number | null {
  let sum = 0;
  let weights = 0;
  for (const item of items) {
    if (!(item.weight > 0)) continue;
    sum += item.value * item.weight;
    weights += item.weight;
  }
  if (weights <= 0) return null;
  return round2(sum / weights);
}

/** Семестр дисциплины по дате последней оценки (null — оценок нет). */
export function disciplineSemesterOf(graded: GradedElementLike[]): SemesterKey | null {
  let latest: GradedElementLike | null = null;
  for (const row of graded) {
    if (!latest || row.gradedAt.getTime() > latest.gradedAt.getTime()) latest = row;
  }
  return latest ? semesterKeyOf(latest.gradedAt) : null;
}

// ── needForTarget ───────────────────────────────────────────────────────────

export type NeedForTargetOutcome =
  | {
      status: 'OK';
      /** Минимальный балл на экзамене (в шкале элемента, целое). */
      neededScore: number;
      /** Тот же балл в процентах от максимума экзамена. */
      neededPercent: number;
      maxScore: number;
      /** Гарантированный итог при этом балле (с учётом округления). */
      guaranteedFinal: number;
    }
  | { status: 'ALREADY_SECURED'; finalPercent: number }
  | {
      status: 'EXAM_ALREADY_GRADED';
      finalPercent: number;
      examScore: number;
      examMaxScore: number;
    }
  | { status: 'UNREACHABLE'; bestPossible: number }
  | { status: 'NO_EXAM_ELEMENT'; finalPercent: number };

/** Эпсилон против «хвоста» двоичной арифметики при сравнении с порогом. */
const EPS = 1e-9;

/**
 * Какой балл нужен на экзамене, чтобы итог дисциплины (с арифметическим
 * округлением) стал ≥ target. Остальные незакрытые элементы считаются
 * нулями — результат является ГАРАНТИРОВАННЫМ, а не оптимистичным.
 * `exam` — экзаменационный элемент плана (может быть уже оценён).
 */
export function needForTargetPure(input: {
  graded: GradedElementLike[];
  plan: PlannedElementLike[];
  exam: ExamPlanLike | null;
  target: number;
}): NeedForTargetOutcome {
  const { graded, plan: planRaw, exam, target } = input;

  // Нормировка: план (без неоцениваемых элементов), а без плана —
  // веса оценок + вес экзамена.
  const plan = planRaw.filter((el) => el.maxScore === undefined || el.maxScore > 0);
  const planWeightSum =
    plan.reduce((acc, el) => acc + el.weight, 0) ||
    graded.reduce((acc, el) => acc + el.weight, 0) + (exam?.weight ?? 0);
  const normalizeWeight = (weight: number): number =>
    planWeightSum > 0 ? weight / planWeightSum : 0;

  const acc = accumulatedGrade(graded, plan);
  const accumulated = acc.accumulated ?? 0;
  const finalPercent = roundGrade(accumulated);

  const examGraded =
    exam === null ? undefined : graded.find((row) => row.elementCode === exam.elementCode);

  if (exam === null) {
    return { status: 'NO_EXAM_ELEMENT', finalPercent };
  }
  if (examGraded) {
    if (finalPercent >= target) return { status: 'ALREADY_SECURED', finalPercent };
    return {
      status: 'EXAM_ALREADY_GRADED',
      finalPercent,
      examScore: examGraded.score,
      examMaxScore: exam.maxScore,
    };
  }

  // Экзамен ещё не сдан: round(acc + wNorm·x/maxScore·100) ≥ target.
  // Результат округления — целое число, поэтому «итог ≥ target» равносильно
  // «итог ≥ ceil(target)», а по монотонности округления
  // «round(y) ≥ ceil(target)» ⇔ «y ≥ ceil(target) − 0.5».
  // Для целого target (штатный случай калькулятора) порог = target − 0.5;
  // дробная цель трактуется как «следующий целый итог» (70.5 → нужен итог 71).
  const wNorm = normalizeWeight(exam.weight);
  if (wNorm <= 0) {
    return finalPercent >= target
      ? { status: 'ALREADY_SECURED', finalPercent }
      : { status: 'UNREACHABLE', bestPossible: finalPercent };
  }
  if (finalPercent >= target) {
    return { status: 'ALREADY_SECURED', finalPercent };
  }

  const raw = ((Math.ceil(target) - 0.5 - accumulated) * exam.maxScore) / (100 * wNorm);
  const neededScore = Math.ceil(raw - EPS);

  if (neededScore <= 0) {
    return { status: 'ALREADY_SECURED', finalPercent };
  }
  if (neededScore > exam.maxScore) {
    const bestPossible = roundGrade(accumulated + wNorm * exam.maxScore);
    return { status: 'UNREACHABLE', bestPossible };
  }

  const guaranteedFinal = roundGrade(accumulated + wNorm * ((neededScore / exam.maxScore) * 100));
  return {
    status: 'OK',
    neededScore,
    neededPercent: round2((neededScore / exam.maxScore) * 100),
    maxScore: exam.maxScore,
    guaranteedFinal,
  };
}

// ── Рейтинг в группе ────────────────────────────────────────────────────────

/**
 * «Топ-X%»: доля группы, в которую студент входит по рейтингу.
 * X = ceil(место / размер группы × 100), но не меньше 1.
 */
export function bestPercentFromRank(rank: number, groupSize: number): number {
  if (groupSize <= 0) return 100;
  return Math.min(100, Math.max(1, Math.ceil((rank / groupSize) * 100)));
}

/**
 * Готовая формулировка для экрана: «Вы входите в 27% лучших в группе»,
 * а не «перцентиль 32». Одиночная группа — особая честная формулировка.
 */
export function bestPercentLabel(rank: number, groupSize: number): string {
  if (groupSize <= 1) return 'Вы — единственный студент в группе';
  return `Вы входите в ${bestPercentFromRank(rank, groupSize)}% лучших в группе`;
}
