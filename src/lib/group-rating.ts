// DIG-103 — «Рейтинг группы» (/grades/rating): чистая логика сортировки,
// мест и форматирования среднего балла. Без серверных импортов —
// переиспользуется и фасадом слоя данных (performance.getGroupRating),
// и экраном; контракт зафиксирован red-тестами tests/group-rating.test.ts.
//
// Правила (задача DIG-103):
//  - сортировка по среднему desc, при равенстве — по алфавиту (ru);
//  - равные средние — ОДНО место (competition ranking, как «Рейтинг в
//    группе» сводки DIG-80: место = 1 + число строго выше), поэтому место
//    на странице рейтинга совпадает с местом в сводке;
//  - студенты без оценок — после ранжированных, по алфавиту, без места:
//    размер таблицы совпадает с «N из <размер группы>» в сводке;
//  - формат среднего — всегда два знака (87 → «87,00»; RU-запятая).
import type { Locale } from '@/lib/i18n';

/** Член группы (минимум для строки таблицы). */
export interface GroupRatingMember {
  studentId: string;
  fullName: string;
}

/** Студент с рассчитанным средним (GPA — единый расчёт агрегата DIG-80). */
export interface GroupRatingEntry extends GroupRatingMember {
  average: number;
}

/** Строка таблицы рейтинга: наружу НЕ уходит ничего, кроме ФИО и среднего. */
export interface GroupRatingRow {
  studentId: string;
  fullName: string;
  /** Средний балл (шкала проекта 0–100); null — оценок нет. */
  average: number | null;
  /** Место (competition ranking); null — не ранжирован (нет оценок). */
  place: number | null;
  /** Строка владельца сессии — на экране подсветка + метка «вы». */
  isViewer: boolean;
}

/** Порядок по ФИО — словарная коллация ru (канон дефолтной локали). */
const byName = (a: { fullName: string }, b: { fullName: string }): number =>
  a.fullName.localeCompare(b.fullName, 'ru');

/**
 * Полная таблица рейтинга группы: ранжированные (средний desc, при
 * равенстве — по алфавиту; равные средние — одно место), затем студенты
 * без оценок (по алфавиту, без места). `members` — ВСЕ студенты группы
 * (owner-scope гарантирует фасад), `entries` — те, у кого есть средний.
 */
export function buildGroupRatingRows(
  entries: readonly GroupRatingEntry[],
  members: readonly GroupRatingMember[],
  viewerStudentId: string | null,
): GroupRatingRow[] {
  const ranked = [...entries].sort((a, b) =>
    a.average === b.average ? byName(a, b) : b.average - a.average,
  );

  const placed = ranked.map((entry): GroupRatingRow => {
    // Competition ranking: столько студентов, сколько строго выше, + 1.
    const place = 1 + ranked.filter((other) => other.average > entry.average).length;
    return {
      studentId: entry.studentId,
      fullName: entry.fullName,
      average: entry.average,
      place,
      isViewer: entry.studentId === viewerStudentId,
    };
  });

  const rankedIds = new Set(ranked.map((entry) => entry.studentId));
  const unranked = members
    .filter((m) => !rankedIds.has(m.studentId))
    .sort(byName)
    .map((m): GroupRatingRow => ({
      studentId: m.studentId,
      fullName: m.fullName,
      average: null,
      place: null,
      isViewer: m.studentId === viewerStudentId,
    }));

  return [...placed, ...unranked];
}

/** Средний балл для таблицы: всегда два знака (87 → «87,00»; EN — точка). */
export function formatAverageScore(value: number, locale: Locale = 'ru'): string {
  const fixed = value.toFixed(2);
  return locale === 'en' ? fixed : fixed.replace('.', ',');
}
