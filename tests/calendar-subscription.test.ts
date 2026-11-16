// DIG-63 — живая ICS-подписка расписания и дедлайнов в системный календарь.
//
// Контракт фичи:
//  1. Токен подписки — HMAC-подписанная ссылка (секрет ICS_TOKEN_SECRET,
//     только сервер): в URL нет секретов и studentId, подделка и чужой
//     секрет отсекаются парсером до обращения к хранилищу.
//  2. Подписка выдаётся только студенту (getOrCreateCalendarSubscription):
//     повторный вызов возвращает ТУ ЖЕ ссылку (календарь подписчика не
//     ломается), сотрудник — null + запись в аудите (ROLE_MISMATCH).
//  3. Выход из кабинета отзывает подписку навсегда: строка удаляется
//     (revokeCalendarSubscriptionOfLogin), старая ссылка отвечает null
//     даже после повторного входа (новый вход = новый tokenId).
//  4. Фид (resolveCalendarFeed) собирает пары группы студента за семестр
//     (включая отменённые с пометкой) и ВСЕ контрольные точки сессии
//     (экзамены, зачёты, пересдачи — это и есть «дедлайны» главной).
//     Чужая подписка отдаёт только свою группу (изоляция групп).
//  5. Публичный путь фида открыт в route-guard (календарные клиенты ходят
//     без кук), а ответы без валидного токена — единый 404.
import { beforeEach, describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';

import { mintCalendarToken, newCalendarTokenId, parseCalendarToken } from '@/lib/calendar-token';
import { createMemoryDataDb, type MemoryDataDb } from '@/server/data/memory-db';
import {
  getOrCreateCalendarSubscription,
  resolveCalendarFeed,
  revokeCalendarSubscriptionOfLogin,
} from '@/server/data/calendar';
import type { DataCtx, ScheduleEventRow } from '@/server/data/types';
import { isPublicPath } from '@/lib/route-guard';

const SECRET = 'test-ics-token-secret';
const NOW = new Date(2026, 10, 15, 12, 0, 0); // 15.11.2026 — осенний семестр

/** Дата относительно NOW (как в demo-seed), чтобы тесты не зависели от календаря. */
const day = (offsetDays: number, hour: number, minute = 0): Date => {
  const d = new Date(NOW);
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hour, minute, 0, 0);
  return d;
};

const annaCtx: DataCtx = {
  userId: 'u-anna',
  login: 'anna.smirnova',
  role: 'STUDENT',
  studentId: 'st-anna',
  groupName: 'ПИ-21',
  faculty: 'ИТ',
};

const ilyaCtx: DataCtx = {
  userId: 'u-ilya',
  login: 'ilya.petrov',
  role: 'STUDENT',
  studentId: 'st-ilya',
  groupName: 'ЭК-11',
  faculty: 'ЭК',
};

const deanCtx: DataCtx = {
  userId: 'u-dean',
  login: 'dean.kovaleva',
  role: 'STAFF',
  studentId: null,
  groupName: null,
  faculty: 'ИТ',
};

function seedFixture(): MemoryDataDb {
  const db = createMemoryDataDb();
  const schedule: ScheduleEventRow[] = [
    {
      id: 'sch-1',
      groupName: 'ПИ-21',
      disciplineCode: 'PI21-DB',
      disciplineName: 'Базы данных',
      date: day(1, 10, 0),
      startsAt: day(1, 10, 0),
      endsAt: day(1, 11, 30),
      kind: 'LECTURE',
      room: '301',
      teacherName: 'Соколов Сергей Сергеевич',
      status: 'SCHEDULED',
      note: null,
    },
    {
      id: 'sch-2',
      groupName: 'ПИ-21',
      disciplineCode: 'PI21-DISC',
      disciplineName: 'Дискретная математика',
      date: day(2, 12, 0),
      startsAt: day(2, 12, 0),
      endsAt: day(2, 13, 30),
      kind: 'PRACTICE',
      room: '212',
      teacherName: 'Иванова Ирина Игоревна',
      status: 'CANCELLED',
      note: null,
    },
    {
      id: 'sch-consult',
      groupName: 'ПИ-21',
      disciplineCode: 'PI21-PROG',
      disciplineName: 'Программирование',
      date: day(3, 16, 0),
      startsAt: day(3, 16, 0),
      endsAt: day(3, 17, 30),
      kind: 'CONSULTATION',
      room: '405',
      teacherName: 'Иванова Ирина Игоревна',
      status: 'SCHEDULED',
      note: 'Перед зачётом',
    },
    // Чужая группа: не должна попасть в фид Анны.
    {
      id: 'sch-other',
      groupName: 'ЭК-11',
      disciplineCode: 'EK11-ECON',
      disciplineName: 'Экономическая теория',
      date: day(4, 15, 40),
      startsAt: day(4, 15, 40),
      endsAt: day(4, 17, 10),
      kind: 'SEMINAR',
      room: '18',
      teacherName: 'Орлов Олег Олегович',
      status: 'SCHEDULED',
      note: null,
    },
  ];
  db.seed({
    students: [
      {
        id: 'st-anna',
        login: 'anna.smirnova',
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
        login: 'ilya.petrov',
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
      {
        id: 'st-staff',
        login: 'dean.kovaleva',
        fullName: 'Мария Ковалева',
        email: 'dean@example.edu',
        groupName: 'ПИ-21',
        course: 0,
        faculty: 'ИТ',
        program: '',
        programCode: null,
        studyForm: 'очная',
        funding: null,
        gradebookNumber: '00000000',
      },
    ],
    schedule,
    exams: [
      {
        id: 'exm-1',
        groupName: 'ПИ-21',
        disciplineCode: 'PI21-DB',
        disciplineName: 'Базы данных',
        kind: 'EXAM',
        date: day(5, 10, 0),
        startsAt: day(5, 10, 0),
        room: '301',
        note: null,
      },
      {
        id: 'exm-2',
        groupName: 'ПИ-21',
        disciplineCode: 'PI21-INFO',
        disciplineName: 'Информатика',
        kind: 'RETAKE',
        date: day(7, 9, 0),
        startsAt: day(7, 9, 0),
        room: '305',
        note: 'Пересдача коллоквиума',
      },
      {
        id: 'exm-other',
        groupName: 'ЭК-11',
        disciplineCode: 'EK11-MATH',
        disciplineName: 'Математический анализ',
        kind: 'EXAM',
        date: day(6, 9, 0),
        startsAt: day(6, 9, 0),
        room: '12',
        note: null,
      },
    ],
  });
  return db;
}

describe('calendar-token: HMAC-подписанная ссылка подписки', () => {
  it('генерирует неугадываемый tokenId (16 байт base64url), уникальный между вызовами', () => {
    const first = newCalendarTokenId();
    const second = newCalendarTokenId();
    expect(first).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(first).not.toBe(second);
  });

  it('mint → parse восстанавливает tokenId; формат v1.<tokenId>.<hmac>', () => {
    const tokenId = newCalendarTokenId();
    const token = mintCalendarToken(SECRET, tokenId);
    expect(token).toMatch(/^v1\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}$/);
    expect(parseCalendarToken(SECRET, token)).toEqual({ tokenId });
  });

  it('подделка любой части и чужой секрет → null (до обращения к БД)', () => {
    const token = mintCalendarToken(SECRET, newCalendarTokenId());
    const [, tokenId, sig] = token.split('.');
    // Подмена ПЕРВОГО символа подписи гарантированно-другим. Раньше здесь
    // была слепая замена на 'x': base64url-алфавит содержит 'x', и в ~1/64
    // запусков настоящая подпись начиналась с 'x' — «подделка» совпадала с
    // оригиналом, валидный токен возвращался, и тест падал (flaky, урок
    // r3 DIG-66). Теперь tamper всегда отличим от настоящей подписи.
    const tamperedSig = `${sig[0] === 'x' ? 'y' : 'x'}${sig.slice(1)}`;
    expect(tamperedSig).not.toBe(sig);
    expect(parseCalendarToken(SECRET, `v1.${tokenId}.${tamperedSig}`)).toBeNull();
    expect(parseCalendarToken(SECRET, `v2.${tokenId}.${sig}`)).toBeNull();
    expect(parseCalendarToken('another-secret', token)).toBeNull();
    expect(parseCalendarToken(SECRET, 'garbage')).toBeNull();
    expect(parseCalendarToken(SECRET, '')).toBeNull();
    // Собственная HMAC-сверка: подпись действительно HMAC-SHA256 от tokenId.
    const expected = createHmac('sha256', SECRET).update(tokenId!).digest('base64url');
    expect(sig).toBe(expected);
    // Длина tokenId: 128 бит энтропии — перебор исключён.
    expect(newCalendarTokenId().length).toBe(22);
  });
});

describe('getOrCreateCalendarSubscription: выдача подписки студенту', () => {
  let db: MemoryDataDb;
  beforeEach(() => {
    db = seedFixture();
  });

  it('создаёт подписку и возвращает ту же ссылку повторно (календарь не ломается)', async () => {
    const first = await getOrCreateCalendarSubscription(db, annaCtx, {
      now: NOW,
      secret: SECRET,
    });
    expect(first).not.toBeNull();
    expect(first!.token).toMatch(/^v1\./);

    const second = await getOrCreateCalendarSubscription(db, annaCtx, {
      now: NOW,
      secret: SECRET,
    });
    expect(second!.token).toBe(first!.token);
  });

  it('разные студенты получают разные подписки', async () => {
    const anna = await getOrCreateCalendarSubscription(db, annaCtx, {
      now: NOW,
      secret: SECRET,
    });
    const ilya = await getOrCreateCalendarSubscription(db, ilyaCtx, {
      now: NOW,
      secret: SECRET,
    });
    expect(anna!.token).not.toBe(ilya!.token);
  });

  it('сотруднику подписка не выдаётся: null + аудит ROLE_MISMATCH', async () => {
    const result = await getOrCreateCalendarSubscription(db, deanCtx, {
      now: NOW,
      secret: SECRET,
    });
    expect(result).toBeNull();
    const audit = db.auditEvents();
    expect(audit.at(-1)).toMatchObject({
      resourceType: 'calendar-subscription',
      reason: 'ROLE_MISMATCH',
      outcome: 'DENIED',
    });
  });

  it('без секрета подписка не выдаётся (fail closed, URL не mint-ится)', async () => {
    const result = await getOrCreateCalendarSubscription(db, annaCtx, {
      now: NOW,
      secret: '',
    });
    expect(result).toBeNull();
  });
});

describe('resolveCalendarFeed: живой фид по ссылке', () => {
  let db: MemoryDataDb;
  beforeEach(() => {
    db = seedFixture();
  });

  it('собирает пары группы (семестр) и все контрольные точки сессии', async () => {
    const sub = await getOrCreateCalendarSubscription(db, annaCtx, {
      now: NOW,
      secret: SECRET,
    });
    const feed = await resolveCalendarFeed(db, sub!.token, { now: NOW, secret: SECRET });
    expect(feed).not.toBeNull();
    expect(feed!.name).toContain('ПИ-21');

    const uids = feed!.events.map((e) => e.uid);
    // Пары группы, включая консультации и отменённую пару.
    expect(uids).toContain('lesson-sch-1@digital-deanery');
    expect(uids).toContain('lesson-sch-consult@digital-deanery');
    expect(uids).toContain('lesson-sch-2@digital-deanery');
    // Контрольные точки: экзамен + пересдача (дедлайны), чужая группа — нет.
    expect(uids).toContain('exam-exm-1@digital-deanery');
    expect(uids).toContain('exam-exm-2@digital-deanery');
    expect(uids).not.toContain('exam-exm-other@digital-deanery');
    expect(uids).not.toContain('lesson-sch-other@digital-deanery');

    // События отсортированы по времени начала.
    const starts = feed!.events.map((e) => e.startsAt.getTime());
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);

    // Отменённая пара помечена в заголовке.
    const cancelled = feed!.events.find((e) => e.uid === 'lesson-sch-2@digital-deanery');
    expect(cancelled!.title).toContain('Отменена');

    // Экзамен длится 90 минут (как на экране «Сессия»).
    const exam = feed!.events.find((e) => e.uid === 'exam-exm-1@digital-deanery');
    expect(exam!.title).toContain('Базы данных');
    expect(exam!.endsAt.getTime() - exam!.startsAt.getTime()).toBe(90 * 60_000);
  });

  it('чужая подписка изолирована: Илья видит только свою группу', async () => {
    const ilya = await getOrCreateCalendarSubscription(db, ilyaCtx, {
      now: NOW,
      secret: SECRET,
    });
    const feed = await resolveCalendarFeed(db, ilya!.token, { now: NOW, secret: SECRET });
    const uids = feed!.events.map((e) => e.uid);
    expect(uids).toContain('lesson-sch-other@digital-deanery');
    expect(uids).not.toContain('lesson-sch-1@digital-deanery');
    expect(feed!.name).toContain('ЭК-11');
  });

  it('мусорный/поддельный токен → единый null (без оракула существования)', async () => {
    expect(await resolveCalendarFeed(db, '', { now: NOW, secret: SECRET })).toBeNull();
    expect(await resolveCalendarFeed(db, 'garbage', { now: NOW, secret: SECRET })).toBeNull();
    expect(
      await resolveCalendarFeed(db, mintCalendarToken(SECRET, 'no-such-token'), {
        now: NOW,
        secret: SECRET,
      }),
    ).toBeNull();
    expect(await resolveCalendarFeed(db, 'v1.x.y', { now: NOW, secret: SECRET })).toBeNull();
  });
});

describe('выход из кабинета отзывает подписку навсегда', () => {
  let db: MemoryDataDb;
  beforeEach(() => {
    db = seedFixture();
  });

  it('после revoke старая ссылка отвечает null; новый вход — новая ссылка', async () => {
    const before = await getOrCreateCalendarSubscription(db, annaCtx, {
      now: NOW,
      secret: SECRET,
    });
    expect(
      (await resolveCalendarFeed(db, before!.token, { now: NOW, secret: SECRET }))!,
    ).not.toBeNull();

    const revoked = await revokeCalendarSubscriptionOfLogin(db, 'anna.smirnova');
    expect(revoked).toBe(true);

    expect(await resolveCalendarFeed(db, before!.token, { now: NOW, secret: SECRET })).toBeNull();

    // Повторный «вход»: tokenId новый — прежняя ссылка не оживает.
    const after = await getOrCreateCalendarSubscription(db, annaCtx, {
      now: NOW,
      secret: SECRET,
    });
    expect(after!.token).not.toBe(before!.token);
    expect(await resolveCalendarFeed(db, before!.token, { now: NOW, secret: SECRET })).toBeNull();
    expect(
      (await resolveCalendarFeed(db, after!.token, { now: NOW, secret: SECRET }))!,
    ).not.toBeNull();
  });

  it('revocate идемпотентен; чужой логин без подписки → false', async () => {
    await getOrCreateCalendarSubscription(db, annaCtx, { now: NOW, secret: SECRET });
    expect(await revokeCalendarSubscriptionOfLogin(db, 'anna.smirnova')).toBe(true);
    expect(await revokeCalendarSubscriptionOfLogin(db, 'anna.smirnova')).toBe(false);
    expect(await revokeCalendarSubscriptionOfLogin(db, 'nobody')).toBe(false);
  });

  it('выход одного студента не трогает подписку другого', async () => {
    const anna = await getOrCreateCalendarSubscription(db, annaCtx, {
      now: NOW,
      secret: SECRET,
    });
    const ilya = await getOrCreateCalendarSubscription(db, ilyaCtx, {
      now: NOW,
      secret: SECRET,
    });
    await revokeCalendarSubscriptionOfLogin(db, 'ilya.petrov');
    expect(
      (await resolveCalendarFeed(db, anna!.token, { now: NOW, secret: SECRET }))!,
    ).not.toBeNull();
    expect(await resolveCalendarFeed(db, ilya!.token, { now: NOW, secret: SECRET })).toBeNull();
  });
});

describe('route-guard: фид подписки публичен (календарные клиенты без кук)', () => {
  it('/api/calendar/ics — публичный путь; кабинет остаётся закрытым', () => {
    expect(isPublicPath('/api/calendar/ics')).toBe(true);
    expect(isPublicPath('/api/session/ics')).toBe(false);
    expect(isPublicPath('/api/notifications/count')).toBe(false);
  });
});
