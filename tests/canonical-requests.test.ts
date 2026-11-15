// DIG-30 — серверная логика канонических заявок «Заявки и справки».
//
// Контракт: подача (номер ЗД-ГГГГ-NNNNNN, уникальность, название
// «тип · ключевой параметр», событие + уведомление), мгновенные типы
// (сразу READY), повторный заказ за 24 часа предлагает скачать готовую,
// переходы через машину состояний с проверкой прав и владения (IDOR:
// чужая заявка неотличима от несуществующей, отказ в аудите).
import { beforeEach, describe, expect, it } from 'vitest';
import { createMemoryDataDb, type MemoryDataDb } from '@/server/data/memory-db';
import { toDataCtx } from '@/server/data/context';
import type { DataCtx } from '@/server/data/types';
import {
  createCanonicalRequest,
  getCanonicalRequestByNumber,
  listCanonicalRequestEvents,
  listCanonicalRequestsByStudent,
  transitionCanonicalRequest,
} from '@/server/data/canonical-requests';
import { formatCanonicalRequestNumber } from '@/server/data/canonical-request-number';
import { formatReadyBy, slaReadyDate } from '@/lib/request-sla';
import type { CanonicalRequestTypeRow } from '@/server/data/types';

const NOW = new Date('2026-11-13T10:00:00'); // пятница
const LATER_1H = new Date(NOW.getTime() + 3600_000);
const LATER_25H = new Date(NOW.getTime() + 25 * 3600_000);

const TYPES: CanonicalRequestTypeRow[] = [
  {
    id: 'crt-cert',
    code: 'CERT_ENROLLMENT',
    name: 'Справка об обучении',
    etaDays: 1,
    format: 'ELECTRONIC',
    isInstant: true,
    formSchema: {
      keyField: 'purpose',
      fields: [
        {
          key: 'purpose',
          label: 'Назначение',
          type: 'enum',
          required: true,
          options: ['для банка', 'для военкомата', 'по месту требования'],
        },
      ],
    },
  },
  {
    id: 'crt-extract',
    code: 'GRADES_EXTRACT',
    name: 'Выписка оценок',
    etaDays: 1,
    format: 'ELECTRONIC',
    isInstant: true,
    formSchema: null,
  },
  {
    id: 'crt-diploma',
    code: 'DIPLOMA_COPY',
    name: 'Дубликат диплома',
    etaDays: 5,
    format: 'PAPER',
    isInstant: false,
    formSchema: {
      keyField: 'reason',
      fields: [{ key: 'reason', label: 'Причина', type: 'text', required: true }],
    },
  },
];

let db: MemoryDataDb;
let anna: DataCtx; // студент ИТ
let ilya: DataCtx; // студент ЭК
let maria: DataCtx; // сотрудник ИТ

beforeEach(async () => {
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
    canonicalRequestTypes: TYPES,
  });
  anna = (await toDataCtx({ id: 'auth-anna', login: 'anna', role: 'STUDENT' }, db))!;
  ilya = (await toDataCtx({ id: 'auth-ilya', login: 'ilya', role: 'STUDENT' }, db))!;
  maria = (await toDataCtx({ id: 'auth-maria', login: 'maria', role: 'STAFF' }, db))!;
});

const createDiploma = (ctx: DataCtx, now: Date) =>
  createCanonicalRequest(db, ctx, { typeCode: 'DIPLOMA_COPY', params: { reason: 'утрата' }, now });

describe('подача заявки (DIG-30)', () => {
  it('номер «ЗД-ГГГГ-NNNNNN», уникален, статус SUBMITTED, название «тип · ключевой параметр»', async () => {
    const first = await createDiploma(anna, NOW);
    const second = await createDiploma(anna, LATER_1H);
    expect(first.kind).toBe('created');
    if (first.kind !== 'created') return;

    expect(first.request.number).toBe(formatCanonicalRequestNumber(2026, 1));
    expect(first.request.number).toMatch(/^ЗД-2026-[0-9]{6}$/);
    expect(first.request.status).toBe('SUBMITTED');
    expect(first.request.title).toBe('Дубликат диплома · утрата');
    expect(first.request.params).toEqual({ reason: 'утрата' });

    expect(second.kind).toBe('created');
    if (second.kind !== 'created') return;
    expect(second.request.number).toMatch(/^ЗД-2026-[0-9]{6}$/);
    expect(second.request.number).not.toBe(first.request.number); // уникальность
  });

  it('название заявки строится из типа и ключевого параметра', async () => {
    const cert = await createCanonicalRequest(db, anna, {
      typeCode: 'CERT_ENROLLMENT',
      params: { purpose: 'для банка' },
      now: NOW,
    });
    expect(cert.kind).toBe('created');
    if (cert.kind !== 'created') return;
    expect(cert.request.title).toBe('Справка об обучении · для банка');

    const extract = await createCanonicalRequest(db, anna, {
      typeCode: 'GRADES_EXTRACT',
      params: {},
      now: NOW,
    });
    if (extract.kind !== 'created') return expect.fail('extract created');
    expect(extract.request.title).toBe('Выписка оценок');
  });

  it('каждая подача пишет RequestEvent «Подана» и уведомление с датой по SLA (рабочие дни)', async () => {
    const result = await createDiploma(anna, NOW);
    expect(result.kind).toBe('created');
    if (result.kind !== 'created') return;

    const events = await listCanonicalRequestEvents(db, anna, result.request.id);
    expect(events).not.toBeNull();
    expect(events).toHaveLength(1);
    const created = events![0]!;
    expect(created.toStatus).toBe('SUBMITTED');
    expect(created.fromStatus).toBeNull();
    expect(created.actorRole).toBe('STUDENT');
    expect(created.actorName).toBe('Анна Ковалёва');

    const notifications = await db.listNotificationsByStudent('st-anna');
    expect(notifications).toHaveLength(1);
    expect(notifications[0]!.type).toBe('REQUEST');
    expect(notifications[0]!.title).toBe(`Заявка ${result.request.number}`);
    const readyBy = formatReadyBy(slaReadyDate(NOW, 5)!); // пт +5 рабочих → пт 20
    expect(notifications[0]!.body).toContain('Дубликат диплома · утрата');
    expect(notifications[0]!.body).toContain(readyBy);
    expect(readyBy).toBe('20 ноября'); // выходные 14–15 ноября пропущены
  });

  it('мгновенный тип сразу READY + событие «Документ сформирован» + уведомление о скачивании', async () => {
    const result = await createCanonicalRequest(db, anna, {
      typeCode: 'CERT_ENROLLMENT',
      params: { purpose: 'для военкомата' },
      now: NOW,
    });
    expect(result.kind).toBe('created');
    if (result.kind !== 'created') return;
    expect(result.request.status).toBe('READY');

    const events = await listCanonicalRequestEvents(db, anna, result.request.id);
    expect(events).toHaveLength(1);
    expect(events![0]!.toStatus).toBe('READY');

    const [notification] = await db.listNotificationsByStudent('st-anna');
    expect(notification!.body).toContain('Справка об обучении · для военкомата');
    expect(notification!.body.toLowerCase()).toContain('скачивани');
  });

  it('форма валидируется: неизвестный тип и битая форма отклоняются без создания заявки', async () => {
    const unknown = await createCanonicalRequest(db, anna, {
      typeCode: 'NO_SUCH_TYPE',
      params: {},
      now: NOW,
    });
    expect(unknown.kind).toBe('error');
    if (unknown.kind === 'error') expect(unknown.code).toBe('UNKNOWN_TYPE');

    const invalid = await createCanonicalRequest(db, anna, {
      typeCode: 'CERT_ENROLLMENT',
      params: { purpose: 'для шпионажа' },
      now: NOW,
    });
    expect(invalid.kind).toBe('error');
    if (invalid.kind === 'error') {
      expect(invalid.code).toBe('INVALID_FORM');
      expect(invalid.message).toContain('Назначение');
    }
    expect(await listCanonicalRequestsByStudent(db, anna)).toHaveLength(0);
  });

  it('сотрудник подать заявку не может (ROLE_MISMATCH + аудит)', async () => {
    const result = await createDiploma(maria, NOW);
    expect(result.kind).toBe('error');
    if (result.kind === 'error') expect(result.code).toBe('ROLE_MISMATCH');
    expect(db.auditEvents().some((e) => e.reason === 'ROLE_MISMATCH')).toBe(true);
  });
});

describe('повторный заказ за 24 часа (приёмка DIG-30)', () => {
  it('готовая справка того же типа за 24 ч → duplicate с номером готовой, дубль не создаётся', async () => {
    const first = await createCanonicalRequest(db, anna, {
      typeCode: 'CERT_ENROLLMENT',
      params: { purpose: 'для банка' },
      now: NOW,
    });
    expect(first.kind).toBe('created');

    const again = await createCanonicalRequest(db, anna, {
      typeCode: 'CERT_ENROLLMENT',
      params: { purpose: 'для банка' },
      now: LATER_1H,
    });
    expect(again.kind).toBe('duplicate');
    if (again.kind !== 'duplicate') return;
    expect(again.existing.number).toBe((first as { request: { number: string } }).request.number);
    expect(again.title).toBe('Справка об обучении · для банка');
    // Уведомлений и заявок не прибавилось.
    expect(await listCanonicalRequestsByStudent(db, anna)).toHaveLength(1);
    expect(await db.listNotificationsByStudent('st-anna')).toHaveLength(1);
  });

  it('ISSUED тоже считается готовой (документ существует)', async () => {
    const first = await createCanonicalRequest(db, anna, {
      typeCode: 'GRADES_EXTRACT',
      params: {},
      now: NOW,
    });
    if (first.kind !== 'created') return expect.fail('created');
    await transitionCanonicalRequest(db, maria, {
      requestId: first.request.id,
      to: 'ISSUED',
      now: LATER_1H,
    });
    const again = await createCanonicalRequest(db, anna, {
      typeCode: 'GRADES_EXTRACT',
      params: {},
      now: LATER_1H,
    });
    expect(again.kind).toBe('duplicate');
  });

  it('после 24 часов заказ проходит (created)', async () => {
    const first = await createCanonicalRequest(db, anna, {
      typeCode: 'CERT_ENROLLMENT',
      params: { purpose: 'для банка' },
      now: NOW,
    });
    expect(first.kind).toBe('created');
    const again = await createCanonicalRequest(db, anna, {
      typeCode: 'CERT_ENROLLMENT',
      params: { purpose: 'для банка' },
      now: LATER_25H,
    });
    expect(again.kind).toBe('created');
    expect(await listCanonicalRequestsByStudent(db, anna)).toHaveLength(2);
  });

  it('неготовая заявка того же типа не блокирует заказ', async () => {
    await createDiploma(anna, NOW);
    const second = await createDiploma(anna, LATER_1H);
    expect(second.kind).toBe('created');
  });

  it('чужая готовая справка другого студента не считается дубликатом', async () => {
    await createCanonicalRequest(db, ilya, {
      typeCode: 'CERT_ENROLLMENT',
      params: { purpose: 'для банка' },
      now: NOW,
    });
    const mine = await createCanonicalRequest(db, anna, {
      typeCode: 'CERT_ENROLLMENT',
      params: { purpose: 'для банка' },
      now: LATER_1H,
    });
    expect(mine.kind).toBe('created');
  });
});

describe('переходы через сервис: события и уведомления (DIG-30)', () => {
  it('полная цепочка сотрудником: событие на каждый переход + уведомление «Принята → В работе. Готовность до …»', async () => {
    const created = await createDiploma(anna, NOW);
    if (created.kind !== 'created') return expect.fail('created');
    const id = created.request.id;

    expect((await transitionCanonicalRequest(db, maria, { requestId: id, to: 'ACCEPTED', now: LATER_1H })).kind).toBe('ok');
    const step2 = await transitionCanonicalRequest(db, maria, { requestId: id, to: 'IN_PROGRESS', now: LATER_1H });
    expect(step2.kind).toBe('ok');

    const events = await listCanonicalRequestEvents(db, anna, id);
    expect(events).not.toBeNull();
    expect(events!.map((e) => `${e.fromStatus}→${e.toStatus}`)).toEqual([
      'null→SUBMITTED',
      'SUBMITTED→ACCEPTED',
      'ACCEPTED→IN_PROGRESS',
    ]);
    expect(events![2]!.actorRole).toBe('STAFF');
    expect(events![2]!.actorName).toBe('Мария Петрова');

    const notifications = await db.listNotificationsByStudent('st-anna');
    const progress = notifications.find((n) => n.body.includes('Принята → В работе'));
    expect(progress).toBeDefined();
    expect(progress!.title).toBe(`Заявка ${created.request.number}`);
    expect(progress!.body).toContain('Дубликат диплома · утрата');
    expect(progress!.body).toContain('Готовность до');
    expect(progress!.body).toContain(formatReadyBy(slaReadyDate(NOW, 5)!));
    expect(progress!.link).toBe('/requests');
  });

  it('READY → ISSUED финализирует заявку', async () => {
    const instant = await createCanonicalRequest(db, anna, {
      typeCode: 'GRADES_EXTRACT',
      params: {},
      now: NOW,
    });
    if (instant.kind !== 'created') return expect.fail('created');
    const issued = await transitionCanonicalRequest(db, maria, {
      requestId: instant.request.id,
      to: 'ISSUED',
      now: LATER_1H,
    });
    expect(issued.kind).toBe('ok');
    if (issued.kind === 'ok') expect(issued.request.status).toBe('ISSUED');
  });

  it('NEEDS_FIX требует причину: она попадает в событие и уведомление; студент возвращает в SUBMITTED', async () => {
    const created = await createDiploma(anna, NOW);
    if (created.kind !== 'created') return expect.fail('created');
    const id = created.request.id;

    const noReason = await transitionCanonicalRequest(db, maria, {
      requestId: id,
      to: 'NEEDS_FIX',
      comment: '   ',
      now: LATER_1H,
    });
    expect(noReason.kind).toBe('error');
    if (noReason.kind === 'error') expect(noReason.code).toBe('REASON_REQUIRED');

    const withReason = await transitionCanonicalRequest(db, maria, {
      requestId: id,
      to: 'NEEDS_FIX',
      comment: 'Не хватает подписи на заявлении',
      now: LATER_1H,
    });
    expect(withReason.kind).toBe('ok');
    if (withReason.kind === 'ok') expect(withReason.request.status).toBe('NEEDS_FIX');

    const events = await listCanonicalRequestEvents(db, anna, id);
    expect(events!.at(-1)!.comment).toBe('Не хватает подписи на заявлении');
    const [notification] = await db.listNotificationsByStudent('st-anna').then((list) => list.slice(-1));
    expect(notification!.body).toContain('Причина: Не хватает подписи на заявлении');

    const resubmitted = await transitionCanonicalRequest(db, anna, {
      requestId: id,
      to: 'SUBMITTED',
      now: LATER_1H,
    });
    expect(resubmitted.kind).toBe('ok');
    if (resubmitted.kind === 'ok') expect(resubmitted.request.status).toBe('SUBMITTED');
  });
});

describe('права и владение (IDOR, DIG-30)', () => {
  it('студент не может перевести заявку в READY — запрещено, статус не меняется', async () => {
    const created = await createDiploma(anna, NOW);
    if (created.kind !== 'created') return expect.fail('created');

    // Заявку сначала доводим до IN_PROGRESS (сотрудник), чтобы пара
    // «→ READY» существовала в таблице — и всё равно студенту отказано
    // по роли (FORBIDDEN, а не «недопустимый переход»).
    await transitionCanonicalRequest(db, maria, { requestId: created.request.id, to: 'ACCEPTED', now: LATER_1H });
    await transitionCanonicalRequest(db, maria, { requestId: created.request.id, to: 'IN_PROGRESS', now: LATER_1H });

    const result = await transitionCanonicalRequest(db, anna, {
      requestId: created.request.id,
      to: 'READY',
      now: LATER_1H,
    });
    expect(result.kind).toBe('error');
    if (result.kind === 'error') expect(result.code).toBe('FORBIDDEN');

    const events = await listCanonicalRequestEvents(db, anna, created.request.id);
    expect(events).toHaveLength(3); // подана, принята, в работе — READY не добавился
    const after = await getCanonicalRequestByNumber(db, anna, created.request.number);
    expect(after!.status).toBe('IN_PROGRESS');
  });

  it('студент не может выполнить сотруднические переходы (ACCEPTED и др.)', async () => {
    const created = await createDiploma(anna, NOW);
    if (created.kind !== 'created') return expect.fail('created');
    for (const to of ['ACCEPTED', 'NEEDS_FIX', 'REJECTED'] as const) {
      const result = await transitionCanonicalRequest(db, anna, {
        requestId: created.request.id,
        to,
        comment: 'причина',
        now: LATER_1H,
      });
      expect(result.kind, to).toBe('error');
      if (result.kind === 'error') expect(result.code).toBe('FORBIDDEN');
    }
  });

  it('сотрудник не может отменить заявку и вернуть её в SUBMITTED', async () => {
    const created = await createDiploma(anna, NOW);
    if (created.kind !== 'created') return expect.fail('created');
    const cancel = await transitionCanonicalRequest(db, maria, {
      requestId: created.request.id,
      to: 'CANCELLED',
      now: LATER_1H,
    });
    expect(cancel.kind).toBe('error');
    if (cancel.kind === 'error') expect(cancel.code).toBe('FORBIDDEN');
  });

  it('недопустимый переход отклоняется ошибкой (приёмка DIG-30)', async () => {
    const created = await createDiploma(anna, NOW);
    if (created.kind !== 'created') return expect.fail('created');
    const jump = await transitionCanonicalRequest(db, maria, {
      requestId: created.request.id,
      to: 'READY',
      now: LATER_1H,
    });
    expect(jump.kind).toBe('error');
    if (jump.kind === 'error') expect(jump.code).toBe('INVALID_TRANSITION');
    expect(await listCanonicalRequestEvents(db, anna, created.request.id)).toHaveLength(1);
  });

  it('чужая заявка неотличима от несуществующей: NOT_FOUND + аудит OWNERSHIP_DENIED', async () => {
    const annaRequest = await createDiploma(anna, NOW);
    if (annaRequest.kind !== 'created') return expect.fail('created');

    const foreign = await transitionCanonicalRequest(db, ilya, {
      requestId: annaRequest.request.id,
      to: 'CANCELLED',
      now: LATER_1H,
    });
    expect(foreign.kind).toBe('error');
    if (foreign.kind === 'error') expect(foreign.code).toBe('NOT_FOUND');

    const missing = await transitionCanonicalRequest(db, ilya, {
      requestId: 'creq-ghost',
      to: 'CANCELLED',
      now: LATER_1H,
    });
    expect(missing.kind).toBe('error');
    if (missing.kind === 'error') expect(missing.code).toBe('NOT_FOUND');

    expect(await getCanonicalRequestByNumber(db, ilya, annaRequest.request.number)).toBeNull();
    expect(await getCanonicalRequestByNumber(db, anna, 'ЗД-2026-999999')).toBeNull();

    const audit = db.auditEvents();
    expect(audit.some((e) => e.reason === 'OWNERSHIP_DENIED' && e.resourceRef === annaRequest.request.id)).toBe(true);
    expect(audit.some((e) => e.reason === 'NOT_FOUND' && e.resourceRef === 'ЗД-2026-999999')).toBe(true);
    // Уведомления Анны никто не тронул.
    expect(await db.listNotificationsByStudent('st-anna')).toHaveLength(1);
  });

  it('сотрудник чужого факультета получает NOT_FOUND + OUTSIDE_FACULTY', async () => {
    const ilyaRequest = await createDiploma(ilya, NOW);
    if (ilyaRequest.kind !== 'created') return expect.fail('created');
    const result = await transitionCanonicalRequest(db, maria, {
      requestId: ilyaRequest.request.id,
      to: 'ACCEPTED',
      now: LATER_1H,
    });
    expect(result.kind).toBe('error');
    if (result.kind === 'error') expect(result.code).toBe('NOT_FOUND');
    expect(db.auditEvents().some((e) => e.reason === 'OUTSIDE_FACULTY')).toBe(true);
  });

  it('отмена студентом работает до IN_PROGRESS и запрещена после', async () => {
    const a = await createDiploma(anna, NOW);
    if (a.kind !== 'created') return expect.fail('created');
    const cancelled = await transitionCanonicalRequest(db, anna, {
      requestId: a.request.id,
      to: 'CANCELLED',
      now: LATER_1H,
    });
    expect(cancelled.kind).toBe('ok');
    if (cancelled.kind === 'ok') expect(cancelled.request.status).toBe('CANCELLED');

    const b = await createDiploma(anna, LATER_1H);
    if (b.kind !== 'created') return expect.fail('created b');
    await transitionCanonicalRequest(db, maria, { requestId: b.request.id, to: 'ACCEPTED', now: LATER_1H });
    const cancelledAccepted = await transitionCanonicalRequest(db, anna, {
      requestId: b.request.id,
      to: 'CANCELLED',
      now: LATER_1H,
    });
    expect(cancelledAccepted.kind).toBe('ok');

    const c = await createDiploma(anna, LATER_1H);
    if (c.kind !== 'created') return expect.fail('created c');
    await transitionCanonicalRequest(db, maria, { requestId: c.request.id, to: 'ACCEPTED', now: LATER_1H });
    await transitionCanonicalRequest(db, maria, { requestId: c.request.id, to: 'IN_PROGRESS', now: LATER_1H });
    const late = await transitionCanonicalRequest(db, anna, {
      requestId: c.request.id,
      to: 'CANCELLED',
      now: LATER_1H,
    });
    expect(late.kind).toBe('error');
  });
});

describe('чтение канонических заявок (DIG-30)', () => {
  it('список — только свои; сотруднику пусто с аудитом', async () => {
    await createDiploma(anna, NOW);
    await createCanonicalRequest(db, ilya, {
      typeCode: 'CERT_ENROLLMENT',
      params: { purpose: 'для банка' },
      now: NOW,
    });
    const annaList = await listCanonicalRequestsByStudent(db, anna);
    expect(annaList).toHaveLength(1);
    expect(annaList[0]!.studentId).toBe('st-anna');

    const staffList = await listCanonicalRequestsByStudent(db, maria);
    expect(staffList).toEqual([]);
    expect(db.auditEvents().some((e) => e.reason === 'ROLE_MISMATCH')).toBe(true);
  });

  it('история событий чужой заявки — null (uniform 404)', async () => {
    const annaRequest = await createDiploma(anna, NOW);
    if (annaRequest.kind !== 'created') return expect.fail('created');
    expect(await listCanonicalRequestEvents(db, ilya, annaRequest.request.id)).toBeNull();
    expect(await listCanonicalRequestEvents(db, anna, annaRequest.request.id)).not.toBeNull();
  });
});
