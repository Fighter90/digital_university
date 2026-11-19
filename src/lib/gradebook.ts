// DIG-27 — чистые функции зачётной книжки (без серверных импортов).
//
// Правила зафиксированы в openspec/changes/dig-27-gradebook-screen и
// docs/grading.md:
//  - тип контроля дисциплины выводится из плана контроля: есть элемент
//    EXAM → «Экзамен»; единственный элемент TEST → «Зачёт»; прочие планы
//    без EXAM → «Диф. зачёт»; нет данных → null (в модели прототипа нет
//    отдельного поля «тип контроля»);
//  - формула оценки карточки: элементы группируются по виду контроля
//    (TEST → «Контрольные», HOMEWORK → «ДЗ», …), процент части — сумма
//    весов группы, «текущий балл части» — заработанная доля от максимума
//    части (Σ вес×доля по сданным элементам группы / вес части × 100);
//  - при пересдаче элемента учитывается последняя оценка по дате (тот же
//    дедуп, что в performance-math).
//
// Модуль покрыт юнит-тестами напрямую (tests/gradebook.test.ts).

import { t, type TranslationKey } from '@/lib/i18n';

/** Виды элементов контроля (структурно совпадает с types.ts слоя данных). */
export type GradeElementKind = 'HOMEWORK' | 'LAB' | 'TEST' | 'PROJECT' | 'EXAM';

/** Тип контроля дисциплины для зачётки. */
export type ControlType = 'EXAM' | 'DIFF_CREDIT' | 'CREDIT';

/**
 * Метка типа контроля по локали (DIG-84/DIG-89): RU и EN — по словарю
 * интерфейса (значения RU байт-в-байт равны прежним литералам).
 */
export function controlTypeLabel(controlType: ControlType, locale: 'ru' | 'en' = 'ru'): string {
  return t(locale, `control.${controlType}` as TranslationKey);
}

/** Каноническая RU-карта (значения из словаря — байт-в-байт прежние метки). */
export const CONTROL_TYPE_LABELS: Record<ControlType, string> = {
  EXAM: controlTypeLabel('EXAM', 'ru'),
  DIFF_CREDIT: controlTypeLabel('DIFF_CREDIT', 'ru'),
  CREDIT: controlTypeLabel('CREDIT', 'ru'),
};

/** Псевдоним для читаемости в рендерах (/grades/*, выписка PDF). */
export const controlLabel = controlTypeLabel;

/**
 * Тип контроля по набору видов элементов (план контроля, а без плана —
 * сданные элементы). Детерминирован, покрыт тестами.
 */
export function controlTypeOf(kinds: GradeElementKind[]): ControlType | null {
  if (kinds.length === 0) return null;
  if (kinds.includes('EXAM')) return 'EXAM';
  if (kinds.length === 1 && kinds[0] === 'TEST') return 'CREDIT';
  return 'DIFF_CREDIT';
}

const PART_LABEL_KEYS: Record<GradeElementKind, TranslationKey> = {
  TEST: 'gradebook.element.TEST',
  HOMEWORK: 'gradebook.element.HOMEWORK',
  LAB: 'gradebook.element.LAB',
  PROJECT: 'gradebook.element.PROJECT',
  EXAM: 'gradebook.element.EXAM',
};

/** Каноническая RU-карта частей формулы (значения из словаря, байт-в-байт). */
export const PART_LABELS: Record<GradeElementKind, string> = {
  TEST: elementKindLabel('TEST'),
  HOMEWORK: elementKindLabel('HOMEWORK'),
  LAB: elementKindLabel('LAB'),
  PROJECT: elementKindLabel('PROJECT'),
  EXAM: elementKindLabel('EXAM'),
};

/** Метка части формулы по локали: «Контрольные» / «Tests» (DIG-89). */
export function elementKindLabel(kind: GradeElementKind, locale: 'ru' | 'en' = 'ru'): string {
  return t(locale, PART_LABEL_KEYS[kind]);
}

/** Элемент плана контроля (минимальный срез для частей формулы). */
export interface PlanElementLike {
  elementCode: string;
  kind: GradeElementKind;
  weight: number;
  maxScore: number;
}

/** Оценка элемента (минимальный срез строки GradeRow). */
export interface GradedScoreLike {
  elementCode: string;
  score: number;
  maxScore: number;
  gradedAt: Date;
}

/** Часть формулы оценки карточки дисциплины. */
export interface GradePart {
  kind: GradeElementKind;
  label: string;
  /** Сумма весов группы, в процентах итога дисциплины (0.3 → 30). */
  weightPercent: number;
  /** Текущий балл части, % от максимума части (null — в части нет оценок). */
  earnedPercent: number | null;
  /** Сколько элементов части оценено. */
  gradedCount: number;
}

const round1 = (x: number): number => Math.round(x * 10) / 10;

/**
 * Части формулы оценки: группировка плана по виду контроля в порядке
 * первого появления. Пересдачи дедуплицируются (последняя по дате).
 */
export function gradeParts(plan: PlanElementLike[], graded: GradedScoreLike[]): GradePart[] {
  const latest = new Map<string, GradedScoreLike>();
  for (const row of graded) {
    const prev = latest.get(row.elementCode);
    if (!prev || row.gradedAt.getTime() > prev.gradedAt.getTime()) {
      latest.set(row.elementCode, row);
    }
  }

  const order: GradeElementKind[] = [];
  const groups = new Map<GradeElementKind, PlanElementLike[]>();
  for (const el of plan) {
    if (!groups.has(el.kind)) {
      groups.set(el.kind, []);
      order.push(el.kind);
    }
    groups.get(el.kind)!.push(el);
  }

  return order.map((kind) => {
    const items = groups.get(kind)!;
    const weightSum = items.reduce((acc, el) => acc + el.weight, 0);
    let earned = 0;
    let gradedCount = 0;
    for (const el of items) {
      const row = latest.get(el.elementCode);
      if (!row || el.maxScore <= 0) continue;
      earned += (row.score / row.maxScore) * el.weight;
      gradedCount += 1;
    }
    return {
      kind,
      label: PART_LABELS[kind],
      weightPercent: round1(weightSum * 100),
      earnedPercent: gradedCount > 0 && weightSum > 0 ? round1((earned / weightSum) * 100) : null,
      gradedCount,
    };
  });
}

/** Строка формулы для подсказки: «Контрольные 30% · Экзамен 70%». */
export function formulaLine(parts: GradePart[]): string {
  return parts.map((part) => `${part.label} ${part.weightPercent}%`).join(' · ');
}

/** Дата в формате ДД.ММ.ГГГГ (даты зачётки компактны). */
export function formatScoreDate(date: Date): string {
  const p = new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(date);
  const get = (type: string) => p.find((part) => part.type === type)?.value ?? '';
  return `${get('day')}.${get('month')}.${get('year')}`;
}
