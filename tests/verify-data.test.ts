// DIG-47 — справки в слое данных: публичное представление без PII,
// выдача по заявке владельца (idемпотентно), отзыв сотрудником факультета.
// Красная фаза: контракт зафиксирован ДО реализации.
import { beforeAll, describe, expect, it } from 'vitest';

import { createMemoryDataDb, type MemoryDataDb } from '@/server/data/memory-db';
import {
  getOrCreateCertificateForRequest,
  revokeCertificateByCode,
  verifyCertificateByCode,
} from '@/server/data/certificates';
import { denyAccess } from '@/server/data/access';
import { toDataCtx } from '@/server/data/context';
import type { CertificateRow, DataCtx } from '@/server/data/types';

const T0 = new Date('2026-11-01T10:00:00.000Z');

const ANNA_CODE = 'ABCD-EFGH-JKLM-NPQR-STUV-WXYZ-2345-6777';
const ILYA_CODE = 'YT3Q-C6VB-N2KH-W5LM-R7XD-P4FS-J6GQ-Z3MT';

let db: MemoryDataDb;
let anna: DataCtx;
let ilya: DataCtx;
let maria: DataCtx; // staff, факультет «ИТ»

const STUDENTS = [
  {
    id: 'st-anna',
    login: 'anna',
    fullName: 'Анна Ковалёва',
    email: 'anna@example.edu',
    groupName: 'ПИ-21',
    course: 2,
    faculty: 'ИТ',
    program: 'Прикладная информатика',
    programCode: null,
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
    programCode: null,
    studyForm: 'очная',
    funding: 'контракт',
    gradebookNumber: '20254567',
  },
];

const STAFF = [
  {
    id: 'stf-maria',
    login: 'maria',
    fullName: 'Мария Петрова',
    position: 'Специалист деканата',
    email: 'maria@example.edu',
    faculty: 'ИТ',
  },
];

const REQUESTS = [
  {
    id: 'req-anna-1',
    studentId: 'st-anna',
    number: 'SR-2026-A1B2C',
    type: 'CERTIFICATE' as const,
    title: 'Справка об обучении для налоговой',
    status: 'COMPLETED' as const,
    assignee: null,
    resultNote: null,
    createdAt: T0,
    updatedAt: T0,
  },
  {
    id: 'req-anna-2',
    studentId: 'st-anna',
    number: 'SR-2026-Q5W6E',
    type: 'STATEMENT' as const,
    title: 'Заявление на академический отпуск',
    status: 'IN_PROGRESS' as const,
    assignee: null,
    resultNote: null,
    createdAt: T0,
    updatedAt: T0,
  },
];

const DEFAULT_CERTS: CertificateRow[] = [
  {
    id: 'cert-anna-seed',
    studentId: 'st-anna',
    requestId: null,
    documentType: 'Справка об обучении',
    purpose: null,
    number: 'СП-2026-000412',
    verificationCode: ANNA_CODE,
    issuedAt: T0,
    expiresAt: new Date('2027-11-01T10:00:00.000Z'),
    revokedAt: null,
    revokedReason: null,
  },
  {
    id: 'cert-ilya-revoked',
    studentId: 'st-ilya',
    requestId: null,
    documentType: 'Справка об обучении',
    purpose: null,
    number: 'СП-2026-000777',
    verificationCode: ILYA_CODE,
    issuedAt: T0,
    expiresAt: new Date('2027-11-01T10:00:00.000Z'),
    revokedAt: new Date('2026-11-05T09:00:00.000Z'),
    revokedReason: 'Отозвано деканатом',
  },
];

/** Полный ре-сид: memory-адаптер сбрасывает таблицы, отсутствующие в seed. */
function seedAll(certificates: CertificateRow[] = DEFAULT_CERTS): void {
  db.seed({ students: STUDENTS, staff: STAFF, requests: REQUESTS, certificates });
}

beforeAll(async () => {
  db = createMemoryDataDb();
  seedAll();

  anna = (await toDataCtx({ id: 'auth-anna', login: 'anna', role: 'STUDENT' }, db)) as DataCtx;
  ilya = (await toDataCtx({ id: 'auth-ilya', login: 'ilya', role: 'STUDENT' }, db)) as DataCtx;
  maria = (await toDataCtx({ id: 'auth-maria', login: 'maria', role: 'STAFF' }, db)) as DataCtx;
});

const ANNA_REQUEST = REQUESTS[0]!;
const STATEMENT_REQUEST = REQUESTS[1]!;

describe('verifyCertificateByCode: публичное представление', () => {
  it('действительная справка: статус, тип, дата, маскированное ФИО', async () => {
    seedAll();
    const view = await verifyCertificateByCode(db, ANNA_CODE, new Date('2026-11-14T12:00:00.000Z'));
    expect(view).toEqual({
      status: 'VALID',
      documentType: 'Справка об обучении',
      issuedAt: T0,
      holderName: 'Анна К.', // маска: первое слово (фамилия в ФИО-порядке) + инициал
    });
  });

  it('регистр и дефисы нормализуются (код из QR без групп)', async () => {
    seedAll();
    const view = await verifyCertificateByCode(
      db,
      ANNA_CODE.replaceAll('-', '').toLowerCase(),
      new Date('2026-11-14T12:00:00.000Z'),
    );
    expect(view.status).toBe('VALID');
  });

  it('отозванная справка: статус REVOKED, поля документа видны', async () => {
    seedAll();
    const view = await verifyCertificateByCode(db, ILYA_CODE, new Date('2026-11-14T12:00:00.000Z'));
    expect(view.status).toBe('REVOKED');
    expect(view.documentType).toBe('Справка об обучении');
    expect(view.holderName).toBe('Илья С.');
  });

  it('истёкшая справка неотличима от отсутствующей (NOT_FOUND)', async () => {
    seedAll([
      {
        id: 'cert-expired',
        studentId: 'st-anna',
        requestId: null,
        documentType: 'Справка об обучении',
        purpose: null,
        number: 'СП-2026-000999',
        verificationCode: 'MMMM-MMMM-MMMM-MMMM-MMMM-MMMM-MMMM-MMMM',
        issuedAt: new Date('2025-11-01T10:00:00.000Z'),
        expiresAt: new Date('2026-01-01T10:00:00.000Z'),
        revokedAt: null,
        revokedReason: null,
      },
    ]);
    const view = await verifyCertificateByCode(
      db,
      'MMMM-MMMM-MMMM-MMMM-MMMM-MMMM-MMMM-MMMM',
      new Date('2026-11-14T12:00:00.000Z'),
    );
    expect(view).toEqual({
      status: 'NOT_FOUND',
      documentType: null,
      issuedAt: null,
      holderName: null,
    });
  });

  it('неизвестный и невалидный код — тот же NOT_FOUND без полей', async () => {
    seedAll();
    for (const raw of ['ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ', 'hello', '']) {
      const view = await verifyCertificateByCode(db, raw, new Date());
      expect(view).toEqual({
        status: 'NOT_FOUND',
        documentType: null,
        issuedAt: null,
        holderName: null,
      });
    }
  });

  it('публичное представление не содержит полного имени и лишних полей', async () => {
    seedAll();
    const view = await verifyCertificateByCode(db, ANNA_CODE, new Date());
    expect(Object.keys(view).sort()).toEqual(['documentType', 'holderName', 'issuedAt', 'status']);
    const json = JSON.stringify(view);
    // Маска показывает первое слово и инициалы: остальные токены полного
    // имени (фамилия/отчество в ФИО-порядке) не проходят в JSON вообще.
    expect(json).not.toContain('Ковалёва');
    expect(json).not.toContain('anna');
    expect(json).not.toContain('studentId');
    expect(json).not.toContain('email');
  });
});

describe('getOrCreateCertificateForRequest: выдача по заявке', () => {
  it('владелец: выполненная заявка-справка получает код ≥128 бит и срок действия', async () => {
    seedAll();
    const cert = await getOrCreateCertificateForRequest(
      db,
      anna,
      ANNA_REQUEST,
      new Date('2026-11-12T12:00:00.000Z'),
    );
    expect(cert).not.toBeNull();
    expect(cert!.verificationCode).toMatch(/^[A-Z2-7]{4}(-[A-Z2-7]{4}){7}$/);
    expect(cert!.documentType).toBe('Справка об обучении для налоговой');
    expect(cert!.studentId).toBe('st-anna');
    const validityDays =
      (cert!.expiresAt.getTime() - cert!.issuedAt.getTime()) / (24 * 60 * 60 * 1000);
    expect(validityDays).toBeGreaterThanOrEqual(360);
  });

  it('idемпотентно: повторный вызов возвращает ТОТ ЖЕ код', async () => {
    seedAll();
    const first = await getOrCreateCertificateForRequest(db, anna, ANNA_REQUEST, new Date());
    const second = await getOrCreateCertificateForRequest(db, anna, ANNA_REQUEST, new Date());
    expect(second!.verificationCode).toBe(first!.verificationCode);
    expect(second!.number).toBe(first!.number);
  });

  it('не выдаётся по заявке другого типа или в другом статусе', async () => {
    seedAll();
    expect(
      await getOrCreateCertificateForRequest(db, anna, STATEMENT_REQUEST, new Date()),
    ).toBeNull();
    expect(
      await getOrCreateCertificateForRequest(
        db,
        anna,
        {
          ...STATEMENT_REQUEST,
          id: 'req-anna-3',
          number: 'SR-2026-Z1X2C',
          type: 'CERTIFICATE',
          status: 'SUBMITTED',
        },
        new Date(),
      ),
    ).toBeNull();
  });

  it('чужая заявка (Илья → заявка Анны) — null + аудит OWNERSHIP_DENIED', async () => {
    seedAll();
    const cert = await getOrCreateCertificateForRequest(db, ilya, ANNA_REQUEST, new Date());
    expect(cert).toBeNull();
    const audit = db.auditEvents();
    const last = audit[audit.length - 1]!;
    expect(last.reason).toBe('OWNERSHIP_DENIED');
    expect(last.resourceType).toBe('certificate');
  });

  it('сотрудник — null + аудит ROLE_MISMATCH', async () => {
    seedAll();
    const cert = await getOrCreateCertificateForRequest(db, maria, ANNA_REQUEST, new Date());
    expect(cert).toBeNull();
    const audit = db.auditEvents();
    expect(audit[audit.length - 1]!.reason).toBe('ROLE_MISMATCH');
  });
});

describe('revokeCertificateByCode: отзыв сотрудником', () => {
  it('сотрудник своего факультета отзывает справку; проверка сразу видит REVOKED', async () => {
    seedAll();
    const now = new Date('2026-11-12T15:00:00.000Z');
    const revoked = await revokeCertificateByCode(db, maria, ANNA_CODE, {
      revokedAt: now,
      reason: 'Ошибка выдачи',
    });
    expect(revoked).not.toBeNull();
    expect(revoked!.revokedAt).toEqual(now);
    expect(revoked!.revokedReason).toBe('Ошибка выдачи');
    const view = await verifyCertificateByCode(db, ANNA_CODE, now);
    expect(view.status).toBe('REVOKED');
  });

  it('повторный отзыв идемпотентен: дата не меняется', async () => {
    seedAll();
    await revokeCertificateByCode(db, maria, ANNA_CODE, {
      revokedAt: new Date('2026-11-12T15:00:00.000Z'),
      reason: null,
    });
    const second = await revokeCertificateByCode(db, maria, ANNA_CODE, {
      revokedAt: new Date('2026-11-13T15:00:00.000Z'),
      reason: null,
    });
    expect(second!.revokedAt).toEqual(new Date('2026-11-12T15:00:00.000Z'));
  });

  it('сотрудник чужого факультета — null + аудит OWNERSHIP_DENIED', async () => {
    seedAll();
    const cert = await revokeCertificateByCode(db, maria, ILYA_CODE, {
      revokedAt: new Date(),
      reason: null,
    });
    expect(cert).toBeNull();
    const audit = db.auditEvents();
    expect(audit[audit.length - 1]!.reason).toBe('OWNERSHIP_DENIED');
  });

  it('студент не может отозвать — null + аудит ROLE_MISMATCH', async () => {
    seedAll();
    const cert = await revokeCertificateByCode(db, ilya, ANNA_CODE, {
      revokedAt: new Date(),
      reason: null,
    });
    expect(cert).toBeNull();
    const audit = db.auditEvents();
    expect(audit[audit.length - 1]!.reason).toBe('ROLE_MISMATCH');
  });

  it('неизвестный код — null + аудит NOT_FOUND', async () => {
    seedAll();
    const cert = await revokeCertificateByCode(
      db,
      maria,
      'ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ',
      { revokedAt: new Date(), reason: null },
    );
    expect(cert).toBeNull();
    const audit = db.auditEvents();
    expect(audit[audit.length - 1]!.reason).toBe('NOT_FOUND');
  });

  it('denyAccess остаётся единственным писателем отказов (регресс DIG-12)', async () => {
    seedAll();
    const before = db.auditEvents().length;
    await denyAccess(db, {
      ctx: anna,
      resourceType: 'certificate',
      resourceRef: 'x',
      reason: 'OWNERSHIP_DENIED',
    });
    expect(db.auditEvents().length).toBe(before + 1);
  });
});
