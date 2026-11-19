// DIG-87 — EN-локализация часть 1: каркас + dashboard + schedule + requests.
//
// Приёмка задачи: на английской версии НЕ должно быть русских слов и фраз.
// Красный-первый контур:
//  1) EN-словарь не содержит кириллицы (кроме осознанно двуязычных locale.*);
//  2) EN-рендер карточек/виджетов dashboard не содержит кириллицы;
//  3) EN-рендер карточек расписания (и aria-подписи, и «было: …») — без кириллицы;
//  4) EN-рендер мастера заказа (шаги 1–3) и карточки заявки — без кириллицы;
//  5) RU-строки новых ключей байт-в-байт равны прежним захардкоженным строкам.
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { cleanup, render } from '@testing-library/react';
import { createElement } from 'react';

// Мастер заказа использует useRouter (next/navigation) — в юнит-среде
// роутера нет, подменяем как tests/requests-order-wizard.test.tsx.
const replaceMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
}));

afterEach(cleanup);

import { en } from '@/lib/i18n/en';
import { ru as ruDict } from '@/lib/i18n/ru';
import { t } from '@/lib/i18n';
import {
  buildWeekSummary,
  daysLeftLabel,
  debtLabel,
  formatDelta,
  greetingFor,
  headingDateLabel,
  lessonKindLabel,
  pluralEnClasses,
} from '@/lib/dashboard-format';
import {
  formatDayShort,
  formatDayTitle,
  formatMonthTitle,
  pairsLabel,
  toScheduleEventCards,
  type ScheduleEventCard,
} from '@/lib/schedule-cards';
import { miniCalendarCells, toScheduleEventViews, weekLabel } from '@/lib/schedule-view';
import { semesterBounds, semesterBoundsLabel, startOfMoscowWeek } from '@/lib/schedule-time';
import { toEventDetailsView } from '@/lib/event-details';
import { requestTypeHint } from '@/lib/request-order-map';
import { formatAttachmentSize } from '@/lib/request-card-view';
import { wizardDeliveryLabel, wizardFilesError } from '@/lib/request-wizard-schema';
import { dueLabel, taskActionLabel, taskSourceLabel } from '@/lib/task-format';
import { requestNumberLabel } from '@/lib/requests-view';
import { Hero, RequestsSection, TodaySection } from '@/components/dashboard/sections';
import { DayView } from '@/components/schedule/day-view';
import { EventCard } from '@/components/schedule/event-card';
import { ViewSwitcher } from '@/components/schedule/view-switcher';
import { EventTypePill } from '@/components/schedule/event-type-pill';
import {
  OrderWizard,
  type WizardProfileDto,
  type WizardTypeDto,
} from '@/components/requests/order-wizard';
import { RequestCard } from '@/components/requests/request-card';
import type { RequestCardView } from '@/lib/requests-view';

const CYRILLIC = /[А-Яа-яЁё]/;

function expectNoCyrillic(html: string, what: string) {
  const hit = CYRILLIC.exec(html);
  expect(
    hit,
    `${what}: кириллица в EN-рендере: …${html.slice(Math.max(0, (hit?.index ?? 0) - 40), (hit?.index ?? 0) + 60)}…`,
  ).toBeNull();
}

// ── 1. словари ────────────────────────────────────────────────────────────────

describe('DIG-87: EN-словарь без кириллицы', () => {
  it('ни одно EN-значение не содержит кириллицы (кроме двуязычных locale.*)', () => {
    for (const [key, value] of Object.entries(en)) {
      if (key.startsWith('locale.')) continue; // осознанно двуязычный переключатель
      expect(CYRILLIC.test(value), `ключ ${key}: «${value}»`).toBe(false);
    }
  });

  it('наборы ключей RU и EN по-прежнему идентичны', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(ruDict).sort());
  });

  it('RU-строки новых ключей байт-в-байт равны прежним строкам интерфейса', () => {
    // dashboard: виджеты
    expect(ruDict['dashboard.widget.today']).toBe('Сегодня');
    expect(ruDict['dashboard.widget.deadlines']).toBe('Ближайшие дедлайны');
    expect(ruDict['dashboard.widget.progress']).toBe('Как у меня дела');
    expect(ruDict['dashboard.widget.tasks']).toBe('Что от меня ждут');
    expect(ruDict['dashboard.widget.requests']).toBe('Заявки');
    expect(ruDict['dashboard.widget.news']).toBe('Новости деканата');
    expect(ruDict['dashboard.widget.events']).toBe('Мероприятия');
    expect(ruDict['dashboard.widget.quickActions']).toBe('Быстрые действия');
    expect(ruDict['dashboard.hero.title']).toBe('Ваша неделя');
    // dashboard: плитки и подсказки
    expect(ruDict['dashboard.tile.average']).toBe('Средний балл');
    expect(ruDict['dashboard.tile.credits']).toBe('Кредиты');
    expect(ruDict['dashboard.tile.debts']).toBe('Долги');
    expect(ruDict['dashboard.tile.requestsInWork']).toBe('Заявки в работе');
    expect(ruDict['dashboard.tile.creditsOf']).toBe('из {total}');
    expect(ruDict['dashboard.tile.requestsTotal']).toBe('всего заявок: {total}');
    // schedule: виды и карточка
    expect(ruDict['schedule.view.day']).toBe('День');
    expect(ruDict['schedule.view.week']).toBe('Неделя');
    expect(ruDict['schedule.view.month']).toBe('Месяц');
    expect(ruDict['schedule.badge.moved']).toBe('Перенос');
    expect(ruDict['schedule.badge.cancelled']).toBe('Отмена');
    expect(ruDict['schedule.was.room']).toBe('было: ауд. {room}');
    expect(ruDict['schedule.was']).toBe('было: {parts}');
    expect(ruDict['schedule.untilPrefix']).toBe('до');
    expect(ruDict['schedule.room.label']).toBe('ауд. {room}');
    expect(ruDict['schedule.day.empty.title']).toBe('Пар в этот день нет');
    expect(ruDict['schedule.day.empty.next']).toBe('Ближайшие пары: {label}');
    // wizard
    expect(ruDict['wizard.title']).toBe('Заказ справки или заявления');
    expect(ruDict['wizard.stepLabel']).toBe('Шаг {step} из 3 · {title}');
    expect(ruDict['wizard.step.what']).toBe('Что нужно');
    expect(ruDict['wizard.step.params']).toBe('Параметры');
    expect(ruDict['wizard.step.review']).toBe('Проверка');
    expect(ruDict['wizard.destination.label']).toBe('Куда предоставляется');
    expect(ruDict['wizard.delivery.label']).toBe('Способ получения');
    expect(ruDict['wizard.exit.title']).toBe('Выйти без сохранения?');
    // задача-виджет
    expect(ruDict['tasks.markDone']).toBe('Отметить выполненной');
  });
});

// ── 2. dashboard ──────────────────────────────────────────────────────────────

const progressEn = {
  ok: true as const,
  value: {
    average: 88.7,
    averageDelta: 2.3,
    credits: 120,
    creditsTotal: 240,
    debts: [{ disciplineName: 'Computer Science', dateLabel: 'November 18', daysLeft: 7 }],
    disciplines: [],
  },
};

const requestsEn = { ok: true as const, value: { inWork: 2, total: 3 } };

describe('DIG-87: dashboard — EN-рендер без кириллицы', () => {
  it('hero: заголовок, приветствие, плитки и подсказки', () => {
    const html = renderToStaticMarkup(
      createElement(Hero, {
        firstName: 'Anna',
        greeting: t('en', 'dashboard.greeting.day'),
        headingDate: headingDateLabel(new Date(2026, 10, 11), 'en'),
        summary: buildWeekSummary({ pairs: 4, moved: 1, cancelled: 1, retakeDaysLeft: 7 }, 'en'),
        progress: progressEn,
        requests: requestsEn,
        locale: 'en',
      }),
    );
    expectNoCyrillic(html, 'Hero');
    expect(html).toContain('Your week');
    expect(html).toContain('Good afternoon, Anna');
    expect(html).toContain('GPA');
    expect(html).toContain('Credits');
    expect(html).toContain('Debts');
    expect(html).toContain('Requests in progress');
    expect(html).toContain('of 240');
    expect(html).toContain('total requests: 3');
  });

  it('сводка героя и дни до дедлайна на EN', () => {
    expect(buildWeekSummary({ pairs: 4, moved: 1, cancelled: 1, retakeDaysLeft: 7 }, 'en')).toBe(
      'Today 4 classes, one rescheduled, one cancelled. 7 days until the retake.',
    );
    expect(buildWeekSummary({ pairs: 0, moved: 0, cancelled: 0, retakeDaysLeft: null }, 'en')).toBe(
      'No classes today.',
    );
    expect(daysLeftLabel(7, 'en')).toBe('7 days left');
    expect(daysLeftLabel(0, 'en')).toBe('Today');
    expect(daysLeftLabel(1, 'en')).toBe('Tomorrow');
    expect(debtLabel(1, 'en')).toBe('1 debt');
    expect(debtLabel(3, 'en')).toBe('3 debts');
    expect(greetingFor(new Date(2026, 10, 11, 12, 0), 'en')).toBe('Good afternoon');
    expect(formatDelta(2.3, 'en')).toBe('+2.3');
    expect(pluralEnClasses(1)).toBe('class');
    expect(pluralEnClasses(4)).toBe('classes');
  });

  it('виджет «Сегодня»: пустой день и ближайший учебный день', () => {
    const html = renderToStaticMarkup(
      createElement(TodaySection, {
        today: {
          ok: true as const,
          value: {
            lessons: [],
            movedCount: 0,
            cancelledCount: 0,
            nearestStudyDay: { label: 'Thursday, November 12', count: 1 },
          },
        },
        locale: 'en',
      }),
    );
    expectNoCyrillic(html, 'TodaySection empty');
    expect(html).toContain('No classes today');
    expect(html).toContain('Next study day — Thursday, November 12: 1 class.');
  });

  it('виджет «Заявки»: счётчики и ссылка «Все заявки»', () => {
    const html = renderToStaticMarkup(
      createElement(RequestsSection, { requests: requestsEn, locale: 'en' }),
    );
    expectNoCyrillic(html, 'RequestsSection');
    expect(html).toContain('requests in progress');
    expect(html).toContain('ready for pickup');
    expect(html).toContain('All requests');
  });
});

// ── 3. schedule ───────────────────────────────────────────────────────────────

const row = (
  overrides: Partial<Parameters<typeof toScheduleEventCards>[0][number]> = {},
): Parameters<typeof toScheduleEventCards>[0][number] => ({
  id: 'sch-1',
  groupName: 'CS-21',
  disciplineCode: 'PI21-INFO',
  disciplineName: 'Computer Science',
  teacherName: 'Peter Petrov',
  room: '301',
  building: null,
  onlineUrl: null,
  date: new Date(2026, 10, 11, 10, 0),
  startsAt: new Date(2026, 10, 11, 10, 0),
  endsAt: new Date(2026, 10, 11, 11, 30),
  kind: 'LECTURE' as const,
  status: 'SCHEDULED' as const,
  previousRoom: null,
  previousStartsAt: null,
  note: null,
  changeNote: null,
  changeAuthor: null,
  homework: null,
  materials: null,
  ...overrides,
});

describe('DIG-87: schedule — EN-модели карточек без кириллицы', () => {
  it('карточка пары: аудитория, «было», aria-label, тип занятия', () => {
    const [card] = toScheduleEventCards(
      [row({ status: 'ROOM_CHANGED' as const, previousRoom: '214' })],
      'en',
    );
    expect(card!.roomLabel).toBe('Room 301');
    expect(card!.previousRoomLabel).toBe('was: room 214');
    expect(card!.ariaLabel).toBe('Lecture, Computer Science, 10:00–11:30, Room 301, rescheduled');
    const [online] = toScheduleEventCards([row({ room: 'Онлайн' })], 'en');
    expect(online!.roomLabel).toBe('online');
    const html = renderToStaticMarkup(
      createElement(EventCard, { event: card! as ScheduleEventCard, locale: 'en' }),
    );
    expectNoCyrillic(html, 'EventCard');
    expect(html).toContain('Rescheduled');
    expect(html).toContain('until 11:30');
    const pill = renderToStaticMarkup(
      createElement(EventTypePill, { kind: 'LAB' as const, locale: 'en' }),
    );
    expectNoCyrillic(pill, 'EventTypePill');
    expect(pill).toContain('Lab');
    expect(lessonKindLabel('LECTURE', 'en')).toBe('Lecture');
    expect(lessonKindLabel('LECTURE')).toBe('Лекция');
  });

  it('недельная модель: «было: ауд./время», подписи строк', () => {
    const [view] = toScheduleEventViews(
      [
        row({
          status: 'ROOM_CHANGED' as const,
          previousRoom: '214',
          previousStartsAt: new Date(2026, 10, 11, 11, 10),
        }),
      ],
      'en',
    );
    expect(view!.previousLabel).toBe('was: room 214 / 11:10');
    expectNoCyrillic(view!.ariaLabel, 'ScheduleEventView aria');
  });

  it('вид «День»: заголовки, пустой день, стрелки', () => {
    const cards = toScheduleEventCards([row()], 'en');
    const html = renderToStaticMarkup(
      createElement(DayView, {
        title: formatDayTitle(new Date(2026, 10, 11), 'en'),
        isToday: true,
        events: cards,
        prevHref: null,
        nextHref: null,
        todayHref: '/schedule?view=day',
        nextStudy: null,
        locale: 'en',
      }),
    );
    expectNoCyrillic(html, 'DayView');
    expect(html).toContain('Wednesday, November 11');
    expect(html).toContain('today');
  });

  it('пустой день: «Ближайшие пары» и «пар больше нет»', () => {
    const html = renderToStaticMarkup(
      createElement(DayView, {
        title: formatDayTitle(new Date(2026, 10, 11), 'en'),
        isToday: false,
        events: [],
        prevHref: null,
        nextHref: null,
        todayHref: '/schedule?view=day',
        nextStudy: { dateKey: '2026-11-12', label: 'Thu, November 12' },
        locale: 'en',
      }),
    );
    expectNoCyrillic(html, 'DayView empty');
    expect(html).toContain('No classes on this day');
    expect(html).toContain('Next classes: Thu, November 12');
    const htmlNone = renderToStaticMarkup(
      createElement(DayView, {
        title: formatDayTitle(new Date(2026, 10, 11), 'en'),
        isToday: false,
        events: [],
        prevHref: null,
        nextHref: null,
        todayHref: '/schedule?view=day',
        nextStudy: null,
        locale: 'en',
      }),
    );
    expect(htmlNone).toContain('No more classes this semester');
  });

  it('переключатель видов и даты на EN', () => {
    const html = renderToStaticMarkup(
      createElement(ViewSwitcher, {
        view: 'week',
        platform: 'desktop',
        currentQuery: '',
        todayKey: '2026-11-11',
        locale: 'en',
      }),
    );
    expectNoCyrillic(html, 'ViewSwitcher');
    expect(html).toContain('Day');
    expect(html).toContain('Week');
    expect(html).toContain('Month');
    expect(formatDayShort(new Date(2026, 10, 12), 'en')).toBe('Thu, November 12');
    expect(formatDayShort(new Date(2026, 10, 12))).toBe('чт, 12 ноября');
    expect(formatMonthTitle(2026, 11, 'en')).toBe('November 2026');
    expect(formatMonthTitle(2026, 11)).toBe('Ноябрь 2026');
    expect(pairsLabel(3, 'en')).toBe('3 classes');
    expect(pairsLabel(3)).toBe('3 пары');
  });

  it('неделя/семестр/мини-календарь на EN и байт-в-байт RU', () => {
    // Понедельник недели 9–15 ноября: weekWindow().from — это понедельник
    // «−2 недели» (окно данных ленты), поэтому берём startOfMoscowWeek.
    const monday = startOfMoscowWeek(new Date(2026, 10, 11));
    expect(weekLabel(monday, 'en')).toBe('November 9 – 15, 2026');
    expect(weekLabel(monday)).toBe('9 – 15 ноября 2026');
    expect(semesterBounds(new Date(2026, 10, 11), 'en').label).toBe('Fall semester 2026/27');
    expect(semesterBoundsLabel(new Date(2026, 10, 11), 'en')).toBe('Fall semester 2026/27');
    expect(semesterBounds(new Date(2026, 10, 11)).label).toBe('Осенний семестр 2026/27');
    const mini = miniCalendarCells(monday, 'en');
    expectNoCyrillic(mini.monthLabel, 'mini monthLabel');
    expectNoCyrillic(mini.weekdays.join(' '), 'mini weekdays');
    expect(mini.monthLabel).toBe('November 2026');
    expect(mini.weekdays.join(' ')).toBe('Mon Tue Wed Thu Fri Sat Sun');
  });

  it('детали пары: EN-модель без кириллицы', () => {
    const view = toEventDetailsView(
      row({ status: 'ROOM_CHANGED' as const, previousRoom: '214' }),
      'en',
    );
    expect(view.kindLabel).toBe('Lecture');
    expect(view.dateLabel).toBe('Wednesday, November 11');
    expect(view.roomLabel).toBe('Room 301');
    expect(view.buildingLabel).toBe('Main building');
    expect(view.move!.authorLabel).toBe('the deanery');
    expect(view.move!.wasLabel).toBe('room 214');
  });
});

// ── 4. requests ───────────────────────────────────────────────────────────────

const cardEn: RequestCardView = {
  id: 'creq-1',
  // Канонический номер «ЗД-…» содержит кириллицу: на EN карточка показывает
  // его транслитом «ZD-…» (requestNumberLabel), ссылка — канонический номер.
  number: 'ЗД-2026-000123',
  title: 'Enrollment certificate',
  iconKind: 'certificate',
  status: 'IN_PROGRESS',
  createdAtLabel: 'November 16, 10:05 MSK',
  createdAtISO: new Date(2026, 10, 16, 10, 5).toISOString(),
  updatedAtISO: new Date(2026, 10, 17, 9, 0).toISOString(),
  readyByISO: null,
  reason: null,
  nextAction: 'The deanery is preparing the document',
  action: 'CANCEL',
  isFix: false,
} as RequestCardView;

const wizardTypes: WizardTypeDto[] = [
  {
    code: 'CERT_ENROLLMENT',
    name: 'Enrollment certificate',
    etaDays: 1,
    format: 'ELECTRONIC',
    isInstant: true,
    formSchema: { fields: [] },
  },
  {
    code: 'GRADES_EXTRACT',
    name: 'Grades extract',
    etaDays: 3,
    format: 'PAPER',
    isInstant: false,
    formSchema: { fields: [] },
  },
];

const wizardProfile: WizardProfileDto = {
  fullName: 'Anna Smirnova',
  groupName: 'CS-21',
  course: 2,
  faculty: 'IT',
};

describe('DIG-87: requests — мастер заказа и карточка на EN без кириллицы', () => {
  it('мастер, шаг 1: типы, подсказки, бейджи', () => {
    // Portal base-ui не рендерится в renderToStaticMarkup — клиентский рендер.
    render(
      createElement(OrderWizard, {
        types: wizardTypes,
        profile: wizardProfile,
        orderParam: 'new',
        autoTarget: null,
        action: async () => null,
        locale: 'en',
      }),
    );
    const html = document.body.innerHTML;
    expectNoCyrillic(html, 'OrderWizard step 1');
    expect(html).toContain('Order a certificate or application');
    expect(html).toContain('Step 1 of 3 · What you need');
    expect(html).toContain('Instant');
  });

  it('хелперы мастера: подсказка типа, способ получения, лимит файлов, формат', () => {
    expectNoCyrillic(requestTypeHint('CERT_ENROLLMENT', 'en'), 'requestTypeHint');
    expect(requestTypeHint('CERT_ENROLLMENT')).toBe(
      'Подтверждает, что вы студент вуза: программа, курс, форма обучения',
    );
    expectNoCyrillic(wizardDeliveryLabel('PICKUP', 'en'), 'wizardDeliveryLabel');
    expect(wizardDeliveryLabel('PICKUP')).toBe('Забрать в деканате');
    expectNoCyrillic(
      wizardFilesError([{ name: 'scan.pdf', size: 20 * 1024 * 1024 }], 0, 'en')!,
      'files error',
    );
    expect(wizardFilesError([{ name: 'scan.pdf', size: 20 * 1024 * 1024 }], 0)).toBe(
      'Файл «scan.pdf» больше 10 МБ',
    );
    expect(formatAttachmentSize(1500, 'en')).toBe('1 KB');
    expect(formatAttachmentSize(1500)).toBe('1 КБ');
  });

  it('карточка заявки: EN-рендер без кириллицы, номер транслитом «ZD-…»', () => {
    expect(requestNumberLabel('ЗД-2026-000123', 'en')).toBe('ZD-2026-000123');
    expect(requestNumberLabel('ЗД-2026-000123', 'ru')).toBe('ЗД-2026-000123');
    const html = renderToStaticMarkup(
      createElement(RequestCard, { request: cardEn, locale: 'en' }),
    );
    expectNoCyrillic(html, 'RequestCard');
    expect(html).toContain('ZD-2026-000123');
    expect(html).toContain('href="/requests/%D0%97%D0%94-2026-000123"'); // ссылка — канон
    expect(html).toContain('In progress');
    expect(html).toContain('submitted');
    expect(html).toContain('Cancel');
  });

  it('строки задач виджета: источники, действия, сроки на EN и байт-в-байт RU', () => {
    expectNoCyrillic(taskSourceLabel('REQUEST', 'en'), 'taskSourceLabel');
    expect(taskSourceLabel('REQUEST')).toBe('Заявка');
    expect(taskActionLabel('RETAKE', 'en')).toBe('Sign up');
    expect(taskActionLabel('RETAKE')).toBe('К записи');
    expectNoCyrillic(dueLabel(2, new Date(2026, 10, 18, 9, 0), 'en'), 'dueLabel');
    expect(dueLabel(2, new Date(2026, 10, 18, 9, 0))).toBe('до 18 ноября');
    expect(dueLabel(null, null)).toBe('Срок не назначен');
  });
});
