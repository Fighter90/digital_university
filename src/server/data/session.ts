// DIG-28 — серверная часть «Сессии»: таймлайн экзаменов и зачётов со
// статусами допуска, пересдачи с записью, консультации и материалы для
// экспорта в календарь.
//
// Статусы допуска — правила экрана, продолжение бейджа допуска DIG-26
// (docs/grading.md): целевой элемент сессии — EXAM-элемент плана, а без
// него (зачёт без экзамена) — последний TEST-элемент («Зачёт»). Оценён
// целевой → «Сдано · N»; сданы все остальные → «Допущен»; есть несданные
// → «Не допущен» с причиной «Не сдано: …»; плана нет — отказывать нечем,
// статус «Допущен». Пересдача (kind RETAKE) — отдельный список с записью.
//
// Доступ (тот же контракт, что performance.ts / gradebook.ts): ctx строится
// из живой сессии (requireDataCtx), контрольные и консультации скоуплены
// ctx.groupName, персональные выборки — ctx.studentId. Чужой/несуществующий
// examId в записи на пересдачу отвечают одинаковым null (форма — ошибка без
// оракула), причина различается только в AuditLog (probe без скоупа).

import {
  admissionReasonPhrase,
  EXAM_KIND_LABELS,
  examCountdown,
  examStatusView,
  formatSessionRange,
  seasonTitleOf,
  type SessionExamStatus,
} from '@/lib/session-format';
import { denyAccess } from './access';
import { newRequestNumber } from './request-number';
import type { DataDb } from './port';
import type {
  DataCtx,
  DisciplineElementRow,
  DisciplineRow,
  ExamSessionRow,
  GradeRow,
  ScheduleEventRow,
  ServiceRequestRow,
} from './types';

const RESOURCE = 'session';
const RETAKE_RESOURCE = 'retake-signup';
const RETAKE_TITLE_PREFIX = 'Запись на пересдачу — ';

// ── View-типы (то, что читают экраны) ───────────────────────────────────────

export interface SessionExamItem {
  examId: string;
  disciplineCode: string;
  disciplineName: string;
  kind: 'EXAM' | 'CREDIT';
  kindLabel: string;
  date: Date;
  startsAt: Date;
  room: string;
  /** Из справочника дисциплин группы; null — дисциплина вне справочника. */
  teacherName: string | null;
  status: Exclude<SessionExamStatus, 'RETAKE'>;
  statusLabel: string;
  statusBadge: 'success' | 'error' | 'warning';
  /** Оценка целевого элемента (последняя попытка) — только у PASSED. */
  score: number | null;
  /** «Не сдано: Лабораторная 3» — только у NOT_ADMITTED. */
  admissionReason: string | null;
  /** «Что сдать» → карточка дисциплины — только у NOT_ADMITTED. */
  actionHref: string | null;
}

export interface SessionRetakeItem {
  examId: string;
  disciplineCode: string;
  disciplineName: string;
  date: Date;
  startsAt: Date;
  room: string;
  note: string | null;
  /** Заявка на эту пересдачу уже создана (кнопка не показывается). */
  requested: boolean;
  requestNumber: string | null;
  /** Пересдача ещё не состоялась — кнопка «Записаться» показывается. */
  signUpAvailable: boolean;
}

export interface SessionConsultationItem {
  eventId: string;
  disciplineCode: string;
  disciplineName: string;
  date: Date;
  startsAt: Date;
  endsAt: Date;
  room: string;
  teacherName: string;
}

export interface SessionData {
  studentId: string | null;
  /** «Зимняя сессия» — по месяцу первой контрольной. */
  seasonTitle: string;
  /** «22 декабря – 25 января» — из дат сессии; null — контрольных нет. */
  rangeLabel: string | null;
  /** Обратный отсчёт до первой контрольной; null — контрольных нет. */
  countdown: { days: number; label: string } | null;
  /** Контрольные (зачёты и экзамены) по возрастанию даты. */
  exams: SessionExamItem[];
  /** Пересдачи по возрастанию даты. */
  retakes: SessionRetakeItem[];
  /** Консультации группы (kind CONSULTATION) по возрастанию даты. */
  consultations: SessionConsultationItem[];
}

const EMPTY_SESSION: SessionData = {
  studentId: null,
  seasonTitle: 'Сессия',
  rangeLabel: null,
  countdown: null,
  exams: [],
  retakes: [],
  consultations: [],
};

// ── Статусы допуска по плану контроля и оценкам ─────────────────────────────

/** Срез по одной дисциплине: целевой элемент сессии и несданные остальные. */
interface DisciplineSessionInfo {
  teacherName: string | null;
  targetScore: number | null;
  ungradedOthers: string[];
}

function sessionInfoOf(
  disciplineCode: string,
  grades: GradeRow[],
  disciplines: DisciplineRow[],
  elements: DisciplineElementRow[],
): DisciplineSessionInfo {
  const plan = elements.filter((el) => el.disciplineCode === disciplineCode);
  // Целевой элемент: EXAM, без него — последний TEST («Зачёт»).
  const target =
    plan.find((el) => el.kind === 'EXAM') ??
    [...plan.filter((el) => el.kind === 'TEST')].at(-1) ??
    null;

  // Последняя попытка по каждому элементу (пересдача перезаписывает).
  const latest = new Map<string, GradeRow>();
  for (const row of grades) {
    if (row.disciplineCode !== disciplineCode) continue;
    const current = latest.get(row.elementCode);
    if (!current || row.gradedAt.getTime() >= current.gradedAt.getTime()) {
      latest.set(row.elementCode, row);
    }
  }

  const ungradedOthers = plan
    .filter((el) => el.maxScore > 0 && el !== target && !latest.has(el.elementCode))
    .map((el) => el.elementName);

  const teacher = disciplines.find((row) => row.disciplineCode === disciplineCode);
  return {
    teacherName: teacher?.teacherName ?? null,
    targetScore: target ? (latest.get(target.elementCode)?.score ?? null) : null,
    ungradedOthers,
  };
}

function statusOf(info: DisciplineSessionInfo): {
  status: Exclude<SessionExamStatus, 'RETAKE'>;
  score: number | null;
  reason: string | null;
} {
  if (info.targetScore !== null) {
    return { status: 'PASSED', score: info.targetScore, reason: null };
  }
  if (info.ungradedOthers.length === 0) {
    return { status: 'ADMITTED', score: null, reason: null };
  }
  return { status: 'NOT_ADMITTED', score: null, reason: admissionReasonPhrase(info.ungradedOthers) };
}

function toExamItem(
  exam: ExamSessionRow,
  info: DisciplineSessionInfo,
): SessionExamItem {
  const kind = exam.kind === 'EXAM' ? 'EXAM' : 'CREDIT';
  const { status, score, reason } = statusOf(info);
  const view = examStatusView(status, score);
  return {
    examId: exam.id,
    disciplineCode: exam.disciplineCode,
    disciplineName: exam.disciplineName,
    kind,
    kindLabel: EXAM_KIND_LABELS[kind],
    date: exam.date,
    startsAt: exam.startsAt,
    room: exam.room,
    teacherName: info.teacherName,
    status,
    statusLabel: view.label,
    statusBadge: view.badge,
    score,
    admissionReason: reason,
    actionHref: status === 'NOT_ADMITTED' ? `/grades/${exam.disciplineCode}` : null,
  };
}

const byStartsAt = <T extends { startsAt: Date }>(a: T, b: T) =>
  a.startsAt.getTime() - b.startsAt.getTime();

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ── Публичные функции (контракт слоя данных) ────────────────────────────────

/**
 * Сессия текущего студента одним агрегатом: контрольные со статусами
 * допуска, пересдачи (с флагом созданной заявки), консультации группы.
 * Сотрудник — пустой агрегат + аудит (ROLE_MISMATCH).
 */
export async function getSession(
  db: DataDb,
  ctx: DataCtx,
  now: Date = new Date(),
): Promise<SessionData> {
  if (ctx.studentId === null || ctx.groupName === null) {
    await denyAccess(db, {
      ctx,
      resourceType: RESOURCE,
      resourceRef: 'aggregate',
      reason: 'ROLE_MISMATCH',
    });
    return EMPTY_SESSION;
  }

  const [exams, grades, disciplines, elements, schedule, requests] = await Promise.all([
    db.listExamsByGroup(ctx.groupName),
    db.listGradesByStudent(ctx.studentId),
    db.listDisciplinesByGroup(ctx.groupName),
    db.listDisciplineElementsByGroup(ctx.groupName),
    db.listScheduleByGroup(ctx.groupName),
    db.listRequestsByStudent(ctx.studentId),
  ]);

  const assessments = exams.filter((exam) => exam.kind !== 'RETAKE').sort(byStartsAt);
  const retakes = exams.filter((exam) => exam.kind === 'RETAKE').sort(byStartsAt);

  const consultEvents: ScheduleEventRow[] = schedule
    .filter((event) => event.kind === 'CONSULTATION')
    .sort(byStartsAt);

  const requestedTitles = new Map<string, string>();
  for (const request of requests) {
    if (request.title.startsWith(RETAKE_TITLE_PREFIX)) {
      requestedTitles.set(request.title, request.number);
    }
  }

  const examItems: SessionExamItem[] = assessments.map((exam) =>
    toExamItem(exam, sessionInfoOf(exam.disciplineCode, grades, disciplines, elements)),
  );

  const retakeItems: SessionRetakeItem[] = retakes.map((exam) => {
    const number = requestedTitles.get(`${RETAKE_TITLE_PREFIX}${exam.disciplineName}`) ?? null;
    return {
      examId: exam.id,
      disciplineCode: exam.disciplineCode,
      disciplineName: exam.disciplineName,
      date: exam.date,
      startsAt: exam.startsAt,
      room: exam.room,
      note: exam.note,
      requested: number !== null,
      requestNumber: number,
      signUpAvailable: startOfDay(exam.date).getTime() >= startOfDay(now).getTime(),
    };
  });

  const first = assessments[0] ?? null;
  const last = assessments.at(-1) ?? null;

  return {
    studentId: ctx.studentId,
    seasonTitle: first ? seasonTitleOf(first.date) : 'Сессия',
    rangeLabel: first && last ? formatSessionRange(first.date, last.date) : null,
    countdown: first ? examCountdown(now, first.startsAt) : null,
    exams: examItems,
    retakes: retakeItems,
    consultations: consultEvents.map((event) => ({
      eventId: event.id,
      disciplineCode: event.disciplineCode,
      disciplineName: event.disciplineName,
      date: event.date,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      room: event.room,
      teacherName: event.teacherName,
    })),
  };
}

/**
 * Запись на пересдачу: заявка STATEMENT + событие SUBMITTED + уведомление
 * REQUEST со ссылкой на заявку. Идемпотентна по заголовку заявки
 * (повторный вызов возвращает существующую заявку, created: false).
 * Чужой/несуществующий examId и не-пересдача — единообразный null,
 * причина — только в AuditLog.
 */
export async function createRetakeRequest(
  db: DataDb,
  ctx: DataCtx,
  examId: string,
  options: { now?: Date; random?: () => number } = {},
): Promise<{ request: ServiceRequestRow; created: boolean } | null> {
  const now = options.now ?? new Date();

  if (ctx.studentId === null || ctx.groupName === null) {
    await denyAccess(db, {
      ctx,
      resourceType: RETAKE_RESOURCE,
      resourceRef: examId,
      reason: 'ROLE_MISMATCH',
    });
    return null;
  }

  const probed = await db.probeExamById(examId);
  if (!probed) {
    await denyAccess(db, {
      ctx,
      resourceType: RETAKE_RESOURCE,
      resourceRef: examId,
      reason: 'NOT_FOUND',
    });
    return null;
  }
  if (probed.groupName !== ctx.groupName) {
    await denyAccess(db, {
      ctx,
      resourceType: RETAKE_RESOURCE,
      resourceRef: examId,
      reason: 'OWNERSHIP_DENIED',
    });
    return null;
  }
  if (probed.kind !== 'RETAKE' || startOfDay(probed.date).getTime() < startOfDay(now).getTime()) {
    // Записываются только на несостоявшиеся пересдачи; чужой/просроченный
    // случай неотличим снаружи (единообразный null).
    await denyAccess(db, {
      ctx,
      resourceType: RETAKE_RESOURCE,
      resourceRef: examId,
      reason: 'NOT_FOUND',
    });
    return null;
  }

  // Идемпотентность: заявка с этим заголовком уже существует — возвращаем её.
  const title = `${RETAKE_TITLE_PREFIX}${probed.disciplineName}`;
  const own = await db.listRequestsByStudent(ctx.studentId);
  const existing = own.find((request) => request.title === title);
  if (existing) return { request: existing, created: false };

  const number = newRequestNumber(options.random, now);
  const request = await db.appendRequestByStudent(ctx.studentId, {
    type: 'STATEMENT',
    title,
    number,
    createdAt: now,
    eventMessage: 'Заявка подана через личный кабинет',
    actorName: ctx.login,
  });

  await db.appendNotificationToStudent(ctx.studentId, {
    type: 'REQUEST',
    title: 'Заявка на пересдачу создана',
    body:
      `Заявка ${number} — запись на пересдачу по «${probed.disciplineName}» ` +
      `(${formatSessionRange(probed.date, probed.date)}, каб. ${probed.room}). ` +
      'Деканат подтвердит запись в статусе заявки.',
    createdAt: now,
    link: `/requests/${number}`,
  });

  return { request, created: true };
}
