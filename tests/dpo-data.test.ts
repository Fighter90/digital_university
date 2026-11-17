// DIG-42 — контракт данных «Дополнительного образования» (/dpo).
// Приёмка: enrollDpo (успех → дубль → null без второй строки), документы
// фильтруются по студенту (чужие строки наружу не проходят), сид демо-данных:
// 6 программ, у Анны 2 записи с прогрессом (60 % и 10 %) и 3 документа
// (договор, акт, сертификат), фильтр каталога по формату (?format=).
import { beforeAll, describe, expect, it } from 'vitest';

import {
  enrollDpoProgram,
  filterDpoCatalog,
  getDpoCatalog,
  getDpoDocuments,
  getDpoMyPrograms,
  parseDpoFormat,
} from '@/server/data/dpo';
import { createMemoryDataDb, type MemoryDataDb } from '@/server/data/memory-db';
import { seedDemoData } from '@/server/data/demo-seed';
import type { AuthStore } from '@/server/auth/types';
import type { DataCtx, DpoProgramRow } from '@/server/data/types';

let db: MemoryDataDb;
let anna: DataCtx;
let ilya: DataCtx;
let maria: DataCtx;

const at = (minutes: number): Date => new Date(2026, 10, 16, 10, minutes, 0);

const programSeed = (overrides: Partial<DpoProgramRow> & { id: string }): DpoProgramRow => ({
  slug: overrides.slug ?? `${overrides.id}-slug`,
  title: 'Программа',
  description: 'Описание программы дополнительного образования.',
  hours: 72,
  format: 'ONLINE',
  startsAt: at(60 * 24 * 14),
  price: 0,
  tags: ['данные'],
  facultyTag: 'ИТ',
  ...overrides,
});

// seedDemoData требует AuthStore только для посадки демо-логинов.
const stubStore = {
  seedUser: () => undefined,
  listUsers: () => [] as Array<{ login: string }>,
} as unknown as AuthStore;

beforeAll(() => {
  db = createMemoryDataDb();
  db.seed({
    students: [
      {
        id: 'st-anna',
        login: 'anna',
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
        login: 'ilya',
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
    dpoPrograms: [
      programSeed({ id: 'dpo-a', title: 'Аналитика данных', format: 'ONLINE' }),
      programSeed({ id: 'dpo-b', title: 'Проектное управление', format: 'OFFLINE' }),
      programSeed({ id: 'dpo-c', title: 'UX/UI дизайн', format: 'HYBRID' }),
    ],
    dpoEnrollments: [
      { programId: 'dpo-a', studentId: 'st-anna', enrolledAt: at(-40), progressPercent: 60 },
    ],
    dpoDocuments: [
      {
        id: 'dpo-doc-1',
        studentId: 'st-anna',
        programId: 'dpo-a',
        kind: 'CONTRACT',
        title: 'Договор',
        issuedAt: at(-39),
        number: 'ДПО-2026-0001',
      },
      {
        id: 'dpo-doc-2',
        studentId: 'st-ilya',
        programId: 'dpo-b',
        kind: 'RECEIPT',
        title: 'Квитанция Ильи',
        issuedAt: at(-38),
        number: 'ДПО-2026-0002',
      },
    ],
  });

  anna = {
    userId: 'auth-anna',
    login: 'anna',
    role: 'STUDENT',
    studentId: 'st-anna',
    groupName: 'ПИ-21',
    faculty: 'ИТ',
  };
  ilya = {
    ...anna,
    userId: 'auth-ilya',
    login: 'ilya',
    studentId: 'st-ilya',
    groupName: 'ЭК-11',
    faculty: 'ЭК',
  };
  maria = {
    ...anna,
    userId: 'auth-dean',
    login: 'maria',
    role: 'STAFF',
    studentId: null,
    groupName: null,
  };
});

describe('enrollDpo — успех → дубль → null', () => {
  it('запись создаёт РОВНО одну строку, повторный вызов возвращает null', async () => {
    const before = await db.listDpoEnrollmentsByStudent('st-ilya');
    expect(before.filter((e) => e.programId === 'dpo-b')).toHaveLength(0);

    // Успех: строка записи с нулевым прогрессом.
    const created = await db.enrollDpo('st-ilya', 'dpo-b');
    expect(created).toMatchObject({ programId: 'dpo-b', studentId: 'st-ilya', progressPercent: 0 });

    // Дубль: null, второй строки нет.
    const duplicate = await db.enrollDpo('st-ilya', 'dpo-b');
    expect(duplicate).toBeNull();
    const mine = await db.listDpoEnrollmentsByStudent('st-ilya');
    expect(mine.filter((e) => e.programId === 'dpo-b')).toHaveLength(1);

    // Запись на чужую не мешает собственной: у Анны по-прежнему одна строка.
    expect(await db.listDpoEnrollmentsByStudent('st-anna')).toHaveLength(1);
  });

  it('запись на несуществующую программу невозможна: null', async () => {
    expect(await db.enrollDpo('st-anna', 'dpo-unknown')).toBeNull();
  });

  it('через слой данных: студент записывается, дубль — отказ без мутации, несуществующая — NOT_FOUND в аудите', async () => {
    const ok = await enrollDpoProgram(db, ilya, 'dpo-c');
    expect(ok).toMatchObject({ ok: true, program: { id: 'dpo-c', title: 'UX/UI дизайн' } });

    const before = db.auditEvents().length;
    const duplicate = await enrollDpoProgram(db, ilya, 'dpo-c');
    expect(duplicate).toMatchObject({ ok: false, error: /уже записаны/ });
    // Дубль не пишет аудит (не попытка чужого доступа) и не мутирует.
    expect(db.auditEvents().slice(before)).toHaveLength(0);
    expect(await db.listDpoEnrollmentsByStudent('st-ilya')).toHaveLength(2);

    const missing = await enrollDpoProgram(db, ilya, 'dpo-unknown');
    expect(missing).toMatchObject({ ok: false });
    const events = db.auditEvents().slice(before);
    expect(events.map((e) => e.reason)).toEqual(['NOT_FOUND']);
    for (const event of events) {
      expect(event.resourceType).toBe('dpo-program');
    }
  });

  it('сотруднику записываться нельзя: мягкий отказ БЕЗ аудита ROLE_MISMATCH (раздел студенческий)', async () => {
    const before = db.auditEvents().length;
    const result = await enrollDpoProgram(db, maria, 'dpo-a');
    expect(result).toMatchObject({ ok: false });
    expect(db.auditEvents().slice(before)).toHaveLength(0);
  });
});

describe('каталог и «Мои программы»', () => {
  it('parseDpoFormat: известные форматы проходят, мусор/undefined/массив → ALL', () => {
    expect(parseDpoFormat(undefined)).toBe('ALL');
    expect(parseDpoFormat('ONLINE')).toBe('ONLINE');
    expect(parseDpoFormat('OFFLINE')).toBe('OFFLINE');
    expect(parseDpoFormat('HYBRID')).toBe('HYBRID');
    expect(parseDpoFormat('junk')).toBe('ALL');
    expect(parseDpoFormat(['HYBRID', 'ONLINE'])).toBe('HYBRID');
  });

  it('каталог читает любой вошедший (и сотрудник), enrolledByMe — только свои записи', async () => {
    const catalog = await getDpoCatalog(db, anna);
    expect(catalog).toHaveLength(3);
    expect(catalog.find((v) => v.program.id === 'dpo-a')?.enrolledByMe).toBe(true);
    expect(catalog.find((v) => v.program.id === 'dpo-c')?.enrolledByMe).toBe(false);

    const staffCatalog = await getDpoCatalog(db, maria);
    expect(staffCatalog).toHaveLength(3);
    expect(staffCatalog.every((v) => !v.enrolledByMe)).toBe(true);
  });

  it('фильтр каталога по формату: ALL не фильтрует, ONLINE/OFFLINE/HYBRID отбирают свои', () => {
    const catalog = [
      { program: programSeed({ id: 'x1', format: 'ONLINE' }), enrolledByMe: false },
      { program: programSeed({ id: 'x2', format: 'OFFLINE' }), enrolledByMe: false },
      { program: programSeed({ id: 'x3', format: 'HYBRID' }), enrolledByMe: false },
    ];
    expect(filterDpoCatalog(catalog, 'ALL')).toHaveLength(3);
    expect(filterDpoCatalog(catalog, 'ONLINE').map((v) => v.program.id)).toEqual(['x1']);
    expect(filterDpoCatalog(catalog, 'OFFLINE').map((v) => v.program.id)).toEqual(['x2']);
    expect(filterDpoCatalog(catalog, 'HYBRID').map((v) => v.program.id)).toEqual(['x3']);
  });

  it('«Мои программы» — записи владельца с join по программе, свежие первыми', async () => {
    const mine = await getDpoMyPrograms(db, anna);
    expect(mine).toHaveLength(1);
    expect(mine[0]?.program.id).toBe('dpo-a');
    expect(mine[0]?.enrollment.progressPercent).toBe(60);

    const ilyaMine = await getDpoMyPrograms(db, ilya);
    expect(ilyaMine.map((v) => v.program.id)).toEqual(['dpo-c', 'dpo-b']); // свежее сверху
  });

  it('сотруднику «Мои программы» и «Документы» не отдают строк (studentId null)', async () => {
    expect(await getDpoMyPrograms(db, maria)).toEqual([]);
    expect(await getDpoDocuments(db, maria)).toEqual([]);
  });
});

describe('документы — owner-scoped', () => {
  it('документы фильтруются по студенту: Анна видит только свои, Илья — только свои', async () => {
    const annaDocs = await getDpoDocuments(db, anna);
    expect(annaDocs.map((d) => d.id)).toEqual(['dpo-doc-1']);
    expect(annaDocs.every((d) => d.studentId === 'st-anna')).toBe(true);

    const ilyaDocs = await getDpoDocuments(db, ilya);
    expect(ilyaDocs.map((d) => d.id)).toEqual(['dpo-doc-2']);
    expect(ilyaDocs.every((d) => d.studentId === 'st-ilya')).toBe(true);
  });

  it('адаптер держит скоуп на чтении: чужой studentId не вытягивает чужие строки', async () => {
    expect(await db.listDpoDocumentsByStudent('st-ghost')).toEqual([]);
    const all = await db.listDpoDocumentsByStudent('st-anna');
    expect(all).toHaveLength(1);
  });
});

describe('демо-сид «Дополнительного образования» — приёмка DIG-42', () => {
  it('каталог: ровно 6 программ, среди них 6 названий приёмки, есть бесплатные и платные', async () => {
    const demo = createMemoryDataDb();
    await seedDemoData(demo, stubStore);
    const programs = await demo.listDpoPrograms();
    expect(programs).toHaveLength(6);
    const titles = programs.map((p) => p.title);
    for (const title of [
      'Аналитика данных',
      'UX/UI дизайн',
      'Проектное управление',
      'Python для исследований',
      'Цифровая педагогика',
      'Кибербезопасность основы',
    ]) {
      expect(titles, `программа ${title}`).toContain(title);
    }
    // Оба состояния цены на экране: «бесплатно для прототипа» и демо-цена.
    expect(programs.some((p) => p.price === 0)).toBe(true);
    expect(programs.some((p) => p.price > 0)).toBe(true);
    // Все три формата представлены (чипы фильтра не пустые).
    expect(new Set(programs.map((p) => p.format)).size).toBe(3);
  });

  it('у Анны ровно 2 записи с прогрессом 60 % и 10 %', async () => {
    const demo = createMemoryDataDb();
    await seedDemoData(demo, stubStore);
    const mine = await demo.listDpoEnrollmentsByStudent('st-anna');
    expect(mine).toHaveLength(2);
    expect([...mine].map((e) => e.progressPercent).sort((a, b) => a - b)).toEqual([10, 60]);
    expect(mine.every((e) => e.studentId === 'st-anna')).toBe(true);
  });

  it('у Анны ровно 3 документа: договор, акт, сертификат; у Ильи документов нет', async () => {
    const demo = createMemoryDataDb();
    await seedDemoData(demo, stubStore);
    const annaCtx = { ...anna, studentId: 'st-anna' };
    const docs = await getDpoDocuments(demo, annaCtx);
    expect(docs).toHaveLength(3);
    expect([...docs].map((d) => d.kind).sort()).toEqual(['ACT', 'CERTIFICATE', 'CONTRACT']);
    const ilyaCtx = { ...ilya };
    expect(await getDpoDocuments(demo, ilyaCtx)).toHaveLength(0);
    // Записей у Ильи тоже нет (каталог пуст его записей не подсвечивает).
    expect(await demo.listDpoEnrollmentsByStudent('st-ilya')).toHaveLength(0);
  });
});
