// DIG-43 — контракт данных «Мероприятия» (/events). Приёмка: toggle записи
// (запись → отмена, дубликат не создаёт вторую строку), «Осталось N мест»
// при capacity (заполненное мероприятие не принимает запись — «Мест нет»),
// фильтр «Онлайн» и «На этой неделе», сортировка ленты по дате старта,
// owner-scoped мутации (сотруднику — отказ с аудитом ROLE_MISMATCH,
// несуществующее мероприятие/slug — NOT_FOUND с аудитом, единый null).
import { beforeAll, describe, expect, it } from 'vitest';

import { eventSpotsLabel, eventCoverOf } from '@/lib/events';
import {
  getEventsPage,
  normalizeEventSlug,
  openEventView,
  parseEventsFilter,
  toggleEventRegistrationForStudent,
} from '@/server/data/events';
import { createMemoryDataDb, type MemoryDataDb } from '@/server/data/memory-db';
import type { DataCtx, EventRow } from '@/server/data/types';

/** Детерминированное «сейчас»: вторник 17 ноября 2026, 12:00. */
const NOW = new Date(2026, 10, 17, 12, 0, 0);
const at = (dayOffset: number, hour: number, minute = 0): Date => {
  const d = new Date(NOW);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
};

let db: MemoryDataDb;
let anna: DataCtx;
let ilya: DataCtx;
let maria: DataCtx;

const eventSeed = (overrides: Partial<EventRow> & { id: string }): EventRow => ({
  slug: overrides.slug ?? `${overrides.id}-slug`,
  title: 'Мероприятие',
  description: 'Описание вымышленного мероприятия вуза для прототипа.',
  startsAt: at(3, 18),
  endsAt: at(3, 20),
  location: 'Главный корпус, холл',
  isOnline: false,
  onlineUrl: null,
  capacity: 50,
  tags: ['ИТ'],
  kind: 'LECTURE',
  ...overrides,
});

beforeAll(() => {
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
    events: [
      // Сортировка ленты — по дате старта по возрастанию (ties — по slug):
      // прошедшее мероприятие идёт первым, остальные — по расписанию ниже.
      eventSeed({
        id: 'ev-past',
        slug: 'past-event-aaaa',
        title: 'Прошедшая встреча',
        // Тег вне факультетов: не попадает под фильтр «Мой факультет».
        tags: ['митап'],
        startsAt: at(-3, 19),
        endsAt: at(-3, 21),
      }),
      eventSeed({
        id: 'ev-lecture-ai',
        slug: 'lekciya-ai-bbbb',
        title: 'Лекция про AI',
        isOnline: true,
        onlineUrl: 'https://events.example.edu/live/ai',
        location: 'Онлайн-трансляция',
        capacity: 500,
        tags: ['ai', 'ИТ'],
        startsAt: at(2, 18, 30),
      }),
      eventSeed({
        id: 'ev-career',
        slug: 'karernyj-den-cccc',
        title: 'Карьерный день',
        kind: 'CAREER',
        capacity: 2, // места под демо «Мест нет»
        tags: ['ИТ', 'карьера'],
        startsAt: at(4, 14),
      }),
      eventSeed({
        id: 'ev-hack',
        slug: 'hakaton-dddd',
        title: 'Хакатон',
        kind: 'HACKATHON',
        capacity: 100,
        tags: ['ИТ', 'хакатон'],
        startsAt: at(9, 10),
      }),
      eventSeed({
        id: 'ev-webinar',
        slug: 'vebinar-eeee',
        title: 'Онлайн-вебинар',
        kind: 'CAREER',
        isOnline: true,
        onlineUrl: 'https://events.example.edu/live/webinar',
        capacity: 300,
        tags: ['карьера', 'ЭК'],
        startsAt: at(12, 19),
      }),
      eventSeed({
        id: 'ev-culture',
        slug: 'kulturnaya-noch-ffff',
        title: 'Культурная ночь',
        kind: 'CULTURE',
        tags: ['кампус'],
        startsAt: at(16, 20),
      }),
    ],
    // Карьерный день (capacity 2) заполнен без Анны — «Мест нет»
    // (вторая запись — вымышленный одногруппник вне seeded-студентов,
    // контракт не требует существования Student-строки).
    eventRegistrations: [
      { eventId: 'ev-career', studentId: 'st-ilya', createdAt: at(-1, 10) },
      { eventId: 'ev-career', studentId: 'st-mate-dmitry', createdAt: at(-1, 12) },
      { eventId: 'ev-hack', studentId: 'st-anna', createdAt: at(-1, 11) },
    ],
  });

  anna = {
    userId: 'auth-anna',
    login: 'anna',
    role: 'STUDENT',
    studentId: 'st-anna',
    groupName: 'ПИ-21',
    faculty: 'ИТ',
  };
  ilya = {
    ...anna,
    userId: 'auth-ilya',
    login: 'ilya',
    studentId: 'st-ilya',
    groupName: 'ЭК-11',
    faculty: 'ЭК',
  };
  maria = {
    ...anna,
    userId: 'auth-dean',
    login: 'maria',
    role: 'STAFF',
    studentId: null,
    groupName: null,
    faculty: 'ИТ',
  };
});

describe('toggle записи — запись и отмена', () => {
  it('запись создаёт РОВНО одну строку, повторный вызов отменяет запись', async () => {
    const before = await db.listEventRegistrationsByStudent('st-anna');
    expect(before.filter((r) => r.eventId === 'ev-culture')).toHaveLength(0);

    // Запись: строка одна, счётчик занятых растёт на 1.
    const up = await db.toggleEventRegistration('st-anna', 'ev-culture');
    expect(up).toEqual({ registered: true, taken: 1 });
    const mine = await db.listEventRegistrationsByStudent('st-anna');
    expect(mine.filter((r) => r.eventId === 'ev-culture')).toHaveLength(1);

    // Дубликат НЕ создаёт вторую строку: повторный toggle отменяет запись.
    const down = await db.toggleEventRegistration('st-anna', 'ev-culture');
    expect(down).toEqual({ registered: false, taken: 0 });
    expect(await db.listEventRegistrationsByStudent('st-anna')).toHaveLength(before.length);

    // И снова запись — снова ровно одна строка (чередование стабильное).
    const again = await db.toggleEventRegistration('st-anna', 'ev-culture');
    expect(again).toEqual({ registered: true, taken: 1 });
    expect(
      (await db.listEventRegistrationsByStudent('st-anna')).filter(
        (r) => r.eventId === 'ev-culture',
      ),
    ).toHaveLength(1);
    await db.toggleEventRegistration('st-anna', 'ev-culture'); // уборка за собой
  });

  it('запись на несуществующее мероприятие невозможна: null', async () => {
    expect(await db.toggleEventRegistration('st-anna', 'ev-unknown')).toBeNull();
  });

  it('через слой данных: студент записывается и отменяет, сотрудники не участвуют', async () => {
    // Студент: запись на лекцию (свободно).
    const ok = await toggleEventRegistrationForStudent(db, ilya, 'ev-lecture-ai');
    expect(ok).toMatchObject({ ok: true, slug: 'lekciya-ai-bbbb', registered: true, taken: 1 });
    expect(ok.ok && ok.spotsLeft).toBe(499); // capacity 500 − 1

    // Повторный клик отменяет запись (как в МСП — toggle).
    const off = await toggleEventRegistrationForStudent(db, ilya, 'ev-lecture-ai');
    expect(off).toMatchObject({ ok: true, registered: false, taken: 0, spotsLeft: 500 });
  });

  it('сотруднику записываться нельзя: отказ + аудит ROLE_MISMATCH', async () => {
    const before = db.auditEvents().length;
    const result = await toggleEventRegistrationForStudent(db, maria, 'ev-lecture-ai');
    expect(result).toMatchObject({ ok: false });
    expect(
      db
        .auditEvents()
        .slice(before)
        .map((e) => e.reason),
    ).toEqual(['ROLE_MISMATCH']);
    expect(
      db
        .auditEvents()
        .slice(before)
        .map((e) => e.resourceType),
    ).toEqual(['campus-event']);
  });

  it('несуществующее мероприятие: отказ + аудит NOT_FOUND (единый null наружу)', async () => {
    const before = db.auditEvents().length;
    const result = await toggleEventRegistrationForStudent(db, ilya, 'ev-unknown');
    expect(result).toMatchObject({ ok: false, error: 'Мероприятие не найдено' });
    expect(
      db
        .auditEvents()
        .slice(before)
        .map((e) => e.reason),
    ).toEqual(['NOT_FOUND']);
  });
});

describe('«Осталось N мест» при capacity', () => {
  it('заполненное мероприятие не принимает запись: «Мест нет» без аудита отказа', async () => {
    const attendeeCountBefore = await db.listEventAttendeeCount('ev-career');
    expect(attendeeCountBefore).toBe(2); // сид: 2 записи при capacity 2

    // Порт: строка не создаётся, возвращает занятость.
    const port = await db.toggleEventRegistration('st-anna', 'ev-career');
    expect(port).toEqual({ registered: false, taken: 2 });
    expect(await db.listEventAttendeeCount('ev-career')).toBe(2);

    // Слой: отказ «Мест нет» (отказ вместимости — без аудита доступа).
    const auditBefore = db.auditEvents().length;
    const result = await toggleEventRegistrationForStudent(db, anna, 'ev-career');
    expect(result).toMatchObject({ ok: false, error: 'Мест нет' });
    expect(db.auditEvents()).toHaveLength(auditBefore);
  });

  it('записанный студент может отменить даже на заполненном мероприятии', async () => {
    // Илья записан (сид). Отмена проходит, место освобождается.
    const off = await toggleEventRegistrationForStudent(db, ilya, 'ev-career');
    expect(off).toMatchObject({ ok: true, registered: false, taken: 1, spotsLeft: 1 });
    // Анна теперь может записаться — и возвращает сид (2 записи) на место.
    const on = await toggleEventRegistrationForStudent(db, anna, 'ev-career');
    expect(on).toMatchObject({ ok: true, registered: true, taken: 2, spotsLeft: 0 });
    // Возвращаем сид: Анна отменяется, Илья записывается обратно.
    await toggleEventRegistrationForStudent(db, anna, 'ev-career');
    await toggleEventRegistrationForStudent(db, ilya, 'ev-career');
  });

  it('метка мест: плюрализация и «Мест нет»', () => {
    expect(eventSpotsLabel(30, 0)).toBe('Осталось 30 мест');
    expect(eventSpotsLabel(30, 28)).toBe('Осталось 2 места');
    expect(eventSpotsLabel(30, 29)).toBe('Осталось 1 место');
    expect(eventSpotsLabel(30, 30)).toBe('Мест нет');
    expect(eventSpotsLabel(30, 31)).toBe('Мест нет'); // защита от перелива
  });

  it('agрегат занятости: только число, без чужих строк', async () => {
    const count = await db.listEventAttendeeCount('ev-hack');
    expect(count).toBe(1); // сид: запись Анны
  });
});

describe('фильтры и сортировка ленты', () => {
  it('parseEventsFilter: известное → то же, мусор и undefined → all', () => {
    expect(parseEventsFilter(undefined)).toBe('all');
    expect(parseEventsFilter('all')).toBe('all');
    expect(parseEventsFilter('week')).toBe('week');
    expect(parseEventsFilter('faculty')).toBe('faculty');
    expect(parseEventsFilter('career')).toBe('career');
    expect(parseEventsFilter('online')).toBe('online');
    expect(parseEventsFilter('junk')).toBe('all');
    expect(parseEventsFilter(['week', 'junk'])).toBe('week');
  });

  it('сортировка ленты: по дате старта по возрастанию, прошедшие первыми', async () => {
    const page = await getEventsPage(db, anna, 'all', NOW);
    expect(page.items.map((v) => v.event.id)).toEqual([
      'ev-past', // прошедшее (сид прототипа не содержит, контракт допускает)
      'ev-lecture-ai', // +2 дня
      'ev-career', // +4 дня
      'ev-hack', // +9 дней
      'ev-webinar', // +12 дней
      'ev-culture', // +16 дней
    ]);
    // Чипы «Записан» из сида: Анна записана на хакатон.
    const hack = page.items.find((v) => v.event.id === 'ev-hack');
    expect(hack?.registeredByMe).toBe(true);
    expect(page.items.find((v) => v.event.id === 'ev-career')?.registeredByMe).toBe(false);
  });

  it('фильтр «Онлайн»: только isOnline-события', async () => {
    const page = await getEventsPage(db, anna, 'online', NOW);
    expect(page.items.map((v) => v.event.id)).toEqual(['ev-lecture-ai', 'ev-webinar']);
    expect(page.items.every((v) => v.event.isOnline)).toBe(true);
  });

  it('фильтр «На этой неделе»: старт в ближайшие 7 дней от now', async () => {
    const page = await getEventsPage(db, anna, 'week', NOW);
    // +2 и +4 дня внутри недели; +9 — нет; прошедшее — нет (только предстоящие).
    expect(page.items.map((v) => v.event.id)).toEqual(['ev-lecture-ai', 'ev-career']);
  });

  it('фильтр «Мой факультет»: по тегу факультета контекста', async () => {
    const itPage = await getEventsPage(db, anna, 'faculty', NOW);
    expect(itPage.items.map((v) => v.event.id)).toEqual(['ev-lecture-ai', 'ev-career', 'ev-hack']);
    const ekPage = await getEventsPage(db, ilya, 'faculty', NOW);
    expect(ekPage.items.map((v) => v.event.id)).toEqual(['ev-webinar']);
  });

  it('фильтр «Карьера»: только события типа CAREER', async () => {
    const page = await getEventsPage(db, anna, 'career', NOW);
    expect(page.items.map((v) => v.event.id)).toEqual(['ev-career', 'ev-webinar']);
    expect(page.items.every((v) => v.event.kind === 'CAREER')).toBe(true);
  });

  it('чтение афиши доступно и сотруднику (мутации — отдельный контракт)', async () => {
    const page = await getEventsPage(db, maria, 'all', NOW);
    expect(page.items).toHaveLength(6);
    expect(page.items.every((v) => !v.registeredByMe)).toBe(true);
  });
});

describe('карточка события по slug', () => {
  it('открывается по публичному slug, видна запись владельца и занятость', async () => {
    const before = await openEventView(db, anna, 'hakaton-dddd');
    expect(before).not.toBeNull();
    expect(before?.event.id).toBe('ev-hack');
    expect(before?.registeredByMe).toBe(true); // сид Анны
    expect(before?.taken).toBe(1);
    expect(before?.spotsLeft).toBe(99);

    // Обычный клиент видит то же мероприятие без чужой записи.
    const forIlya = await openEventView(db, ilya, 'hakaton-dddd');
    expect(forIlya?.registeredByMe).toBe(false);
  });

  it('slug страницы нормализуется (trim + нижний регистр), как на /msp', async () => {
    // Страница нормализует ввод ДО вызова слоя (normalizeEventSlug).
    const view = await openEventView(db, anna, normalizeEventSlug(' Hakaton-DDDD '));
    expect(view?.event.id).toBe('ev-hack');
  });

  it('несуществующий slug: null + аудит NOT_FOUND (единый 404)', async () => {
    const before = db.auditEvents().length;
    const missing = await openEventView(db, anna, 'no-such-event');
    expect(missing).toBeNull();
    const events = db.auditEvents().slice(before);
    expect(events.map((e) => e.reason)).toEqual(['NOT_FOUND']);
    for (const event of events) {
      expect(event.resourceType).toBe('campus-event');
      expect(event.resourceRef).toBe('no-such-event');
    }
  });
});

describe('обложка-заглушка — детерминирована', () => {
  it('одинаковое название → одинаковый градиент (без random)', () => {
    const first = eventCoverOf('Хакатон «Цифровой прорыв»');
    const second = eventCoverOf('Хакатон «Цифровой прорыв»');
    expect(first).toEqual(second);
    expect(first.cover).toMatch(/^from-[a-z]+-100 to-[a-z]+-200$/);
    const all = new Set(
      ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ж', 'З', 'И', 'К'].map((t) => eventCoverOf(t).cover),
    );
    expect(all.size).toBeGreaterThan(1); // палитра реально разнообразит ленту
  });
});
