// DIG-39 — контракт слоя данных «Обращения в деканат» (red-first).
// Приёмка: список owner-scoped (тикеты Анны не видны Илье), чужой и
// несуществующий номер → одинаковый null + аудит (OWNERSHIP_DENIED /
// NOT_FOUND); создание с темой из белого списка, вложениями (≤ 3, имя
// ≤ 80), привязкой только к СВОЕЙ заявке и дисциплине СВОЕЙ группы; ответ
// студента возвращает статус в «Открыто»; ответ менеджера → «Ждём вас» +
// уведомление (тип TICKET, ссылка на чат) с учётом матрицы PUSH; открытие
// чата помечает сообщения менеджера прочитанными; сотруднику — отказ + аудит.
import { beforeAll, describe, expect, it } from 'vitest';

import { createMemoryDataDb, type MemoryDataDb } from '@/server/data/memory-db';
import { toDataCtx } from '@/server/data/context';
import { defaultSettingsFor } from '@/server/data/profile';
import {
  appendManagerMessage,
  createTicket,
  getDeaneryPage,
  MAX_ATTACHMENT_NAME_LENGTH,
  MAX_TICKET_ATTACHMENTS,
  openTicketChat,
  replyToTicket,
} from '@/server/data/deanery';
import {
  normalizeTicketNumber,
  newTicketNumber,
  TICKET_NUMBER_PATTERN,
} from '@/server/data/ticket-number';
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

/** Минуты от условного старта — детерминированная хронология теста. */
const at = (minutes: number): Date => new Date(2026, 10, 16, 10, minutes, 0);

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
    requests: [
      {
        id: 'req-anna-1',
        studentId: 'st-anna',
        number: 'SR-2026-AAAAA',
        type: 'CERTIFICATE',
        title: 'Справка об обучении',
        status: 'IN_PROGRESS',
        assignee: null,
        resultNote: null,
        createdAt: at(-60),
        updatedAt: at(-60),
      },
      {
        id: 'req-ilya-1',
        studentId: 'st-ilya',
        number: 'SR-2026-BBBBB',
        type: 'STATEMENT',
        title: 'Заявление на академический отпуск',
        status: 'SUBMITTED',
        assignee: null,
        resultNote: null,
        createdAt: at(-50),
        updatedAt: at(-50),
      },
    ],
    disciplines: [
      {
        groupName: 'ПИ-21',
        disciplineCode: 'PI21-DB',
        disciplineName: 'Базы данных',
        credits: 5,
        teacherName: 'Соколов Сергей Сергеевич',
      },
      {
        groupName: 'ЭК-11',
        disciplineCode: 'EK11-MATH',
        disciplineName: 'Математический анализ',
        credits: 5,
        teacherName: 'Кузнецова Ксения Кирилловна',
      },
    ],
    settings: [defaultSettingsFor('st-anna'), defaultSettingsFor('st-ilya')],
  });
  anna = (await toDataCtx(userOf('auth-anna', 'anna', 'STUDENT'), db))!;
  ilya = (await toDataCtx(userOf('auth-ilya', 'ilya', 'STUDENT'), db))!;
  maria = (await toDataCtx(userOf('auth-maria', 'maria', 'STAFF'), db))!;
  expect(anna?.studentId).toBe('st-anna');
  expect(ilya?.studentId).toBe('st-ilya');
  expect(maria?.studentId).toBeNull();
});

describe('ticket-number — публичный номер TS-ГГГГ-XXXXX', () => {
  it('формат и нормализация ввода', () => {
    const number = newTicketNumber(() => 0.123456, new Date(2026, 10, 16));
    expect(number).toMatch(TICKET_NUMBER_PATTERN);
    expect(TICKET_NUMBER_PATTERN.test('SR-2026-AAAAA')).toBe(false);
    expect(normalizeTicketNumber(' #ts-2026-ab12c ')).toBe('TS-2026-AB12C');
  });
});

describe('createTicket — создание обращения', () => {
  it('с темой из списка, вложением и привязкой к СВОЕЙ заявке и дисциплине', async () => {
    const result = await createTicket(db, anna, {
      subject: 'GRADES',
      body: 'Проверьте, пожалуйста, оценку за проект по базам данных.',
      attachments: ['скрин-ведомости.png'],
      requestNumber: 'sr-2026-aaaaa',
      disciplineCode: 'PI21-DB',
      now: at(1),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ticket.number).toMatch(TICKET_NUMBER_PATTERN);
    expect(result.ticket.status).toBe('OPEN');
    expect(result.ticket.subject).toBe('GRADES');
    expect(result.ticket.requestNumber).toBe('SR-2026-AAAAA');
    expect(result.ticket.disciplineCode).toBe('PI21-DB');
    const chat = await openTicketChat(db, anna, result.ticket.number);
    expect(chat?.messages).toHaveLength(1);
    expect(chat?.messages[0]?.authorRole).toBe('STUDENT');
    expect(chat?.messages[0]?.authorName).toBe('Анна Ковалёва');
    expect(chat?.messages[0]?.attachments).toEqual(['скрин-ведомости.png']);
  });

  it('тема вне белого списка отклоняется с ошибкой про тему', async () => {
    const result = await createTicket(db, anna, {
      subject: 'DORMITORY' as never,
      body: 'Любой текст',
      attachments: [],
      now: at(2),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('тем');
  });

  it('пустой текст отклоняется', async () => {
    const result = await createTicket(db, anna, {
      subject: 'OTHER',
      body: '   ',
      attachments: [],
      now: at(3),
    });
    expect(result.ok).toBe(false);
  });

  it('больше трёх вложений отклоняется (лимит из задачи — 3 файла)', async () => {
    expect(MAX_TICKET_ATTACHMENTS).toBe(3);
    const result = await createTicket(db, anna, {
      subject: 'OTHER',
      body: 'Много файлов',
      attachments: ['a.pdf', 'b.pdf', 'c.pdf', 'd.pdf'],
      now: at(4),
    });
    expect(result.ok).toBe(false);
  });

  it('имя вложения длиннее 80 символов отклоняется', async () => {
    expect(MAX_ATTACHMENT_NAME_LENGTH).toBe(80);
    const result = await createTicket(db, anna, {
      subject: 'OTHER',
      body: 'Длинное имя',
      attachments: ['x'.repeat(81)],
      now: at(5),
    });
    expect(result.ok).toBe(false);
  });

  it('привязка к ЧУЖОЙ заявке отклоняется, обращение не создаётся', async () => {
    const before = await getDeaneryPage(db, anna);
    const result = await createTicket(db, anna, {
      subject: 'ACADEMIC_LEAVE',
      body: 'Ссылаюсь на чужую заявку',
      attachments: [],
      requestNumber: 'SR-2026-BBBBB',
      now: at(6),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('сво');
    const after = await getDeaneryPage(db, anna);
    expect(after.tickets.length).toBe(before.tickets.length);
  });

  it('дисциплина ЧУЖОЙ группы отклоняется', async () => {
    const result = await createTicket(db, anna, {
      subject: 'CURRICULUM',
      body: 'Вопрос по чужой дисциплине',
      attachments: [],
      disciplineCode: 'EK11-MATH',
      now: at(7),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('групп');
  });

  it('сотруднику создать обращение нельзя: отказ + аудит ROLE_MISMATCH', async () => {
    const result = await createTicket(db, maria, {
      subject: 'OTHER',
      body: 'Попытка со стороны сотрудника',
      attachments: [],
      now: at(8),
    });
    expect(result.ok).toBe(false);
    const audit = db.auditEvents();
    expect(audit[audit.length - 1]).toMatchObject({
      resourceType: 'ticket',
      reason: 'ROLE_MISMATCH',
      actorLogin: 'maria',
    });
  });
});

describe('getDeaneryPage — список owner-scoped', () => {
  it('тикеты Анны не видны Илье, и наоборот; сортировка по свежей активности', async () => {
    await createTicket(db, ilya, {
      subject: 'TRANSFER',
      body: 'Как перевестись на бюджет?',
      attachments: [],
      now: at(9),
    });

    const annaPage = await getDeaneryPage(db, anna);
    expect(annaPage.tickets.length).toBeGreaterThanOrEqual(1);
    for (const item of annaPage.tickets) {
      // Каждый тикет списка Анны несёт её первое сообщение — чужих нет.
      const chat = await openTicketChat(db, anna, item.number);
      expect(chat).not.toBeNull();
    }
    const ilyaPage = await getDeaneryPage(db, ilya);
    expect(ilyaPage.tickets.length).toBe(1);
    for (const item of annaPage.tickets) {
      expect(ilyaPage.tickets.map((t) => t.number)).not.toContain(item.number);
    }
    // Свежие сверху: updatedAt по убыванию.
    const times = annaPage.tickets.map((t) => t.updatedAt.getTime());
    expect([...times].sort((a, b) => b - a)).toEqual(times);
    // Для композера страница несёт свои заявки и дисциплины своей группы.
    expect(annaPage.requests.map((r) => r.number)).toContain('SR-2026-AAAAA');
    expect(annaPage.disciplines.map((d) => d.code)).toContain('PI21-DB');
    expect(ilyaPage.disciplines.map((d) => d.code)).toContain('EK11-MATH');
  });

  it('сотруднику — пустой список + аудит ROLE_MISMATCH', async () => {
    const page = await getDeaneryPage(db, maria);
    expect(page.tickets).toHaveLength(0);
    const audit = db.auditEvents();
    expect(audit[audit.length - 1]).toMatchObject({
      resourceType: 'ticket',
      reason: 'ROLE_MISMATCH',
      actorLogin: 'maria',
    });
  });
});

describe('openTicketChat — чат с единой 404-семантикой', () => {
  it('чужой номер: null + аудит OWNERSHIP_DENIED', async () => {
    const ilyaTicket = (await getDeaneryPage(db, ilya)).tickets[0]!;
    const chat = await openTicketChat(db, anna, ilyaTicket.number);
    expect(chat).toBeNull();
    const audit = db.auditEvents();
    expect(audit[audit.length - 1]).toMatchObject({
      resourceType: 'ticket',
      reason: 'OWNERSHIP_DENIED',
      actorLogin: 'anna',
    });
  });

  it('несуществующий номер: тот же null + аудит NOT_FOUND', async () => {
    const chat = await openTicketChat(db, anna, 'TS-2026-ZZZZZ');
    expect(chat).toBeNull();
    const audit = db.auditEvents();
    expect(audit[audit.length - 1]).toMatchObject({
      resourceType: 'ticket',
      reason: 'NOT_FOUND',
      actorLogin: 'anna',
    });
  });

  it('сотруднику чат студента недоступен: null + аудит ROLE_MISMATCH', async () => {
    const annaTicket = (await getDeaneryPage(db, anna)).tickets[0]!;
    const chat = await openTicketChat(db, maria, annaTicket.number);
    expect(chat).toBeNull();
    const audit = db.auditEvents();
    expect(audit[audit.length - 1]).toMatchObject({
      resourceType: 'ticket',
      reason: 'ROLE_MISMATCH',
      actorLogin: 'maria',
    });
  });
});

describe('переписка: менеджер отвечает → «Ждём вас» + уведомление', () => {
  it('ответ менеджера: статус ANSWERED, реплики студента прочитаны, уведомление TICKET', async () => {
    const annaTicket = (await getDeaneryPage(db, anna)).tickets.find(
      (t) => t.subject === 'GRADES',
    )!;
    const notificationsBefore = (await db.listNotificationsByStudent('st-anna')).filter(
      (n) => n.type === 'TICKET',
    ).length;

    const result = await appendManagerMessage(db, maria, annaTicket.number, {
      body: 'Добрый день! Проверим ведомость и вернёмся с ответом.',
      attachments: ['скан-ведомости.pdf'],
      now: at(20),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ticket.status).toBe('ANSWERED');

    // Читаем чат напрямую через порт: openTicketChat пометил бы ответы
    // менеджера прочитанными (это отдельный сценарий, следующий тест).
    const messages = await db.listTicketMessages(annaTicket.id);
    const managerMsg = messages.find((m) => m.authorRole === 'STAFF');
    expect(managerMsg?.authorName).toBe('Мария Петрова');
    expect(managerMsg?.attachments).toEqual(['скан-ведомости.pdf']);

    // Реплика студента прочитана менеджером (статус «Прочитано» в чате).
    const studentMsg = messages.find((m) => m.authorRole === 'STUDENT');
    expect(studentMsg?.readAt).not.toBeNull();

    // Уведомление в фиде студента: тип TICKET, ссылка на чат.
    const feed = await db.listNotificationsByStudent('st-anna');
    const ticketNotes = feed.filter((n) => n.type === 'TICKET');
    expect(ticketNotes.length).toBe(notificationsBefore + 1);
    const note = ticketNotes[ticketNotes.length - 1]!;
    expect(note.title).toBe('Ответ по обращению');
    expect(note.link).toBe(`/deanery/${annaTicket.number}`);
    expect(note.isRead).toBe(false);
  });

  it('открытие чата помечает сообщения менеджера прочитанными', async () => {
    const annaTicket = (await getDeaneryPage(db, anna)).tickets.find(
      (t) => t.subject === 'GRADES',
    )!;
    const before = (await getDeaneryPage(db, anna)).tickets.find(
      (t) => t.number === annaTicket.number,
    )!;
    expect(before.unreadStaffCount).toBeGreaterThan(0);

    await openTicketChat(db, anna, annaTicket.number);

    const after = (await getDeaneryPage(db, anna)).tickets.find(
      (t) => t.number === annaTicket.number,
    )!;
    expect(after.unreadStaffCount).toBe(0);
    const chat = await openTicketChat(db, anna, annaTicket.number);
    for (const message of chat!.messages) {
      if (message.authorRole === 'STAFF') expect(message.readAt).not.toBeNull();
    }
  });

  it('ответ студента возвращает статус в «Открыто»', async () => {
    const annaTicket = (await getDeaneryPage(db, anna)).tickets.find(
      (t) => t.subject === 'GRADES',
    )!;
    expect(annaTicket.status).toBe('ANSWERED');

    const result = await replyToTicket(db, anna, annaTicket.number, {
      body: 'Спасибо! Жду ответа.',
      attachments: [],
      now: at(25),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ticket.status).toBe('OPEN');

    const chat = await openTicketChat(db, anna, annaTicket.number);
    const last = chat!.messages[chat!.messages.length - 1]!;
    expect(last.authorRole).toBe('STUDENT');
    expect(last.body).toBe('Спасибо! Жду ответа.');
  });

  it('чужой номер для ответа студента — null-семантика отказа', async () => {
    const ilyaTicket = (await getDeaneryPage(db, ilya)).tickets[0]!;
    const result = await replyToTicket(db, anna, ilyaTicket.number, {
      body: 'Попытка ответить в чужом чате',
      attachments: [],
      now: at(26),
    });
    expect(result.ok).toBe(false);
  });

  it('менеджер чужого факультета получает отказ + аудит OUTSIDE_FACULTY', async () => {
    const ilyaTicket = (await getDeaneryPage(db, ilya)).tickets[0]!;
    const result = await appendManagerMessage(db, maria, ilyaTicket.number, {
      body: 'Ответ менеджера ИТ-факультета',
      attachments: [],
      now: at(27),
    });
    expect(result.ok).toBe(false);
    const audit = db.auditEvents();
    expect(audit[audit.length - 1]).toMatchObject({
      resourceType: 'ticket',
      reason: 'OUTSIDE_FACULTY',
      actorLogin: 'maria',
    });
    // Статус чужого тикета не изменился.
    const after = (await getDeaneryPage(db, ilya)).tickets[0]!;
    expect(after.status).toBe('OPEN');
  });

  it('студент не может отправить сообщение от имени менеджера', async () => {
    const annaTicket = (await getDeaneryPage(db, anna)).tickets[0]!;
    const result = await appendManagerMessage(db, anna, annaTicket.number, {
      body: 'Подделка от студента',
      attachments: [],
      now: at(28),
    });
    expect(result.ok).toBe(false);
    const audit = db.auditEvents();
    expect(audit[audit.length - 1]).toMatchObject({
      resourceType: 'ticket',
      reason: 'ROLE_MISMATCH',
      actorLogin: 'anna',
    });
  });

  it('выключенный тип «Обращения» в матрице подавляет уведомление, статус меняется', async () => {
    // Анна выключает PUSH типа TICKET (канал «Обращения»).
    const settings = (await db.findSettingsByStudent('st-anna'))!;
    await db.saveSettingsByStudent('st-anna', {
      ...settings,
      notificationChannels: {
        ...settings.notificationChannels,
        TICKET: { PUSH: false, EMAIL: true, TELEGRAM: false },
      },
    });
    const feedBefore = (await db.listNotificationsByStudent('st-anna')).filter(
      (n) => n.type === 'TICKET',
    ).length;

    const annaTicket = (await getDeaneryPage(db, anna)).tickets.find(
      (t) => t.subject === 'GRADES',
    )!;
    const result = await appendManagerMessage(db, maria, annaTicket.number, {
      body: 'Второй ответ менеджера',
      attachments: [],
      now: at(30),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ticket.status).toBe('ANSWERED');

    const feedAfter = (await db.listNotificationsByStudent('st-anna')).filter(
      (n) => n.type === 'TICKET',
    );
    expect(feedAfter.length).toBe(feedBefore);

    // Возвращаем матрицу, чтобы порядок тестов не зависел от этого шага.
    await db.saveSettingsByStudent('st-anna', settings);
  });
});
