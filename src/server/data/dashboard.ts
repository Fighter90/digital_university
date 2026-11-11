// DIG-20 — «Ваша неделя»: серверный агрегат главной кабинета.
//
// Приёмка DIG-20: главная грузится ОДНИМ серверным запросом-агрегатом —
// все источники читаются параллельно (Promise.all над изолированным портом
// данных, скоупленным requireDataCtx()), без водопада запросов. Сбой одного
// источника не роняет страницу: каждый источник оседает в Section<T>, и
// блок с ошибкой отрисовывает собственное состояние ошибки, остальные блоки
// живы. Сводка-строка героя выводится детерминированно из данных
// (buildWeekSummary) — никакой LLM-генерации.
//
// Доступ: ctx строится из живой сессии (requireDataCtx) — studentId /
// groupName — поэтому чужие данные с этой страницы получить невозможно
// по построению (тот же контракт, что requests.ts / schedule.ts).

import {
  LESSON_KIND_LABELS,
  buildWeekSummary,
  disciplineLevel,
  formatDateBadge,
  formatLongDate,
  formatTime,
  greetingFor,
  headingDateLabel,
  nearestStudyDayLabel,
} from '@/lib/dashboard-format';
import type { DataDb } from './port';
import type {
  DataCtx,
  ExamSessionRow,
  GradeRow,
  ScheduleEventRow,
  ServiceRequestRow,
  StudentRow,
} from './types';

/** Результат одного источника агрегата: значение или изолированная ошибка. */
export type DashboardSection<T> = { ok: true; value: T } | { ok: false; error: string };

const ok = <T>(value: T): DashboardSection<T> => ({ ok: true, value });
const fail = <T>(error: unknown): DashboardSection<T> => ({
  ok: false,
  error: error instanceof Error ? error.message : String(error),
});

/** Осаждает промис источника: параллельный залп без каскадного падения. */
async function settle<T>(promise: Promise<T>): Promise<DashboardSection<T>> {
  try {
    return ok(await promise);
  } catch (error) {
    return fail<T>(error);
  }
}

/** Продолжает цепочку вывода блока, если источник-предок осел успешно. */
function derive<A, B>(source: DashboardSection<A>, next: (value: A) => B): DashboardSection<B> {
  return source.ok ? ok(next(source.value)) : { ok: false, error: source.error };
}

/** Комбинирует два источника в один блок (обе секции должны осесть успешно). */
function combine<A, B, C>(
  a: DashboardSection<A>,
  b: DashboardSection<B>,
  next: (a: A, b: B) => C,
): DashboardSection<C> {
  if (!a.ok) return { ok: false, error: a.error };
  if (!b.ok) return { ok: false, error: b.error };
  return ok(next(a.value, b.value));
}

export interface TodayLessonView {
  id: string;
  startsAt: Date;
  endsAt: Date;
  /** «10:00–11:30» */
  kind: ScheduleEventRow['kind'];
  /** «Лекция» / «Лабораторная» / … */
  kindLabel: string;
  disciplineName: string;
  room: string;
  teacherName: string;
  isRescheduled: boolean;
  isCancelled: boolean;
  /** Занятие в онлайн-формате: аудитория «Онлайн» → ссылка-пилюля. */
  isOnline: boolean;
  /** «Перенос: ауд. 214 → 305» / «Время изменено: было 10:40». */
  transferNote: string | null;
  note: string | null;
}

export interface TodayView {
  lessons: TodayLessonView[];
  movedCount: number;
  cancelledCount: number;
  /** Когда пар нет: ближайший учебный день с занятиями. */
  nearestStudyDay: { label: string; count: number } | null;
}

export interface DeadlineView {
  id: string;
  disciplineName: string;
  /** «Пересдача» / «Зачёт» / «Экзамен». */
  kindLabel: string;
  date: Date;
  /** Бейдж даты: { day: '18', month: 'нояб.' }. */
  dayBadge: string;
  monthBadge: string;
  /** Календарных дней до события (0 — сегодня). ≤3 подсвечивается красным. */
  daysLeft: number;
}

export interface DisciplineBarView {
  code: string;
  disciplineName: string;
  /** Взвешенный средний, % от максимума (0–100). */
  average: number;
  level: 'good' | 'medium' | 'risk';
}

export interface DebtView {
  disciplineName: string;
  /** «18 ноября». */
  dateLabel: string;
  daysLeft: number;
}

export interface ProgressView {
  /** Взвешенный средний балл в процентах от максимума (0–100); нет оценок → null. */
  average: number | null;
  /** Тренд: две последние работы против предыдущих (в пунктах). */
  averageDelta: number | null;
  credits: number;
  creditsTotal: number;
  debts: DebtView[];
  disciplines: DisciplineBarView[];
}

export interface RequestsView {
  inWork: number;
  total: number;
}

export interface DashboardData {
  firstName: string | null;
  greeting: string;
  /** «среда, 11 ноября» — для заголовка «Ваша неделя · …». */
  headingDate: string;
  /** Детерминированная строка-резюме; null, если расписание не загрузилось. */
  summary: string | null;
  today: DashboardSection<TodayView>;
  deadlines: DashboardSection<DeadlineView[]>;
  progress: DashboardSection<ProgressView>;
  requests: DashboardSection<RequestsView>;
}

const GRADE_AHEAD_WINDOW = 2;

/** Взвешенный средний в процентах от максимума. */
function weightedAveragePercent(rows: GradeRow[]): number | null {
  const totalWeight = rows.reduce((acc, r) => acc + r.weight, 0);
  if (rows.length === 0 || totalWeight <= 0) return null;
  const sum = rows.reduce((acc, r) => acc + (r.score / r.maxScore) * 100 * r.weight, 0);
  return Math.round((sum / totalWeight) * 100) / 100;
}

/** Тренд среднего: две последние работы против предыдущих. */
function averageDeltaPercent(rows: GradeRow[]): number | null {
  const sorted = [...rows].sort((a, b) => a.gradedAt.getTime() - b.gradedAt.getTime());
  if (sorted.length < GRADE_AHEAD_WINDOW + 1) return null;
  const recent = sorted.slice(-GRADE_AHEAD_WINDOW);
  const older = sorted.slice(0, -GRADE_AHEAD_WINDOW);
  const recentAvg = weightedAveragePercent(recent);
  const olderAvg = weightedAveragePercent(older);
  if (recentAvg === null || olderAvg === null) return null;
  return Math.round((recentAvg - olderAvg) * 10) / 10;
}

/** Пересдачи = академические долги: ближайшие будущие RETAKE-сессии группы. */
function debtsFromExams(exams: ExamSessionRow[], startOfToday: number): DebtView[] {
  return exams
    .filter((e) => e.kind === 'RETAKE' && startOfDay(e.date).getTime() >= startOfToday)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((e) => ({
      disciplineName: e.disciplineName,
      dateLabel: formatLongDate(e.date),
      daysLeft: calendarDaysLeft(e.date, startOfToday),
    }));
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function calendarDaysLeft(date: Date, startOfToday: number): number {
  return Math.round((startOfDay(date).getTime() - startOfToday) / 86_400_000);
}

/**
 * Кредиты осваиваются ≈ 60 ECTS в учебный год (вымышленный план подготовки);
 * источник — курс студента из профиля, поэтому значение детерминировано
 * и не требует отдельного справочника. Ограничение — 240 (4 года).
 */
export function creditsForCourse(course: number): number {
  return Math.max(0, Math.min(240, course * 60));
}

const sameLocalDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export function toTodayView(events: ScheduleEventRow[], now: Date): TodayView {
  const todayLessons = events
    .filter((e) => sameLocalDay(e.date, now))
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  const lessons: TodayLessonView[] = todayLessons.map((e) => {
    const isRescheduled =
      e.status === 'ROOM_CHANGED' || e.status === 'TIME_CHANGED';
    const isCancelled = e.status === 'CANCELLED';
    const isOnline = e.room.trim().toLowerCase() === 'онлайн';
    const transferNote = e.status === 'ROOM_CHANGED'
      ? `Перенос: ауд. ${e.previousRoom ?? '—'} → ${e.room}`
      : e.status === 'TIME_CHANGED' && e.previousStartsAt
        ? `Время изменено: было ${formatTime(e.previousStartsAt)}`
        : null;
    return {
      id: e.id,
      startsAt: e.startsAt,
      endsAt: e.endsAt,
      kind: e.kind,
      kindLabel: LESSON_KIND_LABELS[e.kind],
      disciplineName: e.disciplineName,
      room: e.room,
      teacherName: e.teacherName,
      isRescheduled,
      isCancelled,
      isOnline,
      transferNote,
      note: e.note,
    };
  });

  const nextDay = events
    .filter((e) => startOfDay(e.date).getTime() > startOfDay(now).getTime())
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const nearestKey = nextDay[0]?.date
    ? startOfDay(nextDay[0].date).getTime()
    : null;
  const nearestStudyDay =
    nearestKey === null
      ? null
      : {
          label: nearestStudyDayLabel(new Date(nearestKey)),
          count: nextDay.filter((e) => startOfDay(e.date).getTime() === nearestKey).length,
        };

  return {
    lessons,
    movedCount: lessons.filter((l) => l.isRescheduled).length,
    cancelledCount: lessons.filter((l) => l.isCancelled).length,
    nearestStudyDay,
  };
}

export function toDeadlineViews(exams: ExamSessionRow[], now: Date, limit = 3): DeadlineView[] {
  const startOfToday = startOfDay(now).getTime();
  return exams
    .filter((e) => calendarDaysLeft(e.date, startOfToday) >= 0)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, limit)
    .map((e) => {
      const badge = formatDateBadge(e.date);
      return {
        id: e.id,
        disciplineName: e.disciplineName,
        kindLabel:
          e.kind === 'RETAKE' ? 'Пересдача' : e.kind === 'CREDIT' ? 'Зачёт' : 'Экзамен',
        date: e.date,
        dayBadge: badge.day,
        monthBadge: badge.month,
        daysLeft: calendarDaysLeft(e.date, startOfToday),
      };
    });
}

export function toProgressView(
  grades: GradeRow[],
  exams: ExamSessionRow[],
  student: StudentRow | null,
  now: Date,
): ProgressView {
  const startOfToday = startOfDay(now).getTime();

  const byDiscipline = new Map<string, { name: string; rows: GradeRow[] }>();
  for (const row of grades) {
    const bucket = byDiscipline.get(row.disciplineCode) ?? {
      name: row.disciplineName,
      rows: [],
    };
    bucket.rows.push(row);
    byDiscipline.set(row.disciplineCode, bucket);
  }
  const disciplines: DisciplineBarView[] = [...byDiscipline.entries()]
    .map(([code, { name, rows }]) => {
      const average = weightedAveragePercent(rows) ?? 0;
      return { code, disciplineName: name, average, level: disciplineLevel(average) };
    })
    .sort((a, b) => b.average - a.average);

  return {
    average: weightedAveragePercent(grades),
    averageDelta: averageDeltaPercent(grades),
    credits: student ? creditsForCourse(student.course) : 0,
    creditsTotal: 240,
    debts: debtsFromExams(exams, startOfToday),
    disciplines,
  };
}

const REQUESTS_IN_WORK: ServiceRequestRow['status'][] = [
  'SUBMITTED',
  'IN_PROGRESS',
  'NEEDS_REVISION',
];

export function toRequestsView(requests: ServiceRequestRow[]): RequestsView {
  return {
    inWork: requests.filter((r) => REQUESTS_IN_WORK.includes(r.status)).length,
    total: requests.length,
  };
}

/**
 * Агрегат главной: 5 параллельных чтений изолированного порта данных
 * (profile, schedule, exams, grades, requests) — один «запрос» со стороны
 * страницы, нулевой водопад. Формат ошибок — Section, чтобы страница могла
 * отрисовать состояние ошибки отдельно для каждого блока.
 */
export async function getDashboard(
  db: DataDb,
  ctx: DataCtx,
  now: Date = new Date(),
): Promise<DashboardData> {
  const [student, schedule, exams, grades, requests] = await Promise.all([
    settle(ctx.studentId === null ? Promise.resolve(null) : db.findStudentById(ctx.studentId)),
    settle(db.listScheduleByGroup(ctx.groupName ?? '__no-group__')),
    settle(db.listExamsByGroup(ctx.groupName ?? '__no-group__')),
    settle(ctx.studentId === null ? Promise.resolve([]) : db.listGradesByStudent(ctx.studentId)),
    settle(ctx.studentId === null ? Promise.resolve([]) : db.listRequestsByStudent(ctx.studentId)),
  ]);

  const firstName = student.ok && student.value ? student.value.fullName.split(' ')[0] : null;

  const today = derive(schedule, (events) => toTodayView(events, now));
  const deadlines = derive(exams, (rows) => toDeadlineViews(rows, now));
  const progress = combine(grades, exams, (g, e) => toProgressView(g, e, student.ok ? student.value : null, now));
  const requestsView = derive(requests, toRequestsView);

  const summary = derive(schedule, (events) => {
    const view = toTodayView(events, now);
    const retake = derive(exams, (rows) => debtsFromExams(rows, startOfDay(now).getTime()));
    const retakeDaysLeft =
      retake.ok && retake.value.length > 0 ? (retake.value[0]?.daysLeft ?? null) : null;
    return buildWeekSummary({
      pairs: view.lessons.length,
      moved: view.movedCount,
      cancelled: view.cancelledCount,
      retakeDaysLeft,
    });
  });

  return {
    firstName,
    greeting: greetingFor(now),
    headingDate: headingDateLabel(now),
    summary: summary.ok ? summary.value : null,
    today,
    deadlines,
    progress,
    requests: requestsView,
  };
}
