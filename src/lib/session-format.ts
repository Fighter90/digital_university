// DIG-28 — presentation-слой экрана «Сессия» (Figma «05 · Успеваемость —
// сессия»). Чистые функции БЕЗ серверных импортов: сезон и диапазон сессии,
// обратный отсчёт, причина недопуска, подписи и цвета статус-пилюль.
// Словесные подписи обязательны: цвет — не единственный носитель смысла.
import type { ExamKind } from '@/server/data/types';

/** Статус контрольной на таймлайне сессии. */
export type SessionExamStatus = 'ADMITTED' | 'NOT_ADMITTED' | 'PASSED' | 'RETAKE';

/** Тип контрольной для человека. */
export const EXAM_KIND_LABELS: Record<ExamKind, string> = {
  EXAM: 'Экзамен',
  CREDIT: 'Зачёт',
  RETAKE: 'Пересдача',
};

/** Статус-пилюля: подпись (цвет не единственный носитель смысла) + словарь Badge. */
export interface ExamStatusView {
  label: string;
  badge: 'success' | 'error' | 'warning';
}

/** Пилюля статуса по правилам макета: зелёный / красный / зелёный / янтарный. */
export function examStatusView(
  status: SessionExamStatus,
  score: number | null,
): ExamStatusView {
  switch (status) {
    case 'ADMITTED':
      return { label: 'Допущен', badge: 'success' };
    case 'NOT_ADMITTED':
      return { label: 'Не допущен', badge: 'error' };
    case 'RETAKE':
      return { label: 'Пересдача', badge: 'warning' };
    case 'PASSED':
      return { label: passedScoreLabel(score ?? 0), badge: 'success' };
  }
}

/** «Сдано · 9» — оценка целевого элемента в её шкале. */
export function passedScoreLabel(score: number): string {
  return `Сдано · ${Number.isInteger(score) ? score : formatScore(score)}`;
}

/** Оценка для человека: целая — без дроби, иначе одна десятичная с запятой. */
function formatScore(value: number): string {
  return value.toFixed(1).replace('.', ',');
}

// ── Числа и даты ────────────────────────────────────────────────────────────

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

/** «5 декабря» — дата контрольной на таймлайне. */
export function formatSessionDate(date: Date): string {
  return `${date.getDate()} ${MONTHS_GENITIVE[date.getMonth()]}`;
}

/** «09:40» — время начала. */
export function formatSessionTime(date: Date): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * Сезон сессии по месяцу первой контрольной: декабрь–февраль — «Зимняя
 * сессия», май–июнь — «Летняя сессия», остальное — просто «Сессия».
 */
export function seasonTitleOf(firstExamDate: Date): string {
  const month = firstExamDate.getMonth();
  if (month === 11 || month === 0 || month === 1) return 'Зимняя сессия';
  if (month === 4 || month === 5) return 'Летняя сессия';
  return 'Сессия';
}

/**
 * Диапазон сессии для шапки: «22 декабря – 25 января»; в одном месяце —
 * «5 – 9 января»; одна дата — «22 декабря».
 */
export function formatSessionRange(from: Date, to: Date): string {
  const start = formatSessionDate(from);
  if (sameDay(from, to)) return start;
  if (from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear()) {
    return `${from.getDate()} – ${to.getDate()} ${MONTHS_GENITIVE[to.getMonth()]}`;
  }
  return `${start} – ${formatSessionDate(to)}`;
}

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Календарных дней до контрольной (отрицательное — дата прошла). */
function calendarDaysLeft(date: Date, now: Date): number {
  return Math.round((startOfDay(date).getTime() - startOfDay(now).getTime()) / 86_400_000);
}

export interface ExamCountdown {
  /** Календарные дни до первой контрольной (0 — сегодня, <0 — идёт). */
  days: number;
  /** Готовая подпись шапки. */
  label: string;
}

/** Обратный отсчёт до первого экзамена (плюрализация, «сегодня», «идёт»). */
export function examCountdown(now: Date, firstExamAt: Date): ExamCountdown {
  const days = calendarDaysLeft(firstExamAt, now);
  if (days > 0) return { days, label: `До первого экзамена ${days} ${pluralDays(days)}` };
  if (days === 0) return { days, label: 'Первый экзамен сегодня' };
  return { days, label: 'Сессия уже идёт' };
}

/** день / дня / дней. */
export function pluralDays(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'день';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'дня';
  return 'дней';
}

/**
 * Причина недопуска — перечень несданных элементов плана: «Не сдано:
 * Лабораторная 3»; пустой список — null (причины нет).
 */
export function admissionReasonPhrase(elementNames: string[]): string | null {
  if (elementNames.length === 0) return null;
  return `Не сдано: ${elementNames.join(', ')}`;
}
