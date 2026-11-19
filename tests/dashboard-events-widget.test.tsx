// DIG-76 — виджет «Мероприятия» на главной: реальные ближайшие события.
//
// Баг регресса 18.11: виджет рендерил статическую заглушку «Мероприятия
// скоро появятся», хотя экран /events работает с реальными событиями (сид).
// Приёмка:
//  - слой данных (фасад events.ts, getDashboardEvents) отдаёт ближайшие
//    БУДУЩИЕ события от now, с агрегатами (занято/свободно) и owner-scoped
//    флагом записи владельца сессии (registeredByMe);
//  - с сидом виджет показывает мини-карточки (дата, название, место/онлайн,
//    «Осталось N мест», чип «Записан») и ссылку «Все мероприятия» → /events;
//  - без будущих событий — честная заглушка «Мероприятия скоро появятся»;
//  - сбой источника — изолированное состояние ошибки блока;
//  - EN-рендер без кириллицы (дата, чип, места — по словарю и локали).
import { beforeAll, describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { createMemoryDataDb, type MemoryDataDb } from '@/server/data/memory-db';
import { getDashboardEvents, type EventsSummary } from '@/server/data/events';
import { EventsSection } from '@/components/dashboard/sections';
import type { DashboardSection } from '@/server/data';
import type { DataCtx, EventRow } from '@/server/data/types';
import type { EventView } from '@/server/data';

/** Детерминированное «сейчас»: вторник 17 ноября 2026, 12:00. */
const NOW = new Date(2026, 10, 17, 12, 0, 0);
const at = (dayOffset: number, hour: number, minute = 0): Date => {
  const d = new Date(NOW);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
};

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

// ── 1. Слой данных: getDashboardEvents ───────────────────────────────────────

describe('DIG-76: getDashboardEvents — ближайшие будущие события', () => {
  let db: MemoryDataDb;
  let anna: DataCtx;
  let ilya: DataCtx;
  let maria: DataCtx;

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
        // Прошедшее событие не попадает в виджет (фильтр от now).
        eventSeed({
          id: 'ev-past',
          slug: 'past-event-aaaa',
          title: 'Прошедшая встреча',
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
          startsAt: at(2, 18, 30),
        }),
        eventSeed({
          id: 'ev-career',
          slug: 'karernyj-den-cccc',
          title: 'Карьерный день',
          kind: 'CAREER',
          capacity: 2, // заполнено записями ниже → «Мест нет»
          location: 'Главный корпус, атриум',
          startsAt: at(4, 14),
        }),
        eventSeed({
          id: 'ev-hack',
          slug: 'hakaton-dddd',
          title: 'Хакатон',
          kind: 'HACKATHON',
          capacity: 100,
          startsAt: at(9, 10),
        }),
        eventSeed({
          id: 'ev-webinar',
          slug: 'vebinar-eeee',
          title: 'Онлайн-вебинар',
          kind: 'CAREER',
          isOnline: true,
          capacity: 300,
          startsAt: at(12, 19),
        }),
      ],
      eventRegistrations: [
        // Карьерный день заполнен без Анны (capacity 2); хакатон — её запись.
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

  it('отдаёт ближайшие будущие от now (по возрастанию), прошедшие не проходят', async () => {
    const { items } = await getDashboardEvents(db, anna, NOW);
    // Три ближайших будущих: лекция (+2д), карьерный день (+4д), хакатон (+9д).
    expect(items.map((v) => v.event.slug)).toEqual([
      'lekciya-ai-bbbb',
      'karernyj-den-cccc',
      'hakaton-dddd',
    ]);
  });

  it('агрегаты: занято/свободно считаются, «Мест нет» при capacity', async () => {
    const { items } = await getDashboardEvents(db, anna, NOW);
    const lecture = items.find((v) => v.event.id === 'ev-lecture-ai')!;
    expect(lecture.taken).toBe(0);
    expect(lecture.spotsLeft).toBe(500);
    const career = items.find((v) => v.event.id === 'ev-career')!;
    expect(career.taken).toBe(2);
    expect(career.spotsLeft).toBe(0);
  });

  it('registeredByMe — скоуп владельца сессии (IDOR): у каждого свой флаг', async () => {
    const annaView = await getDashboardEvents(db, anna, NOW);
    expect(annaView.items.map((v) => [v.event.id, v.registeredByMe] as const)).toEqual([
      ['ev-lecture-ai', false],
      ['ev-career', false],
      ['ev-hack', true], // Анна записана на хакатон
    ]);
    const ilyaView = await getDashboardEvents(db, ilya, NOW);
    expect(ilyaView.items.map((v) => [v.event.id, v.registeredByMe] as const)).toEqual([
      ['ev-lecture-ai', false],
      ['ev-career', true], // Илья заполнил карьерный день
      ['ev-hack', false],
    ]);
    // Сотрудник не записан нигде (нет studentId).
    const staffView = await getDashboardEvents(db, maria, NOW);
    expect(staffView.items.every((v) => !v.registeredByMe)).toBe(true);
  });

  it('лимит виджета: не больше трёх ближайших', async () => {
    const { items } = await getDashboardEvents(db, anna, NOW);
    expect(items).toHaveLength(3);
  });

  it('нет будущих событий → пустой список (честный empty-state виджета)', async () => {
    const pastOnly = createMemoryDataDb();
    pastOnly.seed({
      events: [
        eventSeed({
          id: 'ev-old',
          slug: 'staryj-slug',
          startsAt: at(-30, 10),
          endsAt: at(-30, 12),
        }),
      ],
    });
    const { items } = await getDashboardEvents(pastOnly, anna, NOW);
    expect(items).toEqual([]);
  });
});

// ── 2. Рендер виджета EventsSection ──────────────────────────────────────────

const ok = (value: EventsSummary): DashboardSection<EventsSummary> => ({ ok: true, value });
const fail = (error: string): DashboardSection<EventsSummary> => ({ ok: false, error });

/** Мини-фистур двух ближайших событий из сида (виджет показывает 2-3). */
const widgetViews: EventView[] = [
  {
    event: eventSeed({
      id: 'ev-lecture-ai',
      slug: 'lekciya-ai-bbbb',
      title: 'Лекция про AI',
      isOnline: true,
      onlineUrl: 'https://events.example.edu/live/ai',
      location: 'Онлайн-трансляция',
      capacity: 500,
      startsAt: at(3, 18, 30),
      endsAt: at(3, 20),
    }),
    taken: 2,
    spotsLeft: 498,
    registeredByMe: false,
  },
  {
    event: eventSeed({
      id: 'ev-career-day',
      slug: 'karernyj-den-cccc',
      title: 'Карьерный день',
      kind: 'CAREER',
      capacity: 2,
      location: 'Главный корпус, атриум',
      startsAt: at(4, 14),
      endsAt: at(4, 18),
    }),
    taken: 2,
    spotsLeft: 0,
    registeredByMe: true, // владелец сессии записан → чип «Записан»
  },
];

const renderWidget = (section: DashboardSection<EventsSummary>, locale: 'ru' | 'en' = 'ru') =>
  renderToStaticMarkup(createElement(EventsSection, { events: section, locale }));

describe('DIG-76: EventsSection — реальные события вместо заглушки', () => {
  it('мини-карточки: дата, название, ссылка на карточку, место/онлайн', () => {
    const html = renderWidget(ok({ items: widgetViews }));
    // Обе карточки с ссылками на карточки событий.
    expect(html).toContain('href="/events/lekciya-ai-bbbb"');
    expect(html).toContain('href="/events/karernyj-den-cccc"');
    // Названия.
    expect(html).toContain('Лекция про AI');
    expect(html).toContain('Карьерный день');
    // Дата и время старта (20 нояб. · 18:30 / 21 нояб. · 14:00).
    expect(html).toContain('20 нояб.');
    expect(html).toContain('18:30');
    expect(html).toContain('21 нояб.');
    expect(html).toContain('14:00');
    // Место: онлайн-событие помечено «Онлайн», офлайн — площадка.
    expect(html).toContain('Онлайн');
    expect(html).toContain('Главный корпус, атриум');
    // Заглушки больше нет.
    expect(html).not.toContain('Мероприятия скоро появятся');
  });

  it('«Осталось N мест» / «Мест нет» и чип «Записан» только на своём событии', () => {
    const html = renderWidget(ok({ items: widgetViews }));
    expect(html).toContain('Осталось 498 мест');
    expect(html).toContain('Мест нет');
    // Чип «Записан» на карьерном дне (registeredByMe) и только на нём.
    expect(html).toContain('data-testid="dashboard-event-chip-karernyj-den-cccc"');
    expect(html).toContain('Записан');
    expect(html).not.toContain('data-testid="dashboard-event-chip-lekciya-ai-bbbb"');
  });

  it('ссылка «Все мероприятия» ведёт на /events', () => {
    const html = renderWidget(ok({ items: widgetViews }));
    expect(html).toContain('data-testid="dashboard-events-all"');
    expect(html).toContain('href="/events"');
  });

  it('пустое состояние: без будущих событий — честная заглушка, без списка и ссылки', () => {
    const html = renderWidget(ok({ items: [] }));
    expect(html).toContain('Мероприятия скоро появятся');
    expect(html).toContain('Раздел готовится');
    expect(html).not.toContain('data-testid="dashboard-events-list"');
    expect(html).not.toContain('Все мероприятия');
  });

  it('сбой источника изолирован: собственное состояние ошибки блока', () => {
    const html = renderWidget(fail('events db down'));
    expect(html).toContain('Блок «Мероприятия» не загрузился');
    expect(html).toMatch(/role="alert"/);
  });

  it('EN: даты, места, чип и места без кириллицы', () => {
    const html = renderWidget(ok({ items: widgetViews }), 'en');
    expect(html).toContain('All events');
    expect(html).toContain('data-testid="dashboard-event-chip-karernyj-den-cccc"');
    expect(html).toContain('Registered');
    expect(html).toContain('498 spots left');
    expect(html).toContain('No spots');
    expect(html).toContain('Nov 20');
    // EN-рендер демо-события: титул/место из словаря en-demo-content.
    expect(html).toContain('Lecture: how large language models work');
    expect(html).toContain('Main building, atrium');
    expect(html).not.toMatch(/[а-яА-ЯёЁ]/);
  });
});
