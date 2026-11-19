// DIG-34 — «Задачи»: единый агрегат действий, которые ждут от студента.
//
// Разделение ролей (критерий приёмки): задача — ДЕЙСТВИЕ («что сделать»),
// заявка/контрольная/обращение — ОБЪЕКТ. Строка задачи несёт href ровно
// туда, где действие выполняется: заявка на доработке → карточка канонической
// заявки (единственное место с формой «Исправить и подать повторно»),
// дедлайн курса и недопуск → карточка дисциплины, пересдача → «Сессия»,
// обращение → «Деканат», ручная задача → отметка на самом экране.
//
// Источники (один Promise.all, скоуп по ctx, URL-параметров нет — IDOR
// невозможен по построению): канонические заявки NEEDS_FIX (машина состояний
// DIG-30), дедлайны заданий группы (StudyDeadlineRow, концепт-сиды), недопуск
// к будущим контрольным (правила допуска «Сессии» DIG-28), будущие пересдачи
// без заявки на запись, не закрытые обращения с последним сообщением
// сотрудника и ручные задачи владельца (StudentTaskRow).
//
// Группы сроков: Просрочено / Сегодня / На этой неделе (1–7 дней) / Позже.
// Задача без назначенного срока (заявка на доработке, ответ на обращение)
// попадает в «Сегодня» — действие ждёт сейчас; среди задач одного дня
// без даты идут первыми, далее — по времени (порядок источников стабилен:
// заявки, дедлайны, недопуск, пересдачи, обращения, ручные).

import { listCanonicalRequestsByStudent } from './canonical-requests';
import { denyAccess } from './access';
import { disciplineAdmission, RETAKE_TITLE_PREFIX } from './session';
import { t, type Locale } from '@/lib/i18n';
import type { DataDb } from './port';
import type { DataCtx, StudentTaskRow } from './types';

// Тесты агрегата импортируют контекст вместе с view-типами задач.
export type { DataCtx };

/** Откуда пришла задача. */
export type TaskSource = 'REQUEST' | 'COURSE' | 'SESSION' | 'RETAKE' | 'DEANERY' | 'MANUAL';

/** Строка задачи: действие с адресом исполнения. */
export interface TaskView {
  /** Стабильный ключ строки: `<источник>-<id объекта>`. */
  id: string;
  source: TaskSource;
  /** Что сделать — глагол: «Доработать заявку», «Сдать: Тест 2». */
  verb: string;
  /** Откуда: «Справка об обучении · ЗД-2026-000003», «Базы данных». */
  origin: string;
  /** Срок; null — срок не назначен (задача живёт в «Сегодня»). */
  dueAt: Date | null;
  /** Календарных дней до срока (0 — сегодня); null — срок не назначен. */
  daysLeft: number | null;
  /** Куда ведёт действие — ровно там, где задачу выполнить. */
  href: string;
  /** «Отметить выполненной» показывается только для ручных задач. */
  manual: boolean;
}

export interface TaskGroupViews {
  overdue: TaskView[];
  today: TaskView[];
  week: TaskView[];
  later: TaskView[];
}

export interface TasksData extends TaskGroupViews {
  /** Открытых задач всего — счётчик меню и блока главной. */
  openCount: number;
}

/** Блок главной «Что от меня ждут»: счётчик и самые срочные задачи. */
export interface TasksSummary {
  openCount: number;
  /** До трёх самых срочных задач (Просрочено → Сегодня → неделя → Позже). */
  top: TaskView[];
}

const EMPTY_TASKS: TasksData = {
  overdue: [],
  today: [],
  week: [],
  later: [],
  openCount: 0,
};

const TASK_RESOURCE = 'tasks';
const TASK_ROW_RESOURCE = 'student-task';

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function calendarDaysLeft(date: Date, startOfTodayMs: number): number {
  return Math.round((startOfDay(date).getTime() - startOfTodayMs) / 86_400_000);
}

/**
 * Группировка по срокам (чистая функция). Внутри группы — по возрастанию
 * срока; задачи без срока считаются «началом сегодняшнего дня»: идут
 * первыми в «Сегодня», при равном ключе сохраняют порядок источников
 * (стабильная сортировка).
 */
export function groupTasks(rows: TaskView[], now: Date): TaskGroupViews {
  const startOfTodayMs = startOfDay(now).getTime();
  // Ключ сортировки — точное время; границы групп — календарные дни.
  const sortKey = (t: TaskView): number => (t.dueAt === null ? startOfTodayMs : t.dueAt.getTime());
  const diffDays = (t: TaskView): number =>
    t.dueAt === null ? 0 : calendarDaysLeft(t.dueAt, startOfTodayMs);

  const buckets: TaskGroupViews = { overdue: [], today: [], week: [], later: [] };
  for (const task of rows) {
    const diff = diffDays(task);
    if (diff < 0) buckets.overdue.push(task);
    else if (diff === 0) buckets.today.push(task);
    else if (diff <= 7) buckets.week.push(task);
    else buckets.later.push(task);
  }
  const byDue = (a: TaskView, b: TaskView): number => sortKey(a) - sortKey(b);
  for (const list of [buckets.overdue, buckets.today, buckets.week, buckets.later]) {
    list.sort(byDue);
  }
  return buckets;
}

/**
 * Агрегат задач текущего студента. Сотрудник получает пустой агрегат и
 * запись AuditLog (ROLE_MISMATCH) — тот же контракт, что у «Сессии».
 */
export async function getTasks(
  db: DataDb,
  ctx: DataCtx,
  now: Date = new Date(),
  locale: Locale = 'ru',
): Promise<TasksData> {
  if (ctx.studentId === null || ctx.groupName === null) {
    await denyAccess(db, {
      ctx,
      resourceType: TASK_RESOURCE,
      resourceRef: 'aggregate',
      reason: 'ROLE_MISMATCH',
    });
    return EMPTY_TASKS;
  }

  const [requests, exams, grades, disciplines, elements, deadlines, manualTasks, appeals] =
    await Promise.all([
      listCanonicalRequestsByStudent(db, ctx),
      db.listExamsByGroup(ctx.groupName),
      db.listGradesByStudent(ctx.studentId),
      db.listDisciplinesByGroup(ctx.groupName),
      db.listDisciplineElementsByGroup(ctx.groupName),
      db.listStudyDeadlinesByGroup(ctx.groupName),
      db.listStudentTasksByStudent(ctx.studentId),
      db.listAppealsByStudent(ctx.studentId),
    ]);
  const appealMessages = await Promise.all(
    appeals.map((appeal) => db.listAppealMessages(appeal.id)),
  );

  const startOfTodayMs = startOfDay(now).getTime();
  const view = (task: Omit<TaskView, 'daysLeft'>): TaskView => ({
    ...task,
    daysLeft: task.dueAt === null ? null : calendarDaysLeft(task.dueAt, startOfTodayMs),
  });

  // 1. Канонические заявки «Нужна доработка» (NEEDS_FIX, машина состояний
  //    DIG-30): действие над объектом-заявкой, не дубль. Ровно карточка
  //    канона — единственное место с формой доработки.
  const requestTasks = requests
    .filter((request) => request.status === 'NEEDS_FIX')
    .map((request) =>
      view({
        id: `request-${request.id}`,
        source: 'REQUEST',
        verb: t(locale, 'tasks.verb.fixRequest'),
        origin: `${request.title} · ${request.number}`,
        dueAt: null,
        href: `/requests/${request.number}`,
        manual: false,
      }),
    );

  // 2. Дедлайны заданий курса (система курсов; в концепте — сиды).
  const courseTasks = deadlines.map((deadline) =>
    view({
      id: `course-${deadline.id}`,
      source: 'COURSE',
      verb: t(locale, 'tasks.verb.submit', { title: deadline.title }),
      origin: deadline.disciplineName,
      dueAt: deadline.dueAt,
      href: `/grades/${deadline.disciplineCode}`,
      manual: false,
    }),
  );

  // 3. Недопуск к будущим контрольным: что сдать. Зачёт и экзамен одной
  //    дисциплины с одинаковой причиной закрываются одной сдачей —
  //    остаётся задача с ближайшим сроком.
  const admissionTasks = new Map<string, TaskView>();
  for (const exam of exams) {
    if (exam.kind === 'RETAKE') continue;
    if (startOfDay(exam.date).getTime() < startOfTodayMs) continue;
    const { status, reason } = disciplineAdmission(
      exam.disciplineCode,
      grades,
      disciplines,
      elements,
    );
    if (status !== 'NOT_ADMITTED' || reason === null) continue;
    const candidate = view({
      id: `session-${exam.id}`,
      source: 'SESSION',
      verb: t(locale, 'tasks.verb.submit', {
        title: reason.replace(/^Не сдано: /, ''),
      }),
      origin: exam.disciplineName,
      dueAt: exam.date,
      href: `/grades/${exam.disciplineCode}`,
      manual: false,
    });
    const key = `${exam.disciplineCode}|${reason}`;
    const existing = admissionTasks.get(key);
    if (!existing || (existing.dueAt?.getTime() ?? 0) > (candidate.dueAt?.getTime() ?? 0)) {
      admissionTasks.set(key, candidate);
    }
  }

  // 4. Пересдачи: будущие и без существующей заявки на запись (тот же
  //    контракт идемпотентности, что «Сессия», DIG-28).
  const requestedRetakes = new Set(
    (await db.listRequestsByStudent(ctx.studentId))
      .filter((request) => request.title.startsWith(RETAKE_TITLE_PREFIX))
      .map((request) => request.title.slice(RETAKE_TITLE_PREFIX.length)),
  );
  const retakeTasks = exams
    .filter(
      (exam) =>
        exam.kind === 'RETAKE' &&
        startOfDay(exam.date).getTime() >= startOfTodayMs &&
        !requestedRetakes.has(exam.disciplineName),
    )
    .map((exam) =>
      view({
        id: `retake-${exam.id}`,
        source: 'RETAKE',
        verb: t(locale, 'tasks.verb.retakeSignup'),
        origin: exam.disciplineName,
        dueAt: exam.date,
        href: '/grades/session',
        manual: false,
      }),
    );

  // 5. Обращения, ждущие ответа студента: не закрытые, последнее сообщение —
  //    от сотрудника.
  const deaneryTasks: TaskView[] = [];
  appeals.forEach((appeal, index) => {
    if (appeal.status === 'CLOSED') return;
    const messages = appealMessages[index] ?? [];
    const last = messages.at(-1);
    if (!last || last.authorRole !== 'STAFF') return;
    deaneryTasks.push(
      view({
        id: `deanery-${appeal.id}`,
        source: 'DEANERY',
        verb: t(locale, 'tasks.verb.replyAppeal'),
        origin: appeal.subject,
        dueAt: null,
        href: '/deanery',
        manual: false,
      }),
    );
  });

  // 6. Ручные задачи владельца (не отмеченные): выполняются отметкой на
  //    самом экране задач.
  const manualRows = manualTasks
    .filter((row) => row.doneAt === null)
    .map((row) => viewManual(row, now, locale));

  const grouped = groupTasks(
    [
      ...requestTasks,
      ...courseTasks,
      ...admissionTasks.values(),
      ...retakeTasks,
      ...deaneryTasks,
      ...manualRows,
    ],
    now,
  );

  return {
    ...grouped,
    openCount:
      grouped.overdue.length + grouped.today.length + grouped.week.length + grouped.later.length,
  };
}

function viewManual(row: StudentTaskRow, now: Date, locale: Locale = 'ru'): TaskView {
  return {
    id: `manual-${row.id}`,
    source: 'MANUAL',
    verb: row.title,
    origin: row.note ?? t(locale, 'tasks.origin.deanery'),
    dueAt: row.dueAt,
    daysLeft: calendarDaysLeft(row.dueAt, startOfDay(now).getTime()),
    href: '/tasks',
    manual: true,
  };
}

/** Сводка для блока главной: счётчик и до трёх самых срочных задач. */
export async function getTasksSummary(
  db: DataDb,
  ctx: DataCtx,
  now: Date = new Date(),
  locale: Locale = 'ru',
): Promise<TasksSummary> {
  const data = await getTasks(db, ctx, now, locale);
  return {
    openCount: data.openCount,
    top: [...data.overdue, ...data.today, ...data.week, ...data.later].slice(0, 3),
  };
}

/**
 * Отметить ручную задачу выполненной. Только владелец; чужой/несуществующий
 * id — единообразный null, причина — только в AuditLog (без оракула).
 */
export async function markTaskDone(
  db: DataDb,
  ctx: DataCtx,
  taskId: string,
  now: Date = new Date(),
): Promise<StudentTaskRow | null> {
  if (ctx.studentId === null) {
    await denyAccess(db, {
      ctx,
      resourceType: TASK_ROW_RESOURCE,
      resourceRef: taskId,
      reason: 'ROLE_MISMATCH',
    });
    return null;
  }
  const probed = await db.probeStudentTaskById(taskId);
  if (!probed) {
    await denyAccess(db, {
      ctx,
      resourceType: TASK_ROW_RESOURCE,
      resourceRef: taskId,
      reason: 'NOT_FOUND',
    });
    return null;
  }
  if (probed.studentId !== ctx.studentId) {
    await denyAccess(db, {
      ctx,
      resourceType: TASK_ROW_RESOURCE,
      resourceRef: taskId,
      reason: 'OWNERSHIP_DENIED',
    });
    return null;
  }
  return db.markStudentTaskDoneByStudent(ctx.studentId, taskId, now);
}
