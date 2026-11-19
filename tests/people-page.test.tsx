// DIG-37 — контракт страницы /people («Справочник», SSR).
// Приёмка: заголовок, поиск (data-testid="people-search"), быстрые фильтры
// пилюлями («Мои преподаватели», «Мой деканат», «Все»), карточки людей с
// аватаром-инициалами, ФИО-ссылкой, должностью, подразделением, дисциплинами
// студента у него; пометка «Ваш менеджер»; состояние сотрудника.
import { describe, expect, it, vi } from 'vitest';
import { createElement, type ComponentType } from 'react';
import { prerenderToNodeStream } from 'react-dom/static';

import type { PeopleDirectoryData, PersonListEntry } from '@/server/data/people';
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
  directory: null as PeopleDirectoryData | null,
  favorites: { favorites: [], hasPersonalScope: true },
}));

vi.mock('@/server/data/db', () => ({ dataDb: {} }));

vi.mock('@/server/data', () => ({
  requireDataCtx: vi.fn(async () => state.ctx),
  getPeopleDirectory: vi.fn(async () => state.directory),
  listFavoritePersons: vi.fn(async () => state.favorites),
}));

import PeoplePage from '@/app/(cabinet)/people/(list)/page';

async function renderPage(): Promise<string> {
  const Page = PeoplePage as unknown as ComponentType;
  const { prelude } = await prerenderToNodeStream(createElement(Page));
  let html = '';
  for await (const chunk of prelude) {
    html += String(chunk);
  }
  return html.replaceAll('<!-- -->', '');
}

function entry(overrides: Partial<PersonListEntry> & { id: string }): PersonListEntry {
  return {
    kind: 'TEACHER',
    fullName: 'Иванова Ирина Игоревна',
    position: 'Старший преподаватель',
    department: 'Кафедра программной инженерии',
    email: 'irina.ivanova@example.edu',
    phone: null,
    disciplines: ['Программирование', 'Алгоритмы и структуры данных'],
    isMyTeacher: false,
    isMyDeanery: false,
    isMyManager: false,
    myDisciplines: [],
    ...overrides,
  };
}

function studentFixture(): PeopleDirectoryData {
  return {
    hasPersonalScope: true,
    totalCount: 4,
    groupmates: [],
    people: [
      entry({
        id: 'teacher-ivanova',
        isMyTeacher: true,
        myDisciplines: ['Программирование'],
      }),
      entry({
        id: 'staff-belova',
        kind: 'STAFF',
        fullName: 'Наталья Белова',
        position: 'Менеджер программы «Прикладная информатика»',
        department: 'Деканат факультета ИТ',
        email: 'natalia.belova@example.edu',
        disciplines: [],
        isMyManager: true,
        isMyDeanery: true,
      }),
      entry({
        id: 'teacher-petrov',
        fullName: 'Петров Пётр Петрович',
        position: 'Доцент',
        department: 'Кафедра информационных технологий',
        email: 'petrov@example.edu',
        disciplines: ['Информатика'],
      }),
      entry({
        id: 'staff-gavrilov',
        kind: 'STAFF',
        fullName: 'Сергей Гаврилов',
        position: 'Заместитель декана по учебной работе',
        department: 'Деканат факультета ЭК',
        email: 'gavrilov@example.edu',
        disciplines: [],
        isMyDeanery: false,
      }),
    ],
  };
}

describe('/people — студент', () => {
  it('заголовок «Справочник», поиск и быстрые фильтры (включая «★ Избранное»)', async () => {
    state.ctx = studentCtx;
    state.directory = studentFixture();

    const html = await renderPage();
    expect(html).toContain('Справочник');
    expect(html).toContain('data-testid="people-search"');
    // DIG-102 — плейсхолдер поиска «ФИО, email или телефон» из словаря.
    expect(html).toContain('ФИО, email или телефон…');
    expect(html).toContain('data-testid="people-filters"');
    expect(html).toContain('aria-label="Поиск по справочнику"');
    for (const label of ['Мои преподаватели', 'Мой деканат', 'Все', '★ Избранное']) {
      expect(html).toContain(label);
    }
  });

  it('карточке студента доступна звезда избранного, сотруднику — нет', async () => {
    state.ctx = studentCtx;
    state.directory = studentFixture();
    let html = await renderPage();
    expect(html).toContain('data-testid="person-favorite-teacher-ivanova"');
    expect(html).toContain('aria-pressed="false"');

    state.ctx = staffCtx;
    state.directory = { ...studentFixture(), hasPersonalScope: false };
    state.favorites = { favorites: [], hasPersonalScope: false };
    html = await renderPage();
    expect(html).not.toContain('data-testid="person-favorite-teacher-ivanova"');
    state.favorites = { favorites: [], hasPersonalScope: true };
  });

  it('карточка в списке: аватар-инициалы, ФИО-ссылка, должность, подразделение', async () => {
    state.ctx = studentCtx;
    state.directory = studentFixture();

    const html = await renderPage();
    const card = html.match(/<li[^>]*data-testid="person-card-teacher-ivanova"[\s\S]*?<\/li>/)!;
    expect(card[0]).toContain('ИИ'); // инициалы аватара
    expect(card[0]).toContain('href="/people/teacher-ivanova"');
    expect(card[0]).toContain('Иванова Ирина Игоревна');
    expect(card[0]).toContain('Старший преподаватель');
    expect(card[0]).toContain('Кафедра программной инженерии');
  });

  it('дисциплины студента у преподавателя видны в карточке списка', async () => {
    state.ctx = studentCtx;
    state.directory = studentFixture();

    const html = await renderPage();
    const card = html.match(/<li[^>]*data-testid="person-card-teacher-ivanova"[\s\S]*?<\/li>/)!;
    expect(card[0]).toContain('Ваши дисциплины');
    expect(card[0]).toContain('Программирование');
  });

  it('менеджер программы студента помечен «Ваш менеджер» прямо в списке', async () => {
    state.ctx = studentCtx;
    state.directory = studentFixture();

    const html = await renderPage();
    const card = html.match(/<li[^>]*data-testid="person-card-staff-belova"[\s\S]*?<\/li>/)!;
    expect(card[0]).toContain('Ваш менеджер');
  });
});

describe('/people — сотрудник деканата', () => {
  it('справочник открывается без персональных секций', async () => {
    state.ctx = staffCtx;
    state.directory = { ...studentFixture(), hasPersonalScope: false };

    const html = await renderPage();
    expect(html).toContain('data-testid="people-list"');
    expect(html).not.toContain('Ваши дисциплины');
    expect(html).not.toContain('Ваш менеджер');
  });
});
