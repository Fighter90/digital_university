// DIG-28 — presentation-слой экрана «Сессия» (Figma «05 · Успеваемость —
// сессия»). Чистые функции БЕЗ серверных импортов: сезон и диапазон сессии,
// обратный отсчёт, причина недопуска, подписи и цвета статус-пилюль.
// Словесные подписи обязательны: цвет — не единственный носитель смысла.
// DIG-79 (BUG-02/12): настенные компоненты дат берутся в явной зоне
// Europe/Moscow — сервер и браузер рендерят одинаковые строки (React #418).
import { moscowParts, type MoscowParts } from '@/lib/schedule-time';
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
export function examStatusView(status: SessionExamStatus, score: number | null): ExamStatusView {
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
  const p = moscowParts(date);
  return `${p.day} ${MONTHS_GENITIVE[p.month - 1]}`;
}

/** «09:40» — время начала. */
export function formatSessionTime(date: Date): string {
  const p = moscowParts(date);
  return `${pad2(p.hour)}:${pad2(p.minute)}`;
}

/**
 * Сезон сессии по московскому месяцу первой контрольной: декабрь–февраль —
 * «Зимняя сессия», май–июнь — «Летняя сессия», остальное — просто «Сессия».
 */
export function seasonTitleOf(firstExamDate: Date): string {
  const month = moscowParts(firstExamDate).month; // 1..12
  if (month === 12 || month === 1 || month === 2) return 'Зимняя сессия';
  if (month === 5 || month === 6) return 'Летняя сессия';
  return 'Сессия';
}

/**
 * Диапазон сессии для шапки: «22 декабря – 25 января»; в одном месяце —
 * «5 – 9 января»; одна дата — «22 декабря».
 */
export function formatSessionRange(from: Date, to: Date): string {
  const a = moscowParts(from);
  const start = `${a.day} ${MONTHS_GENITIVE[a.month - 1]}`;
  const b = moscowParts(to);
  if (sameMoscowDay(a, b)) return start;
  if (a.month === b.month && a.year === b.year) {
    return `${a.day} – ${b.day} ${MONTHS_GENITIVE[b.month - 1]}`;
  }
  return `${start} – ${formatSessionDate(to)}`;
}

const sameMoscowDay = (a: MoscowParts, b: MoscowParts) =>
  a.year === b.year && a.month === b.month && a.day === b.day;

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** Номер московского календарного дня («дней от эпохи») — для разницы дней. */
function moscowDayNumber(date: Date): number {
  const p = moscowParts(date);
  return Math.round(Date.UTC(p.year, p.month - 1, p.day) / 86_400_000);
}

/** Календарных дней до контрольной по московскому календарю (отрицательное — дата прошла). */
function calendarDaysLeft(date: Date, now: Date): number {
  return moscowDayNumber(date) - moscowDayNumber(now);
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
