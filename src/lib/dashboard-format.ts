// DIG-20 — pure presentation helpers of the dashboard screen («Ваша неделя»).
// No server imports: every function is deterministic and safe for client
// components. The summary line is DERIVED FROM DATA here (never via an LLM),
// which keeps the hero reproducible in tests and demo runs.
//
// DIG-87 — EN-локализация часть 1: функции форматирования получили
// необязательный параметр locale (дефолт 'ru' — прежние вызовы дают
// байт-в-байт прежние RU-строки). Строки интерфейса берутся из словаря
// t(locale, key); плюрализация RU — pluralRu, EN — простые формы.

import { t, type Locale } from '@/lib/i18n';
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

// ── слова с плюрализацией по локали ──────────────────────────────────────────

const PAIR_FORMS = ['пара', 'пары', 'пар'] as const;
const DAY_FORMS = ['день', 'дня', 'дней'] as const;

/** «пара/пары/пар» (RU) или «class/classes» (EN). */
export function pairWord(count: number, locale: Locale = 'ru'): string {
  if (locale === 'en') return count === 1 ? 'class' : 'classes';
  return pluralRu(count, PAIR_FORMS);
}

/** «день/дня/дней» (RU) или «day/days» (EN). */
export function dayWord(count: number, locale: Locale = 'ru'): string {
  if (locale === 'en') return count === 1 ? 'day' : 'days';
  return pluralRu(count, DAY_FORMS);
}

/** «1 класс/class…» счётчик пар для EN-рендера (для тестов и хинтов). */
export function pluralEnClasses(count: number): string {
  return count === 1 ? 'class' : 'classes';
}

/** Заглавная первая буква (Intl для RU отдаёт строчные, словарь требует «Ноябрь»). */
export function capitalizeFirst(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const TZ = 'Europe/Moscow';

/** Час суток по московскому времени (независимо от TZ сервера/браузера). */
function moscowHour(now: Date): number {
  return Number(
    new Intl.DateTimeFormat('ru-RU', { timeZone: TZ, hour: 'numeric', hour12: false }).format(now),
  );
}

export function greetingFor(now: Date, locale: Locale = 'ru'): string {
  const hour = moscowHour(now);
  if (hour < 5) return t(locale, 'dashboard.greeting.night');
  if (hour < 12) return t(locale, 'dashboard.greeting.morning');
  if (hour < 18) return t(locale, 'dashboard.greeting.day');
  return t(locale, 'dashboard.greeting.evening');
}

const headingFormatter = new Intl.DateTimeFormat('ru-RU', {
  timeZone: TZ,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

const headingFormatterEn = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

/** Дата для заголовка героя: «среда, 11 ноября» / «Wednesday, November 11». */
export function headingDateLabel(now: Date, locale: Locale = 'ru'): string {
  return locale === 'en' ? headingFormatterEn.format(now) : headingFormatter.format(now);
}

/** Заголовок героя: «Ваша неделя · среда, 11 ноября». */
export function weekHeading(now: Date, locale: Locale = 'ru'): string {
  return `${t(locale, 'dashboard.hero.title')} · ${headingDateLabel(now, locale)}`;
}

const weekdayDateFormatter = new Intl.DateTimeFormat('ru-RU', {
  timeZone: TZ,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

const weekdayDateFormatterEn = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

/** Ближайший учебный день: «четверг, 12 ноября» / «Thursday, November 12». */
export function nearestStudyDayLabel(date: Date, locale: Locale = 'ru'): string {
  return locale === 'en' ? weekdayDateFormatterEn.format(date) : weekdayDateFormatter.format(date);
}

const longDateFormatter = new Intl.DateTimeFormat('ru-RU', {
  timeZone: TZ,
  day: 'numeric',
  month: 'long',
});

const longDateFormatterEn = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  day: 'numeric',
  month: 'long',
});

/** Дата пересдачи для бейджа риска: «18 ноября» / «November 18». */
export function formatLongDate(date: Date, locale: Locale = 'ru'): string {
  return locale === 'en' ? longDateFormatterEn.format(date) : longDateFormatter.format(date);
}

const timeFormatter = new Intl.DateTimeFormat('ru-RU', {
  timeZone: TZ,
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

const dayFormatter = new Intl.DateTimeFormat('ru-RU', {
  timeZone: TZ,
  day: 'numeric',
});
const shortMonthFormatter = new Intl.DateTimeFormat('ru-RU', {
  timeZone: TZ,
  month: 'short',
});
const shortMonthFormatterEn = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  month: 'short',
});

/** Бейдж дедлайна: { day: '18', month: 'нояб.' } / { day: '18', month: 'Nov' }. */
export function formatDateBadge(date: Date, locale: Locale = 'ru'): { day: string; month: string } {
  return {
    day: dayFormatter.format(date),
    month: locale === 'en' ? shortMonthFormatterEn.format(date) : shortMonthFormatter.format(date),
  };
}

/**
 * «осталось N дн.» с плюрализацией; 0 → «Сегодня», 1 → «Завтра».
 * Красная подсветка (≤3 дней) — ответственность компонента, здесь только текст.
 */
export function daysLeftLabel(daysLeft: number, locale: Locale = 'ru'): string {
  if (daysLeft <= 0) return t(locale, 'dashboard.daysLeft.today');
  if (daysLeft === 1) return t(locale, 'dashboard.daysLeft.tomorrow');
  return t(locale, 'dashboard.daysLeft.in', { count: daysLeft, days: dayWord(daysLeft, locale) });
}

/**
 * Календарных дней до дедлайна — разница КАЛЕНДАРНЫХ дней в Europe/Moscow
 * (BUG-06/DIG-83): та же логика, что у карточки «Дедлайны» дашборда
 * (src/server/data/dashboard.ts), но в ЯВНОЙ зоне, чтобы SSR и гидрация
 * давали одну строку при любом TZ процесса (корень BUG-02). Москва = UTC+3
 * фиксированно (без перехода на летнее время).
 */
export function calendarDaysLeft(due: Date, now: Date): number {
  const MOSCOW_OFFSET_MS = 3 * 3_600_000;
  const moscowDay = (date: Date): number =>
    Math.floor((date.getTime() + MOSCOW_OFFSET_MS) / 86_400_000);
  return moscowDay(due) - moscowDay(now);
}

/** Средний балл: RU — десятичная запятая, EN — точка; нет данных → «—». */
export function formatAverage(average: number | null, locale: Locale = 'ru'): string {
  if (average === null) return '—';
  return locale === 'en' ? average.toFixed(1) : average.toFixed(1).replace('.', ',');
}

/** Дельта со знаком и типографским минусом; нет данных → ''. */
export function formatDelta(delta: number | null, locale: Locale = 'ru'): string {
  if (delta === null) return '';
  const sign = delta >= 0 ? '+' : '−';
  const value = Math.abs(delta).toFixed(1);
  return locale === 'en' ? `${sign}${value}` : `${sign}${value.replace('.', ',')}`;
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
 * EN: «Today 4 classes, one rescheduled, one cancelled. 7 days until the retake.»
 */
export function buildWeekSummary(
  { pairs, moved, cancelled, retakeDaysLeft }: WeekSummaryInput,
  locale: Locale = 'ru',
): string {
  let base =
    pairs === 0
      ? t(locale, 'dashboard.summary.noPairs')
      : t(locale, 'dashboard.summary.pairs', { count: pairs, pairs: pairWord(pairs, locale) });
  if (moved === 1) base += t(locale, 'dashboard.summary.movedOne');
  if (moved > 1) base += t(locale, 'dashboard.summary.movedMany', { count: moved });
  if (cancelled === 1) base += t(locale, 'dashboard.summary.cancelledOne');
  if (cancelled > 1) base += t(locale, 'dashboard.summary.cancelledMany', { count: cancelled });
  base += '.';
  if (retakeDaysLeft !== null) {
    base +=
      retakeDaysLeft <= 0
        ? t(locale, 'dashboard.summary.retakeToday')
        : t(locale, 'dashboard.summary.retakeIn', {
            count: retakeDaysLeft,
            days: dayWord(retakeDaysLeft, locale),
          });
  }
  return base;
}

/** Русские подписи типов занятий (пилюли таймлайна) — канон RU-рендера. */
export const LESSON_KIND_LABELS: Record<ScheduleKind, string> = {
  LECTURE: 'Лекция',
  PRACTICE: 'Практика',
  LAB: 'Лабораторная',
  SEMINAR: 'Семинар',
  CONSULTATION: 'Консультация',
};

const LESSON_KIND_KEYS: Record<
  ScheduleKind,
  | 'schedule.kind.lecture'
  | 'schedule.kind.seminar'
  | 'schedule.kind.lab'
  | 'schedule.kind.practice'
  | 'schedule.kind.consultation'
> = {
  LECTURE: 'schedule.kind.lecture',
  SEMINAR: 'schedule.kind.seminar',
  LAB: 'schedule.kind.lab',
  PRACTICE: 'schedule.kind.practice',
  CONSULTATION: 'schedule.kind.consultation',
};

/** Подпись типа занятия по локали: «Лекция» / «Lecture» (DIG-87). */
export function lessonKindLabel(kind: ScheduleKind, locale: Locale = 'ru'): string {
  return t(locale, LESSON_KIND_KEYS[kind]);
}

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

/** Склонение слова «долг» для бейджа риска: RU «1 долг», EN «1 debt». */
export function debtLabel(count: number, locale: Locale = 'ru'): string {
  if (locale === 'en') return `${count} ${count === 1 ? 'debt' : 'debts'}`;
  return `${count} ${pluralRu(count, ['долг', 'долга', 'долгов'])}`;
}

/** «N заявок в работе» для виджета «Заявки»: RU плюрализация, EN простые формы. */
export function requestsInWorkLabel(count: number, locale: Locale = 'ru'): string {
  if (locale === 'en') return `${count} ${count === 1 ? 'request' : 'requests'} in progress`;
  return `${count} ${pluralRu(count, ['заявка в работе', 'заявки в работе', 'заявок в работе'])}`;
}

/** «N готово к получению» для виджета «Заявки». */
export function requestsReadyLabel(count: number, locale: Locale = 'ru'): string {
  if (locale === 'en') return `${count} ${count === 1 ? 'request' : 'requests'} ready for pickup`;
  return `${count} ${pluralRu(count, ['готова к получению', 'готовы к получению', 'готово к получению'])}`;
}

/** Подпись вида занятия для дедлайна дашборда: «Пересдача» / «Зачёт» / «Экзамен». */
export function deadlineKindLabel(
  kind: 'RETAKE' | 'CREDIT' | 'EXAM',
  locale: Locale = 'ru',
): string {
  const key: 'dashboard.kind.retake' | 'dashboard.kind.credit' | 'dashboard.kind.exam' =
    kind === 'RETAKE'
      ? 'dashboard.kind.retake'
      : kind === 'CREDIT'
        ? 'dashboard.kind.credit'
        : 'dashboard.kind.exam';
  return t(locale, key);
}
