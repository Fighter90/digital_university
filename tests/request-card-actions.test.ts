// DIG-33 — серверные действия карточки: «Задать вопрос по заявке»
// (обращение с привязкой к номеру) и «Отправить на email» (концепт:
// фиксируется кабинетное уведомление; SMTP не подключается).
//
// IDOR-контракт как во всём слое: чужая заявка и несуществующая
// неотличимы (null / отказ), сотрудник — отказ с ROLE_MISMATCH.
import { beforeEach, describe, expect, it } from 'vitest';
import { createMemoryDataDb, type MemoryDataDb } from '@/server/data/memory-db';
import type { DataCtx } from '@/server/data/types';
import { seedDemoData } from '@/server/data/demo-seed';
import { formatCanonicalRequestNumber } from '@/server/data/canonical-request-number';
import {
  createRequestQuestionAppeal,
  sendRequestDocumentByEmail,
} from '@/server/data/canonical-requests';

const stubAuthStore = { selection: { kind: 'memory', store: {}, rateLimiter: {} } } as never;

let db: MemoryDataDb;
let anna: DataCtx;
let ilya: DataCtx;
let maria: DataCtx; // сотрудник ИТ

beforeEach(async () => {
  db = createMemoryDataDb();
  await seedDemoData(db, stubAuthStore);
  anna = {
    userId: 'auth-anna',
    login: 'anna.smirnova',
    role: 'STUDENT',
    studentId: 'st-anna',
    groupName: 'ПИ-21',
    faculty: 'ИТ',
  };
  ilya = {
    userId: 'auth-ilya',
    login: 'ilya.petrov',
    role: 'STUDENT',
    studentId: 'st-ilya',
    groupName: 'ЭК-11',
    faculty: 'ЭК',
  };
  maria = {
    userId: 'auth-dean',
    login: 'dean.kovaleva',
    role: 'STAFF',
    studentId: null,
    groupName: null,
    faculty: 'ИТ',
  };
});

const year = new Date().getFullYear();

describe('createRequestQuestionAppeal: вопрос → обращение с номером заявки', () => {
  it('владелец создаёт обращение: тема с номером, вопрос в первом сообщении', async () => {
    const deferNumber = formatCanonicalRequestNumber(year, 3); // «для военкомата» NEEDS_FIX
    const appeal = await createRequestQuestionAppeal(db, anna, {
      requestId: 'creq-demo-defer',
      message: 'Когда будут готовы документы после исправления?',
    });
    expect(appeal).not.toBeNull();
    expect(appeal!.subject).toBe(`Вопрос по заявке ${deferNumber}`);
    expect(appeal!.status).toBe('OPEN');

    const messages = await db.listAppealMessages(appeal!.id);
    expect(messages).toHaveLength(1);
    expect(messages[0]!.authorRole).toBe('STUDENT');
    expect(messages[0]!.body).toContain(deferNumber);
    expect(messages[0]!.body).toContain('Когда будут готовы документы после исправления?');
  });

  it('чужая заявка неотличима от несуществующей (null без утечки)', async () => {
    expect(
      await createRequestQuestionAppeal(db, ilya, {
        requestId: 'creq-demo-defer',
        message: 'А это чужая заявка',
      }),
    ).toBeNull();
    expect(
      await createRequestQuestionAppeal(db, anna, {
        requestId: 'creq-no-such',
        message: 'Несуществующая заявка',
      }),
    ).toBeNull();
  });

  it('сотрудник получает отказ (вопрос задаёт студент-владелец)', async () => {
    expect(
      await createRequestQuestionAppeal(db, maria, {
        requestId: 'creq-demo-defer',
        message: 'Сотрудник не задаёт вопросы',
      }),
    ).toBeNull();
  });
});

describe('sendRequestDocumentByEmail: отправка готового документа владельцу', () => {
  it('мгновенная READY: успех с email профиля и кабинетное уведомление', async () => {
    const certNumber = formatCanonicalRequestNumber(year, 1); // READY «для банка»
    const result = await sendRequestDocumentByEmail(db, anna, certNumber);
    expect(result).toEqual({ ok: true, email: 'anna.smirnova@example.edu' });

    const notifications = await db.listNotificationsByStudent('st-anna');
    const sent = notifications.find((n) => n.body.includes('anna.smirnova@example.edu'));
    expect(sent).toBeDefined();
    expect(sent!.body).toContain(certNumber);
    expect(sent!.link).toBe(`/requests/${certNumber}`);
  });

  it('неготовая заявка — отказ без отправки', async () => {
    const deferNumber = formatCanonicalRequestNumber(year, 3); // NEEDS_FIX
    const result = await sendRequestDocumentByEmail(db, anna, deferNumber);
    expect(result).toEqual({ ok: false, error: expect.stringContaining('не готов') });
  });

  it('бумажный тип без мгновенного документа — отказ', async () => {
    const diplomaNumber = formatCanonicalRequestNumber(year, 2); // PAPER, SUBMITTED
    const result = await sendRequestDocumentByEmail(db, anna, diplomaNumber);
    expect(result).toEqual({ ok: false, error: expect.stringContaining('не готов') });
  });

  it('чужой номер и сотрудник — отказ (IDOR)', async () => {
    const certNumber = formatCanonicalRequestNumber(year, 1);
    expect(await sendRequestDocumentByEmail(db, ilya, certNumber)).toEqual({
      ok: false,
      error: expect.any(String),
    });
    expect((await sendRequestDocumentByEmail(db, maria, certNumber)).ok).toBe(false);
  });

  it('несуществующий номер — тот же отказ (без оракула)', async () => {
    expect((await sendRequestDocumentByEmail(db, anna, 'ЗД-2026-999999')).ok).toBe(false);
  });
});
