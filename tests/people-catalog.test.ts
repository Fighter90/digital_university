// DIG-37 — контракт вымышленного справочника людей (чистый модуль
// src/lib/people-catalog.ts, без серверных импортов).
//
// Приёмка: стабильные id, имена преподавателей сшиты с сидом расписания
// и дисциплин (переход из детали пары и карточки дисциплины возможен
// по имени), поиск по ФИО / дисциплине / подразделению, менеджеры
// программ обеих программ демо-набора, данные вымышленные (@example.edu).
import { describe, expect, it } from 'vitest';

import {
  PEOPLE,
  PEOPLE_FILTER_LABELS,
  findPersonById,
  matchPerson,
  normalizePeopleQuery,
  personHrefByFullName,
  type PersonEntry,
} from '@/lib/people-catalog';

/** Имена преподавателей из сидов расписания/дисциплин (demo-seed DIG-12). */
const SEED_TEACHER_NAMES = [
  'Петров Пётр Петрович',
  'Иванова Ирина Игоревна',
  'Соколов Сергей Сергеевич',
  'Орлов Олег Олегович',
  'Кузнецова Ксения Кирилловна',
] as const;

describe('people-catalog — данные', () => {
  it('содержит преподавателей из сида расписания и дисциплин (сшивка по ФИО)', () => {
    for (const name of SEED_TEACHER_NAMES) {
      const href = personHrefByFullName(name);
      expect(href, `teacher ${name} must resolve to /people/<id>`).toMatch(/^\/people\/.+/);
    }
  });

  it('сшивает сотрудника деканата из сида заявок (Мария Ковалёва)', () => {
    expect(personHrefByFullName('Мария Ковалёва')).toMatch(/^\/people\/.+/);
  });

  it('неизвестное имя → null (перехода нет, планый текст)', () => {
    expect(personHrefByFullName('Незнакомый Преподаватель')).toBeNull();
    expect(personHrefByFullName('')).toBeNull();
  });

  it('id уникальны и стабильны (slug-формат)', () => {
    const ids = PEOPLE.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^(teacher|staff)-[a-z-]+$/);
    }
  });

  it('менеджер программы есть у обеих программ демо-набора', () => {
    const programs = PEOPLE.filter((p) => p.isProgramManager).map((p) => p.program);
    expect(programs).toContain('Прикладная информатика');
    expect(programs).toContain('Экономика');
  });

  it('данные вымышленные: почта только @example.edu', () => {
    for (const person of PEOPLE) {
      expect(person.email).toMatch(/@example\.edu$/);
    }
  });

  it('у сотрудников деканата указан факультет, у общих служб — null', () => {
    const deanery = PEOPLE.filter((p) => p.department.includes('Деканат'));
    expect(deanery.length).toBeGreaterThanOrEqual(4);
    for (const person of deanery) {
      expect(person.faculty, `${person.fullName} must carry a faculty`).toBeTruthy();
    }
  });

  it('преподаватели несут дисциплины, совпадающие со справочником дисциплин', () => {
    const petrov = findPersonById('teacher-petrov')!;
    expect(petrov).toBeTruthy();
    expect(petrov.disciplines.map((d) => d.name)).toContain('Информатика');

    const sokolov = findPersonById('teacher-sokolov')!;
    expect(sokolov.disciplines.map((d) => d.name)).toEqual(
      expect.arrayContaining(['Базы данных', 'Физика']),
    );
  });

  it('findPersonById: известный id → запись, неизвестный → null', () => {
    expect(findPersonById('no-such-person')).toBeNull();
    const first = PEOPLE[0]!;
    expect(findPersonById(first.id)).toBe(first);
  });
});

describe('people-catalog — поиск (ФИО / дисциплина / подразделение)', () => {
  const byName = (query: string): PersonEntry[] => PEOPLE.filter((p) => matchPerson(p, query));

  it('нормализация запроса: регистр и лишние пробелы схлопываются', () => {
    expect(normalizePeopleQuery('  Соколов   сергей ')).toBe('соколов сергей');
    expect(normalizePeopleQuery('   ')).toBe('');
  });

  it('пустой запрос совпадает со всеми', () => {
    expect(byName('').length).toBe(PEOPLE.length);
  });

  it('по ФИО: фамилия и полное имя находят одного человека', () => {
    expect(byName('соколов').map((p) => p.fullName)).toEqual(['Соколов Сергей Сергеевич']);
    expect(byName('Иванова Ирина')).toHaveLength(1);
  });

  it('по дисциплине: «базы данных» находит Соколова', () => {
    const hits = byName('базы данных').map((p) => p.fullName);
    expect(hits).toContain('Соколов Сергей Сергеевич');
  });

  it('по подразделению: «деканат» находит сотрудников деканата, но не преподавателей', () => {
    const hits = byName('деканат');
    expect(hits.length).toBeGreaterThanOrEqual(4);
    for (const person of hits) {
      expect(person.kind).toBe('STAFF');
    }
  });

  it('по должности: «менеджер программы» находит менеджеров', () => {
    const hits = byName('менеджер программы');
    expect(hits.length).toBe(2);
    for (const person of hits) expect(person.isProgramManager).toBe(true);
  });

  it('мусорный запрос не находит никого', () => {
    expect(byName('астронавт')).toHaveLength(0);
  });

  it('метки быстрых фильтров: «Мои преподаватели», «Мой деканат», «Все»', () => {
    expect(PEOPLE_FILTER_LABELS.MY_TEACHERS).toBe('Мои преподаватели');
    expect(PEOPLE_FILTER_LABELS.MY_DEANERY).toBe('Мой деканат');
    expect(PEOPLE_FILTER_LABELS.ALL).toBe('Все');
  });
});
