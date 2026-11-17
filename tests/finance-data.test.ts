// DIG-41 — контракт агрегата getFinancePage (слой данных, red-first).
// Скоуп по живой сессии: студент получает свой bundle по форме обучения,
// сотруднику — отказ с аудитом ROLE_MISMATCH (IDOR невозможен по построению).
import { describe, expect, it } from 'vitest';

import { createMemoryDataDb, type MemoryDataDb } from '@/server/data/memory-db';
import { seedDemoData } from '@/server/data/demo-seed';
import type { DataCtx } from '@/server/data/types';
import { getFinancePage } from '@/server/data/finance';

const stubAuthStore = { selection: { kind: 'memory', store: {}, rateLimiter: {} } } as never;

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

const staffCtx: DataCtx = {
  userId: 'auth-dean',
  login: 'dean.kovaleva',
  role: 'STAFF',
  studentId: null,
  groupName: null,
  faculty: 'ИТ',
};

async function seededDb(): Promise<MemoryDataDb> {
  const db = createMemoryDataDb();
  await seedDemoData(db, stubAuthStore);
  return db;
}

describe('getFinancePage: студент (DIG-41)', () => {
  it('бюджетнику отдаёт его личность и непустой bundle без договора', async () => {
    const db = await seededDb();
    const data = await getFinancePage(db, annaCtx);

    expect(data.student).not.toBeNull();
    expect(data.student?.fullName).toBe('Анна Ковалёва');
    expect(data.student?.groupName).toBe('ПИ-21');
    expect(data.bundle).not.toBeNull();
    expect(data.bundle!.summary.isContract).toBe(false);
    // Приёмка: у бюджетника не пусто — стипендия и выплаты.
    expect(data.bundle!.summary.scholarship).not.toBeNull();
    expect(data.bundle!.payouts.length).toBeGreaterThan(0);
    expect(data.bundle!.contract).toBeNull();
  });

  it('платнику отдаёт договор, документы и задолженность из сводки', async () => {
    const db = await seededDb();
    const data = await getFinancePage(db, ilyaCtx);

    expect(data.student?.fullName).toBe('Илья Смирнов');
    expect(data.bundle!.summary.isContract).toBe(true);
    expect(data.bundle!.contract!.payments.length).toBeGreaterThanOrEqual(2);
    expect(data.bundle!.summary.debt).not.toBeNull();
    const docIds = data.bundle!.documents.map((d) => d.id);
    expect(new Set(docIds).size).toBe(docIds.length);
  });

  it('bundle строится по форме обучения владельца ctx, не по вводу', async () => {
    const db = await seededDb();
    const anna = await getFinancePage(db, annaCtx);
    const ilya = await getFinancePage(db, ilyaCtx);
    // Формы финансирования демо-студентов различаются — bundle тоже.
    expect(anna.bundle!.summary.isContract).toBe(false);
    expect(ilya.bundle!.summary.isContract).toBe(true);
    // Документы Ильи недостижимы из набора Анны (изоляция наборов).
    const annaIds = new Set(anna.bundle!.documents.map((d) => d.id));
    for (const doc of ilya.bundle!.documents) {
      expect(annaIds.has(doc.id)).toBe(false);
    }
  });
});

describe('getFinancePage: доступ (DIG-41)', () => {
  it('сотруднику — пустой ответ и аудит ROLE_MISMATCH', async () => {
    const db = await seededDb();
    const before = db.auditEvents().length;

    const data = await getFinancePage(db, staffCtx);
    expect(data.student).toBeNull();
    expect(data.bundle).toBeNull();

    const audit = db.auditEvents();
    expect(audit.length).toBe(before + 1);
    const last = audit[audit.length - 1]!;
    expect(last.resourceType).toBe('finance');
    expect(last.reason).toBe('ROLE_MISMATCH');
    expect(last.outcome).toBe('DENIED');
    expect(last.actorLogin).toBe('dean.kovaleva');
  });
});
