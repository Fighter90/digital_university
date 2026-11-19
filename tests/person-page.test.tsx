// DIG-37 — контракт страницы карточки человека /people/[id] (SSR).
// Приёмка: контакты (email, кабинет, телефон), часы консультаций,
// дисциплины (с пометкой «ваша»), ближайшие пары студента с этим
// преподавателем, кнопки «Написать письмо» (mailto) и «Записаться на
// консультацию» (заглушка), «Ваш менеджер»; неизвестный id → единый 404.
import { describe, expect, it, vi } from 'vitest';
import { createElement, type ComponentType } from 'react';
import { prerenderToNodeStream } from 'react-dom/static';

import type { PersonCardData } from '@/server/data/people';
import type { DataCtx } from '@/server/data/types';

const studentCtx: DataCtx = {
  userId: 'auth-anna',
  login: 'anna.smirnova',
  role: 'STUDENT',
  studentId: 'st-anna',
  groupName: 'ПИ-21',
  faculty: 'ИТ',
};

const staffCtx: DataCtx = { ...studentCtx, role: 'STAFF', studentId: null, groupName: null };

const state = vi.hoisted(() => ({
  ctx: null as unknown,
  card: null as PersonCardData | null,
  notFoundCalled: false,
  lastId: null as string | null,
}));

vi.mock('@/server/data/db', () => ({ dataDb: {} }));

vi.mock('@/server/data', () => ({
  requireDataCtx: vi.fn(async () => state.ctx),
  getPersonCard: vi.fn(async (_db: unknown, _ctx: unknown, id: string) => {
    state.lastId = id;
    return state.card;
  }),
}));

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    state.notFoundCalled = true;
    throw new Error('NEXT_HTTP_ERROR_FALLBACK;404');
  }),
}));

import PersonPage from '@/app/(cabinet)/people/[id]/page';

async function renderPage(id = 'teacher-ivanova'): Promise<string> {
  const Page = PersonPage as unknown as ComponentType<{ params: Promise<{ id: string }> }>;
  const { prelude } = await prerenderToNodeStream(
    createElement(Page, { params: Promise.resolve({ id }) }),
  );
  let html = '';
  for await (const chunk of prelude) {
    html += String(chunk);
  }
  return html.replaceAll('<!-- -->', '');
}

function teacherFixture(): PersonCardData {
  return {
    href: '/people/teacher-ivanova',
    person: {
      id: 'teacher-ivanova',
      kind: 'TEACHER',
      fullName: 'Иванова Ирина Игоревна',
      position: 'Старший преподаватель',
      department: 'Кафедра программной инженерии',
      email: 'irina.ivanova@example.edu',
      phone: '+7 495 010-20-30',
      room: '405',
      consultationHours: 'Вт 14:00–16:00, ауд. 405',
      faculty: 'ИТ',
      program: null,
      isProgramManager: false,
      disciplines: [
        { name: 'Программирование', code: 'PI21-PROG' },
        { name: 'Алгоритмы и структуры данных', code: 'PI21-ALG' },
        { name: 'Информатика', code: 'PI21-INFO' },
      ],
    },
    isMyTeacher: true,
    isMyDeanery: false,
    isMyManager: false,
    hasPersonalScope: true,
    myDisciplines: [
      { name: 'Программирование', code: 'PI21-PROG' },
      { name: 'Алгоритмы и структуры данных', code: 'PI21-ALG' },
    ],
    upcoming: [
      {
        id: 'ev-future',
        dateKey: '2026-11-17',
        dateLabel: '17 ноября, вт',
        timeLabel: '12:00–13:30',
        disciplineName: 'Программирование',
        kind: 'LECTURE',
        kindLabel: 'Лекция',
        roomLabel: 'ауд. 405',
        status: 'SCHEDULED',
      },
    ],
  };
}

function managerFixture(): PersonCardData {
  return {
    href: '/people/staff-belova',
    person: {
      id: 'staff-belova',
      kind: 'STAFF',
      fullName: 'Наталья Белова',
      position: 'Менеджер программы «Прикладная информатика»',
      department: 'Деканат факультета ИТ',
      email: 'natalia.belova@example.edu',
      phone: '+7 495 010-40-50',
      room: '214',
      consultationHours: 'Пн–Пт 10:00–12:00, ауд. 214',
      faculty: 'ИТ',
      program: 'Прикладная информатика',
      isProgramManager: true,
      disciplines: [],
    },
    isMyTeacher: false,
    isMyDeanery: true,
    isMyManager: true,
    hasPersonalScope: true,
    myDisciplines: [],
    upcoming: null,
  };
}

describe('/people/[id] — карточка преподавателя (студент)', () => {
  it('шапка: ФИО, должность, подразделение, ссылка назад в справочник', async () => {
    state.ctx = studentCtx;
    state.card = teacherFixture();

    const html = await renderPage();
    expect(html).toContain('href="/people"');
    expect(html).toContain('Иванова Ирина Игоревна');
    expect(html).toContain('Старший преподаватель');
    expect(html).toContain('Кафедра программной инженерии');
  });

  it('контакты: email, кабинет, телефон', async () => {
    state.ctx = studentCtx;
    state.card = teacherFixture();

    const html = await renderPage();
    expect(html).toContain('data-testid="person-contacts"');
    expect(html).toContain('irina.ivanova@example.edu');
    expect(html).toContain('ауд. 405');
    expect(html).toContain('+7 495 010-20-30');
  });

  it('часы консультаций и дисциплины с пометкой «ваша»', async () => {
    state.ctx = studentCtx;
    state.card = teacherFixture();

    const html = await renderPage();
    expect(html).toContain('Часы консультаций');
    expect(html).toContain('Вт 14:00–16:00, ауд. 405');
    expect(html).toContain('data-testid="person-disciplines"');
    expect(html).toContain('Алгоритмы и структуры данных');
    expect(html).toContain('ваша');
  });

  it('ближайшие пары студента с преподавателем', async () => {
    state.ctx = studentCtx;
    state.card = teacherFixture();

    const html = await renderPage();
    expect(html).toContain('data-testid="person-upcoming"');
    expect(html).toContain('Программирование');
    expect(html).toContain('17 ноября, вт');
    expect(html).toContain('12:00–13:30');
  });

  it('кнопки «Написать письмо» (mailto) и «Записаться на консультацию» (заглушка)', async () => {
    state.ctx = studentCtx;
    state.card = teacherFixture();

    const html = await renderPage();
    const mailto = html.match(/<a[^>]*data-testid="person-mailto"[^>]*>/)![0];
    expect(mailto).toContain('href="mailto:irina.ivanova@example.edu"');
    expect(html).toContain('Написать письмо');
    expect(html).toContain('data-testid="person-consultation-stub"');
    expect(html).toContain('Записаться на консультацию');
    // Заглушка не отправляет форм и не ведёт никуда.
    const stub = html.match(/<button[^>]*data-testid="person-consultation-stub"[^>]*>/)![0];
    expect(stub).toContain('disabled');
  });
});

describe('/people/[id] — менеджер программы (студент)', () => {
  it('пометка «Ваш менеджер» видна', async () => {
    state.ctx = studentCtx;
    state.card = managerFixture();

    const html = await renderPage('staff-belova');
    expect(state.lastId).toBe('staff-belova');
    expect(html).toContain('Ваш менеджер');
    expect(html).not.toContain('data-testid="person-upcoming"');
  });

  // Ревью DIG-37 r5: у сотрудника (менеджера программы) секции «Ближайшие
  // пары» нет ВОВСЕ — ни заголовка с пустой оболочкой, ни пустого состояния
  // с бессмысленным «с этим преподавателем» (сценарий спеки «карточка
  // сотрудника»: секций «Ближайшие пары» нет).
  it('секции «Ближайшие пары» нет вовсе: ни заголовка, ни пустого состояния', async () => {
    state.ctx = studentCtx;
    state.card = managerFixture();

    const html = await renderPage('staff-belova');
    expect(html).not.toContain('data-testid="person-upcoming-title"');
    expect(html).not.toContain('Ближайшие пары');
    expect(html).not.toContain('data-testid="person-upcoming-empty"');
  });
});

describe('/people/[id] — сотрудник деканата', () => {
  it('персональных разделов нет: ни «ваших» дисциплин, ни ближайших пар', async () => {
    state.ctx = staffCtx;
    state.card = {
      ...teacherFixture(),
      hasPersonalScope: false,
      isMyTeacher: false,
      myDisciplines: [],
      upcoming: null,
    };

    const html = await renderPage();
    expect(html).not.toContain('ваша');
    expect(html).not.toContain('data-testid="person-upcoming"');
    expect(html).not.toContain('data-testid="person-upcoming-title"');
    // Базовые разделы на месте.
    expect(html).toContain('data-testid="person-contacts"');
  });
});

describe('/people/[id] — неизвестный id', () => {
  it('единый 404 (notFound), рендера нет', async () => {
    state.ctx = studentCtx;
    state.card = null;
    state.notFoundCalled = false;

    await expect(renderPage('teacher-hacker')).rejects.toThrow('NEXT_HTTP_ERROR_FALLBACK;404');
    expect(state.notFoundCalled).toBe(true);
  });
});
