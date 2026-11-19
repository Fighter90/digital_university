// DIG-81 — согласованность демо-данных между модулями (QA-регресс 18.11).
// BUG-07: чипы входа ↔ логины/ФИО/группа сида (жюри вводит логин вручную —
// фамилии чипа, логина и профиля должны рассказывать одну историю; ФИО едины
// между demo-сидом и prisma-сидом). BUG-08: расписание/сессионные
// уведомления ссылаются на реальные записи schedule/exams (дата, время,
// аудитория) — фантомные аудитории и захардкоженные даты запрещены.
// BUG-11: группа ЭК-11 не вырождена (рейтинг «1 из 1» недостижим).
import { describe, expect, it } from 'vitest';

import { createMemoryDataDb } from '@/server/data/memory-db';
import { DEMO_PASSWORDS, seedDemoData } from '@/server/data/demo-seed';
import { TEST_ACCOUNTS } from '@/components/auth/test-accounts';
import { STAFF_SEED, STUDENT_SEED } from '../prisma/seed-data';
import type { AuthStore } from '@/server/auth/types';

// seedDemoData требует AuthStore только для посадки демо-логинов (см.
// tests/notifications-seed.test.ts).
const stubStore = {
  seedUser: () => undefined,
  listUsers: () => [] as Array<{ login: string }>,
} as unknown as AuthStore;

async function seeded() {
  const db = createMemoryDataDb();
  await seedDemoData(db, stubStore);
  return db;
}

const HM = (d: Date) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
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
];
const RU_DATE = (d: Date) => `${d.getDate()} ${MONTHS_GENITIVE[d.getMonth()]}`;

describe('BUG-07 — чипы входа ↔ сид (канон ФИО ↔ логины)', () => {
  it('чипы называют канонические ФИО, совпадающие с логинами', () => {
    expect(TEST_ACCOUNTS.map((a) => [a.label, a.login])).toEqual([
      ['Анна Смирнова · ПИ-21', 'anna.smirnova'],
      ['Илья Петров · ЭК-11', 'ilya.petrov'],
      ['Сотрудник деканата', 'dean.kovaleva'],
    ]);
  });

  it('чип студента = ФИО и группа профиля в demo-сиде; пароль из DEMO_PASSWORDS', async () => {
    const db = await seeded();
    for (const account of TEST_ACCOUNTS) {
      if (account.role !== 'STUDENT') continue;
      const student = await db.findStudentByLogin(account.login);
      expect(student, `chip ${account.login}: нет студента в сиде`).toBeTruthy();
      expect(account.label).toContain(student!.fullName);
      expect(account.label).toContain(student!.groupName);
      expect(account.password).toBe(DEMO_PASSWORDS[account.login as keyof typeof DEMO_PASSWORDS]);
    }
  });

  it('ФИО и ФИО сотрудника едины между demo-сидом и prisma-сидом', async () => {
    const db = await seeded();
    for (const seedStudent of STUDENT_SEED) {
      const demo = await db.findStudentByLogin(seedStudent.login);
      expect(demo, `${seedStudent.login}: нет в demo-сиде`).toBeTruthy();
      expect(demo!.fullName, `${seedStudent.login}: ФИО разошлись между сидами`).toBe(
        seedStudent.fullName,
      );
    }
    const staff = await db.findStaffByLogin(STAFF_SEED[0]!.login);
    expect(staff).toBeTruthy();
    expect(staff!.fullName).toBe(STAFF_SEED[0]!.fullName);
  });
});

describe('BUG-08 — уведомления порождены записями расписания/сессии', () => {
  it('перенос пары ПИ-21 описывает реальную запись ROOM_CHANGED (сегодня 214 → 305)', async () => {
    const db = await seeded();
    const schedule = await db.listScheduleByGroup('ПИ-21');
    const move = schedule.find((e) => e.id === 'sch-pi21-4');
    expect(move?.status).toBe('ROOM_CHANGED');
    expect(move?.room).toBe('305');
    expect(move?.previousRoom).toBe('214');

    const rows = await db.listNotificationsByStudent('st-anna');
    const ntf = rows.find((n) => n.id === 'ntf-anna-1');
    expect(ntf?.title).toContain(`ауд. ${move!.room}`);
    expect(ntf?.body).toContain(move!.disciplineName);
    expect(ntf?.body).toContain(HM(move!.startsAt));
    expect(ntf?.body).toContain(`ауд. ${move!.room} вместо ${move!.previousRoom}`);
  });

  it('пересдача «Информатика» называет дату/время/кабинет из записи сессии', async () => {
    const db = await seeded();
    const exams = await db.listExamsByGroup('ПИ-21');
    const retake = exams.find((e) => e.id === 'exm-pi21-4');
    expect(retake?.kind).toBe('RETAKE');
    expect(retake?.room).toBe('305');

    const rows = await db.listNotificationsByStudent('st-anna');
    const ntf = rows.find((n) => n.id === 'ntf-anna-7');
    expect(ntf?.body).toContain(RU_DATE(retake!.date));
    expect(ntf?.body).toContain(HM(retake!.startsAt));
    expect(ntf?.body).toContain(`ауд. ${retake!.room}`);
    // дата не захардкожена: текст должен совпасть с записью при любом запуске сида
    expect(ntf?.body).not.toContain('21 декабря');
  });

  it('отмена пары по физике цитирует время и «что делать» из записи CANCELLED', async () => {
    const db = await seeded();
    const schedule = await db.listScheduleByGroup('ПИ-21');
    const cancelled = schedule.find((e) => e.id === 'sch-pi21-5');
    expect(cancelled?.status).toBe('CANCELLED');

    const rows = await db.listNotificationsByStudent('st-anna');
    const ntf = rows.find((n) => n.id === 'ntf-anna-8');
    expect(ntf?.title).toContain(cancelled!.disciplineName);
    expect(ntf?.body).toContain(HM(cancelled!.startsAt));
    expect(ntf?.body).toContain(cancelled!.changeNote!);
  });

  it('перенос времени у ЭК-11 описывает реальную запись (9:00 вместо 10:40, ауд. 12)', async () => {
    const db = await seeded();
    const schedule = await db.listScheduleByGroup('ЭК-11');
    const timeMove = schedule.find((e) => e.id === 'sch-ek11-1');
    expect(timeMove?.status).toBe('TIME_CHANGED');

    const rows = await db.listNotificationsByStudent('st-ilya');
    const ntf = rows.find((n) => n.id === 'ntf-ilya-1');
    expect(ntf?.title).toContain(timeMove!.disciplineName);
    expect(ntf?.body).toContain(HM(timeMove!.startsAt));
    expect(ntf?.body).toContain('вместо 10:40');
    expect(ntf?.body).toContain(`ауд. ${timeMove!.room}`);
    // отмены у ЭК-11 в расписании нет — текст не должен её обещать
    expect(ntf?.title.toLowerCase()).not.toContain('отмен');
    expect(schedule.every((e) => e.status !== 'CANCELLED')).toBe(true);
  });

  it('оценочные уведомления ссылаются на реальные оценки студентов', async () => {
    const db = await seeded();
    const annaRows = await db.listNotificationsByStudent('st-anna');
    const annaGrades = await db.listGradesByStudent('st-anna');
    const project = annaGrades.find((g) => g.elementCode === 'PI21-DB-P1');
    expect(project?.score).toBe(85);
    expect(annaRows.find((n) => n.id === 'ntf-anna-4')?.body).toContain(String(project!.score));

    const ilyaRows = await db.listNotificationsByStudent('st-ilya');
    const ilyaGrades = await db.listGradesByStudent('st-ilya');
    const test1 = ilyaGrades.find((g) => g.elementCode === 'EK11-ECON-T1');
    expect(test1?.score).toBe(81);
    expect(ilyaRows.find((n) => n.id === 'ntf-ilya-4')?.body).toContain(String(test1!.score));
  });

  it('NEWS о консультациях без ложных дат; консультации существуют в расписании', async () => {
    const db = await seeded();
    const schedule = await db.listScheduleByGroup('ПИ-21');
    expect(schedule.filter((e) => e.kind === 'CONSULTATION').length).toBeGreaterThanOrEqual(3);

    const rows = await db.listNotificationsByStudent('st-anna');
    const ntf = rows.find((n) => n.id === 'ntf-anna-6');
    expect(ntf?.body).not.toMatch(/декабр/);
  });

  it('фантомные аудитории регресса (Б-204/А-312/А-401) не встречаются в текстах', async () => {
    const db = await seeded();
    const all = [
      ...(await db.listNotificationsByStudent('st-anna')),
      ...(await db.listNotificationsByStudent('st-ilya')),
    ];
    for (const n of all) {
      expect(`${n.title} ${n.body}`).not.toMatch(/Б-204|А-312|А-401/);
    }
  });
});

describe('BUG-11 — группа ЭК-11 не вырождена', () => {
  it('в ЭК-11 минимум 3 студента, Илья среди них', async () => {
    const db = await seeded();
    const group = await db.listStudentsByGroup('ЭК-11');
    expect(group.length).toBeGreaterThanOrEqual(3);
    expect(group.some((s) => s.login === 'ilya.petrov')).toBe(true);
    expect(new Set(group.map((s) => s.id)).size).toBe(group.length);
  });
});
