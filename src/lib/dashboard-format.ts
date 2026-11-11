// DIG-20 — pure presentation helpers of the dashboard screen («Ваша неделя»).
// No server imports: every function is deterministic and safe for client
// components. The summary line is DERIVED FROM DATA here (never via an LLM),
// which keeps the hero reproducible in tests and demo runs.

import type { ScheduleKind } from '@/server/data/types';

/** Русская плюрализация: 1 пара, 2 пары, 5 пар / 1 день, 2 дня, 5 дней. */
export function pluralRu(count: number, forms: readonly [string, string, string]): string {
  const n = Math.abs(count) % 100;
  const last = n % 10;
  if (n > 10 && n < 20) return forms[2];
  if (last > 1 && last < 5) return forms[1];
  if (last === 1) return forms[0];
  return forms[2];
}

const PAIR_FORMS = ['пара', 'пары', 'пар'] as const;
const DAY_FORMS = ['день', 'дня', 'дней'] as const;

export function greetingFor(now: Date): string {
  const hour = now.getHours();
  if (hour < 5) return 'Доброй ночи';
  if (hour < 12) return 'Доброе утро';
  if (hour < 18) return 'Добрый день';
  return 'Добрый вечер';
}

const headingFormatter = new Intl.DateTimeFormat('ru-RU', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

/** Дата для заголовка героя: «среда, 11 ноября». */
export function headingDateLabel(now: Date): string {
  return headingFormatter.format(now);
}

/** Заголовок героя: «Ваша неделя · среда, 11 ноября». */
export function weekHeading(now: Date): string {
  return `Ваша неделя · ${headingDateLabel(now)}`;
}

const weekdayDateFormatter = new Intl.DateTimeFormat('ru-RU', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

/** Ближайший учебный день: «четверг, 12 ноября». */
export function nearestStudyDayLabel(date: Date): string {
  return weekdayDateFormatter.format(date);
}

const longDateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
});

/** Дата пересдачи для бейджа риска: «18 ноября». */
export function formatLongDate(date: Date): string {
  return longDateFormatter.format(date);
}

const timeFormatter = new Intl.DateTimeFormat('ru-RU', {
  hour: '2-digit',
  minute: '2-digit',
});

/** Время: «10:40» (для «Время изменено: было 10:40»). */
export function formatTime(value: Date): string {
  return timeFormatter.format(value);
}

/** Интервал пары: «10:00–11:30». */
export function formatTimeRange(startsAt: Date, endsAt: Date): string {
  return `${timeFormatter.format(startsAt)}–${timeFormatter.format(endsAt)}`;
}

const dayFormatter = new Intl.DateTimeFormat('ru-RU', { day: 'numeric' });
const shortMonthFormatter = new Intl.DateTimeFormat('ru-RU', { month: 'short' });

/** Бейдж дедлайна: { day: '18', month: 'нояб.' }. */
export function formatDateBadge(date: Date): { day: string; month: string } {
  return { day: dayFormatter.format(date), month: shortMonthFormatter.format(date) };
}

/**
 * «осталось N дн.» с плюрализацией; 0 → «Сегодня», 1 → «Завтра».
 * Красная подсветка (≤3 дней) — ответственность компонента, здесь только текст.
 */
export function daysLeftLabel(daysLeft: number): string {
  if (daysLeft <= 0) return 'Сегодня';
  if (daysLeft === 1) return 'Завтра';
  return `осталось ${daysLeft} ${pluralRu(daysLeft, DAY_FORMS)}`;
}

/** Средний балл: десятичная запятая, один знак; нет данных → «—». */
export function formatAverage(average: number | null): string {
  return average === null ? '—' : average.toFixed(1).replace('.', ',');
}

/** Дельта со знаком и типографским минусом; нет данных → ''. */
export function formatDelta(delta: number | null): string {
  if (delta === null) return '';
  const sign = delta >= 0 ? '+' : '−';
  return `${sign}${Math.abs(delta).toFixed(1).replace('.', ',')}`;
}

export interface WeekSummaryInput {
  pairs: number;
  moved: number;
  cancelled: number;
  /** Дней до ближайшей пересдачи (долга); null — пересдач нет. */
  retakeDaysLeft: number | null;
}

/**
 * Строка-резюме героя, детерминированно из данных:
 * «Сегодня 4 пары, одна перенесена, одна отменена. До пересдачи 7 дней.»
 */
export function buildWeekSummary({
  pairs,
  moved,
  cancelled,
  retakeDaysLeft,
}: WeekSummaryInput): string {
  let base =
    pairs === 0 ? 'Сегодня пар нет' : `Сегодня ${pairs} ${pluralRu(pairs, PAIR_FORMS)}`;
  if (moved === 1) base += ', одна перенесена';
  if (moved > 1) base += `, перенесено пар: ${moved}`;
  if (cancelled === 1) base += ', одна отменена';
  if (cancelled > 1) base += `, отменено пар: ${cancelled}`;
  base += '.';
  if (retakeDaysLeft !== null) {
    base +=
      retakeDaysLeft <= 0
        ? ' Пересдача сегодня.'
        : ` До пересдачи ${retakeDaysLeft} ${pluralRu(retakeDaysLeft, DAY_FORMS)}.`;
  }
  return base;
}

/** Русские подписи типов занятий (пилюли таймлайна). */
export const LESSON_KIND_LABELS: Record<ScheduleKind, string> = {
  LECTURE: 'Лекция',
  PRACTICE: 'Практика',
  LAB: 'Лабораторная',
  SEMINAR: 'Семинар',
  CONSULTATION: 'Консультация',
};

/**
 * Пороговые уровни среднего по дисциплине для мини-полосок:
 * ≥85 — good, 70–84 — medium, ниже — risk (цвет из токенов статусов).
 */
export const DISCIPLINE_LEVEL_THRESHOLDS = { good: 85, medium: 70 } as const;

export type DisciplineLevel = 'good' | 'medium' | 'risk';

export function disciplineLevel(average: number): DisciplineLevel {
  if (average >= DISCIPLINE_LEVEL_THRESHOLDS.good) return 'good';
  if (average >= DISCIPLINE_LEVEL_THRESHOLDS.medium) return 'medium';
  return 'risk';
}

/** Склонение слова «долг» для бейджа риска: 1 долг, 2 долга, 5 долгов. */
export function debtLabel(count: number): string {
  return `${count} ${pluralRu(count, ['долг', 'долга', 'долгов'])}`;
}
