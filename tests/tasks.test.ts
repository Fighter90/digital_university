// DIG-34 — «Задачи»: контракт агрегата getTasks / markTaskDone и чистые помощники.
// Red-first: контракт зафиксирован ДО реализации. Приёмка:
//  - единый список действий из шести источников (каноническая заявка
//    «Нужна доработка», дедлайн курса, недопуск, пересдача, обращение
//    деканата, ручная задача);
//  - группы Просрочено/Сегодня/На этой неделе/Позже, срок не назначен → «Сегодня»;
//  - дедупликация недопуска по дисциплине+причине (одна сдача закрывает зачёт и экзамен);
//  - каждая задача ведёт ровно туда, где её выполнить (href-контракт);
//  - IDOR: отметка ручной задачи — только владельцем, отказы единообразные + аудит.
import { describe, expect, it } from 'vitest';

import { createMemoryDataDb } from '@/server/data/memory-db';
import { getTasks, getTasksSummary, groupTasks, markTaskDone } from '@/server/data/tasks';
import { TASK_SOURCE_LABELS, dueLabel } from '@/lib/task-format';
import type { DataCtx, TasksData, TaskView } from '@/server/data/tasks';
import type {
  AppealMessageRow,
  AppealRow,
  CanonicalRequestRow,
  DisciplineElementRow,
  DisciplineRow,
  ExamSessionRow,
  GradeRow,
  ServiceRequestRow,
  StudentTaskRow,
  StudyDeadlineRow,
} from '@/server/data/types';

// Детерминированное «сейчас»: среда 11 ноября 2026, 09:00 (локальное время).
const NOW = new Date(2026, 10, 11, 9, 0, 0);

const day = (offsetDays: number, hour: number, minute = 0): Date => {
  const d = new Date(NOW);
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hour, minute, 0, 0);
  return d;
};

const annaCtx: DataCtx = {
  userId: 'auth-anna',
  login: 'anna.smirnova',
  role: 'STUDENT',
  studentId: 'st-anna',
  groupName: 'ПИ-21',
  faculty: 'ИТ',
};

const ilyaCtx: DataCtx = {
  userId: 'auth-ilya',
  login: 'ilya.petrov',
  role: 'STUDENT',
  studentId: 'st-ilya',
  groupName: 'ЭК-11',
  faculty: 'ЭК',
};

const deanCtx: DataCtx = {
  userId: 'auth-dean',
  login: 'dean.kovaleva',
  role: 'STAFF',
  studentId: null,
  groupName: null,
  faculty: 'ИТ',
};

// ── фикстуры ────────────────────────────────────────────────────────────────

// DIG-30/34 — источник «Доработать заявку»: канонические заявки «ЗД-…».
// Форма «Исправить и подать повторно» живёт только на карточке канона,
// поэтому задачу порождает ровно NEEDS_FIX канонической заявки.
const canonicalRequests: CanonicalRequestRow[] = [
  {
    id: 'creq-fix',
    number: 'ЗД-2026-000007',
    studentId: 'st-anna',
    typeCode: 'CERT_ENROLLMENT',
    typeName: 'Справка об обучении',
    title: 'Справка об обучении · для военкомата',
    params: { purpose: 'для военкомата' },
    status: 'NEEDS_FIX',
    createdAt: day(-4, 10, 15),
    updatedAt: day(-2, 11, 20),
  },
  {
    id: 'creq-ok',
    number: 'ЗД-2026-000008',
    studentId: 'st-anna',
    typeCode: 'DIPLOMA_COPY',
    typeName: 'Дубликат диплома',
    title: 'Дубликат диплома · утрата оригинала',
    params: { reason: 'утрата оригинала' },
    status: 'IN_PROGRESS',
    createdAt: day(-4, 10, 15),
    updatedAt: day(-3, 12, 0),
  },
];

// Legacy-заявки «SR-…»: задач сами по себе не порождают (у их карточки нет
// формы доработки), но нужны для контракта записи на пересдачу (DIG-28).
const legacyRequests: ServiceRequestRow[] = [];

const grades: GradeRow[] = [
  {
    id: 'grd-db-p1',
    studentId: 'st-anna',
    elementCode: 'PI21-DB-P1',
    elementName: 'Проект',
    disciplineCode: 'PI21-DB',
    disciplineName: 'Базы данных',
    score: 85,
    maxScore: 100,
    weight: 0.3,
    kind: 'PROJECT',
    gradedAt: day(-4, 12),
    comment: null,
  },
  {
    id: 'grd-prog-l2',
    studentId: 'st-anna',
    elementCode: 'PI21-PROG-L2',
    elementName: 'Лабораторная 2',
    disciplineCode: 'PI21-PROG',
    disciplineName: 'Программирование',
    score: 92,
    maxScore: 100,
    weight: 0.4,
    kind: 'LAB',
    gradedAt: day(-4, 12),
    comment: null,
  },
];

const disciplines: DisciplineRow[] = [
  {
    groupName: 'ПИ-21',
    disciplineCode: 'PI21-DB',
    disciplineName: 'Базы данных',
    credits: 5,
    teacherName: 'Соколов Сергей Сергеевич',
  },
  {
    groupName: 'ПИ-21',
    disciplineCode: 'PI21-PROG',
    disciplineName: 'Программирование',
    credits: 6,
    teacherName: 'Иванова Ирина Игоревна',
  },
];

const el = (
  disciplineCode: string,
  disciplineName: string,
  elementCode: string,
  elementName: string,
  kind: DisciplineElementRow['kind'],
  weight: number,
): DisciplineElementRow => ({
  groupName: 'ПИ-21',
  disciplineCode,
  disciplineName,
  elementCode,
  elementName,
  kind,
  weight,
  maxScore: 100,
});

const elements: DisciplineElementRow[] = [
  el('PI21-DB', 'Базы данных', 'PI21-DB-P1', 'Проект', 'PROJECT', 0.3),
  el('PI21-DB', 'Базы данных', 'PI21-DB-T2', 'Тест 2', 'TEST', 0.2),
  el('PI21-DB', 'Базы данных', 'PI21-DB-EX', 'Экзамен', 'EXAM', 0.5),
  el('PI21-PROG', 'Программирование', 'PI21-PROG-L2', 'Лабораторная 2', 'LAB', 0.4),
  el('PI21-PROG', 'Программирование', 'PI21-PROG-L3', 'Лабораторная 3', 'LAB', 0.2),
  el('PI21-PROG', 'Программирование', 'PI21-PROG-CR', 'Зачёт', 'TEST', 0.4),
];

const exam = (
  id: string,
  disciplineCode: string,
  disciplineName: string,
  kind: ExamSessionRow['kind'],
  date: Date,
): ExamSessionRow => ({
  id,
  groupName: 'ПИ-21',
  disciplineCode,
  disciplineName,
  kind,
  date,
  startsAt: date,
  room: '301',
  note: null,
});

const exams: ExamSessionRow[] = [
  exam('exm-db-credit', 'PI21-DB', 'Базы данных', 'CREDIT', day(2, 10, 40)),
  // Экзамен той же дисциплины с той же причиной несдачи — дедуплицируется.
  exam('exm-db-exam', 'PI21-DB', 'Базы данных', 'EXAM', day(12, 10, 0)),
  // Программирование: не сдана «Лабораторная 3».
  exam('exm-prog-credit', 'PI21-PROG', 'Программирование', 'CREDIT', day(9, 12, 0)),
  // Будущая пересдача без заявки на запись.
  exam('exm-info-retake', 'PI21-INFO', 'Информатика', 'RETAKE', day(7, 9, 0)),
  // Прошедшая пересдача — задача не создаётся.
  exam('exm-prog-retake', 'PI21-PROG', 'Программирование', 'RETAKE', day(-3, 9, 0)),
];

const deadline = (
  id: string,
  disciplineCode: string,
  disciplineName: string,
  title: string,
  dueAt: Date,
): StudyDeadlineRow => ({
  id,
  groupName: 'ПИ-21',
  disciplineCode,
  disciplineName,
  title,
  dueAt,
});

const studyDeadlines: StudyDeadlineRow[] = [
  deadline('dl-overdue', 'PI21-PHYS', 'Физика', 'Тест 1 «Кинематика»', day(-2, 23, 59)),
  deadline('dl-today', 'PI21-HIST', 'История', 'Кейс-семинар «Реформы»', day(0, 23, 59)),
  deadline(
    'dl-week',
    'PI21-DISC',
    'Дискретная математика',
    'Индивидуальный проект',
    day(3, 23, 59),
  ),
  deadline('dl-later', 'PI21-ALG', 'Алгоритмы', 'Реферат «Сложность»', day(21, 23, 59)),
];

const studentTask = (
  id: string,
  studentId: string,
  title: string,
  note: string | null,
  dueAt: Date,
  doneAt: Date | null,
): StudentTaskRow => ({ id, studentId, title, note, dueAt, doneAt });

const studentTasks: StudentTaskRow[] = [
  studentTask(
    'task-sign',
    'st-anna',
    'Подписать согласие на обработку данных',
    null,
    day(-1, 18),
    null,
  ),
  studentTask(
    'task-pay',
    'st-anna',
    'Оплатить обучение по договору',
    'Договор У-2026-114',
    day(5, 18),
    null,
  ),
  // Уже отмеченная — в открытый список не попадает.
  studentTask('task-done', 'st-anna', 'Отправить копию договора', null, day(-5, 18), day(-6, 12)),
  studentTask(
    'task-ilya',
    'st-ilya',
    'Оплатить оставшуюся часть по договору',
    null,
    day(9, 18),
    null,
  ),
];

const appeal = (
  id: string,
  studentId: string,
  subject: string,
  status: AppealRow['status'],
): AppealRow => ({ id, studentId, subject, status, createdAt: day(-3, 19) });

const appeals: AppealRow[] = [
  appeal('apl-answer', 'st-anna', 'Пересдача математического анализа', 'ANSWERED'),
  appeal('apl-open', 'st-anna', 'Вопрос по зачёту', 'OPEN'),
  appeal('apl-closed', 'st-anna', 'Справка для налоговой', 'CLOSED'),
  appeal('apl-ilya', 'st-ilya', 'Пересдача математического анализа', 'ANSWERED'),
];

const msg = (
  id: string,
  appealId: string,
  authorRole: AppealMessageRow['authorRole'],
  body: string,
  createdAt: Date,
): AppealMessageRow => ({ id, appealId, authorRole, authorName: 'Автор', body, createdAt });

const appealMessages: AppealMessageRow[] = [
  msg('msg-open-1', 'apl-open', 'STUDENT', 'Здравствуйте!', day(-2, 19)),
  msg('msg-ans-1', 'apl-answer', 'STUDENT', 'Вопрос по пересдаче', day(-3, 19)),
  msg('msg-ans-2', 'apl-answer', 'STAFF', 'Пересдача в пятницу, ауд. 12.', day(-2, 10)),
  msg('msg-closed-1', 'apl-closed', 'STAFF', 'Готово.', day(-9, 10)),
  msg('msg-ilya-1', 'apl-ilya', 'STAFF', 'Ответ деканата.', day(-1, 10)),
];

function seedTasksDb(opts: { retakeRequested?: boolean } = {}) {
  const db = createMemoryDataDb();
  db.seed({
    students: [
      {
        id: 'st-anna',
        login: 'anna.smirnova',
        fullName: 'Анна Ковалёва',
        email: 'anna@example.edu',
        groupName: 'ПИ-21',
        course: 2,
        faculty: 'ИТ',
        program: 'Прикладная информатика',
        programCode: '09.03.04',
        studyForm: 'очная',
        funding: 'бюджет',
        gradebookNumber: '20231234',
      },
      {
        id: 'st-ilya',
        login: 'ilya.petrov',
        fullName: 'Илья Смирнов',
        email: 'ilya@example.edu',
        groupName: 'ЭК-11',
        course: 1,
        faculty: 'ЭК',
        program: 'Экономика',
        programCode: '38.03.01',
        studyForm: 'очная',
        funding: 'контракт',
        gradebookNumber: '20254567',
      },
    ],
    requests: opts.retakeRequested
      ? [
          {
            id: 'req-retake',
            studentId: 'st-anna',
            number: 'SR-2026-AAA03',
            type: 'STATEMENT',
            title: 'Запись на пересдачу — Информатика',
            status: 'SUBMITTED',
            assignee: null,
            resultNote: null,
            createdAt: day(-1, 9, 0),
            updatedAt: day(-1, 9, 0),
          },
        ]
      : legacyRequests,
    canonicalRequests,
    grades,
    disciplines,
    elements,
    exams,
    studyDeadlines,
    studentTasks,
    appeals,
    appealMessages,
  });
  return db;
}

// ── помощники ───────────────────────────────────────────────────────────────

/** Плоский список задач в порядке групп. */
function flat(data: TasksData): TaskView[] {
  return [...data.overdue, ...data.today, ...data.week, ...data.later];
}

function byId(data: TasksData, id: string): TaskView | undefined {
  return flat(data).find((t) => t.id === id);
}

// ── источники ───────────────────────────────────────────────────────────────

describe('getTasks: источники задач', () => {
  it('каноническая заявка «Нужна доработка» → «Доработать заявку» на карточку заявки', async () => {
    const data = await getTasks(seedTasksDb(), annaCtx, NOW);
    const row = byId(data, 'request-creq-fix');
    expect(row).toBeDefined();
    expect(row?.source).toBe('REQUEST');
    expect(row?.verb).toBe('Доработать заявку');
    expect(row?.origin).toContain('Справка об обучении · для военкомата');
    expect(row?.origin).toContain('ЗД-2026-000007');
    // Ровно туда, где действие выполняется: карточка канона с формой доработки.
    expect(row?.href).toBe('/requests/ЗД-2026-000007');
    expect(row?.dueAt).toBeNull();
    expect(row?.daysLeft).toBeNull();
    expect(row?.manual).toBe(false);
    // Срок не назначен → группа «Сегодня».
    expect(data.today.map((t) => t.id)).toContain('request-creq-fix');
    // Заявки в других статусах задач не порождают.
    expect(byId(data, 'request-creq-ok')).toBeUndefined();
  });

  it('дедлайн курса: группа по сроку, действие ведёт на карточку дисциплины', async () => {
    const data = await getTasks(seedTasksDb(), annaCtx, NOW);
    const overdue = byId(data, 'course-dl-overdue');
    expect(overdue?.verb).toBe('Сдать: Тест 1 «Кинематика»');
    expect(overdue?.origin).toBe('Физика');
    expect(overdue?.href).toBe('/grades/PI21-PHYS');
    expect(overdue?.dueAt).toEqual(day(-2, 23, 59));
    expect(overdue?.daysLeft).toBe(-2);
    expect(data.overdue.map((t) => t.id)).toContain('course-dl-overdue');
    expect(data.today.map((t) => t.id)).toContain('course-dl-today');
    expect(data.week.map((t) => t.id)).toContain('course-dl-week');
    expect(data.later.map((t) => t.id)).toContain('course-dl-later');
  });

  it('недопуск: «Сдать: Тест 2»; зачёт и экзамен одной дисциплины — одна задача', async () => {
    const data = await getTasks(seedTasksDb(), annaCtx, NOW);
    const dbTasks = flat(data).filter((t) => t.source === 'SESSION' && t.origin === 'Базы данных');
    expect(dbTasks).toHaveLength(1);
    expect(dbTasks[0]?.id).toBe('session-exm-db-credit');
    expect(dbTasks[0]?.verb).toBe('Сдать: Тест 2');
    expect(dbTasks[0]?.href).toBe('/grades/PI21-DB');
    expect(dbTasks[0]?.dueAt).toEqual(day(2, 10, 40));
    // «Лабораторная 3» по Программированию — отдельная задача (день 9 → «Позже»).
    const prog = data.later.find((t) => t.source === 'SESSION');
    expect(prog?.verb).toBe('Сдать: Лабораторная 3');
    expect(prog?.href).toBe('/grades/PI21-PROG');
    expect(prog?.dueAt).toEqual(day(9, 12, 0));
  });

  it('пересдача без заявки: задача на «Сессию»; прошедшая — задачи нет', async () => {
    const data = await getTasks(seedTasksDb(), annaCtx, NOW);
    const row = byId(data, 'retake-exm-info-retake');
    expect(row?.verb).toBe('Записаться на пересдачу');
    expect(row?.origin).toBe('Информатика');
    expect(row?.href).toBe('/grades/session');
    expect(row?.dueAt).toEqual(day(7, 9, 0));
    expect(row?.manual).toBe(false);
    expect(data.week.map((t) => t.id)).toContain('retake-exm-info-retake');
    expect(byId(data, 'retake-exm-prog-retake')).toBeUndefined();
  });

  it('пересдача с уже созданной заявкой: задачи нет (идемпотентность DIG-28)', async () => {
    const data = await getTasks(seedTasksDb({ retakeRequested: true }), annaCtx, NOW);
    expect(byId(data, 'retake-exm-info-retake')).toBeUndefined();
  });

  it('обращение с последним сообщением сотрудника → «Ответить на обращение»', async () => {
    const data = await getTasks(seedTasksDb(), annaCtx, NOW);
    const row = byId(data, 'deanery-apl-answer');
    expect(row?.source).toBe('DEANERY');
    expect(row?.verb).toBe('Ответить на обращение');
    expect(row?.origin).toBe('Пересдача математического анализа');
    expect(row?.href).toBe('/deanery');
    expect(row?.dueAt).toBeNull();
    // Срок не назначен → «Сегодня».
    expect(data.today.map((t) => t.id)).toContain('deanery-apl-answer');
    // OPEN (писал только студент) и CLOSED задач не порождают.
    expect(byId(data, 'deanery-apl-open')).toBeUndefined();
    expect(byId(data, 'deanery-apl-closed')).toBeUndefined();
  });

  it('ручные задачи: флаг manual, «Отметить выполненной» только у них; отмеченные скрыты', async () => {
    const data = await getTasks(seedTasksDb(), annaCtx, NOW);
    const sign = byId(data, 'manual-task-sign');
    expect(sign?.source).toBe('MANUAL');
    expect(sign?.manual).toBe(true);
    expect(sign?.verb).toBe('Подписать согласие на обработку данных');
    expect(sign?.origin).toBe('Деканат');
    expect(sign?.dueAt).toEqual(day(-1, 18));
    expect(data.overdue.map((t) => t.id)).toContain('manual-task-sign');
    const pay = byId(data, 'manual-task-pay');
    expect(pay?.manual).toBe(true);
    expect(pay?.origin).toBe('Договор У-2026-114');
    expect(data.week.map((t) => t.id)).toContain('manual-task-pay');
    // Отмеченная ранее задача скрыта.
    expect(byId(data, 'manual-task-done')).toBeUndefined();
    // Неручные задачи флаг manual не получают.
    expect(byId(data, 'request-creq-fix')?.manual).toBe(false);
  });
});

// ── группировка, сортировка, счётчик ────────────────────────────────────────

describe('getTasks: группировка и счётчик', () => {
  it('все четыре группы в порядке срочности; счётчик считает открытые задачи', async () => {
    const data = await getTasks(seedTasksDb(), annaCtx, NOW);
    // Просрочено: дедлайн курса (−2) и ручная подпись (−1), самые старые первыми.
    expect(data.overdue.map((t) => t.id)).toEqual(['course-dl-overdue', 'manual-task-sign']);
    // Сегодня: срок не назначен — раньше датированных (порядок источников:
    // заявки, дедлайны курса, недопуск, пересдачи, обращения, ручные),
    // затем дедлайн курса к 23:59.
    expect(data.today.map((t) => t.id)).toEqual([
      'request-creq-fix',
      'deanery-apl-answer',
      'course-dl-today',
    ]);
    // На этой неделе (1–7 дней): зачёт БД (2), курс (3), оплата (5), пересдача (7).
    expect(data.week.map((t) => t.id)).toEqual([
      'session-exm-db-credit',
      'course-dl-week',
      'manual-task-pay',
      'retake-exm-info-retake',
    ]);
    // Позже (>7): зачёт программирования (9), реферат (21).
    expect(data.later.map((t) => t.id)).toEqual(['session-exm-prog-credit', 'course-dl-later']);
    expect(data.openCount).toBe(flat(data).length);
    expect(data.openCount).toBe(11);
  });

  it('groupTasks (чистая): границы 0/1/7/8 дней и срок не назначен → «Сегодня»', () => {
    const row = (id: string, dueAt: Date | null): TaskView => ({
      id,
      source: 'MANUAL',
      verb: 'Сделать',
      origin: 'Деканат',
      dueAt,
      daysLeft:
        dueAt === null
          ? null
          : Math.round(
              (new Date(new Date(dueAt).setHours(0, 0, 0, 0)).getTime() -
                new Date(new Date(NOW).setHours(0, 0, 0, 0)).getTime()) /
                86_400_000,
            ),
      href: '/tasks',
      manual: true,
    });
    const grouped = groupTasks(
      [
        row('m1', day(-1, 12)),
        row('m2', day(0, 23, 59)),
        row('m3', day(1, 12)),
        row('m4', day(7, 12)),
        row('m5', day(8, 12)),
        row('m6', null),
      ],
      NOW,
    );
    expect(grouped.overdue.map((t) => t.id)).toEqual(['m1']);
    expect(grouped.today.map((t) => t.id)).toEqual(['m6', 'm2']);
    expect(grouped.week.map((t) => t.id)).toEqual(['m3', 'm4']);
    expect(grouped.later.map((t) => t.id)).toEqual(['m5']);
  });

  it('getTasksSummary: счётчик и не более трёх самых срочных задач', async () => {
    const summary = await getTasksSummary(seedTasksDb(), annaCtx, NOW);
    expect(summary.openCount).toBe(11);
    expect(summary.top).toHaveLength(3);
    expect(summary.top.map((t) => t.id)).toEqual([
      'course-dl-overdue',
      'manual-task-sign',
      'request-creq-fix',
    ]);
  });

  it('пустые данные: все группы пусты, счётчик 0', async () => {
    const db = createMemoryDataDb();
    db.seed({
      students: [
        {
          id: 'st-anna',
          login: 'anna.smirnova',
          fullName: 'Анна Ковалёва',
          email: 'anna@example.edu',
          groupName: 'ПИ-21',
          course: 2,
          faculty: 'ИТ',
          program: 'Прикладная информатика',
          programCode: '09.03.04',
          studyForm: 'очная',
          funding: 'бюджет',
          gradebookNumber: '20231234',
        },
      ],
    });
    const data = await getTasks(db, annaCtx, NOW);
    expect(data.overdue).toEqual([]);
    expect(data.today).toEqual([]);
    expect(data.week).toEqual([]);
    expect(data.later).toEqual([]);
    expect(data.openCount).toBe(0);
    const summary = await getTasksSummary(db, annaCtx, NOW);
    expect(summary.openCount).toBe(0);
    expect(summary.top).toEqual([]);
  });

  it('скоуп: Илья видит только свои задачи (чужих нет)', async () => {
    const data = await getTasks(seedTasksDb(), ilyaCtx, NOW);
    const ids = flat(data).map((t) => t.id);
    expect(ids).toEqual(['deanery-apl-ilya', 'manual-task-ilya']);
    expect(ids).not.toContain('request-creq-fix');
  });
});

// ── роли и IDOR ─────────────────────────────────────────────────────────────

describe('getTasks / markTaskDone: роли и IDOR', () => {
  it('сотрудник: пустой агрегат + аудит ROLE_MISMATCH', async () => {
    const db = seedTasksDb();
    const data = await getTasks(db, deanCtx, NOW);
    expect(flat(data)).toEqual([]);
    expect(data.openCount).toBe(0);
    const audit = db.auditEvents();
    const denied = audit.find((a) => a.resourceType === 'tasks');
    expect(denied?.reason).toBe('ROLE_MISMATCH');
    expect(denied?.outcome).toBe('DENIED');
  });

  it('владелец отмечает свою задачу: doneAt проставлен, из списка исчезает, повтор идемпотентен', async () => {
    const db = seedTasksDb();
    const first = await markTaskDone(db, annaCtx, 'task-pay', NOW);
    expect(first?.doneAt).toEqual(NOW);
    const data = await getTasks(db, annaCtx, NOW);
    expect(byId(data, 'manual-task-pay')).toBeUndefined();
    expect(data.openCount).toBe(10);
    // Повторная отметка не ошибается (идемпотентность).
    const second = await markTaskDone(db, annaCtx, 'task-pay', NOW);
    expect(second?.doneAt).toEqual(NOW);
    const audit = db.auditEvents();
    expect(audit.filter((a) => a.resourceType === 'student-task')).toHaveLength(0);
  });

  it('чужая задача: единообразный null + аудит OWNERSHIP_DENIED, строка не изменена', async () => {
    const db = seedTasksDb();
    const result = await markTaskDone(db, annaCtx, 'task-ilya', NOW);
    expect(result).toBeNull();
    const rows = await db.listStudentTasksByStudent('st-ilya');
    expect(rows.find((t) => t.id === 'task-ilya')?.doneAt).toBeNull();
    const denied = db.auditEvents().find((a) => a.resourceType === 'student-task');
    expect(denied?.reason).toBe('OWNERSHIP_DENIED');
    expect(denied?.actorLogin).toBe('anna.smirnova');
  });

  it('несуществующая задача: единообразный null + аудит NOT_FOUND', async () => {
    const db = seedTasksDb();
    const result = await markTaskDone(db, annaCtx, 'task-nope', NOW);
    expect(result).toBeNull();
    expect(db.auditEvents().find((a) => a.resourceType === 'student-task')?.reason).toBe(
      'NOT_FOUND',
    );
  });

  it('сотрудник не отмечает задачи: null + аудит ROLE_MISMATCH', async () => {
    const db = seedTasksDb();
    const result = await markTaskDone(db, deanCtx, 'task-pay', NOW);
    expect(result).toBeNull();
    expect(db.auditEvents().find((a) => a.resourceType === 'student-task')?.reason).toBe(
      'ROLE_MISMATCH',
    );
  });
});

// ── чистые помощники интерфейса ─────────────────────────────────────────────

describe('task-format: метки источников и сроков', () => {
  it('метки источников покрывают все шесть видов', () => {
    expect(TASK_SOURCE_LABELS.REQUEST).toBe('Заявка');
    expect(TASK_SOURCE_LABELS.COURSE).toBe('Дисциплина');
    expect(TASK_SOURCE_LABELS.SESSION).toBe('Сессия');
    expect(TASK_SOURCE_LABELS.RETAKE).toBe('Сессия');
    expect(TASK_SOURCE_LABELS.DEANERY).toBe('Деканат');
    expect(TASK_SOURCE_LABELS.MANUAL).toBe('Деканат');
  });

  it('dueLabel: просрочено / сегодня / завтра / до даты / без срока', () => {
    expect(dueLabel(-2, day(-2, 23, 59))).toBe('Просрочено · до 9 ноября');
    expect(dueLabel(0, day(0, 23, 59))).toBe('Сегодня · до 23:59');
    expect(dueLabel(1, day(1, 9, 0))).toBe('Завтра · до 09:00');
    expect(dueLabel(5, day(5, 18, 0))).toBe('до 16 ноября');
    expect(dueLabel(null, null)).toBe('Срок не назначен');
  });
});
