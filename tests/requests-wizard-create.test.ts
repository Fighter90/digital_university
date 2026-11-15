// DIG-31 — слой данных: createWizardRequest (мастер заказа).
// Красная фаза: контракт зафиксирован ДО реализации.
//
// IDOR-контракт DIG-12: контекст студента — единственный ключ; сотрудник
// получает отказ с аудитом ROLE_MISMATCH; неизвестный/не-ORDER сервис —
// просто null (некорректный ввод без аудита). Мгновенная заявка рождается
// COMPLETED с результат-заметкой; у обычных — SUBMITTED и сводка параметров
// в первом событии истории.
import { beforeAll, describe, expect, it } from 'vitest';

import { createMemoryDataDb, type MemoryDataDb } from '@/server/data/memory-db';
import { createWizardRequest } from '@/server/data/requests';
import { listRequestEvents } from '@/server/data/requests';
import type { DataCtx } from '@/server/data/types';

let db: MemoryDataDb;

const studentCtx: DataCtx = {
  userId: 'auth-anna',
  login: 'anna.smirnova',
  role: 'STUDENT',
  studentId: 'st-anna',
  groupName: 'ПИ-21',
  faculty: 'ИТ',
};

const staffCtx: DataCtx = { ...studentCtx, role: 'STAFF', studentId: null, groupName: null };

const input = {
  serviceId: 'cert-defer',
  destination: 'Военкомат по месту учёбы',
  language: 'RU' as const,
  copies: 2,
  delivery: 'MAIL' as const,
  comment: '',
  consent: true,
  attachmentNames: [],
};

beforeAll(() => {
  db = createMemoryDataDb();
});

describe('createWizardRequest — создание заявки из мастера', () => {
  it('обычный документ: SUBMITTED, название документа, сводка в событии', async () => {
    const request = await createWizardRequest(db, studentCtx, input, { now: new Date(2026, 10, 16, 10, 0, 0) });
    expect(request).not.toBeNull();
    expect(request!.title).toBe('Справка для отсрочки от армии');
    expect(request!.type).toBe('CERTIFICATE');
    expect(request!.status).toBe('SUBMITTED');
    expect(request!.resultNote).toBeNull();
    expect(request!.number).toMatch(/^SR-\d{4}-[A-Z0-9]{5}$/);

    const events = await listRequestEvents(db, studentCtx, request!.id);
    expect(events).toHaveLength(1);
    expect(events[0]!.statusTo).toBe('SUBMITTED');
    expect(events[0]!.message).toContain('Военкомат по месту учёбы');
    expect(events[0]!.message).toContain('Почтой');
  });

  it('мгновенная справка об обучении: COMPLETED + результат-заметка', async () => {
    const request = await createWizardRequest(
      db,
      studentCtx,
      { ...input, serviceId: 'cert-enrollment', delivery: 'PDF' },
      { now: new Date(2026, 10, 16, 10, 0, 0) },
    );
    expect(request).not.toBeNull();
    expect(request!.status).toBe('COMPLETED');
    expect(request!.resultNote).toContain('PDF');
  });

  it('заявление с вложениями: имена файлов в сводке события', async () => {
    const request = await createWizardRequest(
      db,
      studentCtx,
      { ...input, serviceId: 'stmt-academic-leave', destination: '', copies: 1, delivery: 'PICKUP', attachmentNames: ['spravka.pdf', 'skan.png'] },
    );
    const events = await listRequestEvents(db, studentCtx, request!.id);
    expect(events[0]!.message).toContain('spravka.pdf');
    expect(events[0]!.message).toContain('skan.png');
  });

  it('сотрудник получает null и аудированный ROLE_MISMATCH', async () => {
    const before = db.auditEvents().length;
    const request = await createWizardRequest(db, staffCtx, input);
    expect(request).toBeNull();
    const audit = db.auditEvents();
    expect(audit.length).toBe(before + 1);
    expect(audit.at(-1)!.reason).toBe('ROLE_MISMATCH');
    expect(audit.at(-1)!.resourceRef).toBe('cert-defer');
  });

  it('неизвестный или не-ORDER сервис — null без записи', async () => {
    expect(await createWizardRequest(db, studentCtx, { ...input, serviceId: 'нет-такого' })).toBeNull();
    expect(await createWizardRequest(db, studentCtx, { ...input, serviceId: 'transcript-instant' })).toBeNull();
  });
});
