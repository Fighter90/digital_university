// DIG-37 — «Справочник»: преподаватели и сотрудники вуза.
//
// Каталог людей — публичный вымышленный контент (src/lib/people-catalog.ts),
// доступен любому авторизованному пользователю кабинета. Персональные же
// разделы («Мои преподаватели», «дисциплины студента у него», «ближайшие
// пары») собираются ТОЛЬКО из скоупа сессии: ctx.studentId / ctx.groupName.
// id из URL выбирает запись каталога по белому списку — IDOR невозможен
// по построению: неизвестный id → null → единый 404 на странице.
//
// Контракты:
//  - getPeopleDirectory(db, ctx) — полный список с пометками:
//    isMyTeacher (имя встречается в расписании/дисциплинах группы студента),
//    isMyDeanery (сотрудник деканата факультета ctx), isMyManager
//    (менеджер программы студента) + myDisciplines для карточки списка;
//  - getPersonCard(db, ctx, id) — карточка человека: контакты и часы
//    консультаций из каталога, «его» дисциплины группы студента и
//    ближайшие пары (группа студента, от «сейчас», без отменённых,
//    только у преподавателей — у сотрудника upcoming === null),
//    null для неизвестного id.

import { lessonKindLabel } from '@/lib/dashboard-format';
import type { Locale } from '@/lib/i18n';
import { enDisciplineName } from '@/lib/en-demo-content';
import {
  findPersonById,
  PEOPLE,
  personHrefByFullName,
  groupmatePersonId,
  parseGroupmatePersonId,
  type PersonDiscipline,
  type PersonEntry,
} from '@/lib/people-catalog';
import { formatDayShort } from '@/lib/schedule-cards';
import { formatMoscowTime, moscowDateKey, semesterBounds } from '@/lib/schedule-time';

import { denyAccess } from './access';
import type { DataDb } from './port';
import type { DataCtx, ScheduleEventRow } from './types';

/** Сколько ближайших пар показываем на карточке человека. */
export const MAX_UPCOMING_EVENTS = 5;

export interface PersonListEntry {
  id: string;
  /** Запись каталога (TEACHER/STAFF) или одногруппник группы (DIG-102). */
  kind: PersonEntry['kind'] | 'GROUPMATE';
  fullName: string;
  position: string;
  department: string;
  email: string;
  /** Телефон для поиска «ФИО, email или телефон»; у одногруппников null. */
  phone: string | null;
  /** Все дисциплины преподавателя в вузе (для поиска и подписи). */
  disciplines: string[];
  /** Преподаватель встречается в расписании/дисциплинах группы студента. */
  isMyTeacher: boolean;
  /** Сотрудник деканата факультета владельца сессии. */
  isMyDeanery: boolean;
  /** Менеджер программы студента («Ваш менеджер»). */
  isMyManager: boolean;
  /** Дисциплины ГРУППЫ студента, которые ведёт этот преподаватель. */
  myDisciplines: string[];
}

export interface PeopleDirectoryData {
  people: PersonListEntry[];
  /**
   * DIG-102 — студенты СВОЕЙ группы, кроме владельца сессии (для поиска и
   * категории «Одногруппники»); сотруднику деканата — пусто. В общем списке
   * `people` их нет: состояние до ввода — прежний каталог (контракт DIG-37).
   */
  groupmates: PersonListEntry[];
  /** Студент: персональные секции возможны; сотрудник — нет. */
  hasPersonalScope: boolean;
  totalCount: number;
}

export interface PersonUpcomingEvent {
  id: string;
  /** Московский ключ дня — для ссылки «?view=day&date=…». */
  dateKey: string;
  dateLabel: string;
  timeLabel: string;
  disciplineName: string;
  kind: ScheduleEventRow['kind'];
  kindLabel: string;
  roomLabel: string;
  status: ScheduleEventRow['status'];
}

export interface PersonCardData {
  person: PersonEntry;
  /** href карточки — /people/<id> (держим единый хелпер со справочником). */
  href: string;
  isMyTeacher: boolean;
  isMyDeanery: boolean;
  isMyManager: boolean;
  hasPersonalScope: boolean;
  /** Дисциплины группы студента у этого преподавателя (с кодом). */
  myDisciplines: PersonDiscipline[];
  /**
   * null — секции «Ближайшие пары» на странице нет (нет студенческого
   * скоупа ИЛИ человек не преподаватель — ревью DIG-37 r5); [] — скоуп есть,
   * пар впереди нет.
   */
  upcoming: PersonUpcomingEvent[] | null;
}

/** ids каталога — стабилизирует контракт тестов и подсказки клиенту. */
export const PEOPLE_DIRECTORY_IDS = PEOPLE.map((person) => person.id);

const roomLabel = (room: string, locale: Locale = 'ru'): string =>
  room.trim().toLowerCase() === 'онлайн'
    ? locale === 'en'
      ? 'online'
      : 'онлайн'
    : locale === 'en'
      ? `room ${room.trim()}`
      : `ауд. ${room.trim()}`;

/** Сшивка «имя преподавателя → дисциплины группы» + множество имён из пар. */
function personalLinks(db: DataDb, ctx: DataCtx): Promise<Links> {
  const studentId = ctx.studentId;
  const groupName = ctx.groupName;
  if (studentId === null || groupName === null) {
    return Promise.resolve({ teacherToDisciplines: new Map(), scheduleTeachers: new Set() });
  }
  return (async () => {
    const [disciplines, schedule] = await Promise.all([
      db.listDisciplinesByGroup(groupName),
      db.listScheduleByGroup(groupName),
    ]);
    const teacherToDisciplines = new Map<string, string[]>();
    for (const row of disciplines) {
      const list = teacherToDisciplines.get(row.teacherName) ?? [];
      if (!list.includes(row.disciplineName)) list.push(row.disciplineName);
      teacherToDisciplines.set(row.teacherName, list);
    }
    const scheduleTeachers = new Set(schedule.map((row) => row.teacherName));
    return { teacherToDisciplines, scheduleTeachers };
  })();
}

/** «Свои» пометки: деканат факультета владельца и менеджер его программы. */
function ownMarks(
  ctx: DataCtx,
  person: PersonEntry,
  studentProgram: string | null,
): { isMyDeanery: boolean; isMyManager: boolean } {
  return {
    isMyDeanery:
      person.kind === 'STAFF' && person.faculty !== null && person.faculty === ctx.faculty,
    isMyManager:
      person.kind === 'STAFF' &&
      person.isProgramManager &&
      studentProgram !== null &&
      person.program === studentProgram,
  };
}

/**
 * Метка «его/Ведёт у вас» — ОДНА на список и карточку (ревью DIG-37 r2):
 * преподаватель группы, у которого есть дисциплины группы или пары в
 * расписании, помечен везде одинаково.
 */
function isMyTeacherMark(person: PersonEntry, links: Links): boolean {
  return (
    person.kind === 'TEACHER' &&
    (links.scheduleTeachers.has(person.fullName) ||
      (links.teacherToDisciplines.get(person.fullName)?.length ?? 0) > 0)
  );
}

interface Links {
  teacherToDisciplines: Map<string, string[]>;
  scheduleTeachers: Set<string>;
}

export async function getPeopleDirectory(db: DataDb, ctx: DataCtx): Promise<PeopleDirectoryData> {
  const isStudent = ctx.studentId !== null && ctx.groupName !== null;
  const [student, links] = await Promise.all([
    isStudent && ctx.studentId !== null ? db.findStudentById(ctx.studentId) : Promise.resolve(null),
    personalLinks(db, ctx),
  ]);

  const people = PEOPLE.map((person) => {
    const marks = ownMarks(ctx, person, student?.program ?? null);
    return {
      id: person.id,
      kind: person.kind,
      fullName: person.fullName,
      position: person.position,
      department: person.department,
      email: person.email,
      phone: person.phone,
      disciplines: person.disciplines.map((discipline) => discipline.name),
      isMyTeacher: isMyTeacherMark(person, links),
      isMyDeanery: marks.isMyDeanery,
      isMyManager: marks.isMyManager,
      myDisciplines: links.teacherToDisciplines.get(person.fullName) ?? [],
    } satisfies PersonListEntry;
  });

  // Персональные связи поверх, дальше — по алфавиту (сортировка стабильна).
  people.sort((a, b) => {
    const aMine = a.isMyTeacher || a.isMyManager || a.isMyDeanery ? 0 : 1;
    const bMine = b.isMyTeacher || b.isMyManager || b.isMyDeanery ? 0 : 1;
    if (aMine !== bMine) return aMine - bMine;
    return a.fullName.localeCompare(b.fullName, 'ru');
  });

  // DIG-102 — одногруппники: студенты СВОЕЙ группы, кроме владельца сессии.
  // Скоуп строгий: groupName берётся из ctx сессии, чужая группа недостижима.
  const groupmates: PersonListEntry[] = [];
  if (isStudent && ctx.studentId !== null && ctx.groupName !== null) {
    const groupStudents = await db.listStudentsByGroup(ctx.groupName);
    for (const row of groupStudents) {
      if (row.id === ctx.studentId) continue;
      groupmates.push({
        id: groupmatePersonId(row.id),
        kind: 'GROUPMATE',
        fullName: row.fullName,
        position: '',
        department: '',
        email: row.email,
        phone: null,
        disciplines: [],
        isMyTeacher: false,
        isMyDeanery: false,
        isMyManager: false,
        myDisciplines: [],
      });
    }
    groupmates.sort((a, b) => a.fullName.localeCompare(b.fullName, 'ru'));
  }

  return { people, groupmates, hasPersonalScope: isStudent, totalCount: people.length };
}

export async function getPersonCard(
  db: DataDb,
  ctx: DataCtx,
  id: string,
  // DIG-89 — EN-рендер «Ближайших пар» по локали (дефолт ru — прежние строки).
  locale: Locale = 'ru',
): Promise<PersonCardData | null> {
  const person = findPersonById(id);
  if (!person) return null;

  const isStudent = ctx.studentId !== null && ctx.groupName !== null;
  const [student, links] = await Promise.all([
    isStudent && ctx.studentId !== null ? db.findStudentById(ctx.studentId) : Promise.resolve(null),
    personalLinks(db, ctx),
  ]);
  const marks = ownMarks(ctx, person, student?.program ?? null);

  // Дисциплины группы студента у этого преподавателя (с кодом) — из скоупа
  // группы; у сотрудников и для сотрудников-людей пусто.
  const myDisciplines: PersonDiscipline[] = [];
  if (isStudent && ctx.groupName !== null && person.kind === 'TEACHER') {
    const disciplines = await db.listDisciplinesByGroup(ctx.groupName);
    for (const row of disciplines) {
      if (row.teacherName === person.fullName) {
        myDisciplines.push({ name: row.disciplineName, code: row.disciplineCode });
      }
    }
  }

  // Ближайшие пары группы студента с этим преподавателем: от «сейчас»,
  // по границам семестра, без отменённых, максимум MAX_UPCOMING_EVENTS.
  // ТОЛЬКО у преподавателей: карточке сотрудника секции нет (сценарий
  // спеки «карточка сотрудника»), поэтому у сотрудника upcoming === null
  // даже при студенческом скоупе — инвариант «null ⇔ секции нет».
  let upcoming: PersonUpcomingEvent[] | null = null;
  if (isStudent && ctx.groupName !== null && person.kind === 'TEACHER') {
    const now = new Date();
    const bounds = semesterBounds(now);
    const rows =
      now.getTime() >= bounds.end.getTime()
        ? []
        : await db.listScheduleByGroupRange(ctx.groupName, { from: now, to: bounds.end });
    upcoming = rows
      .filter((row) => row.teacherName === person.fullName && row.status !== 'CANCELLED')
      .slice(0, MAX_UPCOMING_EVENTS)
      .map((row) => ({
        id: row.id,
        dateKey: moscowDateKey(row.startsAt),
        dateLabel: formatDayShort(row.startsAt, locale),
        timeLabel: `${formatMoscowTime(row.startsAt)}–${formatMoscowTime(row.endsAt)}`,
        disciplineName:
          locale === 'en'
            ? enDisciplineName({ code: row.disciplineCode, name: row.disciplineName })
            : row.disciplineName,
        kind: row.kind,
        kindLabel: lessonKindLabel(row.kind, locale),
        roomLabel: roomLabel(row.room, locale),
        status: row.status,
      }));
  }

  return {
    person,
    href: personHrefByFullName(person.fullName)!,
    isMyTeacher: isMyTeacherMark(person, links),
    isMyDeanery: marks.isMyDeanery,
    isMyManager: marks.isMyManager,
    hasPersonalScope: isStudent,
    myDisciplines,
    upcoming,
  };
}

// ── DIG-102 — избранное людей (/people, «★ Избранное», owner-scoped) ───────

export interface FavoritePersonEntry {
  /** Стабильный ключ toggle: id каталога или «groupmate:<Student.id>». */
  personId: string;
  kind: PersonEntry['kind'] | 'GROUPMATE';
  /** href карточки /people/<id>; у одногруппника null (карточки-страницы нет). */
  href: string | null;
  fullName: string;
  /** Подпись-должность; у одногруппника пусто (рендерит словарную подпись). */
  position: string;
  department: string;
  email: string;
}

export interface FavoritePersonsData {
  /** В порядке добавления (createdAt) — категории собирает UI. */
  favorites: FavoritePersonEntry[];
  hasPersonalScope: boolean;
}

export interface FavoriteToggleResult {
  ok: boolean;
  error?: string;
}

/**
 * Белый список id человека для избранного: запись каталога людей — всем,
 * одногруппник — только студент СВОЕЙ группы (groupName из ctx сессии) и не
 * сам владелец. Чужой/несуществующий id → null: строка не записывается.
 */
async function resolveFavoritePerson(
  db: DataDb,
  ctx: DataCtx,
  personId: string,
): Promise<FavoritePersonEntry | null> {
  const catalog = findPersonById(personId);
  if (catalog) {
    return {
      personId,
      kind: catalog.kind,
      href: personHrefByFullName(catalog.fullName),
      fullName: catalog.fullName,
      position: catalog.position,
      department: catalog.department,
      email: catalog.email,
    };
  }
  const groupmateStudentId = parseGroupmatePersonId(personId);
  if (groupmateStudentId === null) return null;
  if (ctx.groupName === null || groupmateStudentId === ctx.studentId) return null;
  const student = await db.findStudentById(groupmateStudentId);
  if (!student || student.groupName !== ctx.groupName) return null;
  return {
    personId,
    kind: 'GROUPMATE',
    href: null,
    fullName: student.fullName,
    position: '',
    department: '',
    email: student.email,
  };
}

/**
 * Переключение «★ Добавить в Избранное» / «★ В Избранном» владельца сессии.
 * studentId — ТОЛЬКО из ctx (IDOR невозможен по построению); id валидируется
 * белым списком ДО записи; у сотрудника — отказ + AuditLog ROLE_MISMATCH
 * (как у каталога сервисов DIG-29).
 */
export async function toggleFavoritePerson(
  db: DataDb,
  ctx: DataCtx,
  personId: string,
  on: boolean,
): Promise<FavoriteToggleResult> {
  if (ctx.studentId === null) {
    await denyAccess(db, {
      ctx,
      resourceType: 'person',
      resourceRef: personId,
      reason: 'ROLE_MISMATCH',
    });
    return { ok: false, error: 'Избранное доступно студентам' };
  }

  const person = await resolveFavoritePerson(db, ctx, personId);
  if (!person) {
    // Некорректный или недостижимый id (чужая группа) — без записи и без аудита:
    // каталог публичен, оракула существования здесь не строится.
    return { ok: false, error: 'Этот человек недоступен в справочнике' };
  }

  if (on) {
    await db.addFavoritePersonByStudent(ctx.studentId, personId);
  } else {
    await db.removeFavoritePersonByStudent(ctx.studentId, personId);
  }
  return { ok: true };
}

/**
 * Избранное владельца сессии в порядке добавления, с разрешением записей
 * (catalog / одногруппник). Одногруппники повторно проверяются по СВОЕЙ
 * группе: покинувший группу (или удалённый) человек молча выпадает из
 * списка — избранное остаётся честным.
 */
export async function listFavoritePersons(
  db: DataDb,
  ctx: DataCtx,
): Promise<FavoritePersonsData> {
  if (ctx.studentId === null) {
    // Сотрудник деканата: студенческого избранного нет (без аудита — /people
    // общая страница, отказ здесь не событие доступа, а отсутствие секции).
    return { favorites: [], hasPersonalScope: false };
  }
  const ids = await db.listFavoritePersonIdsByStudent(ctx.studentId);
  const favorites: FavoritePersonEntry[] = [];
  for (const personId of ids) {
    const person = await resolveFavoritePerson(db, ctx, personId);
    if (person) favorites.push(person);
  }
  return { favorites, hasPersonalScope: true };
}
