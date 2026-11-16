// DIG-48 — контракт слоя данных кабинета сотрудника (staff-workflow).
//
// Ключевые требования: скоуп факультета (чужое и несуществующее — одинаковый
// null + аудит), смена статуса = атомарно строка + событие истории +
// уведомление студенту, обращения (ответ/«Решено» с уведомлением),
// объявления с проверкой группы факультета. Памятный адаптер + ручные ctx.
import { beforeAll, describe, expect, it } from 'vitest';
import { createMemoryDataDb, type MemoryDataDb } from '@/server/data/memory-db';
import {
  getStaffQueue,
  getStaffRequestDetail,
  changeStaffRequestStatus,
  getStaffAppeals,
  getStaffAppealThread,
  answerStaffAppeal,
  resolveStaffAppeal,
  listStaffAnnouncements,
  createStaffAnnouncement,
  getStaffSummaryData,
} from '@/server/data/staff-workflow';
import { getStaffCertificatePdfInput } from '@/server/data/certificates';
import { getRequestByNumber } from '@/server/data/requests';
import { listNotifications } from '@/server/data/notifications';
import type { DataCtx, StudentRow } from '@/server/data/types';

const T0 = new Date('2026-11-01T10:00:00.000Z');
const NOW = new Date('2026-11-14T12:00:00.000Z');

let db: MemoryDataDb;
let maria: DataCtx; // STAFF, факультет «ИТ»
let annaStudentCtx: DataCtx; // студент — должен получать []/null + аудит

const student = (
  id: string,
  login: string,
  fullName: string,
  faculty: string,
  group: string,
): StudentRow => ({
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
});

beforeAll(async () => {
  db = createMemoryDataDb();
  db.seed({
    students: [
      student('st-anna', 'anna', 'Анна Ковалёва', 'ИТ', 'ПИ-21'),
      {
        ...student('st-ilya', 'ilya', 'Илья Смирнов', 'ЭК', 'ЭК-11'),
        program: 'Экономика',
        gradebookNumber: '20254567',
        course: 1,
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
        id: 'req-anna-1',
        studentId: 'st-anna',
        number: 'SR-2026-A1B2C',
        type: 'CERTIFICATE',
        title: 'Справка об обучении',
        status: 'SUBMITTED',
        assignee: null,
        resultNote: null,
        createdAt: T0,
        updatedAt: T0,
      },
      {
        id: 'req-anna-2',
        studentId: 'st-anna',
        number: 'SR-2026-CCCCC',
        type: 'CERTIFICATE',
        title: 'Справка для банка',
        status: 'COMPLETED',
        assignee: 'Мария Петрова',
        resultNote: 'Готова',
        createdAt: T0,
        updatedAt: T0,
      },
      {
        id: 'req-ilya-1',
        studentId: 'st-ilya',
        number: 'SR-2026-Z9Y8X',
        type: 'STATEMENT',
        title: 'Заявление на отпуск',
        status: 'SUBMITTED',
        assignee: null,
        resultNote: null,
        createdAt: T0,
        updatedAt: T0,
      },
    ],
    requestEvents: [
      {
        id: 'evt-anna-1a',
        requestId: 'req-anna-1',
        actorRole: 'STUDENT',
        actorName: 'Анна Ковалёва',
        statusFrom: null,
        statusTo: 'SUBMITTED',
        message: 'Заявка подана',
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
        id: 'apl-ilya-1',
        studentId: 'st-ilya',
        subject: 'Пересдача',
        status: 'OPEN',
        createdAt: T0,
      },
    ],
    appealMessages: [
      {
        id: 'msg-anna-1a',
        appealId: 'apl-anna-1',
        authorRole: 'STUDENT',
        authorName: 'Анна Ковалёва',
        body: 'Здравствуйте! Зачли ли зачёт?',
        createdAt: T0,
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
  annaStudentCtx = {
    userId: 'auth-anna',
    login: 'anna',
    role: 'STUDENT',
    studentId: 'st-anna',
    groupName: 'ПИ-21',
    faculty: 'ИТ',
  };
});

const auditReasonFor = (ref: string) =>
  db
    .auditEvents()
    .filter((row) => row.resourceRef === ref)
    .at(-1)?.reason;

describe('очередь заявок: скоуп факультета', () => {
  it('сотрудник видит только заявки студентов своего факультета, с профилями студентов', async () => {
    const queue = await getStaffQueue(db, maria);
    expect(queue.map((item) => item.request.number)).toEqual(
      expect.arrayContaining(['SR-2026-A1B2C', 'SR-2026-CCCCC']),
    );
    expect(queue.map((item) => item.request.number)).not.toContain('SR-2026-Z9Y8X');
    expect(queue.every((item) => item.student.faculty === 'ИТ')).toBe(true);
    expect(queue.find((i) => i.request.number === 'SR-2026-A1B2C')?.student.fullName).toBe(
      'Анна Ковалёва',
    );
  });

  it('студенту очередь недоступна: [] + аудит ROLE_MISMATCH', async () => {
    expect(await getStaffQueue(db, annaStudentCtx)).toEqual([]);
    expect(auditReasonFor('staff-queue')).toBe('ROLE_MISMATCH');
  });
});

describe('карточка заявки: скоуп и содержимое', () => {
  it('своя факультетская заявка открывается с историей и студентом', async () => {
    const detail = await getStaffRequestDetail(db, maria, 'SR-2026-A1B2C');
    expect(detail).not.toBeNull();
    expect(detail!.student.id).toBe('st-anna');
    expect(detail!.request.status).toBe('SUBMITTED');
    expect(detail!.events.map((e) => e.statusTo)).toContain('SUBMITTED');
  });

  it('чужой факультет и несуществующий номер — одинаковый null, попытки в аудите', async () => {
    expect(await getStaffRequestDetail(db, maria, 'SR-2026-Z9Y8X')).toBeNull();
    expect(await getStaffRequestDetail(db, maria, 'SR-2026-ZZZZZ')).toBeNull();
    expect(auditReasonFor('SR-2026-Z9Y8X')).toBe('OUTSIDE_FACULTY');
    expect(auditReasonFor('SR-2026-ZZZZZ')).toBe('NOT_FOUND');
  });
});

describe('смена статуса сотрудником', () => {
  it('«Взять в работу»: статус, исполнитель, событие и уведомление студенту атомарно', async () => {
    const before = (await listNotifications(db, annaStudentCtx)).length;
    const result = await changeStaffRequestStatus(db, maria, 'SR-2026-A1B2C', {
      to: 'IN_PROGRESS',
      note: null,
      now: NOW,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.request.status).toBe('IN_PROGRESS');
    expect(result.request.assignee).toBe('Мария Петрова');

    const detail = await getStaffRequestDetail(db, maria, 'SR-2026-A1B2C');
    const last = detail!.events.at(-1)!;
    expect(last.actorRole).toBe('STAFF');
    expect(last.actorName).toBe('Мария Петрова');
    expect(last.statusFrom).toBe('SUBMITTED');
    expect(last.statusTo).toBe('IN_PROGRESS');

    // Уведомление студенту записано тем же вызовом (< 60 с) со ссылкой на заявку.
    const after = await listNotifications(db, annaStudentCtx);
    expect(after.length).toBe(before + 1);
    const created = after.find((n) => !before || !after.slice(0, before).includes(n))!;
    expect(created.type).toBe('REQUEST');
    expect(created.link).toBe('/requests/SR-2026-A1B2C');
    expect(created.body).toContain('Справка об обучении');
  });

  it('«Нужна доработка» без причины отклоняется, с причиной — выполняется', async () => {
    const noReason = await changeStaffRequestStatus(db, maria, 'SR-2026-A1B2C', {
      to: 'NEEDS_REVISION',
      note: '   ',
      now: NOW,
    });
    expect(noReason).toEqual({ ok: false, error: 'REASON_REQUIRED' });

    const withReason = await changeStaffRequestStatus(db, maria, 'SR-2026-A1B2C', {
      to: 'NEEDS_REVISION',
      note: 'Приложите договор о практике',
      now: NOW,
    });
    expect(withReason.ok).toBe(true);
    if (withReason.ok) {
      expect(withReason.request.status).toBe('NEEDS_REVISION');
    }
  });

  it('неразрешённый переход отклоняется (NEEDS_REVISION → COMPLETED)', async () => {
    const result = await changeStaffRequestStatus(db, maria, 'SR-2026-A1B2C', {
      to: 'COMPLETED',
      note: null,
      now: NOW,
    });
    expect(result).toEqual({ ok: false, error: 'NOT_ALLOWED' });
  });

  it('чужая (другой факультет) заявка — единый not_found + аудит', async () => {
    const result = await changeStaffRequestStatus(db, maria, 'SR-2026-Z9Y8X', {
      to: 'IN_PROGRESS',
      note: null,
      now: NOW,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('NOT_FOUND');
    expect(auditReasonFor('SR-2026-Z9Y8X')).toBe('OUTSIDE_FACULTY');
  });

  it('студент не может менять статусы: not_found (ROLE_MISMATCH + аудит)', async () => {
    const result = await changeStaffRequestStatus(db, annaStudentCtx, 'SR-2026-A1B2C', {
      to: 'IN_PROGRESS',
      note: null,
      now: NOW,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('NOT_FOUND');
  });
});

describe('обращения сотрудника', () => {
  it('список — только факультет, с профилями студентов', async () => {
    const list = await getStaffAppeals(db, maria);
    expect(list.map((item) => item.appeal.id)).toEqual(['apl-anna-1']);
    expect(list[0]!.student.fullName).toBe('Анна Ковалёва');
    expect(await getStaffAppeals(db, annaStudentCtx)).toEqual([]);
  });

  it('чат открыт, чужое обращение — null + аудит', async () => {
    const thread = await getStaffAppealThread(db, maria, 'apl-anna-1');
    expect(thread!.messages.map((m) => m.body)).toContain('Здравствуйте! Зачли ли зачёт?');
    expect(await getStaffAppealThread(db, maria, 'apl-ilya-1')).toBeNull();
    expect(auditReasonFor('apl-ilya-1')).toBe('OUTSIDE_FACULTY');
    expect(await getStaffAppealThread(db, maria, 'apl-missing')).toBeNull();
  });

  it('ответ сотрудника: сообщение, статус ANSWERED, уведомление студенту', async () => {
    const before = (await listNotifications(db, annaStudentCtx)).length;
    const answered = await answerStaffAppeal(db, maria, 'apl-anna-1', {
      body: 'Зачёт зачтён, данные обновятся завтра.',
      now: NOW,
    });
    expect(answered!.status).toBe('ANSWERED');
    const thread = await getStaffAppealThread(db, maria, 'apl-anna-1');
    const last = thread!.messages.at(-1)!;
    expect(last.authorRole).toBe('STAFF');
    expect(last.authorName).toBe('Мария Петрова');

    const notifications = await listNotifications(db, annaStudentCtx);
    expect(notifications.length).toBe(before + 1);
    const created = notifications.at(-1)!;
    expect(created.type).toBe('SYSTEM');
    expect(created.body).toContain('Вопрос по зачёту');
  });

  it('пустой ответ отклоняется', async () => {
    expect(await answerStaffAppeal(db, maria, 'apl-anna-1', { body: '  ', now: NOW })).toBeNull();
  });

  it('«Решено» закрывает обращение и уведомляет студента', async () => {
    const before = (await listNotifications(db, annaStudentCtx)).length;
    const resolved = await resolveStaffAppeal(db, maria, 'apl-anna-1', { note: null, now: NOW });
    expect(resolved!.status).toBe('CLOSED');
    expect((await listNotifications(db, annaStudentCtx)).length).toBe(before + 1);
  });
});

describe('объявления сотрудника', () => {
  it('создание для факультета и для своей группы', async () => {
    const facultyWide = await createStaffAnnouncement(db, maria, {
      scope: 'FACULTY',
      groupName: null,
      title: 'Собрание факультета',
      body: 'В пятницу в 14:00, ауд. 301.',
      now: NOW,
    });
    if (!facultyWide || 'error' in facultyWide) throw new Error('объявление не создано');
    expect(facultyWide.faculty).toBe('ИТ');

    const forGroup = await createStaffAnnouncement(db, maria, {
      scope: 'GROUP',
      groupName: 'ПИ-21',
      title: 'Собрание группы ПИ-21',
      body: 'Завтра в 10:00.',
      now: NOW,
    });
    if (!forGroup || 'error' in forGroup) throw new Error('объявление не создано');
    expect(forGroup.groupName).toBe('ПИ-21');
  });

  it('чужая группа факультета отклоняется', async () => {
    const result = await createStaffAnnouncement(db, maria, {
      scope: 'GROUP',
      groupName: 'ЭК-11',
      title: 'Чужая группа',
      body: 'Не должно сохраниться',
      now: NOW,
    });
    expect(result).toEqual({ error: 'UNKNOWN_GROUP' });
  });

  it('список — только объявления своего факультета, свежие первыми', async () => {
    const list = await listStaffAnnouncements(db, maria);
    expect(list.every((row) => row.faculty === 'ИТ')).toBe(true);
    expect(list.map((row) => row.title)).toEqual(
      expect.arrayContaining(['Собрание факультета', 'Собрание группы ПИ-21']),
    );
    const times = list.map((row) => row.createdAt.getTime());
    expect([...times].sort((a, b) => b - a)).toEqual(times);
    expect(await listStaffAnnouncements(db, annaStudentCtx)).toEqual([]);
  });
});

describe('сводка и PDF сотрудника', () => {
  it('сводка считается по заявкам факультета (чужие не входят)', async () => {
    const data = await getStaffSummaryData(db, maria);
    expect(data.requests.every((r) => r.number !== 'SR-2026-Z9Y8X')).toBe(true);
    expect(data.appeals.every((a) => a.id !== 'apl-ilya-1')).toBe(true);
    expect(data.eventsByRequestId['req-anna-1']).toBeDefined();
  });

  it('PDF выполненной справки своего факультета; чужой и неготовой — null', async () => {
    const detail = await getStaffRequestDetail(db, maria, 'SR-2026-CCCCC');
    const input = await getStaffCertificatePdfInput(db, maria, detail!.request, NOW);
    expect(input).not.toBeNull();
    expect(input!.fullName).toBe('Анна Ковалёва');
    expect(input!.verificationCode).toMatch(/^[A-Z2-7]{4}(-[A-Z2-7]{4}){7}$/);

    const wip = await getStaffRequestDetail(db, maria, 'SR-2026-A1B2C');
    expect(await getStaffCertificatePdfInput(db, maria, wip!.request, NOW)).toBeNull();

    // Студент не может сформировать PDF: ROLE_MISMATCH + аудит.
    const annaOwn = await getRequestByNumber(db, annaStudentCtx, 'SR-2026-CCCCC');
    expect(await getStaffCertificatePdfInput(db, annaStudentCtx, annaOwn!, NOW)).toBeNull();
    expect(auditReasonFor('SR-2026-CCCCC')).toBe('ROLE_MISMATCH');
  });
});
