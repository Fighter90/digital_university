// DIG-28 — «Сессия»: слой данных и чистые функции. Красная фаза: контракт
// зафиксирован ДО реализации (модулей нет).
//
// Покрывается приёмка задачи:
//  - таймлайн экзаменов и зачётов со статусами-пилюлями: Допущен (зелёный),
//    Не допущен (красный, причина «Не сдано: …»), Сдано · N (зелёный),
//    Пересдача (янтарный);
//  - шапка: «Зимняя сессия · d MMMM – d MMMM» из дат сессии (без хардкода)
//    и обратный отсчёт до первого экзамена;
//  - консультации перед экзаменами — из расписания (kind CONSULTATION);
//  - запись на пересдачу создаёт заявку и уведомление; IDOR — единообразный
//    null + аудит; повторная запись — идемпотентна;
//  - экспорт «всей сессии в календарь» — чистый сборщик ICS.
import { describe, expect, it } from 'vitest';

import {
  admissionReasonPhrase,
  examCountdown,
  examStatusView,
  formatSessionDate,
  formatSessionRange,
  formatSessionTime,
  passedScoreLabel,
  seasonTitleOf,
} from '@/lib/session-format';
import { buildIcsCalendar, icsDateTime, icsEscape } from '@/lib/ics';
import { createRetakeRequest, getSession } from '@/server/data/session';
import { createMemoryDataDb, type MemoryDataDb } from '@/server/data/memory-db';
import {
  isValidRequestNumber,
  REQUEST_NUMBER_PATTERN,
} from '@/server/data/request-number';
import type {
  DataCtx,
  DisciplineElementRow,
  DisciplineRow,
  ExamSessionRow,
  GradeRow,
  ScheduleEventRow,
  ServiceRequestRow,
} from '@/server/data/types';

// Детерминированное «сейчас»: воскресенье 20 декабря 2026 → зимняя сессия.
const NOW = new Date(2026, 11, 20, 9, 0, 0);

const day = (offsetDays: number, hour = 10, minute = 0): Date => {
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

const staffCtx: DataCtx = { ...annaCtx, role: 'STAFF', studentId: null, groupName: null };

// ── Фикстуры ────────────────────────────────────────────────────────────────

const disciplines: DisciplineRow[] = [
  d('ПИ-21', 'PI21-INFO', 'Информатика', 4, 'Петров Пётр Петрович'),
  d('ПИ-21', 'PI21-PROG', 'Программирование', 6, 'Иванова Ирина Игоревна'),
  d('ПИ-21', 'PI21-DISC', 'Дискретная математика', 4, 'Кузнецова Ксения Кирилловна'),
  // ALG отсутствует в справочнике — преподаватель выводится как «—».
  d('ЭК-11', 'EK11-ECON', 'Экономическая теория', 4, 'Орлов Олег Олегович'),
];

function d(
  groupName: string,
  disciplineCode: string,
  disciplineName: string,
  credits: number,
  teacherName: string,
): DisciplineRow {
  return { groupName, disciplineCode, disciplineName, credits, teacherName };
}

const elements: DisciplineElementRow[] = [
  e('ПИ-21', 'PI21-INFO', 'Информатика', 'PI21-INFO-T1', 'Тест 1', 'TEST', 0.3, 100),
  e('ПИ-21', 'PI21-INFO', 'Информатика', 'PI21-INFO-K', 'Коллоквиум', 'TEST', 0.3, 100),
  e('ПИ-21', 'PI21-INFO', 'Информатика', 'PI21-INFO-EX', 'Экзамен', 'EXAM', 0.4, 100),
  e('ПИ-21', 'PI21-PROG', 'Программирование', 'PI21-PROG-L2', 'Лабораторная 2', 'LAB', 0.4, 100),
  e('ПИ-21', 'PI21-PROG', 'Программирование', 'PI21-PROG-L3', 'Лабораторная 3', 'LAB', 0.2, 100),
  e('ПИ-21', 'PI21-PROG', 'Программирование', 'PI21-PROG-CR', 'Зачёт', 'TEST', 0.4, 100),
  e('ПИ-21', 'PI21-DISC', 'Дискретная математика', 'PI21-DISC-T', 'Тест 1', 'TEST', 0.4, 100),
  e('ПИ-21', 'PI21-DISC', 'Дискретная математика', 'PI21-DISC-EX', 'Экзамен', 'EXAM', 0.6, 100),
  // Дисциплина без справочника: только оценки, план не задаёт допуск.
  e('ЭК-11', 'EK11-ECON', 'Экономическая теория', 'EK11-ECON-T1', 'Тест 1', 'TEST', 0.4, 100),
];

function e(
  groupName: string,
  disciplineCode: string,
  disciplineName: string,
  elementCode: string,
  elementName: string,
  kind: DisciplineElementRow['kind'],
  weight: number,
  maxScore: number,
): DisciplineElementRow {
  return {
    groupName,
    disciplineCode,
    disciplineName,
    elementCode,
    elementName,
    kind,
    weight,
    maxScore,
  };
}

const grades: GradeRow[] = [
  g('grd-1', 'st-anna', 'PI21-INFO-T1', 'Тест 1', 'PI21-INFO', 'Информатика', 'TEST', 88, day(-20)),
  g('grd-2', 'st-anna', 'PI21-PROG-L2', 'Лабораторная 2', 'PI21-PROG', 'Программирование', 'LAB', 92, day(-15)),
  g('grd-3', 'st-anna', 'PI21-DISC-T', 'Тест 1', 'PI21-DISC', 'Дискретная математика', 'TEST', 70, day(-10)),
  // Экзамен DISC уже оценён (последняя попытка) → «Сдано · 74».
  g('grd-4', 'st-anna', 'PI21-DISC-EX', 'Экзамен', 'PI21-DISC', 'Дискретная математика', 'EXAM', 66, day(-9)),
  g('grd-5', 'st-anna', 'PI21-DISC-EX', 'Экзамен', 'PI21-DISC', 'Дискретная математика', 'EXAM', 74, day(-8)),
  // Чужая оценка другого студента не влияет на статусы Анны.
  g('grd-x', 'st-mate', 'PI21-INFO-K', 'Коллоквиум', 'PI21-INFO', 'Информатика', 'TEST', 90, day(-5)),
];

function g(
  id: string,
  studentId: string,
  elementCode: string,
  elementName: string,
  disciplineCode: string,
  disciplineName: string,
  kind: GradeRow['kind'],
  score: number,
  gradedAt: Date,
): GradeRow {
  return {
    id,
    studentId,
    elementCode,
    elementName,
    disciplineCode,
    disciplineName,
    score,
    maxScore: 100,
    weight: 0.4,
    kind,
    gradedAt,
    comment: null,
  };
}

const exams: ExamSessionRow[] = [
  ex('exm-info-cr', 'ПИ-21', 'PI21-INFO', 'Информатика', 'CREDIT', day(3), '210'),
  ex('exm-prog-cr', 'ПИ-21', 'PI21-PROG', 'Программирование', 'CREDIT', day(5), '210'),
  ex('exm-disc-ex', 'ПИ-21', 'PI21-DISC', 'Дискретная математика', 'EXAM', day(10), '301'),
  ex('exm-alg-ex', 'ПИ-21', 'PI21-ALG', 'Алгоритмы и структуры данных', 'EXAM', day(12), '311'),
  ex('exm-econ-ex', 'ЭК-11', 'EK11-ECON', 'Экономическая теория', 'EXAM', day(4), '12'),
];

function ex(
  id: string,
  groupName: string,
  disciplineCode: string,
  disciplineName: string,
  kind: ExamSessionRow['kind'],
  date: Date,
  room: string,
): ExamSessionRow {
  return {
    id,
    groupName,
    disciplineCode,
    disciplineName,
    kind,
    date,
    startsAt: date,
    room,
    note: null,
  };
}

const retakes: ExamSessionRow[] = [
  { ...ex('exm-info-rt', 'ПИ-21', 'PI21-INFO', 'Информатика', 'RETAKE', day(9, 9), '305'), note: 'Пересдача коллоквиума' },
];

const schedule: ScheduleEventRow[] = [
  sch('sch-consult-prog', 'ПИ-21', 'PI21-PROG', 'Программирование', day(4, 14), day(4, 15, 30), '210', 'Иванова Ирина Игоревна'),
  sch('sch-consult-econ', 'ЭК-11', 'EK11-ECON', 'Экономическая теория', day(3, 12), day(3, 13, 30), '12', 'Орлов Олег Олегович'),
];

function sch(
  id: string,
  groupName: string,
  disciplineCode: string,
  disciplineName: string,
  startsAt: Date,
  endsAt: Date,
  room: string,
  teacherName: string,
): ScheduleEventRow {
  return {
    id,
    groupName,
    disciplineCode,
    disciplineName,
    date: startsAt,
    startsAt,
    endsAt,
    kind: 'CONSULTATION',
    room,
    teacherName,
    status: 'SCHEDULED',
    note: null,
  };
}

function seedDb(extra: Partial<Parameters<MemoryDataDb['seed']>[0]> = {}): MemoryDataDb {
  const db = createMemoryDataDb();
  db.seed({
    students: [
      { id: 'st-anna', login: 'anna.smirnova', fullName: 'Анна Ковалёва', email: 'anna@example.edu', groupName: 'ПИ-21', course: 2, faculty: 'ИТ', program: 'Прикладная информатика', programCode: null, studyForm: 'очная', funding: 'бюджет', gradebookNumber: '20231234' },
      { id: 'st-mate', login: 'mate', fullName: 'Сокурсник Сокурсникович', email: 'mate@example.edu', groupName: 'ПИ-21', course: 2, faculty: 'ИТ', program: 'Прикладная информатика', programCode: null, studyForm: 'очная', funding: 'бюджет', gradebookNumber: '20231235' },
    ],
    staff: [{ id: 'stf-1', login: 'dean.kovaleva', fullName: 'Мария Петрова', position: 'Специалист деканата', email: 'dean@example.edu', faculty: 'ИТ' }],
    disciplines,
    elements,
    grades,
    exams: [...exams, ...retakes],
    schedule,
    requests: seededRequests(),
    requestEvents: [],
    notifications: [],
    ...extra,
  });
  return db;
}

function seededRequests(): ServiceRequestRow[] {
  return [
    {
      id: 'req-existing',
      studentId: 'st-anna',
      number: 'SR-2026-ZZ001',
      type: 'STATEMENT',
      title: 'Запись на пересдачу — Информатика',
      status: 'SUBMITTED',
      assignee: null,
      resultNote: null,
      createdAt: day(-1),
      updatedAt: day(-1),
    },
  ];
}

// ── getSession: таймлайн, статусы, шапка ────────────────────────────────────

describe('getSession: таймлайн и статусы', () => {
  it('экзамены и зачёты группы по возрастанию даты, чужая группа не попадает', async () => {
    const db = seedDb();
    const data = await getSession(db, annaCtx, NOW);

    expect(data.exams.map((row) => row.examId)).toEqual([
      'exm-info-cr',
      'exm-prog-cr',
      'exm-disc-ex',
      'exm-alg-ex',
    ]);
    expect(data.exams.every((row) => row.kind === 'EXAM' || row.kind === 'CREDIT')).toBe(true);
  });

  it('тип и преподаватель: зачёт/экзамен, преподаватель из справочника группы, «—» без справочника', async () => {
    const db = seedDb();
    const data = await getSession(db, annaCtx, NOW);

    const info = data.exams.find((row) => row.disciplineCode === 'PI21-INFO')!;
    expect(info.kindLabel).toBe('Зачёт');
    expect(info.teacherName).toBe('Петров Пётр Петрович');

    const alg = data.exams.find((row) => row.disciplineCode === 'PI21-ALG')!;
    expect(alg.kindLabel).toBe('Экзамен');
    expect(alg.teacherName).toBeNull();
  });

  it('«Не допущен»: причина — несданные элементы плана (кроме целевого)', async () => {
    const db = seedDb();
    const data = await getSession(db, annaCtx, NOW);

    // Зачёт по Программированию: не сдана Лабораторная 3 (зачёт сам — целевой).
    const prog = data.exams.find((row) => row.disciplineCode === 'PI21-PROG')!;
    expect(prog.status).toBe('NOT_ADMITTED');
    expect(prog.statusLabel).toBe('Не допущен');
    expect(prog.statusBadge).toBe('error');
    expect(prog.admissionReason).toBe('Не сдано: Лабораторная 3');
    expect(prog.actionHref).toBe('/grades/PI21-PROG');

    // Зачёт по Информатике: не сдан Коллоквиум (экзамен в плане — целевой).
    const info = data.exams.find((row) => row.disciplineCode === 'PI21-INFO')!;
    expect(info.status).toBe('NOT_ADMITTED');
    expect(info.admissionReason).toBe('Не сдано: Коллоквиум');
  });

  it('«Допущен»: все элементы, кроме целевого, сданы', async () => {
    const db = seedDb();
    const data = await getSession(db, annaCtx, NOW);

    // ALG: план не задан (дисциплина вне справочника) — отказывать нечем.
    const alg = data.exams.find((row) => row.disciplineCode === 'PI21-ALG')!;
    expect(alg.status).toBe('ADMITTED');
    expect(alg.statusLabel).toBe('Допущен');
    expect(alg.statusBadge).toBe('success');
    expect(alg.admissionReason).toBeNull();
    expect(alg.actionHref).toBeNull();
  });

  it('«Сдано · N»: целевой элемент оценён, берётся последняя попытка', async () => {
    const db = seedDb();
    const data = await getSession(db, annaCtx, NOW);

    const disc = data.exams.find((row) => row.disciplineCode === 'PI21-DISC')!;
    expect(disc.status).toBe('PASSED');
    expect(disc.statusLabel).toBe('Сдано · 74');
    expect(disc.score).toBe(74);
    expect(disc.statusBadge).toBe('success');
  });

  it('пересдачи: отдельный список с запрошенной заявкой и примечанием', async () => {
    const db = seedDb();
    const data = await getSession(db, annaCtx, NOW);

    expect(data.retakes).toHaveLength(1);
    const retake = data.retakes[0]!;
    expect(retake.examId).toBe('exm-info-rt');
    expect(retake.disciplineName).toBe('Информатика');
    expect(retake.note).toBe('Пересдача коллоквиума');
    expect(retake.room).toBe('305');
    // Заявка с этим заголовком уже есть в сиде → кнопка не «Записаться».
    expect(retake.requested).toBe(true);
    expect(retake.requestNumber).toBe('SR-2026-ZZ001');
    // Будущая пересдача доступна для записи.
    expect(retake.signUpAvailable).toBe(true);
  });

  it('прошедшая пересдача: запись недоступна и слоем данных не создаётся', async () => {
    const pastRetake = {
      ...retakes[0]!,
      id: 'exm-info-rt-past',
      date: day(-3, 9),
      startsAt: day(-3, 9),
    };
    const db = seedDb({ exams: [...exams, pastRetake], requests: [] });
    const data = await getSession(db, annaCtx, NOW);

    const past = data.retakes.find((row) => row.examId === 'exm-info-rt-past')!;
    expect(past.signUpAvailable).toBe(false);

    const result = await createRetakeRequest(db, annaCtx, 'exm-info-rt-past', { now: NOW });
    expect(result).toBeNull();
    expect(db.auditEvents().find((row) => row.resourceRef === 'exm-info-rt-past')?.reason).toBe(
      'NOT_FOUND',
    );
    expect(await db.listRequestsByStudent('st-anna')).toEqual([]);
  });

  it('консультации — из расписания группы (CONSULTATION), чужая группа не попадает', async () => {
    const db = seedDb();
    const data = await getSession(db, annaCtx, NOW);

    expect(data.consultations.map((row) => row.eventId)).toEqual(['sch-consult-prog']);
    const consult = data.consultations[0]!;
    expect(consult.disciplineName).toBe('Программирование');
    expect(consult.room).toBe('210');
    expect(consult.teacherName).toBe('Иванова Ирина Игоревна');
    expect(consult.endsAt.getTime()).toBe(day(4, 15, 30).getTime());
  });

  it('шапка: «Зимняя сессия · 23 декабря – 1 января», отсчёт до первой контрольной', async () => {
    const db = seedDb();
    const data = await getSession(db, annaCtx, NOW);

    expect(data.seasonTitle).toBe('Зимняя сессия');
    expect(data.rangeLabel).toBe('23 декабря – 1 января');
    expect(data.countdown).toEqual({ days: 3, label: 'До первого экзамена 3 дня' });
  });

  it('отсчёт в прошлом сессии: «Сессия уже идёт»; пустая сессия — null-шапка', async () => {
    const db = seedDb();
    const midSession = await getSession(db, annaCtx, day(6));
    expect(midSession.countdown?.label).toBe('Сессия уже идёт');
    expect(midSession.countdown?.days).toBeLessThan(0);

    const emptyDb = seedDb({ exams: [], schedule: [] });
    const empty = await getSession(emptyDb, annaCtx, NOW);
    expect(empty.exams).toEqual([]);
    expect(empty.retakes).toEqual([]);
    expect(empty.consultations).toEqual([]);
    expect(empty.seasonTitle).toBe('Сессия');
    expect(empty.rangeLabel).toBeNull();
    expect(empty.countdown).toBeNull();
  });

  it('IDOR-контракт чтения: студент видит только свою группу, сотрудник — пустой агрегат + аудит', async () => {
    const db = seedDb();
    const data = await getSession(db, annaCtx, NOW);
    expect(data.exams.every((row) => row.examId !== 'exm-econ-ex')).toBe(true);
    expect(data.consultations.every((row) => row.eventId !== 'sch-consult-econ')).toBe(true);

    const staffData = await getSession(db, staffCtx, NOW);
    expect(staffData.exams).toEqual([]);
    expect(staffData.retakes).toEqual([]);
    expect(staffData.consultations).toEqual([]);
    expect(staffData.studentId).toBeNull();

    const audit = db.auditEvents();
    const denial = audit.find((row) => row.resourceType === 'session');
    expect(denial?.reason).toBe('ROLE_MISMATCH');
    expect(denial?.outcome).toBe('DENIED');
  });
});

// ── createRetakeRequest: заявка + уведомление ───────────────────────────────

describe('createRetakeRequest', () => {
  it('создаёт заявку SUBMITTED с событием и уведомлением со ссылкой на заявку', async () => {
    const db = seedDb({ requests: [] });
    const result = await createRetakeRequest(db, annaCtx, 'exm-info-rt', { now: NOW });
    expect(result).not.toBeNull();
    expect(result?.created).toBe(true);

    const request = result!.request;
    expect(request.studentId).toBe('st-anna');
    expect(request.type).toBe('STATEMENT');
    expect(request.title).toBe('Запись на пересдачу — Информатика');
    expect(request.status).toBe('SUBMITTED');
    expect(request.number).toMatch(REQUEST_NUMBER_PATTERN);
    expect(isValidRequestNumber(request.number)).toBe(true);

    const events = await db.listRequestEvents(request.id);
    expect(events).toHaveLength(1);
    expect(events[0]!.statusTo).toBe('SUBMITTED');
    expect(events[0]!.actorRole).toBe('STUDENT');

    const notifications = await db.listNotificationsByStudent('st-anna');
    expect(notifications).toHaveLength(1);
    expect(notifications[0]!.type).toBe('REQUEST');
    expect(notifications[0]!.title).toContain('пересдач');
    expect(notifications[0]!.body).toContain(request.number);
    expect(notifications[0]!.link).toBe(`/requests/${request.number}`);
  });

  it('повторная запись идемпотентна: возвращается существующая заявка', async () => {
    const db = seedDb({ requests: [] });
    const first = await createRetakeRequest(db, annaCtx, 'exm-info-rt', { now: NOW });
    const second = await createRetakeRequest(db, annaCtx, 'exm-info-rt', { now: NOW });

    expect(second?.created).toBe(false);
    expect(second?.request.number).toBe(first!.request.number);
    const all = await db.listRequestsByStudent('st-anna');
    expect(all).toHaveLength(1);
    const notifications = await db.listNotificationsByStudent('st-anna');
    expect(notifications).toHaveLength(1); // уведомление не дублируется
  });

  it('чужой экзамен — null + OWNERSHIP_DENIED, несуществующий — null + NOT_FOUND', async () => {
    const db = seedDb({ requests: [] });

    const foreign = await createRetakeRequest(db, annaCtx, 'exm-econ-ex', { now: NOW });
    expect(foreign).toBeNull();

    const missing = await createRetakeRequest(db, annaCtx, 'exm-nope', { now: NOW });
    expect(missing).toBeNull();

    const audit = db.auditEvents();
    expect(audit.find((row) => row.resourceRef === 'exm-econ-ex')?.reason).toBe('OWNERSHIP_DENIED');
    expect(audit.find((row) => row.resourceRef === 'exm-nope')?.reason).toBe('NOT_FOUND');
  });

  it('не-пересдача (зачёт/экзамен) не даёт записаться — null', async () => {
    const db = seedDb({ requests: [] });
    const result = await createRetakeRequest(db, annaCtx, 'exm-info-cr', { now: NOW });
    expect(result).toBeNull();
    expect(await db.listRequestsByStudent('st-anna')).toEqual([]);
  });

  it('сотрудник — null + ROLE_MISMATCH', async () => {
    const db = seedDb();
    const result = await createRetakeRequest(db, staffCtx, 'exm-info-rt', { now: NOW });
    expect(result).toBeNull();
    expect(db.auditEvents().find((row) => row.resourceType === 'retake-signup')?.reason).toBe(
      'ROLE_MISMATCH',
    );
  });
});

// ── Чистые функции представления ────────────────────────────────────────────

describe('session-format: чистые функции', () => {
  it('сезон сессии — по месяцу первой контрольной', () => {
    expect(seasonTitleOf(new Date(2026, 11, 22))).toBe('Зимняя сессия');
    expect(seasonTitleOf(new Date(2027, 0, 12))).toBe('Зимняя сессия');
    expect(seasonTitleOf(new Date(2027, 5, 5))).toBe('Летняя сессия');
    expect(seasonTitleOf(new Date(2026, 9, 1))).toBe('Сессия');
  });

  it('диапазон сессии: разные месяцы и один месяц', () => {
    expect(formatSessionRange(new Date(2026, 11, 22), new Date(2027, 0, 25))).toBe(
      '22 декабря – 25 января',
    );
    expect(formatSessionRange(new Date(2027, 0, 5), new Date(2027, 0, 9))).toBe('5 – 9 января');
    expect(formatSessionRange(new Date(2026, 11, 22), new Date(2026, 11, 22))).toBe('22 декабря');
  });

  it('дата и время для человека', () => {
    expect(formatSessionDate(new Date(2026, 11, 5, 9, 40))).toBe('5 декабря');
    expect(formatSessionTime(new Date(2026, 11, 5, 9, 40))).toBe('09:40');
  });

  it('обратный отсчёт с плюрализацией', () => {
    expect(examCountdown(NOW, day(3)).label).toBe('До первого экзамена 3 дня');
    expect(examCountdown(NOW, day(1)).label).toBe('До первого экзамена 1 день');
    expect(examCountdown(NOW, day(2)).label).toBe('До первого экзамена 2 дня');
    expect(examCountdown(NOW, day(5)).label).toBe('До первого экзамена 5 дней');
    expect(examCountdown(NOW, day(12)).days).toBe(12);
    expect(examCountdown(NOW, NOW).label).toBe('Первый экзамен сегодня');
    expect(examCountdown(NOW, day(-2)).label).toBe('Сессия уже идёт');
  });

  it('причина допуска: перечень несданных элементов', () => {
    expect(admissionReasonPhrase([])).toBeNull();
    expect(admissionReasonPhrase(['Лабораторная 3'])).toBe('Не сдано: Лабораторная 3');
    expect(admissionReasonPhrase(['Коллоквиум', 'Тест 2'])).toBe('Не сдано: Коллоквиум, Тест 2');
  });

  it('пилюли статусов: цвета и подписи', () => {
    expect(examStatusView('ADMITTED', null)).toEqual({ label: 'Допущен', badge: 'success' });
    expect(examStatusView('NOT_ADMITTED', null)).toEqual({ label: 'Не допущен', badge: 'error' });
    expect(examStatusView('RETAKE', null)).toEqual({ label: 'Пересдача', badge: 'warning' });
    expect(examStatusView('PASSED', 9)).toEqual({ label: 'Сдано · 9', badge: 'success' });
    expect(passedScoreLabel(74)).toBe('Сдано · 74');
  });
});

// ── ICS: «Добавить всю сессию в календарь» ─────────────────────────────────

describe('ics: сборщик календаря', () => {
  const stamp = new Date(2026, 11, 20, 12, 0, 0);

  it('экранирует спецсимволы ICS', () => {
    expect(icsEscape('a;b,c\\d')).toBe('a\\;b\\,c\\\\d');
    expect(icsEscape('строка1\nстрока2')).toBe('строка1\\nстрока2');
  });

  it('плавающее локальное время без смещения', () => {
    expect(icsDateTime(new Date(2026, 11, 22, 10, 0, 0))).toBe('20261222T100000');
    expect(icsDateTime(new Date(2027, 0, 14, 9, 5, 0))).toBe('20270114T090500');
  });

  it('VCALENDAR с VEVENT на каждое событие, CRLF и DTSTAMP', () => {
    const ics = buildIcsCalendar(
      [
        {
          uid: 'exam-1@digital-deanery',
          title: 'Экзамен: Базы данных, ПИ-21',
          startsAt: new Date(2026, 11, 22, 10, 0, 0),
          endsAt: new Date(2026, 11, 22, 11, 30, 0),
          location: 'каб. 301',
          description: 'Письменный экзамен, 90 минут',
        },
        {
          uid: 'consult-1@digital-deanery',
          title: 'Консультация: Программирование',
          startsAt: new Date(2026, 11, 21, 14, 0, 0),
          endsAt: new Date(2026, 11, 21, 15, 30, 0),
          location: 'каб. 210',
          description: null,
        },
      ],
      { name: 'Зимняя сессия · ПИ-21', now: stamp },
    );

    expect(ics).toContain('BEGIN:VCALENDAR\r\n');
    expect(ics.trimEnd()).toMatch(/END:VCALENDAR$/);
    expect(ics).toContain('PRODID:');
    expect(ics).toContain('X-WR-CALNAME:Зимняя сессия · ПИ-21');
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics.match(/END:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain('UID:exam-1@digital-deanery');
    expect(ics).toContain('DTSTART:20261222T100000');
    expect(ics).toContain('DTEND:20261222T113000');
    expect(ics).toContain('LOCATION:каб. 301');
    expect(ics).toContain('DESCRIPTION:Письменный экзамен\\, 90 минут');
    expect(ics).toContain(`DTSTAMP:${icsDateTime(stamp)}`);
    // Только CRLF-переводы строк.
    expect(ics.includes('\r\n')).toBe(true);
    expect(ics.replace(/\r\n/g, '').includes('\n')).toBe(false);
  });

  it('детерминирован при равных входах и сворачивает длинные строки', () => {
    const events = [
      {
        uid: 'long@digital-deanery',
        title:
          'Экзамен: Очень Длинное Название Дисциплины Которое Точно Превышает Семьдесят Пять Символов В Календаре',
        startsAt: new Date(2027, 0, 14, 9, 0, 0),
        endsAt: new Date(2027, 0, 14, 10, 30, 0),
        location: 'каб. 311',
        description: null,
      },
    ];
    const a = buildIcsCalendar(events, { now: stamp });
    const b = buildIcsCalendar(events, { now: stamp });
    expect(a).toBe(b);

    const lines = a.split('\r\n');
    // Свёртка: строки не длиннее 75 символов, продолжения начинаются с пробела.
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(75);
    }
    // Развёртывание SUMMARY: свойство + все его строки-продолжения (пробел).
    const summaryStart = lines.findIndex((line) => line.startsWith('SUMMARY:'));
    expect(summaryStart).toBeGreaterThanOrEqual(0);
    let unfolded = '';
    for (let i = summaryStart; i < lines.length; i += 1) {
      const line = lines[i]!;
      if (i > summaryStart && !line.startsWith(' ')) break;
      unfolded += i === summaryStart ? line.slice('SUMMARY:'.length) : line.slice(1);
    }
    expect(unfolded).toContain('Которое');
  });
});
