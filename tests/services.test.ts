// DIG-29 — контракт слоя данных «Каталог сервисов» (red-first).
// Приёмка: избранное сохраняется на сервере (owner-scoped по studentId),
// до 6 закреплений, идемпотентный toggle, неизвестный/неролевой id
// отклоняется; getServicesPage: студент — избранное + подборка курса без
// дублей; сотрудник — пусто + аудит ROLE_MISMATCH.
import { beforeAll, describe, expect, it } from 'vitest';

import { createMemoryDataDb, type MemoryDataDb } from '@/server/data/memory-db';
import { toDataCtx } from '@/server/data/context';
import { getServicesPage, toggleFavoriteService, MAX_FAVORITES } from '@/server/data/services';
import type { AuthUser } from '@/server/auth/types';
import type { DataCtx } from '@/server/data/types';

let db: MemoryDataDb;
let anna: DataCtx;
let ilya: DataCtx;
let maria: DataCtx;

const userOf = (id: string, login: string, role: AuthUser['role']): AuthUser => ({
  id,
  login,
  role,
});

beforeAll(async () => {
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
    staff: [
      {
        id: 'stf-maria',
        login: 'maria',
        fullName: 'Мария Петрова',
        position: 'Специалист деканата',
        email: 'maria@example.edu',
        faculty: 'ИТ',
      },
    ],
  });
  const annaUser = userOf('auth-anna', 'anna', 'STUDENT');
  const ilyaUser = userOf('auth-ilya', 'ilya', 'STUDENT');
  const mariaUser = userOf('auth-maria', 'maria', 'STAFF');
  anna = (await toDataCtx(annaUser, db))!;
  ilya = (await toDataCtx(ilyaUser, db))!;
  maria = (await toDataCtx(mariaUser, db))!;
  expect(anna?.studentId).toBe('st-anna');
  expect(ilya?.studentId).toBe('st-ilya');
  expect(maria?.studentId).toBeNull();
});

describe('toggleFavoriteService — избранное на сервере', () => {
  it('закрепление и снятие сохраняются в слое данных', async () => {
    const add = await toggleFavoriteService(db, anna, 'cert-enrollment', true);
    expect(add.ok).toBe(true);
    const page = await getServicesPage(db, anna);
    expect(page.favorites.map((s) => s.id)).toContain('cert-enrollment');

    const remove = await toggleFavoriteService(db, anna, 'cert-enrollment', false);
    expect(remove.ok).toBe(true);
    const after = await getServicesPage(db, anna);
    expect(after.favorites.map((s) => s.id)).not.toContain('cert-enrollment');
  });

  it('toggle идемпотентен: повторное закрепление не дублирует', async () => {
    await toggleFavoriteService(db, anna, 'cert-grades', true);
    await toggleFavoriteService(db, anna, 'cert-grades', true);
    const page = await getServicesPage(db, anna);
    expect(page.favorites.filter((s) => s.id === 'cert-grades')).toHaveLength(1);
    await toggleFavoriteService(db, anna, 'cert-grades', false);
  });

  it('неизвестный id и сервис чужой роли отклоняются без записи', async () => {
    const unknown = await toggleFavoriteService(db, anna, 'no-such-service', true);
    expect(unknown.ok).toBe(false);
    const applicant = await toggleFavoriteService(db, anna, 'app-personal-cabinet', true);
    expect(applicant.ok).toBe(false);
    const staffOnly = await toggleFavoriteService(db, anna, 'staff-schedule-editor', true);
    expect(staffOnly.ok).toBe(false);
    const page = await getServicesPage(db, anna);
    expect(page.favorites).toHaveLength(0);
  });

  it('лимит 6: седьмое закрепление отклоняется с сообщением', async () => {
    expect(MAX_FAVORITES).toBe(6);
    const six = [
      'cert-enrollment',
      'cert-grades',
      'cert-tax',
      'transcript-instant',
      'fin-scholarship-cert',
      'help-deanery',
    ];
    for (const id of six) {
      const res = await toggleFavoriteService(db, ilya, id, true);
      expect(res.ok, id).toBe(true);
    }
    const seventh = await toggleFavoriteService(db, ilya, 'dorm-residence-cert', true);
    expect(seventh.ok).toBe(false);
    expect(seventh.error).toContain('6');
    const page = await getServicesPage(db, ilya);
    expect(page.favorites).toHaveLength(6);
  });

  it('снятие незакреплённого — ок (идемпотентно)', async () => {
    const res = await toggleFavoriteService(db, anna, 'cert-enrollment', false);
    expect(res.ok).toBe(true);
  });
});

describe('getServicesPage — скоуп и подборка', () => {
  it('избранное owner-scoped: закрепление Ильи не видно Анне', async () => {
    // После теста лимита у Ильи 6 закреплений — освобождаем одно место.
    await toggleFavoriteService(db, ilya, 'help-deanery', false);
    await toggleFavoriteService(db, ilya, 'dorm-residence-cert', true);
    const annaPage = await getServicesPage(db, anna);
    expect(annaPage.favorites.map((s) => s.id)).not.toContain('dorm-residence-cert');
    const ilyaPage = await getServicesPage(db, ilya);
    expect(ilyaPage.favorites.map((s) => s.id)).toContain('dorm-residence-cert');
  });

  it('подборка курса студента без дублей с избранным', async () => {
    // Анна — 2 курс: подборка содержит cert-enrollment и transcript-instant.
    const before = await getServicesPage(db, anna);
    expect(before.course).toBe(2);
    const pickIds = before.picks.map((s) => s.id);
    expect(pickIds).toContain('transcript-instant');
    expect(pickIds).toContain('cert-enrollment');
    expect(new Set(pickIds).size).toBe(pickIds.length);

    // Закрепили сервис из подборки → он уходит из подборки, а не дублируется.
    await toggleFavoriteService(db, anna, 'cert-enrollment', true);
    const after = await getServicesPage(db, anna);
    expect(after.favorites.map((s) => s.id)).toContain('cert-enrollment');
    expect(after.picks.map((s) => s.id)).not.toContain('cert-enrollment');
    // И общий инвариант: пересечения избранного и подборки нет.
    const fav = new Set(after.favorites.map((s) => s.id));
    for (const pick of after.picks) {
      expect(fav.has(pick.id)).toBe(false);
    }
    await toggleFavoriteService(db, anna, 'cert-enrollment', false);
  });

  it('все карточки страницы — только для роли STUDENT', async () => {
    const page = await getServicesPage(db, anna);
    for (const s of [...page.favorites, ...page.picks]) {
      expect(s.audiences).toContain('STUDENT');
    }
  });

  it('сотруднику — пустая страница и аудит ROLE_MISMATCH', async () => {
    const page = await getServicesPage(db, maria);
    expect(page.course).toBeNull();
    expect(page.favorites).toHaveLength(0);
    expect(page.picks).toHaveLength(0);
    const audit = db.auditEvents();
    const last = audit[audit.length - 1];
    expect(last.resourceType).toBe('service');
    expect(last.reason).toBe('ROLE_MISMATCH');
    expect(last.actorLogin).toBe('maria');
  });
});
