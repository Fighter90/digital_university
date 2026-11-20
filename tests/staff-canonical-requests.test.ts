// DIG-126 — канонические заявки (ЗД-…) в кабинете сотрудника: интеграция
// слоёв DIG-30 ↔ DIG-48 (дефект D1 из FINDINGS-108).
//
// Контракт:
//  • порт listCanonicalRequestsByFaculty + сервис listCanonicalRequestsForStaff —
//    сотрудник видит канонические заявки ТОЛЬКО студентов своего факультета
//    (чужой факультет и «нет такой» неразличимы, попытка — в аудите);
//  • единая очередь getStaffQueueUnified — легаси (ЗС/SR-…) и канон (ЗД-…)
//    сосуществуют, у канона SLA-дедлайн из etaDays типа (РАБОЧИЕ дни);
//  • карточка getStaffCanonicalRequestDetail — данные канона сотруднику
//    факультета владельца, чужой номер — тот же null (404 без оракула);
//  • переходы staffTransitionCanonicalRequest / takeCanonicalRequestInProgress —
//    только легальные переходы машины DIG-30 с проверкой факультета;
//    «Взять в работу» из SUBMITTED — легальная цепочка
//    SUBMITTED → ACCEPTED → IN_PROGRESS (два события, уведомления);
//  • сквозной сценарий: студент подал через createCanonicalRequest →
//    сотрудник видит в очереди → «Взять в работу» → студент видит «В работе».
//
// Red-first: до реализации тест падает на отсутствии функций слоя.
import { beforeAll, describe, expect, it } from 'vitest';
import { createMemoryDataDb, type MemoryDataDb } from '@/server/data/memory-db';
import { seedDemoData } from '@/server/data/demo-seed';
import {
  listCanonicalRequestsForStaff,
  getCanonicalRequestByNumber,
  createCanonicalRequest,
  staffTransitionCanonicalRequest,
  takeCanonicalRequestInProgress,
} from '@/server/data/canonical-requests';
import {
  getStaffQueueUnified,
  getStaffCanonicalRequestDetail,
} from '@/server/data/staff-workflow';
import { listCanonicalRequestsByStudent } from '@/server/data/canonical-requests';
import { slaReadyDate } from '@/lib/request-sla';
import type { CanonicalRequestTypeRow, DataCtx, StudentRow } from '@/server/data/types';

const stubAuthStore = { selection: { kind: 'memory', store: {}, rateLimiter: {} } } as never;

// Пятница 06.11.2026 10:00 UTC — etaDays считаются рабочими днями:
// «пятница + 1» обязана дать понедельник, не субботу/воскресенье.
const FRIDAY = new Date('2026-11-06T10:00:00.000Z');
const NOW = new Date('2026-11-13T12:00:00.000Z');

const diplomaType: CanonicalRequestTypeRow = {
  id: 'crt-diploma',
  code: 'DIPLOMA_COPY',
  name: 'Дубликат диплома',
  etaDays: 1,
  format: 'PAPER',
  isInstant: false,
  formSchema: {
    keyField: 'reason',
    fields: [{ key: 'reason', label: 'Причина', type: 'text', required: true, maxLength: 200 }],
  },
};

const scholarshipType: CanonicalRequestTypeRow = {
  id: 'crt-scholarship',
  code: 'SCHOLARSHIP_CERT',
  name: 'Справка о размере стипендии',
  etaDays: 2,
  format: 'ELECTRONIC',
  isInstant: false,
  formSchema: {
    keyField: 'purpose',
    fields: [
      {
        key: 'purpose',
        label: 'Назначение',
        type: 'enum',
        required: true,
        options: ['для банка', 'для соцзащиты'],
      },
    ],
  },
};

function studentRow(
  id: string,
  login: string,
  fullName: string,
  faculty: string,
  group: string,
): StudentRow {
  return {
    id,
    login,
    fullName,
    email: `${login}@example.edu`,
    groupName: group,
    course: 2,
    faculty,
    program: 'Прикладная информатика',
    programCode: '09.03.04',
    studyForm: 'очная',
    funding: 'бюджет',
    gradebookNumber: '20231234',
  };
}

let db: MemoryDataDb;
let maria: DataCtx; // STAFF факультета «ИТ»
let anna: DataCtx; // студент «ИТ» (владелец)
const ANNA_ROW = studentRow('st-anna', 'anna', 'Анна Смирнова', 'ИТ', 'ПИ-21');
const ILYA_ROW = studentRow('st-ilya', 'ilya', 'Илья Петров', 'ЭК', 'ЭК-11');

beforeAll(async () => {
  db = createMemoryDataDb();
  db.seed({
    students: [ANNA_ROW, ILYA_ROW],
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
    canonicalRequestTypes: [diplomaType, scholarshipType],
    canonicalRequests: [
      {
        id: 'creq-anna-1',
        number: 'ЗД-2026-000002',
        studentId: 'st-anna',
        typeCode: 'DIPLOMA_COPY',
        typeName: 'Дубликат диплома',
        title: 'Дубликат диплома · утрата оригинала',
        params: { reason: 'утрата оригинала' },
        status: 'SUBMITTED',
        createdAt: FRIDAY,
        updatedAt: FRIDAY,
      },
      {
        id: 'creq-ilya-1',
        number: 'ЗД-2026-000004',
        studentId: 'st-ilya',
        typeCode: 'DIPLOMA_COPY',
        typeName: 'Дубликат диплома',
        title: 'Дубликат диплома · повреждение оригинала',
        params: { reason: 'повреждение оригинала' },
        status: 'SUBMITTED',
        createdAt: FRIDAY,
        updatedAt: FRIDAY,
      },
    ],
    canonicalRequestEvents: [
      {
        id: 'cev-anna-1',
        requestId: 'creq-anna-1',
        actorUserId: 'auth-anna',
        actorRole: 'STUDENT',
        actorName: 'Анна Смирнова',
        fromStatus: null,
        toStatus: 'SUBMITTED',
        comment: null,
        createdAt: FRIDAY,
      },
      {
        id: 'cev-ilya-1',
        requestId: 'creq-ilya-1',
        actorUserId: 'auth-ilya',
        actorRole: 'STUDENT',
        actorName: 'Илья Петров',
        fromStatus: null,
        toStatus: 'SUBMITTED',
        comment: null,
        createdAt: FRIDAY,
      },
    ],
  });
  maria = {
    userId: 'auth-maria',
    login: 'maria',
    role: 'STAFF',
    studentId: null,
    groupName: null,
    faculty: 'ИТ',
  };
  anna = {
    userId: 'auth-anna',
    login: 'anna',
    role: 'STUDENT',
    studentId: 'st-anna',
    groupName: 'ПИ-21',
    faculty: 'ИТ',
  };
});

const canonicalRowOf = (items: Awaited<ReturnType<typeof getStaffQueueUnified>>, number: string) =>
  items.find((item) => item.request.number === number)?.request ?? null;

// ── порт + сервис: канон в очереди сотрудника ────────────────────────────────

describe('listCanonicalRequestsForStaff — owner-scope канона (DIG-126)', () => {
  it('сотрудник факультета «ИТ» видит канон только своих студентов', async () => {
    const rows = await listCanonicalRequestsForStaff(db, maria);
    expect(rows.map((r) => r.number)).toEqual(['ЗД-2026-000002']);
  });

  it('студенту канон-очередь недоступна: [] + аудит ROLE_MISMATCH', async () => {
    const rows = await listCanonicalRequestsForStaff(db, anna);
    expect(rows).toEqual([]);
    const denied = db.auditEvents().at(-1);
    expect(denied?.resourceType).toBe('canonical-request');
    expect(denied?.reason).toBe('ROLE_MISMATCH');
  });
});

describe('getStaffQueueUnified — легаси и канон в одной очереди', () => {
  it('канон-строка ЗД-… рядом с легаси, SLA-дедлайн из etaDays РАБОЧИМИ днями', async () => {
    const items = await getStaffQueueUnified(db, maria);
    const canonical = canonicalRowOf(items, 'ЗД-2026-000002');
    expect(canonical).not.toBeNull();
    expect(canonical!.kind).toBe('canonical');
    expect(canonical!.status).toBe('SUBMITTED');
    expect(canonical!.typeCode).toBe('DIPLOMA_COPY');
    expect(canonical!.title).toBe('Дубликат диплома · утрата оригинала');
    // Пятница + 1 рабочий день = понедельник (выходные пропущены).
    expect(canonical!.slaDeadline.getTime()).toBe(slaReadyDate(FRIDAY, 1)!.getTime());
    expect(canonical!.slaDeadline.getDay()).toBe(1);
    // Владелец в элементе очереди — студент факультета.
    const item = items.find((i) => i.request.number === 'ЗД-2026-000002')!;
    expect(item.student.fullName).toBe('Анна Смирнова');
  });

  it('чужой факультет: канон Ильи (ЭК) в очереди «ИТ» отсутствует', async () => {
    const items = await getStaffQueueUnified(db, maria);
    expect(items.find((i) => i.request.number === 'ЗД-2026-000004')).toBeUndefined();
    expect(items.every((i) => i.student.faculty === 'ИТ')).toBe(true);
  });

  it('студент очередь сотрудника не получает ([] + аудит)', async () => {
    const items = await getStaffQueueUnified(db, anna);
    expect(items).toEqual([]);
    expect(db.auditEvents().at(-1)?.reason).toBe('ROLE_MISMATCH');
  });
});

// ── карточка канона сотрудника ───────────────────────────────────────────────

describe('getStaffCanonicalRequestDetail — карточка ЗД-…', () => {
  it('сотрудник факультета владельца получает заявку, студента и историю', async () => {
    const detail = await getStaffCanonicalRequestDetail(db, maria, 'ЗД-2026-000002');
    expect(detail).not.toBeNull();
    expect(detail!.request.status).toBe('SUBMITTED');
    expect(detail!.student.id).toBe('st-anna');
    expect(detail!.events.length).toBeGreaterThanOrEqual(1);
    expect(detail!.type?.etaDays).toBe(1);
  });

  it('чужой факультет и несуществующий номер — одинаковый null (без оракула)', async () => {
    expect(await getStaffCanonicalRequestDetail(db, maria, 'ЗД-2026-999999')).toBeNull();
    expect(await getStaffCanonicalRequestDetail(db, maria, 'ЗД-2026-000004')).toBeNull();
    // Попытка чужого — в аудите как OUTSIDE_FACULTY (последняя запись).
    expect(db.auditEvents().at(-1)?.reason).toBe('OUTSIDE_FACULTY');
  });

  it('студенту карточка сотрудника недоступна (ROLE_MISMATCH + аудит)', async () => {
    expect(await getStaffCanonicalRequestDetail(db, anna, 'ЗД-2026-000002')).toBeNull();
    expect(db.auditEvents().at(-1)?.reason).toBe('ROLE_MISMATCH');
  });
});

// ── легальные переходы канона руками сотрудника ──────────────────────────────

describe('staffTransitionCanonicalRequest — машина состояний + owner-scope', () => {
  it('разрешённый переход SUBMITTED → ACCEPTED выполняется сотрудником факультета', async () => {
    const result = await staffTransitionCanonicalRequest(db, maria, {
      number: 'ЗД-2026-000002',
      to: 'ACCEPTED',
      comment: null,
      now: NOW,
    });
    expect(result.kind).toBe('ok');
    expect(result.kind === 'ok' && result.request.status).toBe('ACCEPTED');
  });

  it('перескок через цепочку запрещён (ACCEPTED → READY — INVALID_TRANSITION)', async () => {
    const result = await staffTransitionCanonicalRequest(db, maria, {
      number: 'ЗД-2026-000002',
      to: 'READY',
      comment: null,
      now: NOW,
    });
    expect(result.kind).toBe('error');
    expect(result.kind === 'error' && result.code).toBe('INVALID_TRANSITION');
  });

  it('«Нужна доработка» без причины отклоняется (REASON_REQUIRED)', async () => {
    const result = await staffTransitionCanonicalRequest(db, maria, {
      number: 'ЗД-2026-000002',
      to: 'NEEDS_FIX',
      comment: '   ',
      now: NOW,
    });
    expect(result.kind).toBe('error');
    expect(result.kind === 'error' && result.code).toBe('REASON_REQUIRED');
  });

  it('чужой факультет — NOT_FOUND без оракула, попытка в аудите', async () => {
    const result = await staffTransitionCanonicalRequest(db, maria, {
      number: 'ЗД-2026-000004',
      to: 'ACCEPTED',
      comment: null,
      now: NOW,
    });
    expect(result.kind).toBe('error');
    expect(result.kind === 'error' && result.code).toBe('NOT_FOUND');
    expect(db.auditEvents().at(-1)?.reason).toBe('OUTSIDE_FACULTY');
  });
});

// ── сквозной сценарий D1: подача → очередь → «Взять в работу» → «В работе» ───

describe('сквозной сценарий DIG-126 (createCanonicalRequest → staff → студент)', () => {
  it('подал через мастер → сотрудник видит в очереди → «Взять в работу» → студент видит «В работе»', async () => {
    // 1. Студент подаёт каноническую заявку через мастер (сервис DIG-30).
    const created = await createCanonicalRequest(db, anna, {
      typeCode: 'SCHOLARSHIP_CERT',
      params: { purpose: 'для банка' },
      now: NOW,
    });
    expect(created.kind).toBe('created');
    const number =
      created.kind === 'created'
        ? created.request.number
        : created.kind === 'duplicate'
          ? created.existing.number
          : undefined;
    expect(number).toMatch(/^ЗД-\d{4}-\d{6}$/);

    // 2. Сотрудник факультета видит её в единой очереди (ЗД-строка).
    const items = await getStaffQueueUnified(db, maria);
    const row = canonicalRowOf(items, number!);
    expect(row).not.toBeNull();
    expect(row!.status).toBe('SUBMITTED');

    // 3. «Взять в работу»: легальная цепочка SUBMITTED → ACCEPTED → IN_PROGRESS.
    const taken = await takeCanonicalRequestInProgress(db, maria, number!, { now: NOW });
    expect(taken.kind).toBe('ok');
    expect(taken.kind === 'ok' && taken.request.status).toBe('IN_PROGRESS');

    // Оба шага легальны и записаны в историю канона.
    const events = await db.listCanonicalRequestEvents(
      (await db.probeCanonicalRequestByNumber(number!))!.id,
    );
    const staffSteps = events.filter((e) => e.actorRole === 'STAFF').map((e) => e.toStatus);
    expect(staffSteps).toEqual(['ACCEPTED', 'IN_PROGRESS']);

    // 4. Студент видит «В работе» в своих заявках; уведомления приходят.
    const mine = await listCanonicalRequestsByStudent(db, anna);
    expect(mine.find((r) => r.number === number)!.status).toBe('IN_PROGRESS');

    // 5. Повторное «Взять в работу» — нельзя (NOT_ALLOWED), состояние цело.
    const again = await takeCanonicalRequestInProgress(db, maria, number!, { now: NOW });
    expect(again.kind).toBe('error');
    expect(again.kind === 'error' && again.code).toBe('NOT_ALLOWED');
  });

  it('«Взять в работу» на чужом факультете — NOT_FOUND + аудит', async () => {
    const result = await takeCanonicalRequestInProgress(db, maria, 'ЗД-2026-000004', { now: NOW });
    expect(result.kind).toBe('error');
    expect(result.kind === 'error' && result.code).toBe('NOT_FOUND');
    expect(db.auditEvents().at(-1)?.reason).toBe('OUTSIDE_FACULTY');
  });
});

// ── сид по умолчанию: демо-очередь сотрудника не пуста каноном ───────────────

describe('demo seed: канон в очереди сотрудника по умолчанию', () => {
  it('сотрудник «ИТ» видит канон-заявку в SUBMITTED без ручной подачи (D1 закрыт из коробки)', async () => {
    const seeded = createMemoryDataDb();
    await seedDemoData(seeded, stubAuthStore);
    const ctx: DataCtx = {
      userId: 'auth-dean',
      login: 'dean.kovaleva',
      role: 'STAFF',
      studentId: null,
      groupName: null,
      faculty: 'ИТ',
    };
    const items = await getStaffQueueUnified(seeded, ctx);
    const canonical = items.filter((i) => i.request.kind === 'canonical');
    expect(canonical.length).toBeGreaterThanOrEqual(1);
    expect(canonical.some((i) => i.request.status === 'SUBMITTED')).toBe(true);
    // Чужой факультет (ЭК — Илья) по-прежнему невидим.
    for (const item of canonical) {
      expect(item.student.faculty).toBe('ИТ');
    }
  });

  it('студент после подачи видит свою заявку через getCanonicalRequestByNumber', async () => {
    const seeded = createMemoryDataDb();
    await seedDemoData(seeded, stubAuthStore);
    const annaCtx: DataCtx = {
      userId: 'auth-anna',
      login: 'anna.smirnova',
      role: 'STUDENT',
      studentId: 'st-anna',
      groupName: 'ПИ-21',
      faculty: 'ИТ',
    };
    const own = await getCanonicalRequestByNumber(seeded, annaCtx, 'ЗД-2026-000002');
    expect(own?.status).toBe('SUBMITTED');
  });
});
