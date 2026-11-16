// DIG-37 — контракт слоя данных справочника (src/server/data/people.ts).
//
// Приёмка: справочник открыт всем авторизованным (студент И сотрудник),
// но ВСЯ персонализация («Мои преподаватели», дисциплины студента у
// преподавателя, ближайшие пары) строится ТОЛЬКО из ctx (studentId /
// groupName) — id из URL выбирает запись каталога, не скоуп данных.
// Неизвестный id → null (страница даёт единый 404).
import { describe, expect, it } from 'vitest';

import { createMemoryDataDb } from '@/server/data/memory-db';
import type { DataCtx, DisciplineRow, ScheduleEventRow, StudentRow } from '@/server/data/types';

import { getPeopleDirectory, getPersonCard, PEOPLE_DIRECTORY_IDS } from '@/server/data/people';

const shift = (days: number, hour: number): Date => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d;
};

const anna: StudentRow = {
  id: 'st-anna',
  login: 'anna.smirnova',
  fullName: 'Анна Ковалёва',
  email: 'anna.kovaleva@example.edu',
  groupName: 'ПИ-21',
  course: 2,
  faculty: 'ИТ',
  program: 'Прикладная информатика',
  programCode: '09.03.04',
  studyForm: 'очная',
  funding: 'бюджет',
  gradebookNumber: '20231234',
};

const staffAnnaCtx: DataCtx = {
  userId: 'auth-anna',
  login: 'anna.smirnova',
  role: 'STUDENT',
  studentId: 'st-anna',
  groupName: 'ПИ-21',
  faculty: 'ИТ',
};

const deanCtx: DataCtx = {
  userId: 'auth-dean',
  login: 'dean.kovaleva',
  role: 'STAFF',
  studentId: null,
  groupName: null,
  faculty: 'ИТ',
};

function discipline(
  code: string,
  name: string,
  teacherName: string,
  groupName = 'ПИ-21',
): DisciplineRow {
  return { groupName, disciplineCode: code, disciplineName: name, credits: 4, teacherName };
}

function event(
  id: string,
  startsAt: Date,
  overrides: Partial<ScheduleEventRow> = {},
): ScheduleEventRow {
  return {
    id,
    groupName: 'ПИ-21',
    disciplineCode: 'PI21-PROG',
    disciplineName: 'Программирование',
    date: startsAt,
    startsAt,
    endsAt: new Date(startsAt.getTime() + 90 * 60_000),
    kind: 'LECTURE',
    room: '405',
    teacherName: 'Иванова Ирина Игоревна',
    status: 'SCHEDULED',
    note: null,
    ...overrides,
  };
}

function seedDb() {
  const db = createMemoryDataDb();
  db.seed({
    students: [anna],
    disciplines: [
      discipline('PI21-PROG', 'Программирование', 'Иванова Ирина Игоревна'),
      discipline('PI21-ALG', 'Алгоритмы и структуры данных', 'Иванова Ирина Игоревна'),
      discipline('PI21-DB', 'Базы данных', 'Соколов Сергей Сергеевич'),
    ],
    schedule: [
      event('ev-past', shift(-2, 10)),
      event('ev-future', shift(3, 12)),
      event('ev-cancelled', shift(4, 14), { status: 'CANCELLED' }),
      event('ev-consult', shift(5, 16), {
        kind: 'CONSULTATION',
        disciplineName: 'Программирование',
      }),
      event('ev-other-teacher', shift(6, 10), { teacherName: 'Незнакомый Преподаватель' }),
    ],
  });
  return db;
}

describe('getPeopleDirectory — полный справочник', () => {
  it('возвращает все записи каталога и полный список их id', async () => {
    const db = seedDb();
    const data = await getPeopleDirectory(db, staffAnnaCtx);
    expect(data.people.length).toBe(PEOPLE_DIRECTORY_IDS.length);
    expect(data.people.map((p) => p.id).sort()).toEqual([...PEOPLE_DIRECTORY_IDS].sort());
    expect(data.totalCount).toBe(data.people.length);
  });

  it('данные записей: ФИО, должность, подразделение и дисциплины преподавателя', async () => {
    const db = seedDb();
    const data = await getPeopleDirectory(db, staffAnnaCtx);
    const ivanova = data.people.find((p) => p.id === 'teacher-ivanova')!;
    expect(ivanova.fullName).toBe('Иванова Ирина Игоревна');
    expect(ivanova.position).toBeTruthy();
    expect(ivanova.department).toBeTruthy();
    expect(ivanova.disciplines).toContain('Программирование');
    expect(ivanova.disciplines).toContain('Алгоритмы и структуры данных');
  });

  it('студенту: преподаватели расписания/дисциплин группы помечены как «его»', async () => {
    const db = seedDb();
    const data = await getPeopleDirectory(db, staffAnnaCtx);
    const byId = new Map(data.people.map((p) => [p.id, p]));
    expect(byId.get('teacher-ivanova')!.isMyTeacher).toBe(true);
    expect(byId.get('teacher-sokolov')!.isMyTeacher).toBe(true);
    expect(byId.get('teacher-petrov')!.isMyTeacher).toBe(false);
  });

  it('студенту: дисциплины группы у преподавателя перечислены в карточке списка', async () => {
    const db = seedDb();
    const data = await getPeopleDirectory(db, staffAnnaCtx);
    const ivanova = data.people.find((p) => p.id === 'teacher-ivanova')!;
    expect(ivanova.myDisciplines).toEqual(
      expect.arrayContaining(['Программирование', 'Алгоритмы и структуры данных']),
    );
    expect(ivanova.myDisciplines).not.toContain('Базы данных');
  });

  it('студенту: менеджер его программы и деканат факультета помечены', async () => {
    const db = seedDb();
    const data = await getPeopleDirectory(db, staffAnnaCtx);
    const byId = new Map(data.people.map((p) => [p.id, p]));
    expect(byId.get('staff-belova')!.isMyManager).toBe(true);
    expect(byId.get('staff-romanova')!.isMyManager).toBe(false);
    expect(byId.get('staff-petrova')!.isMyDeanery).toBe(true);
    expect(byId.get('staff-gavrilov')!.isMyDeanery).toBe(false);
    // Общие службы (без факультета) — не «мой деканат».
    expect(byId.get('staff-titova')!.isMyDeanery).toBe(false);
  });

  it('сортировка: персональные связи впереди, дальше по алфавиту', async () => {
    const db = seedDb();
    const data = await getPeopleDirectory(db, staffAnnaCtx);
    const personal = data.people.filter((p) => p.isMyTeacher || p.isMyManager || p.isMyDeanery);
    const rest = data.people.filter((p) => !(p.isMyTeacher || p.isMyManager || p.isMyDeanery));
    expect(data.people.slice(0, personal.length)).toEqual(personal);
    const restNames = rest.map((p) => p.fullName);
    expect(restNames).toEqual([...restNames].sort((a, b) => a.localeCompare(b, 'ru')));
  });

  it('сотруднику деканата: персональных меток нет, но деканат его факультета виден', async () => {
    const db = seedDb();
    const data = await getPeopleDirectory(db, deanCtx);
    expect(data.hasPersonalScope).toBe(false);
    for (const person of data.people) {
      expect(person.isMyTeacher).toBe(false);
      expect(person.isMyManager).toBe(false);
      expect(person.myDisciplines).toEqual([]);
    }
    const byId = new Map(data.people.map((p) => [p.id, p]));
    expect(byId.get('staff-petrova')!.isMyDeanery).toBe(true);
    expect(byId.get('staff-gavrilov')!.isMyDeanery).toBe(false);
  });

  // Ревью DIG-37 r2: метка «его/Ведёт у вас» должна быть ЕДИНОЙ в списке и
  // карточке. Преподаватель ведёт дисциплину группы, но пар в расписании
  // сейчас нет (семестр начался не у всех потоков) — метка в списке не
  // должна «исчезать» на карточке.
  it('метка «Ведёт у вас» единая в списке и карточке (дисциплины без пар в расписании)', async () => {
    const db = createMemoryDataDb();
    db.seed({
      students: [anna],
      disciplines: [
        discipline('PI21-DISC', 'Дискретная математика', 'Кузнецова Ксения Кирилловна'),
      ],
      schedule: [],
    });
    const data = await getPeopleDirectory(db, staffAnnaCtx);
    const inList = data.people.find((p) => p.id === 'teacher-kuznetsova')!;
    expect(inList.isMyTeacher).toBe(true);
    const card = await getPersonCard(db, staffAnnaCtx, 'teacher-kuznetsova');
    expect(card!.isMyTeacher).toBe(true);
  });
});

describe('getPersonCard — карточка человека', () => {
  it('неизвестный id → null (единый 404 на странице)', async () => {
    const db = seedDb();
    expect(await getPersonCard(db, staffAnnaCtx, 'teacher-hacker')).toBeNull();
  });

  it('преподаватель: контакты, часы консультаций, дисциплины с пометкой «его»', async () => {
    const db = seedDb();
    const card = await getPersonCard(db, staffAnnaCtx, 'teacher-ivanova');
    expect(card).not.toBeNull();
    expect(card!.person.fullName).toBe('Иванова Ирина Игоревна');
    expect(card!.person.email).toMatch(/@example\.edu$/);
    expect(card!.person.consultationHours).toBeTruthy();
    expect(card!.isMyTeacher).toBe(true);
    expect(card!.myDisciplines.map((d) => d.name)).toEqual(
      expect.arrayContaining(['Программирование', 'Алгоритмы и структуры данных']),
    );
  });

  it('преподаватель: ближайшие пары группы студента с ним, без отмен и прошлого', async () => {
    const db = seedDb();
    const card = await getPersonCard(db, staffAnnaCtx, 'teacher-ivanova');
    expect(card!.upcoming).not.toBeNull();
    const ids = card!.upcoming!.map((e) => e.id);
    expect(ids).toContain('ev-future');
    expect(ids).toContain('ev-consult');
    expect(ids).not.toContain('ev-past');
    expect(ids).not.toContain('ev-cancelled');
    expect(ids).not.toContain('ev-other-teacher');
    // Сортировка по времени: dateKey (московская дата) не убывает.
    const keys = card!.upcoming!.map((e) => e.dateKey);
    expect([...keys].sort()).toEqual(keys);
    // Карточка пары готова для показа: дисциплина, тип, аудитория, время.
    expect(card!.upcoming![0]!.disciplineName).toBeTruthy();
    expect(card!.upcoming![0]!.timeLabel).toMatch(/\d{1,2}:\d{2}/);
    expect(card!.upcoming![0]!.dateKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('менеджер программы студента: пометка «Ваш менеджер»', async () => {
    const db = seedDb();
    const mine = await getPersonCard(db, staffAnnaCtx, 'staff-belova');
    expect(mine!.isMyManager).toBe(true);
    const other = await getPersonCard(db, staffAnnaCtx, 'staff-romanova');
    expect(other!.isMyManager).toBe(false);
  });

  it('сотрудник деканата: «его деканат» — по факультету сотрудника', async () => {
    const db = seedDb();
    const petrova = await getPersonCard(db, deanCtx, 'staff-petrova');
    expect(petrova!.isMyDeanery).toBe(true);
    const gavrilov = await getPersonCard(db, deanCtx, 'staff-gavrilov');
    expect(gavrilov!.isMyDeanery).toBe(false);
  });

  it('сотруднику деканата: персональных разделов нет (null, а не пустые данные)', async () => {
    const db = seedDb();
    const card = await getPersonCard(db, deanCtx, 'teacher-ivanova');
    expect(card!.isMyTeacher).toBe(false);
    expect(card!.myDisciplines).toEqual([]);
    expect(card!.upcoming).toBeNull();
  });

  it('у студента без пар впереди — пустой список (не null)', async () => {
    const db = createMemoryDataDb();
    db.seed({ students: [anna], schedule: [], disciplines: [] });
    const card = await getPersonCard(db, staffAnnaCtx, 'teacher-ivanova');
    expect(card).not.toBeNull();
    expect(card!.upcoming).toEqual([]);
  });
});
