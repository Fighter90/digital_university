// DIG-102 — контракт поиска «Найти человека» на /people.
//
// Одно поле «ФИО, email или телефон»:
//  - ФИО — подстрока И словоформы (паттерн faq-suggest DIG-39: каждое слово
//    запроса — начало слова нормализованного ФИО; «ё» нормализуется к «е»);
//  - email — точная/частичная подстрока без учёта регистра;
//  - телефон — подстрока после нормализации пробелов/дефисов у обеих строк;
//  - прежние поля (должность/подразделение/дисциплины) продолжают находиться —
//    контракт e2e DIG-37 («деканат», «базы данных») не ломается;
//  - пустой запрос — совпадение со всем каталогом (состояние до ввода).
import { describe, expect, it } from 'vitest';

import {
  GROUPMATE_ID_PREFIX,
  groupmatePersonId,
  matchPerson,
  matchPersonContacts,
  matchPersonEntry,
  matchPersonFullName,
  normalizePersonName,
  normalizePersonPhone,
  parseGroupmatePersonId,
  PEOPLE,
  findPersonById,
  type PersonEntry,
} from '@/lib/people-catalog';

const titova = findPersonById('staff-titova')!; // Ольга Титова, olga.titova@example.edu, +7 495 010-31-32
const petrov = findPersonById('teacher-petrov')!; // Петров Пётр Петрович

const byName = (query: string): PersonEntry[] =>
  PEOPLE.filter((person) => matchPersonEntry(person, query));

describe('normalizePersonName / Phone', () => {
  it('имя: нижний регистр, ё→е, схлопнутые пробелы', () => {
    expect(normalizePersonName('  Пётр   Петров ')).toBe('петр петров');
    expect(normalizePersonName('Ёлкина')).toBe('елкина');
  });

  it('телефон: пробелы и дефисы убраны, значащие символы сохранены', () => {
    expect(normalizePersonPhone('+7 495 010-11-22')).toBe('+74950101122');
    expect(normalizePersonPhone(' 010 11 22 ')).toBe('0101122');
    expect(normalizePersonPhone('010-11-22')).toBe('0101122');
  });
});

describe('matchPersonFullName — ФИО по подстроке и словоформам', () => {
  it('словоформа: «петр» находит «Петров Пётр Петрович»', () => {
    expect(matchPersonFullName(petrov.fullName, 'петр')).toBe(true);
  });

  it('словоформа с «ё»: «петров» и «Пётров» оба находят', () => {
    expect(matchPersonFullName(petrov.fullName, 'петров')).toBe(true);
    expect(matchPersonFullName(petrov.fullName, 'Пётров')).toBe(true);
  });

  it('начало слова: «иванов» находит «Иванова…» (фамилия склоняется)', () => {
    expect(matchPersonFullName('Иванова Ирина Игоревна', 'иванов')).toBe(true);
  });

  it('несколько слов запроса: все должны совпасть со словами ФИО', () => {
    expect(matchPersonFullName('Иванова Ирина Игоревна', 'иванова ирина')).toBe(true);
    expect(matchPersonFullName('Иванова Ирина Игоревна', 'иванова ирина игоревна')).toBe(true);
    expect(matchPersonFullName('Иванова Ирина Игоревна', 'иванова астронавт')).toBe(false);
  });

  it('подстрока без привязки к началу слова', () => {
    expect(matchPersonFullName('Кузнецова Ксения Кирилловна', 'сения')).toBe(true);
    expect(matchPersonFullName('Кузнецова Ксения Кирилловна', 'ксени')).toBe(true);
  });

  it('промах: другой человек не находится', () => {
    expect(matchPersonFullName(titova.fullName, 'петров')).toBe(false);
  });

  it('пустой запрос — совпадение (каталог до ввода)', () => {
    expect(matchPersonFullName(petrov.fullName, '   ')).toBe(true);
  });
});

describe('matchPersonContacts — ФИО + email + телефон', () => {
  it('email: точная подстрока', () => {
    expect(matchPersonContacts(titova, 'olga.titova@example.edu')).toBe(true);
  });

  it('email: частичная подстрока', () => {
    expect(matchPersonContacts(titova, 'titova@')).toBe(true);
    expect(matchPersonContacts(titova, 'olga.')).toBe(true);
  });

  it('email: без учёта регистра', () => {
    expect(matchPersonContacts(titova, 'TITOVA@EXAMPLE.EDU')).toBe(true);
  });

  it('телефон: точный номер в любом формате пробелов/дефисов', () => {
    expect(matchPersonContacts(titova, '+7 495 010-31-32')).toBe(true);
    expect(matchPersonContacts(titova, '+74950103132')).toBe(true);
    expect(matchPersonContacts(titova, '74950103132')).toBe(true);
  });

  it('телефон: частичный фрагмент с дефисами и пробелами', () => {
    expect(matchPersonContacts(titova, '010-31-32')).toBe(true);
    expect(matchPersonContacts(titova, '010 31 32')).toBe(true);
    expect(matchPersonContacts(titova, '0103132')).toBe(true);
  });

  it('чужой телефон не находит', () => {
    expect(matchPersonContacts(titova, '010-11-22')).toBe(false);
  });

  it('телефона нет — поиск по телефону мимо, по ФИО/email работает', () => {
    const noPhone = { fullName: 'Анна Смирнова', email: 'anna@example.edu', phone: null };
    expect(matchPersonContacts(noPhone, '010-11-22')).toBe(false);
    expect(matchPersonContacts(noPhone, 'анна')).toBe(true);
    expect(matchPersonContacts(noPhone, 'anna@')).toBe(true);
  });

  it('пустой запрос — совпадение', () => {
    expect(matchPersonContacts(titova, '')).toBe(true);
  });
});

describe('matchPersonEntry — прежние поля каталога продолжают находиться', () => {
  it('подразделение: «деканат» (контракт e2e DIG-37)', () => {
    expect(byName('деканат').map((p) => p.id)).toContain('staff-kovaleva');
  });

  it('дисциплина: «базы данных» находит Соколова', () => {
    expect(byName('базы данных').map((p) => p.id)).toContain('teacher-sokolov');
  });

  it('словоформы ФИО работают и на записи каталога', () => {
    expect(byName('петр').map((p) => p.id)).toContain('teacher-petrov');
    expect(byName('иванов').map((p) => p.id)).toContain('teacher-ivanova');
  });

  it('email/телефон работают на записи каталога', () => {
    expect(byName('petr.petrov@').map((p) => p.id)).toEqual(['teacher-petrov']);
    expect(byName('010-11-22').map((p) => p.id)).toEqual(['teacher-petrov']);
  });

  it('matchPerson (старый контракт) не сломан', () => {
    expect(matchPerson(petrov, 'петров')).toBe(true);
    expect(matchPerson(petrov, 'астронавт')).toBe(false);
  });

  it('мусорный запрос — ничего', () => {
    expect(byName('астронавт')).toEqual([]);
  });
});

describe('id одногруппника: groupmate:<Student.id>', () => {
  it('сборка и разбор', () => {
    expect(groupmatePersonId('st-anna')).toBe('groupmate:st-anna');
    expect(parseGroupmatePersonId('groupmate:st-anna')).toBe('st-anna');
    expect(parseGroupmatePersonId('teacher-petrov')).toBeNull();
    expect(parseGroupmatePersonId('groupmate:')).toBeNull();
  });

  it('префикс согласован между сборкой и разбором', () => {
    expect(GROUPMATE_ID_PREFIX).toBe('groupmate:');
    expect(parseGroupmatePersonId(groupmatePersonId('st-x'))).toBe('st-x');
  });
});
