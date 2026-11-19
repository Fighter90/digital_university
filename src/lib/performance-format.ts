// DIG-26 — presentation-слой экрана «Успеваемость: сводка» (Figma «05»).
//
// Чистые функции БЕЗ серверных импортов: форматирование оценок и семестров,
// светофор состояния, карточки дисциплин, долги, подсказки простыми словами.
// Источник данных — view-типы слоя данных (DisciplinePerformance / DebtItem
// из src/server/data/performance.ts); сами выборки и скоупинг (IDOR) живут
// в слое данных, здесь только представление.
//
// Словесные подписи и тултипы обязательны: цвет — не единственный носитель
// смысла (доступность). Правила расчёта — docs/grading.md.
import {
  CREDIT_PASS_PERCENT,
  semesterKeyLabel,
  semesterSortNumber,
  previousSemesterKey,
  weightedAverage,
  type SemesterKey,
  type SemesterTerm,
} from '@/lib/performance-math';
import { t, type Locale } from '@/lib/i18n';
import type { DisciplinePerformance, DebtItem, DebtStatus } from '@/server/data/performance';
import type { ExamSessionRow } from '@/server/data/types';

// ── Тултипы сокращений простыми словами ─────────────────────────────────────

/**
 * Расшифровка GPA у кольца сводки. RU-константы сохранены байт-в-байт
 * (ими пользуются тесты и прежние вызовы); DIG-84 — функции по локали.
 */
export const GPA_HINT =
  'GPA — средний балл, взвешенный кредитами дисциплин: дисциплина с 5 кредитами влияет вдвое сильнее, чем с 2.5. Идущие дисциплины входят предварительной накопленной оценкой.';

/** Расшифровка блока кредитов. */
export const CREDITS_HINT =
  'Кредиты — единицы объёма дисциплин (ECTS). На всю программу нужно 240 кредитов; зачитываются завершённые дисциплины с оценкой не ниже порога зачтения.';

/** Короткая подсказка «кр.» у карточек дисциплин. */
export const CREDITS_SHORT_HINT = 'Кредит — объём дисциплины: 1 кредит ≈ 36 академических часов.';

/** Расшифровка рейтинга группы. */
export const PERCENTILE_HINT =
  'Место в группе считается по среднему баллу (GPA) за всё время среди студентов группы. Средний балл — взвешенная кредитами оценка по всем дисциплинам; «в N% лучших» — доля группы с баллом не выше вашего.';

/** DIG-84 — расшифровки по локали (RU — те же строки байт-в-байт). */
export const gpaHint = (locale: Locale = 'ru'): string => t(locale, 'grades.gpaHint');
export const creditsHint = (locale: Locale = 'ru'): string => t(locale, 'grades.creditsHint');
export const creditsShortHint = (locale: Locale = 'ru'): string =>
  t(locale, 'grades.creditsShortHint');
export const percentileHint = (locale: Locale = 'ru'): string => t(locale, 'grades.percentileHint');

// ── Числа и даты ────────────────────────────────────────────────────────────

/**
 * Оценка для человека: целая — без дробной части, иначе одна десятичная
 * с запятой (48.9 → «48,9»; EN — с точкой «48.9»).
 */
export function formatScore(value: number, locale: Locale = 'ru'): string {
  if (Number.isInteger(value)) return String(value);
  const fixed = value.toFixed(1);
  return locale === 'en' ? fixed : fixed.replace('.', ',');
}

const MONTHS_GENITIVE = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
] as const;

/** «14 ноября» — день и месяц словом (без года; EN — «November 14»). */
export function formatDateShort(date: Date, locale: Locale = 'ru'): string {
  if (locale === 'en') {
    return new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'long' }).format(date);
  }
  return `${date.getDate()} ${MONTHS_GENITIVE[date.getMonth()]}`;
}

/** Русские формы существительного: plural(7, ['день','дня','дней']) → «дней». */
function plural(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (last > 1 && last < 5) return forms[1];
  if (last === 1) return forms[0];
  return forms[2];
}

/** Слово «день(дня/дней)» по локали: EN — day/days. */
function daysWord(count: number, locale: Locale): string {
  return locale === 'en'
    ? Math.abs(count) === 1
      ? 'day'
      : 'days'
    : plural(count, ['день', 'дня', 'дней']);
}

/** Слово «дисциплина(ы)» по локали (светофор рисков). */
function disciplinesWord(count: number, locale: Locale): string {
  return locale === 'en'
    ? Math.abs(count) === 1
      ? 'discipline'
      : 'disciplines'
    : plural(count, ['дисциплина', 'дисциплины', 'дисциплин']);
}

// ── Семестры: параметр URL, подписи, пилюли ─────────────────────────────────

/** Ключ семестра → параметр ?semester=YYYY-FALL|YYYY-SPRING. */
export function semesterParam(key: SemesterKey): string {
  return `${key.startYear}-${key.term}`;
}

/**
 * Параметр ?semester= → ключ семестра; мусор, пустота и неизвестный
 * термин — null (страница откатывается к дефолту, ничего не падает).
 */
export function parseSemesterParam(raw: string | undefined): SemesterKey | null {
  if (!raw) return null;
  const match = /^(\d{4})-(FALL|SPRING)$/.exec(raw);
  if (!match) return null;
  const startYear = Number(match[1]);
  const term = match[2] as SemesterTerm;
  return { startYear, term };
}

/** Короткая подпись пилюли: «Осень 26/27», «Весна 25/26» (EN — Fall/Spring). */
export function semesterShortLabel(key: SemesterKey, locale: Locale = 'ru'): string {
  const short = (y: number) => String(y % 100).padStart(2, '0');
  const term =
    key.term === 'FALL'
      ? t(locale, 'grades.term.fall.short')
      : t(locale, 'grades.term.spring.short');
  return `${term} ${short(key.startYear)}/${short(key.startYear + 1)}`;
}

const sameSemester = (a: SemesterKey, b: SemesterKey): boolean =>
  a.startYear === b.startYear && a.term === b.term;

/** Дисциплина с оценками (участвует в GPA, даёт пилюлю семестра). */
function hasGrades(d: DisciplinePerformance): boolean {
  return d.accumulated !== null || d.finalGrade !== null;
}

export interface SemesterPill {
  /** Значение ?semester= для ссылки. */
  key: string;
  /** Полная подпись (aria/тултип): «Осенний семестр 2026/27». */
  label: string;
  /** Короткая подпись пилюли: «Осень 26/27». */
  short: string;
  semester: SemesterKey;
}

/**
 * Пилюли переключателя семестров: семестры, где есть оценки, плюс текущий
 * (даже пустой — туда в итоге «придут» безоценочные дисциплины), по убыванию.
 */
export function buildSemesterPills(
  disciplines: DisciplinePerformance[],
  current: SemesterKey,
  locale: Locale = 'ru',
): SemesterPill[] {
  const keys = new Map<string, SemesterKey>();
  keys.set(semesterParam(current), current);
  for (const d of disciplines) {
    if (d.semester && hasGrades(d)) keys.set(semesterParam(d.semester), d.semester);
  }
  return [...keys.values()]
    .sort((a, b) => semesterSortNumber(b) - semesterSortNumber(a))
    .map((semester) => ({
      key: semesterParam(semester),
      label: semesterKeyLabel(semester, locale),
      short: semesterShortLabel(semester, locale),
      semester,
    }));
}

/**
 * Дисциплины выбранного семестра. Безоценочным дисциплинам семестр
 * неизвестен (выводится из дат оценок) — они остаются в блоке текущего
 * семестра, а не исчезают из экрана.
 */
export function disciplinesForSemester(
  disciplines: DisciplinePerformance[],
  semester: SemesterKey,
  current: SemesterKey,
): DisciplinePerformance[] {
  return disciplines.filter(
    (d) =>
      (d.semester && sameSemester(d.semester, semester)) ||
      (!d.semester && sameSemester(current, semester)),
  );
}

/**
 * Семестровый GPA по view-дисциплинам: средневзвешенное кредитами значения
 * «итог ?? накопленная» (то же правило, что в агрегате). Пусто → null.
 */
export function semesterGpaOf(disciplines: DisciplinePerformance[]): number | null {
  return weightedAverage(
    disciplines
      .map((d) => {
        const value = d.finalGrade ?? d.accumulated;
        return value === null ? null : { value, weight: d.credits };
      })
      .filter((item): item is { value: number; weight: number } => item !== null),
  );
}

export interface SemesterDeltaView {
  /** Разница GPA с предыдущим семестром, пункты (со знаком). */
  value: number;
  /** Короткая подпись предыдущего семестра: «Весна 25/26». */
  prevLabel: string;
}

/**
 * Дельта GPA выбранного семестра к предыдущему. Предыдущий пуст (нет
 * оценок) → null — «не с чем сравнивать» вместо обманчивого нуля.
 */
export function semesterDelta(
  disciplines: DisciplinePerformance[],
  semester: SemesterKey,
  locale: Locale = 'ru',
): SemesterDeltaView | null {
  const currentGpa = semesterGpaOf(disciplinesForSemester(disciplines, semester, semester));
  const prevKey = previousSemesterKey(semester);
  const prevGpa = semesterGpaOf(disciplinesForSemester(disciplines, prevKey, semester));
  if (currentGpa === null || prevGpa === null) return null;
  return {
    value: Math.round((currentGpa - prevGpa) * 100) / 100,
    prevLabel: semesterShortLabel(prevKey, locale),
  };
}

// ── Уровни дисциплин: светoфор без опоры только на цвет ─────────────────────

export type DisciplineLevel = 'good' | 'medium' | 'risk';

/** Классы текста уровня (цвет + словесная подпись рядом). */
export function levelTextClass(level: DisciplineLevel): string {
  switch (level) {
    case 'good':
      return 'text-success-ink';
    case 'medium':
      return 'text-warning-ink';
    case 'risk':
      return 'text-error-ink';
  }
}

/** Классы полосы прогресса уровня. */
export function levelBarClass(level: DisciplineLevel): string {
  switch (level) {
    case 'good':
      return 'bg-success';
    case 'medium':
      return 'bg-warning';
    case 'risk':
      return 'bg-error';
  }
}

/** Словесный уровень итоговой оценки (шкала прототипа, docs/grading.md). */
function finalLevelOf(grade: number, locale: Locale): { level: DisciplineLevel; word: string } {
  if (grade >= 85) return { level: 'good', word: t(locale, 'grades.level.excellent') };
  if (grade >= 70) return { level: 'good', word: t(locale, 'grades.level.good') };
  if (grade >= CREDIT_PASS_PERCENT) {
    return { level: 'medium', word: t(locale, 'grades.level.satisfactory') };
  }
  return { level: 'risk', word: t(locale, 'grades.level.belowPass') };
}

// ── Карточки дисциплин ──────────────────────────────────────────────────────

export type AdmissionStatus = 'graded' | 'admitted' | 'not-admitted';

export interface DisciplineCard {
  disciplineCode: string;
  disciplineName: string;
  teacher: string | null;
  creditsLabel: string;
  /** Крупная оценка: «87» / «48,9» / прочерк «—». */
  scoreLabel: string;
  /** Итог (завершена) или накопленная (идёт). */
  isFinal: boolean;
  level: DisciplineLevel | null;
  /** Словесный уровень — цвет не единственный носитель смысла. */
  levelWord: string;
  /** «из возможных 88,9» — только у идущей дисциплины с оценками. */
  maxPossibleLabel: string | null;
  admission: AdmissionStatus | null;
  admissionLabel: string | null;
  /** Позиция полосы прогресса, 0..100 (null — нет оценок). */
  progress: number | null;
  href: string;
}

/**
 * Карточка дисциплины для списка: крупная оценка, уровень и словесная
 * подпись, «из возможных», бейдж допуска к экзамену, ссылка в зачётку.
 *
 * Допуск (в прототипе блокирующих элементов нет, docs/grading.md):
 *  - экзамен уже оценён → «Экзамен сдан»;
 *  - неоценён только экзамен → «Допуск к экзамену есть»;
 *  - есть и другие несданные элементы → «Допуска к экзамену нет»;
 *  - экзамена в плане нет → бейджа нет вовсе.
 */
export function toDisciplineCards(
  disciplines: DisciplinePerformance[],
  locale: Locale = 'ru',
): DisciplineCard[] {
  return disciplines.map((d) => {
    const creditsLabel = t(locale, 'grades.creditsShort', { credits: d.credits });
    const href = `/grades/gradebook?discipline=${encodeURIComponent(d.disciplineCode)}`;

    if (d.finalGrade !== null) {
      const { level, word } = finalLevelOf(d.finalGrade, locale);
      return {
        disciplineCode: d.disciplineCode,
        disciplineName: d.disciplineName,
        teacher: d.teacherName,
        creditsLabel,
        scoreLabel: String(d.finalGrade),
        isFinal: true,
        level,
        levelWord: word,
        maxPossibleLabel: null,
        admission: admissionOf(d),
        admissionLabel: admissionLabelOf(admissionOf(d), locale),
        progress: d.finalGrade,
        href,
      };
    }

    if (d.accumulated !== null) {
      const level = inProgressLevelOf(d.accumulated, d.maxPossible, locale);
      return {
        disciplineCode: d.disciplineCode,
        disciplineName: d.disciplineName,
        teacher: d.teacherName,
        creditsLabel,
        scoreLabel: formatScore(d.accumulated, locale),
        isFinal: false,
        level: level.level,
        levelWord: level.word,
        maxPossibleLabel:
          d.maxPossible === null
            ? null
            : t(locale, 'grades.maxPossible', { score: formatScore(d.maxPossible, locale) }),
        admission: admissionOf(d),
        admissionLabel: admissionLabelOf(admissionOf(d), locale),
        progress: Math.min(100, Math.max(0, d.accumulated)),
        href,
      };
    }

    // Оценок нет: прочерк, нейтральный уровень, бейджа допуска нет.
    return {
      disciplineCode: d.disciplineCode,
      disciplineName: d.disciplineName,
      teacher: d.teacherName,
      creditsLabel,
      scoreLabel: '—',
      isFinal: false,
      level: null,
      levelWord: t(locale, 'grades.level.noGrades'),
      maxPossibleLabel: null,
      admission: null,
      admissionLabel: null,
      progress: null,
      href,
    };
  });
}

/** Уровень идущей дисциплины: риски > порог набран > порог возможен. */
function inProgressLevelOf(
  accumulated: number,
  maxPossible: number | null,
  locale: Locale,
): { level: DisciplineLevel; word: string } {
  if (maxPossible !== null && maxPossible < CREDIT_PASS_PERCENT) {
    return { level: 'risk', word: t(locale, 'grades.level.riskUnreachable') };
  }
  if (accumulated >= CREDIT_PASS_PERCENT) {
    return { level: 'good', word: t(locale, 'grades.level.passSecured') };
  }
  return { level: 'medium', word: t(locale, 'grades.level.passNotGuaranteed') };
}

function admissionOf(d: DisciplinePerformance): AdmissionStatus | null {
  if (!d.hasExamElement) return null;
  if (d.examGraded) return 'graded';
  // Неоценён только экзамен → допуск уже есть (остальные элементы сданы).
  return d.gradedElements >= d.totalElements - 1 ? 'admitted' : 'not-admitted';
}

function admissionLabelOf(admission: AdmissionStatus | null, locale: Locale): string | null {
  switch (admission) {
    case 'graded':
      return t(locale, 'grades.admission.graded');
    case 'admitted':
      return t(locale, 'grades.admission.admitted');
    case 'not-admitted':
      return t(locale, 'grades.admission.notAdmitted');
    default:
      return null;
  }
}

/** Статус бейджа допуска (цвет+текст словаря бейджей). */
export function admissionBadgeStatus(admission: AdmissionStatus): 'success' | 'warning' {
  return admission === 'not-admitted' ? 'warning' : 'success';
}

// ── Светофор состояния семестра ─────────────────────────────────────────────

export type TrafficTone = 'debts' | 'risk' | 'ok' | 'idle';

export interface TrafficLightView {
  tone: TrafficTone;
  title: string;
  /** Человеческая фраза: что именно происходит. */
  phrase: string;
  actionHref: string | null;
  actionLabel: string | null;
}

/** Статус бейджа светофора: тон → словарь статусов бейджей. */
export function trafficBadgeStatus(tone: TrafficTone): 'success' | 'warning' | 'error' | 'neutral' {
  switch (tone) {
    case 'ok':
      return 'success';
    case 'risk':
      return 'warning';
    case 'debts':
      return 'error';
    case 'idle':
      return 'neutral';
  }
}

/**
 * Светофор «как у меня дела» по выбранному семестру. Приоритет:
 * активные долги > риски (порог недостижим) > всё хорошо > оценок нет.
 */
export function trafficLight(
  disciplines: DisciplinePerformance[],
  debts: DebtItem[],
  locale: Locale = 'ru',
): TrafficLightView {
  const active = activeDebts(debts);
  if (active.length > 0) {
    const nearest = active[0]!;
    return {
      tone: 'debts',
      title: t(locale, 'grades.tl.debtsTitle'),
      phrase: t(locale, 'grades.tl.debtsPhrase', {
        count: active.length,
        discipline: nearest.disciplineName,
      }),
      actionHref: '#debts',
      actionLabel: t(locale, 'grades.tl.toDebts'),
    };
  }

  const riskItems = disciplines.filter(
    (d) =>
      d.accumulated !== null && (d.maxPossible === null || d.maxPossible < CREDIT_PASS_PERCENT),
  );
  if (riskItems.length > 0) {
    const first = riskItems[0]!;
    return {
      tone: 'risk',
      title: t(locale, 'grades.tl.riskTitle'),
      phrase: t(locale, 'grades.tl.riskPhrase', {
        count: riskItems.length,
        word: disciplinesWord(riskItems.length, locale),
        discipline: first.disciplineName,
        threshold: CREDIT_PASS_PERCENT,
      }),
      actionHref: '/grades/session',
      actionLabel: t(locale, 'grades.tl.toSession'),
    };
  }

  if (disciplines.some((d) => d.accumulated !== null || d.finalGrade !== null)) {
    return {
      tone: 'ok',
      title: t(locale, 'grades.tl.okTitle'),
      phrase: t(locale, 'grades.tl.okPhrase'),
      actionHref: '/grades/session',
      actionLabel: t(locale, 'grades.tl.toSession'),
    };
  }

  return {
    tone: 'idle',
    title: t(locale, 'grades.tl.idleTitle'),
    phrase: t(locale, 'grades.tl.idlePhrase'),
    actionHref: null,
    actionLabel: null,
  };
}

// ── Пустой семестр и «первая контрольная» ───────────────────────────────────

export interface NextAssessmentView {
  /** «Зачёт» / «Экзамен». */
  kindLabel: string;
  disciplineName: string;
  date: Date;
}

/** Ближайшая будущая контрольная (не пересдача): null — не запланировано. */
export function nextAssessment(
  exams: ExamSessionRow[],
  now: Date,
  locale: Locale = 'ru',
): NextAssessmentView | null {
  const upcoming = exams
    .filter((exam) => exam.kind !== 'RETAKE' && exam.date.getTime() > now.getTime())
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  const nearest = upcoming[0];
  if (!nearest) return null;
  return {
    kindLabel:
      nearest.kind === 'EXAM' ? t(locale, 'grades.kind.exam') : t(locale, 'grades.kind.credit'),
    disciplineName: nearest.disciplineName,
    date: nearest.date,
  };
}

/**
 * Подсказка пустого семестра: называет первую контрольную с датой,
 * а без запланированных — обещает оценки после неё.
 */
export function emptySemesterNote(
  assessment: NextAssessmentView | null,
  isCurrent: boolean,
  locale: Locale = 'ru',
): string {
  if (assessment) {
    return t(locale, 'grades.emptyNote.assessment', {
      kind: assessment.kindLabel.toLowerCase(),
      discipline: assessment.disciplineName,
      date: formatDateShort(assessment.date, locale),
    });
  }
  return isCurrent ? t(locale, 'grades.emptyNote.current') : t(locale, 'grades.emptyNote.past');
}

// ── Долги ───────────────────────────────────────────────────────────────────

/** Только незакрытые долги — они и есть «активные». */
export function activeDebts(debts: DebtItem[]): DebtItem[] {
  return debts.filter((d) => d.status !== 'CLOSED');
}

/** Бейдж статуса пересдачи: цвет + текст (словарь бейджей). */
export function debtBadge(
  status: DebtStatus,
  locale: Locale = 'ru',
): {
  label: string;
  badge: 'info' | 'error' | 'success';
} {
  switch (status) {
    case 'ASSIGNED':
      return { label: t(locale, 'grades.debt.assigned'), badge: 'info' };
    case 'OVERDUE':
      return { label: t(locale, 'grades.debt.overdue'), badge: 'error' };
    case 'CLOSED':
      return { label: t(locale, 'grades.debt.closed'), badge: 'success' };
  }
}

/** Фраза даты пересдачи: назначена на… / была …, долг не закрыт. */
export function debtDatePhrase(debt: DebtItem, locale: Locale = 'ru'): string {
  const dateLabel = formatDateShort(debt.retakeDate, locale);
  if (debt.status === 'OVERDUE') {
    return t(locale, 'grades.debt.overduePhrase', { date: dateLabel });
  }
  if (debt.status === 'ASSIGNED') {
    if (debt.daysLeft <= 0) return t(locale, 'grades.debt.assignedToday', { date: dateLabel });
    return t(locale, 'grades.debt.assignedIn', {
      date: dateLabel,
      days: debt.daysLeft,
      word: daysWord(debt.daysLeft, locale),
    });
  }
  return t(locale, 'grades.debt.closedPhrase', { date: dateLabel });
}
