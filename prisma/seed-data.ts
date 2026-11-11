// DIG-10 — pure seed data builders (no Prisma / DB imports).
// Everything is fictional: names, groups, emails (@example.edu only), rooms.
// The semester window slides around the current week so the demo never goes
// stale (runs "live" before Nov 28 2026 and after). All builders are
// deterministic: same `now` in → same data out (idempotency prerequisite).
//
// Password policy: bcrypt hashes ONLY in this file; plaintext jury passwords
// live in README.md ("Тестовые аккаунты").

export interface StudentSeed {
  login: string;
  passwordHash: string;
  fullName: string;
  email: string;
  groupName: string;
  course: number;
  faculty: string;
  program: string;
  studyForm: string;
  gradebookNumber: string;
}

export interface StaffSeed {
  login: string;
  passwordHash: string;
  fullName: string;
  position: string;
  email: string;
}

// Own fictional name list (no faker, no real person databases).
export const TEACHER_NAMES = [
  'Волков Артём Игоревич',
  'Крылова Дарья Максимовна',
  'Никитин Егор Дмитриевич',
  'Соловьёва Марина Андреевна',
  'Захаров Игорь Львович',
  'Гусева Ольга Сергеевна',
  'Белов Пётр Романович',
  'Морозова Алина Викторовна',
  'Титов Арсений Павлович',
  'Романова Екатерина Ильинична',
] as const;

// argon2id-хэши паролей демо-аккаунтов (плейнтекст — только в README,
// раздел «Тестовые аккаунты»). Алгоритм совпадает с verify при входе (DIG-11):
// bcrypt-хэши из ранней версии сида были несовместимы с argon2id-верификатором.
export const STUDENT_SEED: StudentSeed[] = [
  {
    login: 'anna.smirnova',
    passwordHash: '$argon2id$v=19$m=19456,t=2,p=1$3Rjss8EcsWbLn9OAV3gy2g$JbRrvYohL0SW04Cq2OFY9sdpLyBoLNHdCRn3BFBZ/W4',
    fullName: 'Анна Смирнова',
    email: 'anna.smirnova@example.edu',
    groupName: 'ИВТ-21',
    course: 2,
    faculty: 'Факультет компьютерных наук',
    program: 'Информатика и вычислительная техника',
    studyForm: 'очная',
    gradebookNumber: '2026-ИВТ-0142',
  },
  {
    login: 'ilya.petrov',
    passwordHash: '$argon2id$v=19$m=19456,t=2,p=1$dE4a7w4YBFD8OENOy0WBWg$cvHfUePfnTWppDgAQ5FSEBbxtOWiSmV/zrr80rHwGmk',
    fullName: 'Илья Петров',
    email: 'ilya.petrov@example.edu',
    groupName: 'ЭК-23',
    course: 3,
    faculty: 'Экономический факультет',
    program: 'Экономика',
    studyForm: 'очная',
    gradebookNumber: '2026-ЭК-0087',
  },
];

export const STAFF_SEED: StaffSeed[] = [
  {
    login: 'dean.kovaleva',
    passwordHash: '$argon2id$v=19$m=19456,t=2,p=1$PoKF0lLB58r1qjGsMGYnmA$8sMol1AoIV3h0wvT9g8/cPq0PzFYgQB8yjsYMnXfSwk',
    fullName: 'Мария Ковалёва',
    position: 'менеджер курса',
    email: 'm.kovaleva@example.edu',
  },
];

export const DEAN_NAME = STAFF_SEED[0].fullName;

// ---------------------------------------------------------------------------
// Dates: the semester is 15 weeks and slides around the current Monday
// (8 weeks back, 6 weeks forward), so "сентябрь–декабрь 2026" holds when the
// demo is recorded in autumn 2026, and the schedule stays alive afterwards.
// ---------------------------------------------------------------------------

export const WEEKS_BEFORE = 8;
export const WEEKS_AFTER = 7; // total 15 weeks: indexes 0..14 (12 study + 3 session)

/** Single source of "now" for the seed run. */
export function nowSeed(): Date {
  return new Date();
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export function mondayOf(now: Date): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const shift = (d.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  return addDays(d, -shift);
}

export function getSemesterRange(now: Date): { start: Date; end: Date; label: string } {
  const start = addDays(mondayOf(now), -7 * WEEKS_BEFORE);
  const end = addDays(start, 7 * (WEEKS_BEFORE + WEEKS_AFTER) - 1);
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();
  const label =
    startYear === endYear
      ? `осенний семестр ${startYear}/${startYear + 1}`
      : `осенний семестр ${startYear}/${endYear}`;
  return { start, end, label };
}

// ---------------------------------------------------------------------------
// Disciplines and weighted control elements (10-point scale, maxScore = 10).
// ---------------------------------------------------------------------------

export interface DisciplineSeed {
  code: string;
  name: string;
  groupName: string;
  teacherName: string;
  credits: number;
  room: string;
  elements: { code: string; name: string; kind: string; weight: number; maxScore: number }[];
}

const element = (code: string, i: number, name: string, kind: string, weight: number) => ({
  code: `${code}:EL${i + 1}`,
  name,
  kind,
  weight,
  maxScore: 10,
});

const discipline = (
  code: string,
  name: string,
  groupName: string,
  teacherName: string,
  credits: number,
  room: string,
  specs: [name: string, kind: string, weight: number][],
): DisciplineSeed => ({
  code,
  name,
  groupName,
  teacherName,
  credits,
  room,
  elements: specs.map(([n, k, w], i) => element(code, i, n, k, w)),
});

export const DISCIPLINES: DisciplineSeed[] = [
  discipline('ИВТ21-БД', 'Базы данных', 'ИВТ-21', TEACHER_NAMES[0], 5, 'А-312', [
    ['Лабораторные работы', 'LAB', 0.3],
    ['Коллоквиум', 'TEST', 0.2],
    ['Домашние задания', 'HOMEWORK', 0.2],
    ['Экзамен', 'EXAM', 0.3],
  ]),
  discipline('ИВТ21-АЛГ', 'Алгоритмы и структуры данных', 'ИВТ-21', TEACHER_NAMES[1], 5, 'А-305', [
    ['Домашние задания', 'HOMEWORK', 0.3],
    ['Контрольная работа', 'TEST', 0.3],
    ['Проект', 'PROJECT', 0.2],
    ['Экзамен', 'EXAM', 0.2],
  ]),
  discipline('ИВТ21-ОС', 'Операционные системы', 'ИВТ-21', TEACHER_NAMES[2], 4, 'Б-118', [
    ['Лабораторные работы', 'LAB', 0.4],
    ['Коллоквиум', 'TEST', 0.2],
    ['Экзамен', 'EXAM', 0.4],
  ]),
  discipline('ИВТ21-ВЕБ', 'Веб-технологии', 'ИВТ-21', TEACHER_NAMES[3], 4, 'А-312', [
    ['Проект', 'PROJECT', 0.4],
    ['Домашние задания', 'HOMEWORK', 0.3],
    ['Зачёт с оценкой', 'EXAM', 0.3],
  ]),
  discipline(
    'ИВТ21-АСР',
    'Архитектура информационных систем',
    'ИВТ-21',
    TEACHER_NAMES[4],
    3,
    'Б-204',
    [
      ['Домашние задания', 'HOMEWORK', 0.4],
      ['Контрольная работа', 'TEST', 0.3],
      ['Экзамен', 'EXAM', 0.3],
    ],
  ),
  discipline('ИВТ21-УПР', 'Управление проектами', 'ИВТ-21', TEACHER_NAMES[7], 3, 'А-410', [
    ['Проект', 'PROJECT', 0.5],
    ['Домашние задания', 'HOMEWORK', 0.3],
    ['Зачёт с оценкой', 'EXAM', 0.2],
  ]),
  discipline(
    'ИВТ21-ИНГЛ',
    'Иностранный язык (профильный)',
    'ИВТ-21',
    TEACHER_NAMES[5],
    3,
    'В-201',
    [
      ['Домашние задания', 'HOMEWORK', 0.4],
      ['Контрольные работы', 'TEST', 0.2],
      ['Зачёт с оценкой', 'EXAM', 0.4],
    ],
  ),
  discipline(
    'ИВТ21-ФИЗВ',
    'Физическая культура и спорт',
    'ИВТ-21',
    TEACHER_NAMES[6],
    2,
    'Спорткомплекс',
    [
      ['Посещение и активность', 'HOMEWORK', 0.5],
      ['Нормативы', 'TEST', 0.2],
      ['Зачёт с оценкой', 'EXAM', 0.3],
    ],
  ),
  discipline('ЭК23-МКР', 'Макроэкономика', 'ЭК-23', TEACHER_NAMES[8], 4, 'Г-104', [
    ['Домашние задания', 'HOMEWORK', 0.3],
    ['Контрольная работа', 'TEST', 0.3],
    ['Экзамен', 'EXAM', 0.4],
  ]),
  discipline('ЭК23-ЭКМ', 'Эконометрика', 'ЭК-23', TEACHER_NAMES[1], 4, 'Г-210', [
    ['Лабораторные работы', 'LAB', 0.4],
    ['Домашние задания', 'HOMEWORK', 0.2],
    ['Экзамен', 'EXAM', 0.4],
  ]),
  discipline('ЭК23-БУЧ', 'Бухгалтерский учёт', 'ЭК-23', TEACHER_NAMES[9], 3, 'Г-108', [
    ['Домашние задания', 'HOMEWORK', 0.4],
    ['Контрольная работа', 'TEST', 0.3],
    ['Зачёт с оценкой', 'EXAM', 0.3],
  ]),
  discipline('ЭК23-ФИН', 'Финансовые рынки', 'ЭК-23', TEACHER_NAMES[4], 3, 'Г-104', [
    ['Домашние задания', 'HOMEWORK', 0.3],
    ['Проект', 'PROJECT', 0.3],
    ['Экзамен', 'EXAM', 0.4],
  ]),
  discipline('ЭК23-СТАТ', 'Статистика', 'ЭК-23', TEACHER_NAMES[5], 3, 'Г-210', [
    ['Лабораторные работы', 'LAB', 0.4],
    ['Контрольная работа', 'TEST', 0.3],
    ['Экзамен', 'EXAM', 0.3],
  ]),
  discipline('ЭК23-ФИЛ', 'Философия', 'ЭК-23', TEACHER_NAMES[2], 3, 'Д-302', [
    ['Эссе', 'HOMEWORK', 0.4],
    ['Коллоквиум', 'TEST', 0.3],
    ['Зачёт с оценкой', 'EXAM', 0.3],
  ]),
  discipline('ЭК23-ИНГЛ', 'Иностранный язык (деловой)', 'ЭК-23', TEACHER_NAMES[3], 2, 'В-205', [
    ['Домашние задания', 'HOMEWORK', 0.4],
    ['Презентация', 'PROJECT', 0.2],
    ['Зачёт с оценкой', 'EXAM', 0.4],
  ]),
];

// ---------------------------------------------------------------------------
// Weekly schedule template. Slots: [day 0=Mon..4=Fri, slot 0..4, discipline, kind].
// Times are fixed pair windows.
// ---------------------------------------------------------------------------

const SLOT_TIMES: [string, string][] = [
  ['09:00', '10:30'],
  ['10:40', '12:10'],
  ['12:30', '14:00'],
  ['14:10', '15:40'],
  ['15:50', '17:20'],
];

type TemplateRow = [day: number, slot: number, disciplineCode: string, kind: string];

const WEEK_TEMPLATE: Record<string, TemplateRow[]> = {
  'ИВТ-21': [
    [0, 0, 'ИВТ21-БД', 'LECTURE'],
    [0, 1, 'ИВТ21-АЛГ', 'LECTURE'],
    [0, 2, 'ИВТ21-ФИЗВ', 'PRACTICE'],
    [1, 0, 'ИВТ21-ВЕБ', 'PRACTICE'],
    [1, 1, 'ИВТ21-БД', 'PRACTICE'],
    [1, 2, 'ИВТ21-ОС', 'LECTURE'],
    [1, 3, 'ИВТ21-ИНГЛ', 'SEMINAR'],
    [2, 0, 'ИВТ21-АЛГ', 'PRACTICE'],
    [2, 1, 'ИВТ21-АСР', 'LECTURE'],
    [2, 2, 'ИВТ21-УПР', 'SEMINAR'],
    [3, 0, 'ИВТ21-БД', 'LAB'],
    [3, 1, 'ИВТ21-ВЕБ', 'LECTURE'],
    [3, 2, 'ИВТ21-ОС', 'LAB'],
    [3, 3, 'ИВТ21-УПР', 'LECTURE'],
    [4, 0, 'ИВТ21-АСР', 'PRACTICE'],
    [4, 1, 'ИВТ21-ФИЗВ', 'PRACTICE'],
    [4, 2, 'ИВТ21-ВЕБ', 'CONSULTATION'],
  ],
  'ЭК-23': [
    [0, 0, 'ЭК23-МКР', 'LECTURE'],
    [0, 1, 'ЭК23-СТАТ', 'PRACTICE'],
    [0, 2, 'ЭК23-ФИЛ', 'LECTURE'],
    [1, 0, 'ЭК23-ЭКМ', 'LECTURE'],
    [1, 1, 'ЭК23-БУЧ', 'PRACTICE'],
    [1, 2, 'ЭК23-ИНГЛ', 'SEMINAR'],
    [1, 3, 'ЭК23-ФИН', 'LECTURE'],
    [2, 0, 'ЭК23-СТАТ', 'LECTURE'],
    [2, 1, 'ЭК23-ЭКМ', 'LAB'],
    [2, 2, 'ЭК23-БУЧ', 'LECTURE'],
    [3, 0, 'ЭК23-МКР', 'SEMINAR'],
    [3, 1, 'ЭК23-ФИН', 'PRACTICE'],
    [3, 2, 'ЭК23-ЭКМ', 'PRACTICE'],
    [3, 3, 'ЭК23-ФИЛ', 'SEMINAR'],
    [4, 0, 'ЭК23-СТАТ', 'LAB'],
    [4, 1, 'ЭК23-ИНГЛ', 'PRACTICE'],
    [4, 2, 'ЭК23-МКР', 'CONSULTATION'],
  ],
};

const byCode = new Map(DISCIPLINES.map((d) => [d.code, d]));

export interface ScheduleEventSeed {
  groupName: string;
  disciplineCode: string;
  date: Date;
  startsAt: Date;
  endsAt: Date;
  kind: string;
  room: string;
  teacherName: string;
  status: string;
  note: string | null;
  previousRoom: string | null;
  previousStartsAt: Date | null;
}

const SESSION_WEEK_START = 12; // weeks 12..14 are the exam session

function atTime(day: Date, hm: string): Date {
  const [h, m] = hm.split(':').map(Number);
  return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), h, m, 0, 0));
}

export function buildScheduleEvents(now: Date): ScheduleEventSeed[] {
  const start = getSemesterRange(now).start;
  const events: ScheduleEventSeed[] = [];

  for (let week = 0; week < WEEKS_BEFORE + WEEKS_AFTER; week += 1) {
    if (week >= SESSION_WEEK_START) continue; // session weeks: only exams below
    const monday = addDays(start, 7 * week);
    for (const [groupName, rows] of Object.entries(WEEK_TEMPLATE)) {
      for (const [day, slot, code, kind] of rows) {
        const d = byCode.get(code)!;
        const date = addDays(monday, day);
        events.push({
          groupName,
          disciplineCode: code,
          date,
          startsAt: atTime(date, SLOT_TIMES[slot][0]),
          endsAt: atTime(date, SLOT_TIMES[slot][1]),
          kind,
          room: d.room,
          teacherName: d.teacherName,
          status: 'SCHEDULED',
          note: null,
          previousRoom: null,
          previousStartsAt: null,
        });
      }
    }
  }

  // Current-week exceptions: exactly one room change, one time shift, one
  // cancellation — anchored to the week that contains `now` (clamped into the
  // study weeks so they always exist).
  const monday = mondayOf(now);
  const currentWeek = Math.round((monday.getTime() - start.getTime()) / (7 * 24 * 3600 * 1000));
  const week = Math.min(Math.max(currentWeek, 0), SESSION_WEEK_START - 1);
  const weekMonday = addDays(start, 7 * week);
  const find = (group: string, day: number, slot: number) => {
    const date = addDays(weekMonday, day);
    const slotStart = atTime(date, SLOT_TIMES[slot][0]);
    return events.find(
      (e) =>
        e.groupName === group &&
        sameDay(e.date, date) &&
        e.startsAt.getTime() === slotStart.getTime(),
    )!;
  };

  const roomMove = find('ИВТ-21', 1, 1); // Tuesday: Базы данных practice
  roomMove.status = 'ROOM_CHANGED';
  roomMove.previousRoom = roomMove.room;
  roomMove.room = 'Б-204';
  roomMove.note = 'Аудитория занята факультетским мероприятием — пара переносится в Б-204';

  const timeMove = find('ЭК-23', 2, 0); // Wednesday: Статистика lecture
  timeMove.status = 'TIME_CHANGED';
  timeMove.previousStartsAt = timeMove.startsAt;
  timeMove.startsAt = atTime(timeMove.date, SLOT_TIMES[2][0]);
  timeMove.endsAt = atTime(timeMove.date, SLOT_TIMES[2][1]);
  timeMove.note = 'Лектор в командировке — занятие перенесено на 12:30';

  const cancelled = find('ИВТ-21', 4, 2); // Friday: Веб-технологии consultation
  cancelled.status = 'CANCELLED';
  cancelled.note =
    'Консультация отменена: преподаватель на конференции, вопросы — через обращения в деканат';

  return events;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

// ---------------------------------------------------------------------------
// Exam session: credits in week 12, exams in week 13, one retake in week 14.
// ---------------------------------------------------------------------------

export interface ExamSessionSeed {
  groupName: string;
  disciplineCode: string;
  kind: string;
  date: Date;
  startsAt: Date;
  room: string;
  note: string | null;
}

export function buildExamSessions(now: Date): ExamSessionSeed[] {
  const start = getSemesterRange(now).start;
  const creditsMonday = addDays(start, 7 * 12);
  const examsMonday = addDays(start, 7 * 13);
  const retakeMonday = addDays(start, 7 * 14);

  const mk = (
    group: string,
    code: string,
    kind: string,
    dayOffset: number,
    hm: string,
    room: string,
    note: string | null,
    base: Date,
  ): ExamSessionSeed => {
    const date = addDays(base, dayOffset);
    return {
      groupName: group,
      disciplineCode: code,
      kind,
      date,
      startsAt: atTime(date, hm),
      room,
      note,
    };
  };

  return [
    mk(
      'ИВТ-21',
      'ИВТ21-ВЕБ',
      'CREDIT',
      0,
      '10:40',
      'А-312',
      'Зачёт с оценкой по накопленным результатам',
      creditsMonday,
    ),
    mk('ИВТ-21', 'ИВТ21-УПР', 'CREDIT', 1, '10:40', 'А-410', 'Защита проектов', creditsMonday),
    mk('ИВТ-21', 'ИВТ21-ИНГЛ', 'CREDIT', 2, '09:00', 'В-201', null, creditsMonday),
    mk(
      'ИВТ-21',
      'ИВТ21-БД',
      'EXAM',
      0,
      '09:00',
      'А-401',
      'Письменный экзамен, 90 минут',
      examsMonday,
    ),
    mk(
      'ИВТ-21',
      'ИВТ21-АЛГ',
      'EXAM',
      1,
      '09:00',
      'А-401',
      'Письменный экзамен, 90 минут',
      examsMonday,
    ),
    mk('ИВТ-21', 'ИВТ21-ОС', 'EXAM', 3, '10:40', 'Б-118', 'Устный экзамен по билетам', examsMonday),
    mk(
      'ИВТ-21',
      'ИВТ21-БД',
      'RETAKE',
      0,
      '09:00',
      'А-401',
      'Пересдача: письменная работа повышенной сложности',
      retakeMonday,
    ),
    mk('ЭК-23', 'ЭК23-ФИЛ', 'CREDIT', 0, '12:30', 'Д-302', null, creditsMonday),
    mk('ЭК-23', 'ЭК23-БУЧ', 'CREDIT', 2, '10:40', 'Г-108', null, creditsMonday),
    mk('ЭК-23', 'ЭК23-ИНГЛ', 'CREDIT', 3, '09:00', 'В-205', null, creditsMonday),
    mk(
      'ЭК-23',
      'ЭК23-МКР',
      'EXAM',
      0,
      '12:30',
      'Г-101',
      'Письменный экзамен, 90 минут',
      examsMonday,
    ),
    mk(
      'ЭК-23',
      'ЭК23-ЭКМ',
      'EXAM',
      2,
      '09:00',
      'Г-101',
      'Письменный экзамен с калькуляторами',
      examsMonday,
    ),
    mk('ЭК-23', 'ЭК23-ФИН', 'EXAM', 4, '09:00', 'Г-101', null, examsMonday),
  ];
}

// ---------------------------------------------------------------------------
// Grades: deterministic pseudo-random scores (mulberry32), 10-point scale.
// Anna: strong record, exactly one debt (3/10 on the БД colloquium).
// Ilya: solid, no debts. Elements "planned" after now stay ungraded.
// ---------------------------------------------------------------------------

export interface GradesSeed {
  disciplines: DisciplineSeed[];
  entries: { elementCode: string; score: number; gradedAt: Date; comment: string | null }[];
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PLANNED_WEEKS = [2, 5, 8, 10, 12];

export function buildGrades(now: Date, student: StudentSeed): GradesSeed {
  const disciplines = DISCIPLINES.filter((d) => d.groupName === student.groupName);
  const start = getSemesterRange(now).start;
  const rand = mulberry32(
    [...student.login].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 7),
  );
  const entries: GradesSeed['entries'] = [];

  for (const d of disciplines) {
    d.elements.forEach((el, i) => {
      // Elements are "written" across the semester; anything planned after
      // `now` (within 24h) stays ungraded so screens have pending work.
      const plannedWeek = PLANNED_WEEKS[i % PLANNED_WEEKS.length];
      const plannedAt = atTime(addDays(start, 7 * plannedWeek + (i % 4)), '10:00');
      if (plannedAt.getTime() > now.getTime() - 24 * 3600 * 1000) return;

      let score: number;
      if (student.login === 'anna.smirnova') {
        // Anna: good student — mostly 7..10; exactly one debt is forced below.
        score = rand() < 0.7 ? 7 + Math.floor(rand() * 4) : 5 + Math.floor(rand() * 2);
        if (el.code === 'ИВТ21-БД:EL2') score = 3; // the single debt (коллоквиум)
      } else {
        // Ilya: steady 6..9, no debts.
        score = 6 + Math.floor(rand() * 4);
      }
      const comment =
        score >= 9 ? 'Отличная работа' : score === 3 ? 'Требуется пересдача коллоквиума' : null;
      entries.push({ elementCode: el.code, score, gradedAt: plannedAt, comment });
    });
  }
  return { disciplines, entries };
}

// ---------------------------------------------------------------------------
// Requests with event history — every dictionary status is covered.
// ---------------------------------------------------------------------------

export interface RequestSeed {
  studentLogin: string;
  type: string;
  title: string;
  status: string;
  assignee: string | null;
  resultNote: string | null;
  createdAt: Date;
  updatedAt: Date;
  events: {
    actorRole: string;
    actorName: string;
    statusFrom: string | null;
    statusTo: string;
    message: string;
    createdAt: Date;
  }[];
}

export function buildRequests(now: Date): RequestSeed[] {
  const daysAgo = (n: number, h = 10) =>
    new Date(now.getTime() - n * 24 * 3600 * 1000 - h * 3600 * 1000);
  const dean = DEAN_NAME;

  const req = (
    studentLogin: string,
    type: string,
    title: string,
    status: string,
    createdDays: number,
    updatedDays: number,
    resultNote: string | null,
    events: RequestSeed['events'],
  ): RequestSeed => ({
    studentLogin,
    type,
    title,
    status,
    assignee: status === 'SUBMITTED' ? null : dean,
    resultNote,
    createdAt: daysAgo(createdDays),
    updatedAt: daysAgo(updatedDays),
    events,
  });

  const ev = (
    actorRole: string,
    statusFrom: string | null,
    statusTo: string,
    message: string,
    days: number,
  ) => ({
    actorRole,
    actorName: actorRole === 'STUDENT' ? 'Студент' : dean,
    statusFrom,
    statusTo,
    message,
    createdAt: daysAgo(days, 12),
  });

  return [
    // Anna: 2 requests in progress + completed + rejected (history).
    req(
      'anna.smirnova',
      'CERTIFICATE',
      'Справка об обучении по месту требования',
      'IN_PROGRESS',
      6,
      4,
      null,
      [
        ev(
          'STUDENT',
          null,
          'SUBMITTED',
          'Нужна справка с печатью для отдела кадров по месту работы.',
          6,
        ),
        ev(
          'STAFF',
          'SUBMITTED',
          'IN_PROGRESS',
          'Заявка принята в работу, готовность — 3 рабочих дня.',
          4,
        ),
      ],
    ),
    req(
      'anna.smirnova',
      'STATEMENT',
      'Индивидуальный график занятий по физической культуре',
      'IN_PROGRESS',
      9,
      7,
      null,
      [
        ev(
          'STUDENT',
          null,
          'SUBMITTED',
          'Прошу установить индивидуальный график по медицинским показаниям, справка приложена.',
          9,
        ),
        ev(
          'STAFF',
          'SUBMITTED',
          'IN_PROGRESS',
          'Передано на согласование на кафедру физвоспитания.',
          7,
        ),
      ],
    ),
    req(
      'anna.smirnova',
      'CERTIFICATE',
      'Повторная справка для налогового вычета',
      'COMPLETED',
      30,
      24,
      'Справка готова, PDF с QR-кодом доступен в разделе «Мои документы».',
      [
        ev(
          'STUDENT',
          null,
          'SUBMITTED',
          'Первая справка потерялась при подаче документов, нужна копия.',
          30,
        ),
        ev(
          'STAFF',
          'SUBMITTED',
          'IN_PROGRESS',
          'Проверяем данные, готовность — 2 рабочих дня.',
          29,
        ),
        ev(
          'STAFF',
          'IN_PROGRESS',
          'COMPLETED',
          'Справка готова, заберите в деканате или скачайте PDF.',
          24,
        ),
      ],
    ),
    req(
      'anna.smirnova',
      'STATEMENT',
      'Перенос пары для участия в хакатоне',
      'REJECTED',
      20,
      16,
      'В переносе отказано: пара входит в блок промежуточной аттестации.',
      [
        ev(
          'STUDENT',
          null,
          'SUBMITTED',
          'Прошу перенести пару в пятницу — участвую в финале хакатона.',
          20,
        ),
        ev('STAFF', 'SUBMITTED', 'IN_PROGRESS', 'Запросили согласие преподавателя.', 19),
        ev(
          'STAFF',
          'IN_PROGRESS',
          'REJECTED',
          'Отказ: в этот день контрольная точка, замены нет.',
          16,
        ),
      ],
    ),
    // Ilya: completed practice (offer), needs revision, fresh submission.
    req(
      'ilya.petrov',
      'PRACTICE',
      'Заявка на производственную практику',
      'COMPLETED',
      40,
      25,
      'Оффер: ООО «Цифровые Решения», позиция «Аналитик данных», июль–август; договор подписан.',
      [
        ev(
          'STUDENT',
          null,
          'SUBMITTED',
          'Хочу пройти практику в компании-партнёре, резюме приложено.',
          40,
        ),
        ev('STAFF', 'SUBMITTED', 'IN_PROGRESS', 'Направили резюме партнёру, ждём ответ.', 38),
        ev(
          'STAFF',
          'IN_PROGRESS',
          'COMPLETED',
          'Приглашение получено: аналитик данных, июль–август. Договор в деканате.',
          25,
        ),
      ],
    ),
    req(
      'ilya.petrov',
      'STATEMENT',
      'Перезачёт дисциплины «Статистика»',
      'NEEDS_REVISION',
      5,
      2,
      null,
      [
        ev(
          'STUDENT',
          null,
          'SUBMITTED',
          'Прошу перезачесть статистику за первый курс колледжа, аттестат приложен.',
          5,
        ),
        ev('STAFF', 'SUBMITTED', 'IN_PROGRESS', 'Проверяем программу дисциплины колледжа.', 4),
        ev(
          'STAFF',
          'IN_PROGRESS',
          'NEEDS_REVISION',
          'Нужна доработка: приложите скан договора о обучении и программу дисциплины (часы, темы).',
          2,
        ),
      ],
    ),
    req(
      'ilya.petrov',
      'CERTIFICATE',
      'Справка о размере стипендии для банка',
      'SUBMITTED',
      1,
      1,
      null,
      [
        ev(
          'STUDENT',
          null,
          'SUBMITTED',
          'Нужна справка о начисленной стипендии за последние 6 месяцев для кредитной заявки.',
          1,
        ),
      ],
    ),
  ];
}

// ---------------------------------------------------------------------------
// Notifications, news, FAQ, appeals.
// ---------------------------------------------------------------------------

export interface NotificationSeed {
  studentLogin: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: Date;
}

export function buildNotifications(now: Date, studentLogin: string): NotificationSeed[] {
  const daysAgo = (n: number, h = 9) =>
    new Date(now.getTime() - n * 24 * 3600 * 1000 - h * 3600 * 1000);

  if (studentLogin === 'anna.smirnova') {
    return [
      {
        studentLogin,
        type: 'SCHEDULE',
        title: 'Изменение аудитории на этой неделе',
        body: 'Практика «Базы данных» во вторник пройдёт в аудитории Б-204 вместо А-312.',
        isRead: false,
        createdAt: daysAgo(0, 8),
      },
      {
        studentLogin,
        type: 'SCHEDULE',
        title: 'Пара отменена: Веб-технологии',
        body: 'Консультация в пятницу отменена — преподаватель на конференции.',
        isRead: false,
        createdAt: daysAgo(1, 15),
      },
      {
        studentLogin,
        type: 'GRADE',
        title: 'Внимание: долг по коллоквиуму',
        body: 'Коллоквиум «Базы данных» — 3/10. Назначена пересдача 21 декабря, ауд. А-401.',
        isRead: false,
        createdAt: daysAgo(2, 12),
      },
      {
        studentLogin,
        type: 'REQUEST',
        title: 'Заявка в работе: справка об обучении',
        body: 'Мария Ковалёва приняла заявку, готовность — 3 рабочих дня.',
        isRead: false,
        createdAt: daysAgo(4, 11),
      },
      {
        studentLogin,
        type: 'SCHEDULE',
        title: 'Перенос занятия по статистике',
        body: 'Лекция «Статистика» в среду перенесена на 12:30.',
        isRead: true,
        createdAt: daysAgo(1, 9),
      },
      {
        studentLogin,
        type: 'GRADE',
        title: 'Новая оценка: 9/10',
        body: 'Лабораторная работа №4 «Базы данных» — 9/10. Так держать!',
        isRead: true,
        createdAt: daysAgo(5, 14),
      },
      {
        studentLogin,
        type: 'GRADE',
        title: 'Новая оценка: 8/10',
        body: 'Проект «Управление проектами» (этап 2) — 8/10.',
        isRead: true,
        createdAt: daysAgo(6, 13),
      },
      {
        studentLogin,
        type: 'REQUEST',
        title: 'Заявка отклонена: перенос пары',
        body: 'В переносе пары для хакатона отказано — см. комментарий в карточке заявки.',
        isRead: true,
        createdAt: daysAgo(16, 12),
      },
      {
        studentLogin,
        type: 'REQUEST',
        title: 'Справка готова',
        body: 'Повторная справка для налогового вычета готова: PDF с QR-кодом.',
        isRead: true,
        createdAt: daysAgo(24, 12),
      },
      {
        studentLogin,
        type: 'NEWS',
        title: 'Открыта запись на консультации перед сессией',
        body: 'Запись через раздел «Обращения» — тема «Консультация».',
        isRead: true,
        createdAt: daysAgo(3, 10),
      },
      {
        studentLogin,
        type: 'DEADLINE',
        title: 'Долг нужно закрыть до начала сессии',
        body: 'Пересдача коллоквиума по «Базам данных» — 21 декабря. Подготовьтесь заранее.',
        isRead: true,
        createdAt: daysAgo(7, 10),
      },
      {
        studentLogin,
        type: 'SYSTEM',
        title: 'Добро пожаловать в цифровой деканат',
        body: 'Личный кабинет собрал расписание, оценки и заявки в одном месте.',
        isRead: true,
        createdAt: daysAgo(60, 9),
      },
    ];
  }
  return [
    {
      studentLogin,
      type: 'SCHEDULE',
      title: 'Перенос занятия по статистике',
      body: 'Лекция «Статистика» в среду перенесена на 12:30 (аудитория та же).',
      isRead: false,
      createdAt: daysAgo(0, 8),
    },
    {
      studentLogin,
      type: 'REQUEST',
      title: 'Заявка нуждается в доработке',
      body: 'Перезачёт «Статистики»: приложите скан договора и программу дисциплины.',
      isRead: false,
      createdAt: daysAgo(2, 12),
    },
    {
      studentLogin,
      type: 'SCHEDULE',
      title: 'Опубликовано расписание сессии',
      body: 'Экзамены начнутся 14 декабря, зачёты — 7 декабря. Подробности в разделе «Сессия».',
      isRead: false,
      createdAt: daysAgo(1, 9),
    },
    {
      studentLogin,
      type: 'REQUEST',
      title: 'Заявка зарегистрирована',
      body: 'Справка о размере стипендии принята, номер отслеживания в карточке заявки.',
      isRead: true,
      createdAt: daysAgo(1, 10),
    },
    {
      studentLogin,
      type: 'GRADE',
      title: 'Новая оценка: 8/10',
      body: 'Контрольная работа «Макроэкономика» — 8/10.',
      isRead: true,
      createdAt: daysAgo(4, 13),
    },
    {
      studentLogin,
      type: 'GRADE',
      title: 'Новая оценка: 7/10',
      body: 'Лабораторная работа №3 «Эконометрика» — 7/10.',
      isRead: true,
      createdAt: daysAgo(8, 13),
    },
    {
      studentLogin,
      type: 'REQUEST',
      title: 'Практика: оффер получен',
      body: 'ООО «Цифровые Решения» приглашает на практику «Аналитик данных», июль–август.',
      isRead: true,
      createdAt: daysAgo(25, 12),
    },
    {
      studentLogin,
      type: 'DEADLINE',
      title: 'Документы для перезачёта — до 20 ноября',
      body: 'Без программы дисциплины перезачёт провести нельзя.',
      isRead: true,
      createdAt: daysAgo(3, 10),
    },
    {
      studentLogin,
      type: 'NEWS',
      title: 'Стипендия: сроки подачи документов',
      body: 'Документы на повышенную стипендию принимаются до конца месяца.',
      isRead: true,
      createdAt: daysAgo(2, 10),
    },
    {
      studentLogin,
      type: 'SYSTEM',
      title: 'Профиль заполнен',
      body: 'Проверьте данные зачётки и контакты в разделе «Профиль».',
      isRead: true,
      createdAt: daysAgo(45, 9),
    },
  ];
}

export interface NewsSeed {
  slug: string;
  title: string;
  body: string;
  authorName: string;
  isPinned: boolean;
  publishedAt: Date;
}

export function buildNews(now: Date): NewsSeed[] {
  const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 3600 * 1000 - 9 * 3600 * 1000);
  return [
    {
      slug: 'consultations-session',
      title: 'Открыта запись на консультации перед сессией',
      body: 'Преподаватели выделили слоты для консультаций с 7 по 18 декабря. Запись — через «Обращения» с темой «Консультация». Приходите с конкретными вопросами: список тем к экзаменам уже в разделах дисциплин.',
      authorName: DEAN_NAME,
      isPinned: true,
      publishedAt: daysAgo(3),
    },
    {
      slug: 'schedule-updates-november',
      title: 'Изменения в расписании с 16 ноября',
      body: 'Часть пар уточнена: переносы аудиторий и времени видны в расписании с пометками. Проверяйте неделю перед выходом в университет — кабинет показывает актуальный вариант.',
      authorName: DEAN_NAME,
      isPinned: false,
      publishedAt: daysAgo(5),
    },
    {
      slug: 'scholarship-docs-deadline',
      title: 'Стипендия: приём документов на повышенную выплату',
      body: 'Документы на повышенную государственную академическую стипендию принимаются до 30 ноября: достижения в учёбе, науке, спорте или общественной деятельности. Подробности — в FAQ, раздел «Стипендии и выплаты».',
      authorName: DEAN_NAME,
      isPinned: false,
      publishedAt: daysAgo(2),
    },
    {
      slug: 'hackathon-registration',
      title: 'Хакатон «Цифровой деканат»: регистрация открыта',
      body: 'Команды до 4 человек, два трека: студенческие сервисы и аналитика учебного процесса. Участникам финала — перенос пар по заявке в деканат (как у Анны: см. историю заявки).',
      authorName: 'Студенческий совет',
      isPinned: false,
      publishedAt: daysAgo(6),
    },
    {
      slug: 'library-session-hours',
      title: 'Библиотека продлевает часы работы в сессию',
      body: 'С 7 декабря читальный зал работает до 22:00 по будням, в субботу — до 18:00. Бронь мест — на месте, учебники по экзаменационным дисциплинам в резерве кафедр.',
      authorName: 'Библиотека',
      isPinned: false,
      publishedAt: daysAgo(8),
    },
  ];
}

export interface FaqSeed {
  slug: string;
  category: string;
  question: string;
  answer: string;
  sortOrder: number;
}

export function buildFaq(): FaqSeed[] {
  const raw: [category: string, question: string, answer: string][] = [
    [
      'Обучение',
      'Как узнать свой курс и направление подготовки?',
      'Курс, направление и форма обучения указаны в разделе «Профиль». Там же — номер зачётной книжки и факультет.',
    ],
    [
      'Обучение',
      'Что делать, если в зачётке ошибка в оценке?',
      'Подайте обращение в деканат с темой «Ошибка в оценке» и укажите дисциплину. Проверка занимает до 3 рабочих дней.',
    ],
    [
      'Обучение',
      'Как перевестись на другую программу?',
      'Заявление на перевод подаётся в деканат в период с 20 июня по 5 июля. Условия — на странице факультета.',
    ],
    [
      'Обучение',
      'Можно ли посещать занятия другой группы?',
      'Да, как вольнослушатель — по согласованию с преподавателем. Оценки за такое посещение не фиксируются.',
    ],
    [
      'Обучение',
      'Где посмотреть учебный план?',
      'Учебный план с перечнем дисциплин и кредитами доступен в разделе «Успеваемость» — вкладка «Дисциплины».',
    ],
    [
      'Стипендии и выплаты',
      'Как получить повышенную стипендию?',
      'Соберите подтверждённые достижения: оценки «отлично» за последний период, публикации, победы в олимпиадах или волонтёрские часы. Документы подаются в деканат до 30 ноября.',
    ],
    [
      'Стипендии и выплаты',
      'Когда приходит стипендия?',
      'Академическая стипендия начисляется до 25 числа каждого месяца на банковскую карту, указанную в профиле.',
    ],
    [
      'Стипендии и выплаты',
      'Платят ли стипендию первокурсникам первого семестра?',
      'Да, всем студентам очной формы бюджетных мест назначается стипендия первого семестра без требований к оценкам.',
    ],
    [
      'Стипендии и выплаты',
      'Что такое социальная стипендия и кто её получает?',
      'Социальная стипендия назначается студентам из льготных категорий независимо от оценок. Документы — в деканат, решение — в течение 10 дней.',
    ],
    [
      'Стипендии и выплаты',
      'Теряется ли стипендия при одной «четвёрке»?',
      'Нет. Стипендия сохраняется при отсутствии «троек» и долгов за последний период сессии. Подробности — в положении о стипендиях.',
    ],
    [
      'Заявки и справки',
      'Какие справки можно заказать онлайн?',
      'Справка об обучении, о размере стипендии, о периоде обучения, для налогового вычета и военкомата — все через «Сервисы».',
    ],
    [
      'Заявки и справки',
      'Сколько готовится справка?',
      'Стандартный срок — 3 рабочих дня, срочная печать — 1 день. Статус виден в разделе «Мои заявки».',
    ],
    [
      'Заявки и справки',
      'Как забрать готовую справку?',
      'В деканате в рабочие часы или скачать PDF с QR-кодом — он подтверждает подлинность документа.',
    ],
    [
      'Заявки и справки',
      'Заявка в статусе «Нужна доработка» — что делать?',
      'Откройте карточку заявки: там список недостающих документов. Приложите их в том же обращении, повторно подавать не нужно.',
    ],
    [
      'Заявки и справки',
      'Можно ли отозвать заявку?',
      'Да, пока она в статусе «Новая» — кнопка «Отменить» в карточке заявки. После начала обработки — только через деканат.',
    ],
    [
      'Расписание',
      'Почему пара отображается другим цветом?',
      'Цвет — тип занятия: лекция, практика, лаборатория, семинар. Изменённые пары помечены специальной меткой переноса.',
    ],
    [
      'Расписание',
      'Как узнать, куда перенесли пару?',
      'Перенесённые пары показывают прежнюю и новую аудиторию/время прямо в карточке занятия, плюс приходит уведомление.',
    ],
    [
      'Расписание',
      'Расписание изменилось, а в кабинете старое — что делать?',
      'Обновите страницу: данные приходят из деканата в реальном времени. Если расхождение осталось — сообщите через «Обращения».',
    ],
    [
      'Сессия',
      'Когда начинается сессия?',
      'Зачёты — с 7 декабря, экзамены — с 14 декабря. Точное расписание с аудиториями — в разделе «Сессия».',
    ],
    [
      'Сессия',
      'Что такое пересдача и когда она проходит?',
      'Пересдача — вторая попытка сдать экзамен или коллоквиум. Основная волна пересдач — после основного экзамена в течение сессионной недели.',
    ],
    [
      'Сессия',
      'Сколько попыток сдать экзамен?',
      'Три: основной экзамен и две пересдачи (вторая — с комиссией). График пересдач публикуется в «Сессии».',
    ],
    [
      'Сессия',
      'Можно ли уйти на каникулы с долгом?',
      'Нет, до ликвидации академической задолженности пересдачи назначаются до начала следующего семестра.',
    ],
    [
      'Общежитие',
      'Как заселиться в общежитие?',
      'Подайте заявку типа «Общежитие» через «Сервисы» и приложите договор. Решение комиссия принимает до 25 августа.',
    ],
    [
      'Общежитие',
      'Куда сообщить о поломке в общежитии?',
      'Через «Обращения» с темой «Общежитие» — заявка уйдёт в комендатуру, статус виден в кабинете.',
    ],
    [
      'Прочее',
      'Как восстановить пароль от кабинета?',
      'На экране входа нажмите «Забыли пароль?» — письмо придёт на почту example.edu. Если нет доступа к почте — обратитесь в деканат.',
    ],
    [
      'Прочее',
      'Куда предложить идею по улучшению кабинета?',
      'Раздел «Предложения руководству»: лучшие идеи попадают в бэклог прототипа, авторы получают ответ в обращениях.',
    ],
  ];
  return raw.map(([category, question, answer], i) => ({
    slug: `faq-${i + 1}`,
    category,
    question,
    answer,
    sortOrder: i + 1,
  }));
}

export interface AppealSeed {
  studentLogin: string;
  subject: string;
  status: string;
  createdAt: Date;
  messages: {
    authorRole: string;
    authorName: string;
    body: string;
    createdAt: Date;
  }[];
}

export function buildAppeals(now: Date): AppealSeed[] {
  const daysAgo = (n: number, h = 10) =>
    new Date(now.getTime() - n * 24 * 3600 * 1000 - h * 3600 * 1000);
  const dean = DEAN_NAME;
  const anna = 'Анна Смирнова';
  const ilya = 'Илья Петров';

  return [
    {
      studentLogin: 'anna.smirnova',
      subject: 'Пересдача коллоквиума по базам данных',
      status: 'OPEN',
      createdAt: daysAgo(2, 13),
      messages: [
        {
          authorRole: 'STUDENT',
          authorName: anna,
          body: 'Здравствуйте! Получила 3/10 за коллоквиум по базам данных. Подскажите формат пересдачи 21 декабря и темы для подготовки.',
          createdAt: daysAgo(2, 13),
        },
        {
          authorRole: 'STAFF',
          authorName: dean,
          body: 'Здравствуйте, Анна! Пересдача письменная, 60 минут: нормализация, SQL-запросы и индексы. Программа коллоквиума — в материалах дисциплины.',
          createdAt: daysAgo(1, 11),
        },
        {
          authorRole: 'STUDENT',
          authorName: anna,
          body: 'Спасибо! А можно прийти на консультацию к преподавателю заранее?',
          createdAt: daysAgo(0, 9),
        },
      ],
    },
    {
      studentLogin: 'ilya.petrov',
      subject: 'Разъяснение по перезачёту статистики',
      status: 'ANSWERED',
      createdAt: daysAgo(5, 15),
      messages: [
        {
          authorRole: 'STUDENT',
          authorName: ilya,
          body: 'Добрый день! Статистику уже изучал в колледже — какие документы нужны для перезачёта?',
          createdAt: daysAgo(5, 15),
        },
        {
          authorRole: 'STAFF',
          authorName: dean,
          body: 'Добрый день, Илья! Нужны: скан договора об обучении и программа дисциплины с часами и темами. Приложите их к заявке на перезачёт.',
          createdAt: daysAgo(4, 10),
        },
      ],
    },
    {
      studentLogin: 'anna.smirnova',
      subject: 'Ошибка в оценке за лабораторную по веб-технологиям',
      status: 'CLOSED',
      createdAt: daysAgo(14, 16),
      messages: [
        {
          authorRole: 'STUDENT',
          authorName: anna,
          body: 'В карточке лабораторной №3 по веб-технологиям стоит 6/10, а в системе преподавателя — 8/10.',
          createdAt: daysAgo(14, 16),
        },
        {
          authorRole: 'STAFF',
          authorName: dean,
          body: 'Передали запрос преподавателю, ответ ожидаем в течение двух дней.',
          createdAt: daysAgo(13, 10),
        },
        {
          authorRole: 'STAFF',
          authorName: dean,
          body: 'Преподаватель подтвердил: верно 8/10, оценка в кабинете обновлена. Извините за неточность!',
          createdAt: daysAgo(12, 12),
        },
        {
          authorRole: 'STUDENT',
          authorName: anna,
          body: 'Проверила — 8/10 на месте. Спасибо за скорость!',
          createdAt: daysAgo(12, 14),
        },
      ],
    },
  ];
}
