// DIG-46 — слой данных ассистента: скоуп по сессии (IDOR-контракт DIG-12).
// Приёмка: getAssistantContext отдаёт только свои данные (Анна — «Анна»,
// завтра 2 события ПИ-21 с переносом, дисциплины с экзаменом плана; Илья —
// данные ЭК-11; сотрудник — student:null + аудит ROLE_MISMATCH);
// createAssistantRequest — заявка SR-… + уведомление, идемпотентность по
// заголовку, whitelist; reportAssistantAnswer — обращение в деканат.
import { beforeEach, describe, expect, it } from 'vitest';

import {
  createAssistantRequest,
  getAssistantContext,
  reportAssistantAnswer,
} from '@/server/data/assistant';
import { createMemoryDataDb, type MemoryDataDb } from '@/server/data/memory-db';
import { fromMoscowWallClock, moscowParts, shiftMoscowDays } from '@/lib/schedule-time';
import type {
  AuditLogRow,
  DataCtx,
  DisciplineElementRow,
  DisciplineRow,
  GradeRow,
  ScheduleEventRow,
} from '@/server/data/types';

// Детерминированное «сейчас»: четверг 12 ноября 2026, 10:00 по Москве.
const NOW = fromMoscowWallClock(2026, 11, 12, 10, 0);

// Настенные московские дата/время: сдвиг на N дней без локальных часовых
// сюрпризов (тест не зависит от пояса машины).
const day = (offsetDays: number, hour: number, minute = 0): Date =>
  fromMoscowWallClock(
    moscowParts(shiftMoscowDays(NOW, offsetDays)).year,
    moscowParts(shiftMoscowDays(NOW, offsetDays)).month,
    moscowParts(shiftMoscowDays(NOW, offsetDays)).day,
    hour,
    minute,
  );

const annaCtx: DataCtx = {
  userId: 'auth-anna',
  login: 'anna.smirnova',
  role: 'STUDENT',
  studentId: 'st-anna',
  groupName: 'ПИ-21',
  faculty: 'ИТ',
};

const ilyaCtx: DataCtx = {
  ...annaCtx,
  userId: 'auth-ilya',
  login: 'ilya.petrov',
  studentId: 'st-ilya',
  groupName: 'ЭК-11',
  faculty: 'ЭК',
};

const staffCtx: DataCtx = {
  ...annaCtx,
  userId: 'auth-dean',
  login: 'dean.kovaleva',
  role: 'STAFF',
  studentId: null,
  groupName: null,
};

const student = (id: string, login: string, fullName: string, groupName: string) => ({
  id,
  login,
  fullName,
  email: `${login}@example.edu`,
  groupName,
  course: 2,
  faculty: 'ИТ',
  program: 'Прикладная информатика',
  programCode: '09.03.04',
  studyForm: 'очная',
  funding: 'бюджет',
  gradebookNumber: '20231234',
});

const schedule = (over: Partial<ScheduleEventRow> & { id: string }): ScheduleEventRow => ({
  groupName: 'ПИ-21',
  disciplineCode: 'PI21-DB',
  disciplineName: 'Базы данных',
  date: day(0, 10),
  startsAt: day(0, 10),
  endsAt: day(0, 11, 30),
  kind: 'LECTURE',
  room: '301',
  teacherName: 'Соколов Сергей Сергеевич',
  status: 'SCHEDULED',
  note: null,
  ...over,
});

let gradeSeq = 0;
const grade = (over: Partial<GradeRow> = {}): GradeRow => ({
  id: `grd-gen-${(gradeSeq += 1)}`,
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
  ...over,
});

const disciplines: DisciplineRow[] = [
  {
    groupName: 'ПИ-21',
    disciplineCode: 'PI21-DB',
    disciplineName: 'Базы данных',
    credits: 5,
    teacherName: 'Соколов Сергей Сергеевич',
  },
  {
    groupName: 'ЭК-11',
    disciplineCode: 'EK11-MATH',
    disciplineName: 'Математический анализ',
    credits: 5,
    teacherName: 'Кузнецова Ксения Кирилловна',
  },
];

const el = (
  groupName: string,
  disciplineCode: string,
  disciplineName: string,
  elementCode: string,
  elementName: string,
  kind: DisciplineElementRow['kind'],
  weight: number,
): DisciplineElementRow => ({
  groupName,
  disciplineCode,
  disciplineName,
  elementCode,
  elementName,
  kind,
  weight,
  maxScore: 100,
});

const elements: DisciplineElementRow[] = [
  el('ПИ-21', 'PI21-DB', 'Базы данных', 'PI21-DB-P1', 'Проект', 'PROJECT', 0.3),
  el('ПИ-21', 'PI21-DB', 'Базы данных', 'PI21-DB-T2', 'Тест 2', 'TEST', 0.2),
  el('ПИ-21', 'PI21-DB', 'Базы данных', 'PI21-DB-EX', 'Экзамен', 'EXAM', 0.5),
  el('ЭК-11', 'EK11-MATH', 'Математический анализ', 'EK11-MATH-EX', 'Экзамен', 'EXAM', 0.6),
];

function seedDb(): MemoryDataDb {
  const db = createMemoryDataDb();
  db.seed({
    students: [
      student('st-anna', 'anna.smirnova', 'Анна Ковалёва', 'ПИ-21'),
      student('st-ilya', 'ilya.petrov', 'Илья Смирнов', 'ЭК-11'),
    ],
    staff: [
      {
        id: 'stf-dean',
        login: 'dean.kovaleva',
        fullName: 'Мария Петрова',
        position: 'Специалист деканата',
        email: 'dean@example.edu',
        faculty: 'ИТ',
      },
    ],
    grades: [
      grade({}),
      grade({
        id: 'grd-ilya-1',
        studentId: 'st-ilya',
        elementCode: 'EK11-MATH-EX',
        disciplineCode: 'EK11-MATH',
        disciplineName: 'Математический анализ',
        score: 74,
        weight: 0.6,
        kind: 'EXAM',
        gradedAt: day(-8, 12),
      }),
    ],
    schedule: [
      // Завтра (13 ноября): пара с переносом 310 → 405 и консультация по БД.
      schedule({
        id: 'sch-anna-1',
        disciplineCode: 'PI21-PROG',
        disciplineName: 'Программирование',
        kind: 'LAB',
        date: day(1, 12),
        startsAt: day(1, 12),
        endsAt: day(1, 13, 30),
        room: '405',
        previousRoom: '310',
        status: 'ROOM_CHANGED',
        note: 'Пара перенесена в ауд. 405',
        teacherName: 'Иванова Ирина Игоревна',
      }),
      schedule({
        id: 'sch-anna-2',
        kind: 'CONSULTATION',
        date: day(1, 16),
        startsAt: day(1, 16),
        endsAt: day(1, 17, 30),
        room: '212',
      }),
      // Илья (ЭК-11): завтра другая пара — семинар.
      schedule({
        id: 'sch-ilya-1',
        groupName: 'ЭК-11',
        disciplineCode: 'EK11-MATH',
        disciplineName: 'Математический анализ',
        kind: 'PRACTICE',
        room: '12',
        teacherName: 'Кузнецова Ксения Кирилловна',
        date: day(1, 9),
        startsAt: day(1, 9),
        endsAt: day(1, 10, 30),
      }),
    ],
    disciplines,
    elements,
  });
  return db;
}

let db: MemoryDataDb;

beforeEach(() => {
  db = seedDb();
});

function auditRows(): AuditLogRow[] {
  return db.auditEvents();
}

describe('getAssistantContext — студент', () => {
  it('имя, группа и завтрашний день группы с переносом', async () => {
    const ctx = await getAssistantContext(db, annaCtx, NOW);
    expect(ctx.role).toBe('STUDENT');
    expect(ctx.firstName).toBe('Анна');
    expect(ctx.groupLabel).toBe('ПИ-21');
    expect(ctx.tomorrow).not.toBeNull();
    expect(ctx.tomorrow?.events.map((e) => e.discipline)).toEqual([
      'Программирование',
      'Базы данных',
    ]);
    expect(ctx.tomorrow?.events[0]?.isMoved).toBe(true);
    expect(ctx.tomorrow?.events[0]?.previousRoomLabel).toBe('было: ауд. 310');
    expect(ctx.tomorrow?.events[1]?.kindLabel).toBe('Консультация');
  });

  it('дисциплины с экзаменом плана: Базы данных с несданным экзаменом', async () => {
    const ctx = await getAssistantContext(db, annaCtx, NOW);
    const dbDiscipline = ctx.disciplines.find((d) => d.code === 'PI21-DB');
    expect(dbDiscipline).toBeDefined();
    expect(dbDiscipline?.name).toBe('Базы данных');
    expect(dbDiscipline?.accumulated).toBeCloseTo(25.5, 5);
    expect(dbDiscipline?.exam).not.toBeNull();
    expect(dbDiscipline?.exam?.graded).toBe(false);
    const gradedProject = dbDiscipline?.plan.find((elRow) => elRow.code === 'PI21-DB-P1');
    expect(gradedProject?.graded).toBe(true);
    expect(gradedProject?.score).toBe(85);
  });

  it('Илья видит только данные ЭК-11 (изоляция групп)', async () => {
    const ctx = await getAssistantContext(db, ilyaCtx, NOW);
    expect(ctx.firstName).toBe('Илья');
    expect(ctx.groupLabel).toBe('ЭК-11');
    expect(ctx.disciplines.some((d) => d.code === 'PI21-DB')).toBe(false);
    expect(ctx.disciplines.every((d) => d.code.startsWith('EK11'))).toBe(true);
    expect(ctx.tomorrow?.events.map((e) => e.discipline)).toEqual(['Математический анализ']);
  });
});

describe('getAssistantContext — сотрудник', () => {
  it('без студенческих данных + аудит ROLE_MISMATCH', async () => {
    const before = auditRows().length;
    const ctx = await getAssistantContext(db, staffCtx, NOW);
    expect(ctx.role).toBe('STAFF');
    expect(ctx.firstName).toBe('Мария');
    expect(ctx.groupLabel).toBeNull();
    expect(ctx.tomorrow).toBeNull();
    expect(ctx.disciplines).toEqual([]);
    const rows = auditRows();
    expect(rows.length).toBe(before + 1);
    expect(rows.at(-1)?.reason).toBe('ROLE_MISMATCH');
  });
});

describe('createAssistantRequest', () => {
  it('создаёт заявку SR-… типа Справка + уведомление', async () => {
    const result = await createAssistantRequest(db, annaCtx, 'cert-defer', { now: NOW });
    expect(result).not.toBeNull();
    expect(result?.created).toBe(true);
    expect(result?.request.number).toMatch(/^SR-\d{4}-[A-Z0-9]{5}$/);
    expect(result?.request.type).toBe('CERTIFICATE');
    expect(result?.request.title).toBe('Справка для отсрочки от армии');

    const notifications = await db.listNotificationsByStudent('st-anna');
    const created = notifications.find((n) => n.title.includes('отсрочк'));
    expect(created).toBeDefined();
    expect(created?.link).toBe(`/requests/${result?.request.number}`);
  });

  it('повторное подтверждение не создаёт дубль', async () => {
    const first = await createAssistantRequest(db, annaCtx, 'cert-defer', { now: NOW });
    const second = await createAssistantRequest(db, annaCtx, 'cert-defer', { now: NOW });
    expect(second?.created).toBe(false);
    expect(second?.request.id).toBe(first?.request.id);
  });

  it('чужой/несуществующий сервис-ид из whitelist отклоняется', async () => {
    expect(await createAssistantRequest(db, annaCtx, 'not-a-service', { now: NOW })).toBeNull();
    // Абитуриентская услуга есть в каталоге, но студенту недоступна.
    expect(
      await createAssistantRequest(db, annaCtx, 'app-personal-cabinet', { now: NOW }),
    ).toBeNull();
    const own = await db.listRequestsByStudent('st-anna');
    expect(own).toHaveLength(0);
  });

  it('сотруднику отказ + аудит ROLE_MISMATCH', async () => {
    const before = auditRows().length;
    const result = await createAssistantRequest(db, staffCtx, 'cert-defer', { now: NOW });
    expect(result).toBeNull();
    const rows = auditRows();
    expect(rows.length).toBe(before + 1);
    expect(rows.at(-1)?.reason).toBe('ROLE_MISMATCH');
  });
});

describe('reportAssistantAnswer', () => {
  it('создаёт обращение с темой «AI-ассистент: неверный ответ»', async () => {
    const appeal = await reportAssistantAnswer(
      db,
      annaCtx,
      { question: 'Что у меня завтра?', answerExcerpt: 'Завтра 2 пары…' },
      { now: NOW },
    );
    expect(appeal).not.toBeNull();
    expect(appeal?.subject).toBe('AI-ассистент: неверный ответ');
    const messages = await db.listAppealMessages(appeal!.id);
    expect(messages.at(0)?.body).toContain('Что у меня завтра?');
    const appeals = await db.listAppealsByStudent('st-anna');
    expect(appeals.some((a) => a.id === appeal!.id)).toBe(true);
  });

  it('обрезает длинный вопрос и не падает на пустом', async () => {
    const appeal = await reportAssistantAnswer(
      db,
      annaCtx,
      { question: 'Ж'.repeat(600), answerExcerpt: '' },
      { now: NOW },
    );
    const messages = await db.listAppealMessages(appeal!.id);
    expect(messages.at(0)?.body.length).toBeLessThan(600);
  });

  it('сотруднику отказ', async () => {
    const result = await reportAssistantAnswer(
      db,
      staffCtx,
      { question: 'вопрос', answerExcerpt: 'ответ' },
      { now: NOW },
    );
    expect(result).toBeNull();
  });
});
