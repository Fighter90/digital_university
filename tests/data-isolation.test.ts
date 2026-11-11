// DIG-12 — data-isolation contract (IDOR defence).
//
// Every public function of src/server/data/* receives a `DataCtx` produced
// from requireUser()'s session and scopes ALL reads/writes to that context:
// a STUDENT only ever reaches rows owned by ctx.studentId, a STAFF member
// only reaches students of ctx.faculty. A foreign object and a missing
// object MUST be indistinguishable from the outside (both → null → 404),
// while every foreign attempt is recorded in the audit log.
import { beforeAll, describe, expect, it } from 'vitest';
import { createMemoryDataDb, type MemoryDataDb } from '@/server/data/memory-db';
import { toDataCtx } from '@/server/data/context';
import { listRequests, getRequestByNumber, listRequestEvents } from '@/server/data/requests';
import { listGrades } from '@/server/data/grades';
import { listNotifications, markNotificationRead } from '@/server/data/notifications';
import { listAppeals, getAppeal, listAppealMessages } from '@/server/data/appeals';
import { listSchedule, listExams } from '@/server/data/schedule';
import { listFacultyStudents, getFacultyStudent } from '@/server/data/staff';
import { denyAccess } from '@/server/data/access';
import { uniformNotFoundResponse } from '@/server/data/http';
import {
  isValidRequestNumber,
  newRequestNumber,
  normalizeRequestNumber,
} from '@/server/data/request-number';
import type { DataCtx } from '@/server/data/types';

const T0 = new Date('2026-11-01T10:00:00.000Z');
const T1 = new Date('2026-11-02T10:00:00.000Z');

let db: MemoryDataDb;
let anna: DataCtx;
let ilya: DataCtx;
let maria: DataCtx; // staff, faculty «ИТ»

const ANNA_REQUEST_NUMBER = 'SR-2026-A1B2C';
const ILYA_REQUEST_NUMBER = 'SR-2026-Z9Y8X';
const ANNA_REQUEST_ID = 'req-anna-1';
const ILYA_REQUEST_ID = 'req-ilya-1';
const ILYA_NOTIFICATION_ID = 'ntf-ilya-1';
const ILYA_APPEAL_ID = 'apl-ilya-1';
const ILYA_STUDENT_ID = 'st-ilya';

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
        studyForm: 'очная',
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
        studyForm: 'очная',
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
    requests: [
      {
        id: ANNA_REQUEST_ID,
        studentId: 'st-anna',
        number: ANNA_REQUEST_NUMBER,
        type: 'CERTIFICATE',
        title: 'Справка об обучении',
        status: 'COMPLETED',
        assignee: 'Мария Петрова',
        resultNote: 'Готова к выдаче',
        createdAt: T0,
        updatedAt: T1,
      },
      {
        id: ILYA_REQUEST_ID,
        studentId: 'st-ilya',
        number: ILYA_REQUEST_NUMBER,
        type: 'STATEMENT',
        title: 'Заявление на академотпуск',
        status: 'SUBMITTED',
        assignee: null,
        resultNote: null,
        createdAt: T0,
        updatedAt: T0,
      },
    ],
    requestEvents: [
      {
        id: 'evt-anna-1',
        requestId: ANNA_REQUEST_ID,
        actorRole: 'STUDENT',
        actorName: 'Анна Ковалёва',
        statusFrom: null,
        statusTo: 'SUBMITTED',
        message: 'Заявка подана',
        createdAt: T0,
      },
      {
        id: 'evt-ilya-1',
        requestId: ILYA_REQUEST_ID,
        actorRole: 'STUDENT',
        actorName: 'Илья Смирнов',
        statusFrom: null,
        statusTo: 'SUBMITTED',
        message: 'Заявка подана',
        createdAt: T0,
      },
    ],
    grades: [
      {
        id: 'grd-anna-1',
        studentId: 'st-anna',
        elementCode: 'PI21-INFO-TEST1',
        elementName: 'Тест 1',
        disciplineCode: 'INFO-1',
        disciplineName: 'Информатика',
        score: 88,
        maxScore: 100,
        weight: 0.3,
        kind: 'TEST',
        gradedAt: T0,
        comment: null,
      },
      {
        id: 'grd-ilya-1',
        studentId: 'st-ilya',
        elementCode: 'EK11-MATH-EXAM',
        elementName: 'Экзамен',
        disciplineCode: 'MATH-1',
        disciplineName: 'Математика',
        score: 74,
        maxScore: 100,
        weight: 0.6,
        kind: 'EXAM',
        gradedAt: T0,
        comment: null,
      },
    ],
    notifications: [
      {
        id: 'ntf-anna-1',
        studentId: 'st-anna',
        type: 'REQUEST',
        title: 'Справка готова',
        body: 'Справка об обучении готова к выдаче.',
        isRead: false,
        createdAt: T0,
      },
      {
        id: ILYA_NOTIFICATION_ID,
        studentId: 'st-ilya',
        type: 'SCHEDULE',
        title: 'Пара перенесена',
        body: 'Занятие по математике перенесено.',
        isRead: false,
        createdAt: T0,
      },
    ],
    appeals: [
      {
        id: 'apl-anna-1',
        studentId: 'st-anna',
        subject: 'Вопрос по зачёту',
        status: 'OPEN',
        createdAt: T0,
      },
      {
        id: ILYA_APPEAL_ID,
        studentId: 'st-ilya',
        subject: 'Пересдача',
        status: 'ANSWERED',
        createdAt: T0,
      },
    ],
    appealMessages: [
      {
        id: 'msg-ilya-1',
        appealId: ILYA_APPEAL_ID,
        authorRole: 'STUDENT',
        authorName: 'Илья Смирнов',
        body: 'Прошу назначить пересдачу.',
        createdAt: T0,
      },
    ],
    schedule: [
      {
        id: 'sch-pi21-1',
        groupName: 'ПИ-21',
        disciplineCode: 'INFO-1',
        disciplineName: 'Информатика',
        date: T0,
        startsAt: T0,
        endsAt: T1,
        kind: 'LECTURE',
        room: '301',
        teacherName: 'Петров П. П.',
        status: 'SCHEDULED',
        note: null,
      },
      {
        id: 'sch-ek11-1',
        groupName: 'ЭК-11',
        disciplineCode: 'MATH-1',
        disciplineName: 'Математика',
        date: T0,
        startsAt: T0,
        endsAt: T1,
        kind: 'PRACTICE',
        room: '12',
        teacherName: 'Сидорова С. С.',
        status: 'SCHEDULED',
        note: null,
      },
    ],
    exams: [
      {
        id: 'exm-pi21-1',
        groupName: 'ПИ-21',
        disciplineCode: 'INFO-1',
        disciplineName: 'Информатика',
        kind: 'EXAM',
        date: T1,
        startsAt: T1,
        room: '301',
        note: null,
      },
      {
        id: 'exm-ek11-1',
        groupName: 'ЭК-11',
        disciplineCode: 'MATH-1',
        disciplineName: 'Математика',
        kind: 'CREDIT',
        date: T1,
        startsAt: T1,
        room: '12',
        note: null,
      },
    ],
  });

  anna = (await toDataCtx({ id: 'auth-anna', login: 'anna', role: 'STUDENT' }, db))!;
  ilya = (await toDataCtx({ id: 'auth-ilya', login: 'ilya', role: 'STUDENT' }, db))!;
  maria = (await toDataCtx({ id: 'auth-maria', login: 'maria', role: 'STAFF' }, db))!;

  expect(anna).not.toBeNull();
  expect(ilya).not.toBeNull();
  expect(maria).not.toBeNull();
});

const lastAudit = () => db.auditEvents().at(-1);

describe('DataCtx mapping (context.ts)', () => {
  it('student ctx carries studentId and own group only', () => {
    expect(anna.studentId).toBe('st-anna');
    expect(anna.groupName).toBe('ПИ-21');
    expect(anna.faculty).toBe('ИТ');
    expect(anna.role).toBe('STUDENT');
  });

  it('staff ctx carries faculty scope but no studentId', () => {
    expect(maria.faculty).toBe('ИТ');
    expect(maria.studentId).toBeNull();
    expect(maria.groupName).toBeNull();
  });

  it('unknown login → null (fail closed)', async () => {
    expect(await toDataCtx({ id: 'x', login: 'ghost', role: 'STUDENT' }, db)).toBeNull();
  });

  it('student without a profile row → null (fail closed)', async () => {
    expect(await toDataCtx({ id: 'x', login: 'nobody', role: 'STUDENT' }, db)).toBeNull();
  });

  it('staff without a profile row → null (fail closed)', async () => {
    expect(await toDataCtx({ id: 'x', login: 'ghost-staff', role: 'STAFF' }, db)).toBeNull();
  });
});

describe('requests.ts — foreign request number is indistinguishable from missing', () => {
  it('Anna does NOT get Ilya’s request by number', async () => {
    expect(await getRequestByNumber(db, anna, ILYA_REQUEST_NUMBER)).toBeNull();
    expect(await getRequestByNumber(db, ilya, ANNA_REQUEST_NUMBER)).toBeNull();
  });

  it('non-existent number returns the same null as a foreign one (no existence oracle)', async () => {
    const missing = await getRequestByNumber(db, anna, 'SR-2026-XXXXX');
    expect(missing).toBeNull();
  });

  it('own request is returned with full details', async () => {
    const own = await getRequestByNumber(db, anna, ANNA_REQUEST_NUMBER);
    expect(own?.id).toBe(ANNA_REQUEST_ID);
    expect(own?.title).toBe('Справка об обучении');
  });

  it('foreign attempt is audited with OWNERSHIP_DENIED', async () => {
    db.auditEvents().length = 0;
    await getRequestByNumber(db, anna, ILYA_REQUEST_NUMBER);
    const event = lastAudit();
    expect(event?.outcome).toBe('DENIED');
    expect(event?.reason).toBe('OWNERSHIP_DENIED');
    expect(event?.actorLogin).toBe('anna');
    expect(event?.resourceType).toBe('request');
    expect(event?.resourceRef).toBe(ILYA_REQUEST_NUMBER);
  });

  it('missing attempt is audited with NOT_FOUND', async () => {
    await getRequestByNumber(db, anna, 'SR-2026-XXXXX');
    expect(lastAudit()?.reason).toBe('NOT_FOUND');
  });

  it('staff ctx cannot pull a student request via student functions', async () => {
    db.auditEvents().length = 0;
    expect(await getRequestByNumber(db, maria, ANNA_REQUEST_NUMBER)).toBeNull();
    expect(lastAudit()?.reason).toBe('ROLE_MISMATCH');
  });

  it('listRequests returns only own rows', async () => {
    const annaList = await listRequests(db, anna);
    expect(annaList.map((r) => r.studentId)).toEqual(['st-anna']);
    const ilyaList = await listRequests(db, ilya);
    expect(ilyaList.map((r) => r.studentId)).toEqual(['st-ilya']);
  });

  it('listRequestEvents refuses a foreign request id (cuid probing)', async () => {
    expect(await listRequestEvents(db, anna, ILYA_REQUEST_ID)).toBeNull();
    expect((await listRequestEvents(db, anna, ANNA_REQUEST_ID))?.length).toBe(1);
    expect(lastAudit()?.reason).toBe('OWNERSHIP_DENIED');
  });
});

describe('grades.ts — scope by owner', () => {
  it('Anna sees only her grades', async () => {
    const rows = await listGrades(db, anna);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.studentId).toBe('st-anna');
  });

  it('Ilya sees only his grades', async () => {
    const rows = await listGrades(db, ilya);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.studentId).toBe('st-ilya');
  });

  it('staff ctx gets an empty list, not another student’s grades', async () => {
    db.auditEvents().length = 0;
    expect(await listGrades(db, maria)).toEqual([]);
    expect(lastAudit()?.reason).toBe('ROLE_MISMATCH');
  });
});

describe('notifications.ts — mutation also scoped', () => {
  it('listNotifications returns only own rows', async () => {
    const rows = await listNotifications(db, anna);
    expect(rows.map((n) => n.studentId)).toEqual(['st-anna']);
  });

  it('markNotificationRead refuses a foreign notification', async () => {
    db.auditEvents().length = 0;
    expect(await markNotificationRead(db, anna, ILYA_NOTIFICATION_ID)).toBe(false);
    expect(lastAudit()?.reason).toBe('OWNERSHIP_DENIED');
    const still = await listNotifications(db, ilya);
    expect(still.find((n) => n.id === ILYA_NOTIFICATION_ID)?.isRead).toBe(false);
  });

  it('markNotificationRead works for the owner', async () => {
    expect(await markNotificationRead(db, ilya, ILYA_NOTIFICATION_ID)).toBe(true);
    const rows = await listNotifications(db, ilya);
    expect(rows.find((n) => n.id === ILYA_NOTIFICATION_ID)?.isRead).toBe(true);
  });
});

describe('appeals.ts — cuid-based access stays scoped', () => {
  it('getAppeal returns null for a foreign cuid (same as for a missing one)', async () => {
    expect(await getAppeal(db, anna, ILYA_APPEAL_ID)).toBeNull();
    expect(await getAppeal(db, anna, 'apl-does-not-exist')).toBeNull();
  });

  it('getAppeal returns the own appeal', async () => {
    expect((await getAppeal(db, ilya, ILYA_APPEAL_ID))?.subject).toBe('Пересдача');
  });

  it('listAppealMessages refuses a foreign appeal', async () => {
    expect(await listAppealMessages(db, anna, ILYA_APPEAL_ID)).toBeNull();
    expect((await listAppealMessages(db, ilya, ILYA_APPEAL_ID))?.length).toBe(1);
  });

  it('listAppeals returns only own rows', async () => {
    expect((await listAppeals(db, anna)).map((a) => a.studentId)).toEqual(['st-anna']);
    expect((await listAppeals(db, ilya)).map((a) => a.studentId)).toEqual(['st-ilya']);
  });
});

describe('schedule.ts — own group only', () => {
  it('Anna sees only ПИ-21 events', async () => {
    const rows = await listSchedule(db, anna);
    expect(rows).toHaveLength(1);
    expect(rows.every((r) => r.groupName === 'ПИ-21')).toBe(true);
    expect(rows.map((r) => r.id)).not.toContain('sch-ek11-1');
  });

  it('listExams is also group-scoped', async () => {
    const rows = await listExams(db, anna);
    expect(rows).toHaveLength(1);
    expect(rows.every((r) => r.groupName === 'ПИ-21')).toBe(true);
  });

  it('staff ctx cannot read a group schedule through student functions', async () => {
    expect(await listSchedule(db, maria)).toEqual([]);
    expect(await listExams(db, maria)).toEqual([]);
  });
});

describe('staff.ts — faculty scope', () => {
  it('Maria sees only students of her faculty (ИТ): Anna yes, Ilya no', async () => {
    const logins = (await listFacultyStudents(db, maria)).map((s) => s.login);
    expect(logins).toContain('anna');
    expect(logins).not.toContain('ilya');
  });

  it('getFacultyStudent refuses a student from another faculty', async () => {
    db.auditEvents().length = 0;
    expect(await getFacultyStudent(db, maria, ILYA_STUDENT_ID)).toBeNull();
    const event = lastAudit();
    expect(event?.reason).toBe('OUTSIDE_FACULTY');
    expect(event?.resourceRef).toBe(ILYA_STUDENT_ID);
  });

  it('getFacultyStudent returns the own-faculty student', async () => {
    const student = await getFacultyStudent(db, maria, 'st-anna');
    expect(student?.login).toBe('anna');
  });

  it('student ctx is denied staff functions', async () => {
    db.auditEvents().length = 0;
    expect(await listFacultyStudents(db, anna)).toEqual([]);
    expect(lastAudit()?.reason).toBe('ROLE_MISMATCH');
  });
});

describe('access.ts — audit writer', () => {
  it('never throws even if the store fails, and stores actor + resource + reason', async () => {
    const broken = {
      ...db,
      appendAudit: async () => {
        throw new Error('disk on fire');
      },
    } as unknown as MemoryDataDb;
    await expect(
      denyAccess(broken, {
        ctx: anna,
        resourceType: 'request',
        resourceRef: ILYA_REQUEST_NUMBER,
        reason: 'OWNERSHIP_DENIED',
      }),
    ).resolves.toBeUndefined();

    db.auditEvents().length = 0;
    await denyAccess(db, {
      ctx: null,
      resourceType: 'session-probe',
      resourceRef: 'unknown',
      reason: 'ROLE_MISMATCH',
    });
    const event = lastAudit();
    expect(event?.actorUserId).toBeNull();
    expect(event?.outcome).toBe('DENIED');
    expect(JSON.stringify(event)).not.toMatch(/password|hash/i);
  });
});

describe('request-number.ts — non-sequential public numbers', () => {
  it('generated numbers are non-sequential and match the public format', () => {
    const a = newRequestNumber(() => 0.123456);
    const b = newRequestNumber(() => 0.654321);
    expect(a).toMatch(/^SR-\d{4}-[A-Z0-9]{5}$/);
    expect(b).toMatch(/^SR-\d{4}-[A-Z0-9]{5}$/);
    expect(a).not.toBe(b);
    expect(isValidRequestNumber(a)).toBe(true);
    expect(isValidRequestNumber('123')).toBe(false);
  });

  it('normalizeRequestNumber is defensive: case, «#», whitespace', async () => {
    expect(normalizeRequestNumber('  sr-2026-a1b2c ')).toBe('SR-2026-A1B2C');
    expect(normalizeRequestNumber('#SR-2026-A1B2C')).toBe('SR-2026-A1B2C');
    expect(normalizeRequestNumber('SR-2026-A1B2C')).toBe('SR-2026-A1B2C');
    await expect(
      getRequestByNumber(db, anna, normalizeRequestNumber('sr-2026-a1b2c')),
    ).resolves.toBeTruthy();
  });
});

describe('http.ts — uniform 404 for API surfaces', () => {
  it('always the same status and body, foreign or missing', () => {
    const a = uniformNotFoundResponse();
    const b = uniformNotFoundResponse();
    expect(a.status).toBe(404);
    expect(b.status).toBe(404);
    expect(a.headers.get('content-type')).toContain('application/json');
  });
});
