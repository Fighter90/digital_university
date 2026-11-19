// DIG-46 — серверная часть AI-ассистента: контекст сессии для чата,
// предзаполненная заявка по подтверждению и отчёт о неверном ответе.
//
// Доступ (тот же контракт, что session.ts / performance.ts): ctx строится
// из живой сессии (requireDataCtx), персональные выборки скоуплены
// ctx.studentId, групповые (расписание, план контроля) — ctx.groupName.
// Чужие данные недостижимы по построению: движок ассистента получает
// только агрегат своего владельца. Сотрудник (без studentId) получает
// контекст без студенческих данных + запись в аудите (ROLE_MISMATCH).
//
// Заявка ассистента — белый список каталога сервисов (cert-defer,
// аудитория STUDENT): произвольный serviceId отклоняется. Идемпотентность
// по заголовку заявки — как запись на пересдачу DIG-28: повторное
// подтверждение не создаёт дубль. Ассистент сам ничего не отправляет:
// заявка появляется ТОЛЬКО по вызову этой функции из server action,
// которому предшествует явное «Подтвердить и отправить» пользователя.

import { formatDayTitle, toScheduleEventCards } from '@/lib/schedule-cards';
import { lessonKindLabel } from '@/lib/dashboard-format';
import type { Locale } from '@/lib/i18n';
import type { GradeElementKind } from '@/lib/gradebook';
import type { ScheduleKind } from '@/server/data/types';
import { accumulatedGrade, type GradedElementLike } from '@/lib/performance-math';
import {
  dayRange,
  moscowDateKey,
  semesterBounds,
  shiftMoscowDays,
  startOfMoscowDay,
} from '@/lib/schedule-time';
import type { AssistantContext, AssistantDiscipline } from '@/lib/assistant-engine';
import { ASSISTANT_ORDER_SERVICE_ID } from '@/lib/assistant-engine';
import { findService } from '@/lib/services-catalog';
import { denyAccess } from './access';
import { newRequestNumber } from './request-number';
import type { DataDb } from './port';
import type {
  AppealRow,
  DataCtx,
  DisciplineElementRow,
  GradeRow,
  ServiceRequestRow,
} from './types';

const CONTEXT_RESOURCE = 'assistant-context';
const ORDER_RESOURCE = 'assistant-order';
const REPORT_RESOURCE = 'assistant-report';

/** Полные подписи видов элементов плана контроля по локали.
 * ScheduleKind не знает EXAM — таблица EN расширена (DIG-88). */
const ELEMENT_KIND_LABELS_EN: Record<GradeElementKind, string> = {
  HOMEWORK: 'Homework',
  LAB: 'Lab',
  TEST: 'Test',
  PROJECT: 'Project',
  EXAM: 'Exam',
};

/** Подпись вида элемента плана контроля по локали (RU — канон lessonKindLabel). */
function elementKindLabel(kind: GradeElementKind, locale: Locale): string {
  const en = ELEMENT_KIND_LABELS_EN[kind];
  if (locale === 'en') return kind === 'EXAM' ? en : lessonKindLabel(kind as ScheduleKind, 'en');
  return kind === 'EXAM' ? 'Экзамен' : lessonKindLabel(kind as ScheduleKind);
}

/** Тема обращения «Сообщить о неверном ответе» (видна в «Связи с деканатом»). */
export const ASSISTANT_REPORT_SUBJECT = 'AI-ассистент: неверный ответ';

/** Лимит вопроса/ответа в тексте обращения (defensive-лимит слоя данных). */
const REPORT_EXCERPT_LIMIT = 400;

const ASSISTANT_ORDER_EVENT_MESSAGE = 'Заявка подана через AI-ассистент по подтверждению студента';

// ── Контекст чата ───────────────────────────────────────────────────────────

/** Первое слово ФИО: «Анна Смирнова» → «Анна». */
function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

/** Строки расписания → карточки ответа ассистента. Форматирование времени,
 * аудиторий и переносов — тот же сериализатор, что у экрана расписания
 * (toScheduleEventCards), чтобы ассистент не расходился с кабинетом.
 * DIG-88: подписи интерфейса (тип занятия, «ауд./онлайн») — по локали. */
function toAssistantLessons(rows: Parameters<typeof toScheduleEventCards>[0], locale: Locale) {
  return toScheduleEventCards(rows, locale).map((card) => ({
    timeLabel: card.timeLabel,
    discipline: card.discipline,
    kindLabel: lessonKindLabel(card.kind, locale),
    roomLabel: card.roomLabel,
    teacher: card.teacher,
    isMoved: card.isMoved,
    isCancelled: card.isCancelled,
    isOnline: card.roomLabel.toLowerCase() === (locale === 'en' ? 'online' : 'онлайн'),
    previousRoomLabel: card.previousRoomLabel,
  }));
}

/**
 * План контроля дисциплины + оценки владельца → карточка для калькулятора.
 * Оценки приходят скоупленно (listGradesByStudent); последняя попытка по
 * элементу отбирается здесь (пересдача перезаписывает), как в performance.
 */
function toAssistantDiscipline(
  code: string,
  referenceName: string | null,
  teacherName: string | null,
  plan: DisciplineElementRow[],
  graded: GradedElementLike[],
  fallbackName: string,
  locale: Locale = 'ru',
): AssistantDiscipline {
  const latest = new Map<string, GradedElementLike>();
  for (const row of graded) {
    const prev = latest.get(row.elementCode);
    if (!prev || row.gradedAt.getTime() >= prev.gradedAt.getTime()) {
      latest.set(row.elementCode, row);
    }
  }

  const planView = plan.map((el) => {
    const row = latest.get(el.elementCode);
    return {
      code: el.elementCode,
      name: el.elementName,
      kindLabel: elementKindLabel(el.kind, locale),
      weightPercent: Math.round(el.weight * 100),
      maxScore: el.maxScore,
      graded: row !== undefined,
      score: row?.score ?? null,
    };
  });

  const examElement = plan.find((el) => el.kind === 'EXAM') ?? null;
  const examGraded = examElement ? (latest.get(examElement.elementCode) ?? null) : null;
  const acc = accumulatedGrade(
    graded,
    plan.map((el) => ({ elementCode: el.elementCode, weight: el.weight, maxScore: el.maxScore })),
  );

  return {
    code,
    name: referenceName ?? fallbackName,
    teacherName,
    accumulated: acc.accumulated,
    maxPossible: acc.maxPossible,
    plan: planView,
    exam:
      examElement !== null
        ? {
            code: examElement.elementCode,
            name: examElement.elementName,
            weightPercent: Math.round(examElement.weight * 100),
            maxScore: examElement.maxScore,
            graded: examGraded !== null,
            score: examGraded?.score ?? null,
          }
        : null,
  };
}

/**
 * Контекст чата ассистента одним агрегатом: имя, завтрашний московский
 * день группы, дисциплины с планом контроля. Сотрудник — имя без
 * студенческих данных + аудит (ROLE_MISMATCH).
 */
export async function getAssistantContext(
  db: DataDb,
  ctx: DataCtx,
  now: Date = new Date(),
  locale: Locale = 'ru',
): Promise<AssistantContext> {
  if (ctx.role !== 'STUDENT' || ctx.studentId === null || ctx.groupName === null) {
    await denyAccess(db, {
      ctx,
      resourceType: CONTEXT_RESOURCE,
      resourceRef: 'aggregate',
      reason: 'ROLE_MISMATCH',
    });
    const staff = await db.findStaffByLogin(ctx.login);
    return {
      role: 'STAFF',
      firstName: staff ? firstNameOf(staff.fullName) : ctx.login,
      fullName: staff?.fullName ?? ctx.login,
      groupLabel: null,
      tomorrow: null,
      nextStudyDayLabel: null,
      disciplines: [],
    };
  }

  const [student, tomorrowRows, grades, disciplines, elements] = await Promise.all([
    db.findStudentById(ctx.studentId),
    db.listScheduleByGroupRange(ctx.groupName, dayRange(shiftMoscowDays(now, 1))),
    db.listGradesByStudent(ctx.studentId),
    db.listDisciplinesByGroup(ctx.groupName),
    db.listDisciplineElementsByGroup(ctx.groupName),
  ]);

  // Семестр защищает от выдуманных пар вне учебного календаря (как getDay).
  const bounds = semesterBounds(now);
  const range = dayRange(shiftMoscowDays(now, 1));
  const inSemester =
    range.from.getTime() < bounds.end.getTime() && range.to.getTime() > bounds.start.getTime();
  const tomorrowEvents = inSemester ? tomorrowRows : [];

  const tomorrowDate = shiftMoscowDays(now, 1);
  const tomorrow = {
    dateKey: moscowDateKey(tomorrowDate),
    dateLabel: formatDayTitle(tomorrowDate, locale),
    events: toAssistantLessons(tomorrowEvents, locale),
  };

  // Ближайший учебный день (когда завтра пар нет): от завтрашнего дня
  // вперёд до конца семестра, пустые дни пропускаются — как getNextStudyDay.
  let nextStudyDayLabel: string | null = null;
  if (tomorrow.events.length === 0) {
    const from = shiftMoscowDays(startOfMoscowDay(now), 1);
    if (from.getTime() < bounds.end.getTime()) {
      const upcoming = await db.listScheduleByGroupRange(ctx.groupName, { from, to: bounds.end });
      if (upcoming.length > 0) {
        nextStudyDayLabel = formatDayTitle(upcoming[0]!.startsAt, locale);
      }
    }
  }

  // Дисциплины справочника группы (+ синтез из оценок для старых сидов —
  // как computeDisciplines: дисциплина без справочника живёт по оценкам).
  const codes = new Set<string>([
    ...disciplines.map((row) => row.disciplineCode),
    ...grades.map((row) => row.disciplineCode),
  ]);
  const assistantDisciplines = [...codes]
    .map((code): AssistantDiscipline | null => {
      const known = disciplines.find((row) => row.disciplineCode === code);
      const plan = elements.filter((el) => el.disciplineCode === code);
      const ownRows = grades.filter((row: GradeRow) => row.disciplineCode === code);
      if (!known && plan.length === 0 && ownRows.length === 0) return null;
      const graded: GradedElementLike[] = ownRows.map((row) => ({
        elementCode: row.elementCode,
        score: row.score,
        maxScore: row.maxScore,
        weight: row.weight,
        gradedAt: row.gradedAt,
      }));
      return toAssistantDiscipline(
        code,
        known?.disciplineName ?? null,
        known?.teacherName ?? null,
        plan,
        graded,
        ownRows[0]?.disciplineName ?? code,
        locale,
      );
    })
    .filter((d): d is AssistantDiscipline => d !== null)
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'));

  return {
    role: 'STUDENT',
    firstName: student ? firstNameOf(student.fullName) : ctx.login,
    fullName: student?.fullName ?? ctx.login,
    groupLabel: ctx.groupName,
    tomorrow,
    nextStudyDayLabel,
    disciplines: assistantDisciplines,
  };
}

// ── Заявка по подтверждению ─────────────────────────────────────────────────

export interface AssistantRequestResult {
  request: ServiceRequestRow;
  /** false — заявка уже существовала (идемпотентность по заголовку). */
  created: boolean;
}

/**
 * Предзаполненная заявка ассистента — создаётся ТОЛЬКО явным подтверждением
 * пользователя (server action submitAssistantRequestAction). Белый список:
 * сервис каталога должен существовать, быть доступным студенту и входить в
 * список услуг ассистента. Повтор — существующая заявка без дубля.
 */
export async function createAssistantRequest(
  db: DataDb,
  ctx: DataCtx,
  serviceId: string,
  options: { now?: Date; random?: () => number } = {},
): Promise<AssistantRequestResult | null> {
  const now = options.now ?? new Date();

  if (ctx.studentId === null) {
    await denyAccess(db, {
      ctx,
      resourceType: ORDER_RESOURCE,
      resourceRef: serviceId,
      reason: 'ROLE_MISMATCH',
    });
    return null;
  }

  const service = findService(serviceId);
  const allowed =
    service !== null &&
    serviceId === ASSISTANT_ORDER_SERVICE_ID &&
    service.audiences.includes('STUDENT');
  if (!allowed) {
    // Вне белого списка ассистента и чужая роль каталога неразличимы снаружи.
    await denyAccess(db, {
      ctx,
      resourceType: ORDER_RESOURCE,
      resourceRef: serviceId,
      reason: 'NOT_FOUND',
    });
    return null;
  }

  // Идемпотентность по заголовку: повторное подтверждение не создаёт дубль.
  const own = await db.listRequestsByStudent(ctx.studentId);
  const existing = own.find((request) => request.title === service!.title);
  if (existing) return { request: existing, created: false };

  const number = newRequestNumber(options.random, now);
  const request = await db.appendRequestByStudent(ctx.studentId, {
    type: 'CERTIFICATE',
    title: service!.title,
    number,
    createdAt: now,
    eventMessage: ASSISTANT_ORDER_EVENT_MESSAGE,
    actorName: ctx.login,
  });

  await db.appendNotificationToStudent(ctx.studentId, {
    type: 'REQUEST',
    title: `Заявка на «${service!.title}» создана`,
    body:
      `Заявка ${number} создана через AI-ассистента по вашему подтверждению. ` +
      'Деканат возьмёт её в работу — статус виден на странице заявки.',
    createdAt: now,
    link: `/requests/${number}`,
  });

  return { request, created: true };
}

// ── Отчёт о неверном ответе ─────────────────────────────────────────────────

export interface AssistantReportInput {
  question: string;
  answerExcerpt?: string;
}

/**
 * «Сообщить о неверном ответе»: обращение в деканат с темой
 * ASSISTANT_REPORT_SUBJECT и текстом вопроса студента (обрезано).
 * Двухшаговое подтверждение в UI; сотруднику — отказ.
 */
export async function reportAssistantAnswer(
  db: DataDb,
  ctx: DataCtx,
  input: AssistantReportInput,
  options: { now?: Date } = {},
): Promise<AppealRow | null> {
  const now = options.now ?? new Date();

  if (ctx.studentId === null) {
    await denyAccess(db, {
      ctx,
      resourceType: REPORT_RESOURCE,
      resourceRef: 'report',
      reason: 'ROLE_MISMATCH',
    });
    return null;
  }

  const profile = await db.findStudentById(ctx.studentId);
  const question = input.question.trim().slice(0, REPORT_EXCERPT_LIMIT);
  const excerpt = (input.answerExcerpt ?? '').trim().slice(0, REPORT_EXCERPT_LIMIT);
  const message =
    'Студент сообщил о неверном ответе AI-ассистента.\n\n' +
    `Вопрос: «${question}»` +
    (excerpt.length > 0 ? `\n\nОтвет ассистента (фрагмент): «${excerpt}»` : '');

  return db.appendAppealByStudent(ctx.studentId, {
    subject: ASSISTANT_REPORT_SUBJECT,
    message,
    authorName: profile?.fullName ?? ctx.login,
    createdAt: now,
  });
}
