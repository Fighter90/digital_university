// DIG-37 — вымышленный справочник сотрудников вуза (чистый модуль без
// серверных импортов: работает и на сервере, и в клиентском поиске).
//
// Аналог раздела «Сотрудники» аудированного ЛК: из пары в расписании
// до преподавателя было не дойти. Контракт:
//  - PEOPLE — статический каталог (преподаватели + сотрудники деканата);
//  - имена преподавателей СШИТЫ с сидом расписания/дисциплин (DIG-12):
//    переход из детали пары и карточки дисциплины возможен по ФИО через
//    personHrefByFullName();
//  - поиск по ФИО, дисциплине и подразделению (matchPerson);
//  - все данные вымышленные (@example.edu), бренд вуза не используется.
// Персонализацию («Мои преподаватели», ближайшие пары) собирает слой
// данных src/server/data/people.ts из скоупа сессии — этот модуль её не знает.

export type PersonKind = 'TEACHER' | 'STAFF';

export interface PersonDiscipline {
  name: string;
  code: string | null;
}

export interface PersonEntry {
  /** Стабильный slug в URL (/people/<id>) и testid. */
  id: string;
  kind: PersonKind;
  fullName: string;
  /** Должность. */
  position: string;
  /** Подразделение (кафедра, деканат, служба). */
  department: string;
  email: string;
  phone: string | null;
  /** Кабинет. */
  room: string | null;
  /** Часы консультаций. */
  consultationHours: string | null;
  /** Факультет деканата (для «Мой деканат»); у преподавателей null. */
  faculty: string | null;
  /** Программа менеджера (isProgramManager). */
  program: string | null;
  isProgramManager: boolean;
  /** Дисциплины, которые ведёт преподаватель (у сотрудников пусто). */
  disciplines: PersonDiscipline[];
}

/** Быстрые фильтры справочника (пилюли над списком). */
export type PeopleFilter = 'MY_TEACHERS' | 'MY_DEANERY' | 'ALL';

export const PEOPLE_FILTER_LABELS: Record<PeopleFilter, string> = {
  MY_TEACHERS: 'Мои преподаватели',
  MY_DEANERY: 'Мой деканат',
  ALL: 'Все',
};

// DIG-89 — EN-слой справочника: должности/подразделения/часы по id записи
// (имена — демо-ФИО, остаются как в сиде; дисциплины — через enDisciplineName).
import { t, type Locale } from '@/lib/i18n';
import { enDisciplineName } from '@/lib/en-demo-content';

const PEOPLE_EN: Record<
  string,
  { position: string; department: string; consultationHours: string | null; program: string | null }
> = {
  'teacher-petrov': {
    position: 'Associate Professor',
    department: 'Department of Information Technology',
    consultationHours: 'Tue 14:00–16:00, room 301',
    program: null,
  },
  'teacher-ivanova': {
    position: 'Senior Lecturer',
    department: 'Department of Software Engineering',
    consultationHours: 'Wed 15:00–17:00, room 405',
    program: null,
  },
  'teacher-sokolov': {
    position: 'Professor',
    department: 'Department of Information Systems',
    consultationHours: 'Thu 16:00–18:00, room 212',
    program: null,
  },
  'teacher-orlov': {
    position: 'Associate Professor',
    department: 'Department of Humanities and Social Sciences',
    consultationHours: 'Fri 12:00–14:00, room 118',
    program: null,
  },
  'teacher-kuznetsova': {
    position: 'Associate Professor',
    department: 'Department of Applied Mathematics',
    consultationHours: 'Wed 10:00–12:00, room 207',
    program: null,
  },
  'staff-kovaleva': {
    position: 'Deanery specialist',
    department: 'IT Faculty Deanery',
    consultationHours: 'Mon–Fri 09:00–17:00, room 214',
    program: null,
  },
  'staff-semenov': {
    position: 'Dean of the IT Faculty',
    department: 'IT Faculty Deanery',
    consultationHours: 'Thu 15:00–16:30, room 210 (by appointment)',
    program: null,
  },
  'staff-belova': {
    position: 'Program manager “Applied Computer Science”',
    department: 'IT Faculty Deanery',
    consultationHours: 'Mon, Wed 10:00–12:00, room 214',
    program: 'Applied Computer Science',
  },
  'staff-gavrilov': {
    position: 'Deputy Dean for Academic Affairs',
    department: 'Economics Faculty Deanery',
    consultationHours: 'Tue 11:00–13:00, room 12',
    program: null,
  },
  'staff-romanova': {
    position: 'Program manager “Economics”',
    department: 'Economics Faculty Deanery',
    consultationHours: 'Mon, Thu 14:00–16:00, room 12',
    program: 'Economics',
  },
  'staff-titova': {
    position: 'Dormitory specialist',
    department: 'Dormitory Office',
    consultationHours: 'Mon–Fri 10:00–13:00, room 305',
    program: null,
  },
  'staff-nikitin': {
    position: 'Study office methodologist',
    department: 'Study Office',
    consultationHours: 'Mon–Fri 09:00–12:00, room 216',
    program: null,
  },
};

/** EN-поля записи справочника: должность, подразделение, часы, программа. */
export function personEnFields(person: PersonEntry): {
  position: string;
  department: string;
  consultationHours: string | null;
  program: string | null;
} {
  const en = PEOPLE_EN[person.id];
  return en ?? {
    position: person.position,
    department: person.department,
    consultationHours: person.consultationHours,
    program: person.program,
  };
}

/** EN-имена дисциплин преподавателя (по коду/RU-имени сида). */
export function personDisciplineNames(person: PersonEntry, locale: Locale = 'ru'): string[] {
  if (locale !== 'en') return person.disciplines.map((discipline) => discipline.name);
  return person.disciplines.map((discipline) =>
    enDisciplineName({ code: discipline.code, name: discipline.name }),
  );
}

/** Быстрый фильтр: «Мои преподаватели» / «My teachers». */
export function peopleFilterLabel(filter: PeopleFilter, locale: Locale = 'ru'): string {
  if (locale === 'en') return t('en', `people.filter.${filter}` as const);
  return PEOPLE_FILTER_LABELS[filter];
}

const d = (name: string, code: string | null = null): PersonDiscipline => ({ name, code });

// Порядок записей = порядок по умолчанию в справочнике (персональные связи
// поверх поднимает слой данных, сортировка стабильна).
export const PEOPLE: PersonEntry[] = [
  // ── Преподаватели (имена = teacherName сида расписания/дисциплин) ──────
  {
    id: 'teacher-petrov',
    kind: 'TEACHER',
    fullName: 'Петров Пётр Петрович',
    position: 'Доцент',
    department: 'Кафедра информационных технологий',
    email: 'petr.petrov@example.edu',
    phone: '+7 495 010-11-22',
    room: '301',
    consultationHours: 'Вт 14:00–16:00, каб. 301',
    faculty: null,
    program: null,
    isProgramManager: false,
    disciplines: [d('Информатика', 'PI21-INFO')],
  },
  {
    id: 'teacher-ivanova',
    kind: 'TEACHER',
    fullName: 'Иванова Ирина Игоревна',
    position: 'Старший преподаватель',
    department: 'Кафедра программной инженерии',
    email: 'irina.ivanova@example.edu',
    phone: '+7 495 010-13-14',
    room: '405',
    consultationHours: 'Ср 15:00–17:00, каб. 405',
    faculty: null,
    program: null,
    isProgramManager: false,
    disciplines: [
      d('Программирование', 'PI21-PROG'),
      d('Алгоритмы и структуры данных', 'PI21-ALG'),
    ],
  },
  {
    id: 'teacher-sokolov',
    kind: 'TEACHER',
    fullName: 'Соколов Сергей Сергеевич',
    position: 'Профессор',
    department: 'Кафедра информационных систем',
    email: 'sergey.sokolov@example.edu',
    phone: '+7 495 010-15-16',
    room: '212',
    consultationHours: 'Чт 16:00–18:00, каб. 212',
    faculty: null,
    program: null,
    isProgramManager: false,
    disciplines: [d('Базы данных', 'PI21-DB'), d('Физика', 'PI21-PHYS')],
  },
  {
    id: 'teacher-orlov',
    kind: 'TEACHER',
    fullName: 'Орлов Олег Олегович',
    position: 'Доцент',
    department: 'Кафедра гуманитарных и социально-экономических наук',
    email: 'oleg.orlov@example.edu',
    phone: '+7 495 010-17-18',
    room: '118',
    consultationHours: 'Пт 12:00–14:00, каб. 118',
    faculty: null,
    program: null,
    isProgramManager: false,
    disciplines: [d('История', 'PI21-HIST'), d('Экономическая теория', 'EK11-ECON')],
  },
  {
    id: 'teacher-kuznetsova',
    kind: 'TEACHER',
    fullName: 'Кузнецова Ксения Кирилловна',
    position: 'Доцент',
    department: 'Кафедра прикладной математики',
    email: 'ksenia.kuznetsova@example.edu',
    phone: '+7 495 010-19-20',
    room: '207',
    consultationHours: 'Ср 10:00–12:00, каб. 207',
    faculty: null,
    program: null,
    isProgramManager: false,
    disciplines: [d('Дискретная математика', 'PI21-DISC'), d('Математический анализ', 'EK11-MATH')],
  },

  // ── Деканаты и службы (факультеты демо-набора: ИТ и ЭК) ─────────────────
  {
    id: 'staff-kovaleva',
    kind: 'STAFF',
    fullName: 'Мария Ковалёва',
    position: 'Специалист деканата',
    department: 'Деканат факультета ИТ',
    email: 'maria.kovaleva@example.edu',
    phone: '+7 495 010-21-22',
    room: '214',
    consultationHours: 'Пн–Пт 09:00–17:00, каб. 214',
    faculty: 'ИТ',
    program: null,
    isProgramManager: false,
    disciplines: [],
  },
  {
    id: 'staff-semenov',
    kind: 'STAFF',
    fullName: 'Андрей Семёнов',
    position: 'Декан факультета ИТ',
    department: 'Деканат факультета ИТ',
    email: 'andrey.semenov@example.edu',
    phone: '+7 495 010-23-24',
    room: '210',
    consultationHours: 'Чт 15:00–16:30, каб. 210 (по записи)',
    faculty: 'ИТ',
    program: null,
    isProgramManager: false,
    disciplines: [],
  },
  {
    id: 'staff-belova',
    kind: 'STAFF',
    fullName: 'Наталья Белова',
    position: 'Менеджер программы «Прикладная информатика»',
    department: 'Деканат факультета ИТ',
    email: 'natalia.belova@example.edu',
    phone: '+7 495 010-25-26',
    room: '214',
    consultationHours: 'Пн, Ср 10:00–12:00, каб. 214',
    faculty: 'ИТ',
    program: 'Прикладная информатика',
    isProgramManager: true,
    disciplines: [],
  },
  {
    id: 'staff-gavrilov',
    kind: 'STAFF',
    fullName: 'Сергей Гаврилов',
    position: 'Заместитель декана по учебной работе',
    department: 'Деканат факультета ЭК',
    email: 'sergey.gavrilov@example.edu',
    phone: '+7 495 010-27-28',
    room: '12',
    consultationHours: 'Вт 11:00–13:00, каб. 12',
    faculty: 'ЭК',
    program: null,
    isProgramManager: false,
    disciplines: [],
  },
  {
    id: 'staff-romanova',
    kind: 'STAFF',
    fullName: 'Елена Романова',
    position: 'Менеджер программы «Экономика»',
    department: 'Деканат факультета ЭК',
    email: 'elena.romanova@example.edu',
    phone: '+7 495 010-29-30',
    room: '12',
    consultationHours: 'Пн, Чт 14:00–16:00, каб. 12',
    faculty: 'ЭК',
    program: 'Экономика',
    isProgramManager: true,
    disciplines: [],
  },

  // ── Общие службы (не «мой деканат», но в справочнике «Все») ─────────────
  {
    id: 'staff-titova',
    kind: 'STAFF',
    fullName: 'Ольга Титова',
    position: 'Специалист по общежитиям',
    department: 'Управление общежитий',
    email: 'olga.titova@example.edu',
    phone: '+7 495 010-31-32',
    room: '305',
    consultationHours: 'Пн–Пт 10:00–13:00, каб. 305',
    faculty: null,
    program: null,
    isProgramManager: false,
    disciplines: [],
  },
  {
    id: 'staff-nikitin',
    kind: 'STAFF',
    fullName: 'Виктор Никитин',
    position: 'Методист учебного отдела',
    department: 'Учебный отдел',
    email: 'viktor.nikitin@example.edu',
    phone: '+7 495 010-33-34',
    room: '216',
    consultationHours: 'Пн–Пт 09:00–12:00, каб. 216',
    faculty: null,
    program: null,
    isProgramManager: false,
    disciplines: [],
  },
];

/** Запись по стабильному id; неизвестный id → null (страница даёт 404). */
export function findPersonById(id: string): PersonEntry | null {
  return PEOPLE.find((person) => person.id === id) ?? null;
}

/** href карточки по ФИО — сшивка сида (teacherName/actorName) со справочником. */
export function personHrefByFullName(fullName: string | null | undefined): string | null {
  if (!fullName) return null;
  const person = PEOPLE.find((entry) => entry.fullName === fullName);
  return person ? `/people/${person.id}` : null;
}

/** Нормализация запроса: нижний регистр, схлопнутые пробелы. */
export function normalizePeopleQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Минимальная форма записи для поиска: каталог несёт дисциплины объектами
 * {name, code}, список из слоя данных — строками; оба должны искаться
 * одинаково (по ФИО, должности, подразделению и дисциплинам).
 */
export interface PersonSearchable {
  fullName: string;
  position: string;
  department: string;
  disciplines: Array<string | PersonDiscipline>;
}

/** Поиск по ФИО, должности, подразделению и дисциплинам; пустой запрос — всё. */
export function matchPerson(person: PersonSearchable, query: string): boolean {
  const q = normalizePeopleQuery(query);
  if (q === '') return true;
  const haystacks = [
    person.fullName.toLowerCase(),
    person.position.toLowerCase(),
    person.department.toLowerCase(),
    ...person.disciplines.map((discipline) =>
      (typeof discipline === 'string' ? discipline : discipline.name).toLowerCase(),
    ),
  ];
  return haystacks.some((text) => text.includes(q));
}

export interface HighlightChunk {
  text: string;
  hit: boolean;
}

/**
 * Разбивает текст на куски для подсветки совпадений (<mark>): без учёта
 * регистра, все вхождения; пустой запрос или без совпадений — один кусок.
 */
export function splitHighlight(text: string, query: string): HighlightChunk[] {
  const q = normalizePeopleQuery(query);
  if (q === '') return [{ text, hit: false }];
  const lower = text.toLowerCase();
  const chunks: HighlightChunk[] = [];
  let cursor = 0;
  while (true) {
    const at = lower.indexOf(q, cursor);
    if (at === -1) break;
    if (at > cursor) chunks.push({ text: text.slice(cursor, at), hit: false });
    chunks.push({ text: text.slice(at, at + q.length), hit: true });
    cursor = at + q.length;
  }
  if (chunks.length === 0) return [{ text, hit: false }];
  if (cursor < text.length) chunks.push({ text: text.slice(cursor), hit: false });
  return chunks;
}
