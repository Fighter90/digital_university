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
//    ближайшие пары (группа студента, от «сейчас», без отменённых),
//    null для неизвестного id.

import { LESSON_KIND_LABELS } from '@/lib/dashboard-format';
import {
  findPersonById,
  PEOPLE,
  personHrefByFullName,
  type PersonDiscipline,
  type PersonEntry,
} from '@/lib/people-catalog';
import { formatDayShort } from '@/lib/schedule-cards';
import { formatMoscowTime, moscowDateKey, semesterBounds } from '@/lib/schedule-time';

import type { DataDb } from './port';
import type { DataCtx, ScheduleEventRow } from './types';

/** Сколько ближайших пар показываем на карточке человека. */
export const MAX_UPCOMING_EVENTS = 5;

export interface PersonListEntry {
  id: string;
  kind: PersonEntry['kind'];
  fullName: string;
  position: string;
  department: string;
  email: string;
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
  /** null — персонального скоупа нет (сотрудник); [] — пар впереди нет. */
  upcoming: PersonUpcomingEvent[] | null;
}

/** ids каталога — стабилизирует контракт тестов и подсказки клиенту. */
export const PEOPLE_DIRECTORY_IDS = PEOPLE.map((person) => person.id);

const roomLabel = (room: string): string =>
  room.trim().toLowerCase() === 'онлайн' ? 'онлайн' : `ауд. ${room.trim()}`;

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

  return { people, hasPersonalScope: isStudent, totalCount: people.length };
}

export async function getPersonCard(
  db: DataDb,
  ctx: DataCtx,
  id: string,
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
  let upcoming: PersonUpcomingEvent[] | null = null;
  if (isStudent && ctx.groupName !== null) {
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
        dateLabel: formatDayShort(row.startsAt),
        timeLabel: `${formatMoscowTime(row.startsAt)}–${formatMoscowTime(row.endsAt)}`,
        disciplineName: row.disciplineName,
        kind: row.kind,
        kindLabel: LESSON_KIND_LABELS[row.kind],
        roomLabel: roomLabel(row.room),
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
