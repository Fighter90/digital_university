// DIG-102 — контракт избранного справочника людей (/people).
//
// Owner-scope по построению: studentId берётся ТОЛЬКО из ctx сессии; id
// человека валидируется белым списком (каталог людей или одногруппник СВОЕЙ
// группы). Проверяем:
//  - toggle добавляет/удаляет (идемпотентно);
//  - студент B не видит избранное студента A, toggle от имени A не влияет на B;
//  - одногруппник — только студент СВОЕЙ группы (чужая группа и сам владелец —
//    отказ без записи);
//  - сотруднику деканата отказ (ROLE_MISMATCH);
//  - категории формируются верно (TEACHER / STAFF / GROUPMATE);
//  - Prisma-модель и миграция FavoritePerson консистентны.
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { createMemoryDataDb } from '@/server/data/memory-db';
import type { DataCtx, StudentRow } from '@/server/data/types';

import {
  getPeopleDirectory,
  listFavoritePersons,
  toggleFavoritePerson,
} from '@/server/data/people';
import { groupFavoritePersonsByKind, groupmatePersonId } from '@/lib/people-catalog';

const ROOT = process.cwd();

function student(
  id: string,
  login: string,
  fullName: string,
  groupName: string,
  faculty: string,
  gradebookNumber: string,
): StudentRow {
  return {
    id,
    login,
    fullName,
    email: `${login}@example.edu`,
    groupName,
    course: 2,
    faculty,
    program: 'Прикладная информатика',
    programCode: '09.03.04',
    studyForm: 'очная',
    funding: 'бюджет',
    gradebookNumber,
  };
}

const anna = student('st-anna', 'anna.smirnova', 'Анна Смирнова', 'ПИ-21', 'ИТ', '20231234');
const boris = student('st-boris', 'boris.orlov', 'Борис Орлов', 'ПИ-21', 'ИТ', '20231240');
const ilya = student('st-ilya', 'ilya.petrov', 'Илья Петров', 'ЭК-11', 'ЭК', '20254567');

const ctxA: DataCtx = {
  userId: 'auth-anna',
  login: anna.login,
  role: 'STUDENT',
  studentId: anna.id,
  groupName: anna.groupName,
  faculty: anna.faculty,
};
const ctxB: DataCtx = { ...ctxA, userId: 'auth-boris', login: boris.login, studentId: boris.id };
const deanCtx: DataCtx = {
  userId: 'auth-dean',
  login: 'dean.kovaleva',
  role: 'STAFF',
  studentId: null,
  groupName: null,
  faculty: 'ИТ',
};

function seedDb() {
  const db = createMemoryDataDb();
  db.seed({ students: [anna, boris, ilya] });
  return db;
}

describe('Модель и миграция FavoritePerson', () => {
  const schema = readFileSync(resolve(ROOT, 'prisma/schema.prisma'), 'utf8');

  it('схема объявляет модель с owner-ключом и UNIQUE парой', () => {
    const model = schema.match(/model FavoritePerson \{[\s\S]*?\n\}/);
    expect(model).toBeTruthy();
    const body = model![0];
    expect(body).toContain('studentId');
    expect(body).toContain('personId');
    expect(body).toContain('createdAt');
    expect(body).toContain('@@unique([studentId, personId])');
    // Связь со Student с каскадным удалением (данные владельца уходят вместе с ним).
    expect(body).toMatch(/student\s+Student\s+@relation\([\s\S]*?onDelete:\s*Cascade/);
  });

  it('Student ссылается на избранное', () => {
    expect(schema).toMatch(/favorites\s+FavoritePerson\[\]/);
  });

  it('миграция создаёт таблицу, UNIQUE-индекс и FK с каскадом', () => {
    const dir = resolve(ROOT, 'prisma/migrations');
    const favorite = readdirSync(dir).filter((name) => name.includes('favorite'));
    expect(favorite.length).toBeGreaterThanOrEqual(1);
    const sql = readFileSync(resolve(dir, favorite[0]!, 'migration.sql'), 'utf8');
    expect(sql).toContain('CREATE TABLE "FavoritePerson"');
    expect(sql).toContain('"studentId" TEXT NOT NULL');
    expect(sql).toContain('"personId" TEXT NOT NULL');
    expect(sql).toMatch(/CREATE UNIQUE INDEX "FavoritePerson_studentId_personId_key"/);
    expect(sql).toMatch(
      /FOREIGN KEY \("studentId"\) REFERENCES "Student"\("id"\) ON DELETE CASCADE/,
    );
    expect(existsSync(resolve(dir, favorite[0]!, 'migration_lock.toml'))).toBe(false); // lock один на всё
  });
});

describe('toggleFavoritePerson — добавляет/удаляет владельца', () => {
  it('on → в избранном, off → нет; повтор идемпотентен', async () => {
    const db = seedDb();
    await expect(toggleFavoritePerson(db, ctxA, 'teacher-petrov', true)).resolves.toEqual({
      ok: true,
    });
    expect(await db.listFavoritePersonIdsByStudent(anna.id)).toEqual(['teacher-petrov']);

    // Повтор on — no-op (UNIQUE пары на уровне БД).
    await toggleFavoritePerson(db, ctxA, 'teacher-petrov', true);
    expect(await db.listFavoritePersonIdsByStudent(anna.id)).toEqual(['teacher-petrov']);

    await expect(toggleFavoritePerson(db, ctxA, 'teacher-petrov', false)).resolves.toEqual({
      ok: true,
    });
    expect(await db.listFavoritePersonIdsByStudent(anna.id)).toEqual([]);
  });

  it('listFavoritePersons возвращает записи владельца в порядке добавления', async () => {
    const db = seedDb();
    await toggleFavoritePerson(db, ctxA, 'staff-kovaleva', true);
    await toggleFavoritePerson(db, ctxA, 'teacher-petrov', true);
    const { favorites, hasPersonalScope } = await listFavoritePersons(db, ctxA);
    expect(hasPersonalScope).toBe(true);
    expect(favorites.map((f) => f.personId)).toEqual(['staff-kovaleva', 'teacher-petrov']);
    const petrov = favorites.find((f) => f.personId === 'teacher-petrov')!;
    expect(petrov.kind).toBe('TEACHER');
    expect(petrov.fullName).toBe('Петров Пётр Петрович');
    expect(petrov.href).toBe('/people/teacher-petrov');
    expect(petrov.email).toBe('petr.petrov@example.edu');
  });

  it('одногруппник СВОЕЙ группы добавляется с kind GROUPMATE и без карточки-ссылки', async () => {
    const db = seedDb();
    await expect(
      toggleFavoritePerson(db, ctxA, groupmatePersonId(boris.id), true),
    ).resolves.toEqual({ ok: true });
    const { favorites } = await listFavoritePersons(db, ctxA);
    expect(favorites).toHaveLength(1);
    expect(favorites[0]!.kind).toBe('GROUPMATE');
    expect(favorites[0]!.fullName).toBe('Борис Орлов');
    expect(favorites[0]!.email).toBe('boris.orlov@example.edu');
    expect(favorites[0]!.href).toBeNull();
  });
});

describe('owner-scope — избранное приватно по владельцу', () => {
  it('B не видит избранное A; toggle A не влияет на B (и наоборот)', async () => {
    const db = seedDb();
    await toggleFavoritePerson(db, ctxA, 'teacher-petrov', true);

    let bView = await listFavoritePersons(db, ctxB);
    expect(bView.favorites).toEqual([]);

    await toggleFavoritePerson(db, ctxB, 'staff-belova', true);

    const aView = await listFavoritePersons(db, ctxA);
    expect(aView.favorites.map((f) => f.personId)).toEqual(['teacher-petrov']); // belova не утекла
    bView = await listFavoritePersons(db, ctxB);
    expect(bView.favorites.map((f) => f.personId)).toEqual(['staff-belova']); // petrov не утёк

    // Снятие A не трогает список B.
    await toggleFavoritePerson(db, ctxA, 'teacher-petrov', false);
    expect((await listFavoritePersons(db, ctxB)).favorites.map((f) => f.personId)).toEqual([
      'staff-belova',
    ]);
  });

  it('одногруппник чужой группы — отказ без записи', async () => {
    const db = seedDb();
    const result = await toggleFavoritePerson(db, ctxA, groupmatePersonId(ilya.id), true);
    expect(result.ok).toBe(false);
    expect(await db.listFavoritePersonIdsByStudent(anna.id)).toEqual([]);
  });

  it('сам владелец себе в одногруппники не попадает', async () => {
    const db = seedDb();
    const result = await toggleFavoritePerson(db, ctxA, groupmatePersonId(anna.id), true);
    expect(result.ok).toBe(false);
    expect(await db.listFavoritePersonIdsByStudent(anna.id)).toEqual([]);
  });

  it('неизвестный id — отказ', async () => {
    const db = seedDb();
    expect((await toggleFavoritePerson(db, ctxA, 'teacher-hacker', true)).ok).toBe(false);
    expect((await toggleFavoritePerson(db, ctxA, 'groupmate:st-missing', true)).ok).toBe(false);
    expect((await toggleFavoritePerson(db, ctxA, '../etc/passwd', true)).ok).toBe(false);
    expect(await db.listFavoritePersonIdsByStudent(anna.id)).toEqual([]);
  });

  it('сотруднику деканата отказ (ROLE_MISMATCH)', async () => {
    const db = seedDb();
    const result = await toggleFavoritePerson(db, deanCtx, 'teacher-petrov', true);
    expect(result.ok).toBe(false);
    const view = await listFavoritePersons(db, deanCtx);
    expect(view.favorites).toEqual([]);
    expect(view.hasPersonalScope).toBe(false);
    // Отказ задокументирован в аудите.
    const audit = db.auditEvents();
    expect(
      audit.some((row) => row.resourceType === 'person' && row.reason === 'ROLE_MISMATCH'),
    ).toBe(true);
  });
});

describe('Категории избранного формируются верно', () => {
  it('TEACHER / STAFF / GROUPMATE раскладываются по своим категориям', async () => {
    const db = seedDb();
    await toggleFavoritePerson(db, ctxA, 'teacher-ivanova', true);
    await toggleFavoritePerson(db, ctxA, 'staff-kovaleva', true);
    await toggleFavoritePerson(db, ctxA, groupmatePersonId(boris.id), true);
    const { favorites } = await listFavoritePersons(db, ctxA);

    const grouped = groupFavoritePersonsByKind(favorites);
    expect(grouped.TEACHER.map((f) => f.personId)).toEqual(['teacher-ivanova']);
    expect(grouped.STAFF.map((f) => f.personId)).toEqual(['staff-kovaleva']);
    expect(grouped.GROUPMATE.map((f) => f.personId)).toEqual([groupmatePersonId(boris.id)]);
  });

  it('пустые категории — пустые массивы (UI скрывает их)', async () => {
    const db = seedDb();
    await toggleFavoritePerson(db, ctxA, 'teacher-orlov', true);
    const grouped = groupFavoritePersonsByKind((await listFavoritePersons(db, ctxA)).favorites);
    expect(grouped.TEACHER).toHaveLength(1);
    expect(grouped.STAFF).toEqual([]);
    expect(grouped.GROUPMATE).toEqual([]);
  });

  it('одногруппники не попадают в общий список каталога — только отдельным массивом', async () => {
    const db = seedDb();
    const data = await getPeopleDirectory(db, ctxA);
    // people — прежний контракт (только каталог людей): тесты DIG-37 живут.
    expect(data.people.some((p) => p.id.startsWith('groupmate:'))).toBe(false);
    const groupmates = data.groupmates.map((g) => g.id);
    expect(groupmates).toEqual([groupmatePersonId(boris.id)]); // сама Анна исключена
    const mate = data.groupmates[0]!;
    expect(mate.kind).toBe('GROUPMATE');
    expect(mate.fullName).toBe('Борис Орлов');
    expect(mate.email).toBe('boris.orlov@example.edu');
    expect(mate.isMyTeacher).toBe(false);
    expect(mate.isMyManager).toBe(false);
    expect(mate.isMyDeanery).toBe(false);

    // Сотруднику деканата одногруппников не отдаём (нет студенческого скоупа).
    const staffView = await getPeopleDirectory(db, deanCtx);
    expect(staffView.groupmates).toEqual([]);
  });
});
