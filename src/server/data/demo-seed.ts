// DIG-12 — fictional demo dataset for the running prototype (jury demo).
//
// All names, groups, gradebooks and passwords are FICTIONAL (AGENTS.md):
// two students (Anna — faculty «ИТ», Ilya — faculty «ЭК») and one staff
// member (Maria — faculty «ИТ»). Ilya lives in a DIFFERENT faculty on
// purpose: the staff-scope rule «сотрудник видит только студентов своего
// факультета» is demonstrable, and Anna/Ilya give the IDOR e2e its two
// identities. Demo passwords are public by design (contest prototype, no
// real accounts) — they are NOT secrets and never leave the seed.

import { hashPassword } from '@/server/auth/password';
import type { AuthStore } from '@/server/auth/types';
import type { MemoryDataDb } from './memory-db';
import { defaultSettingsFor } from './profile';
import { newRequestNumber } from './request-number';
import type {
  AppealMessageRow,
  AppealRow,
  ExamSessionRow,
  GradeRow,
  NotificationRow,
  RequestEventRow,
  ScheduleEventRow,
  ServiceRequestRow,
  StaffRow,
  StudentRow,
  StudentSettingsRow,
} from './types';

export const DEMO_PASSWORDS = {
  anna: 'anna-demo-2026',
  ilya: 'ilya-demo-2026',
  dean: 'dean-demo-2026',
} as const;

const day = (offsetDays: number, hour: number, minute = 0): Date => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hour, minute, 0, 0);
  return d;
};

/** Deterministic PRNG (mulberry32) — stable request numbers across restarts. */
function prng(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const students: StudentRow[] = [
  {
    id: 'st-anna',
    // DIG-50: логины demo-набора совпадают с сидом БД (prisma/seed-data.ts),
    // чтобы вход работал одинаково на memory-store и на prisma-store.
    login: 'anna.smirnova',
    fullName: 'Анна Ковалёва',
    email: 'anna.kovaleva@example.edu',
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
    login: 'ilya.petrov',
    fullName: 'Илья Смирнов',
    email: 'ilya.smirnov@example.edu',
    groupName: 'ЭК-11',
    course: 1,
    faculty: 'ЭК',
    program: 'Экономика',
    programCode: '38.03.01',
    studyForm: 'очная',
    funding: 'контракт',
    gradebookNumber: '20254567',
  },
];

// DIG-19 — editable profile settings (fictional): phone + visibility flags,
// notification channel matrix (Telegram stays off — «скоро») and the theme.
// Одна осознанная не-дефолтная ячейка у Анны (дедлайны без email) — чтобы
// матрица настроек в демо не выглядела «всё включено».
const settings: StudentSettingsRow[] = [
  {
    studentId: 'st-anna',
    phone: '+7 900 010-20-30',
    emailVisibleToStaff: true,
    phoneVisibleToStaff: true,
    notificationChannels: {
      ...defaultSettingsFor('st-anna').notificationChannels,
      DEADLINE: { PUSH: true, EMAIL: false, TELEGRAM: false },
    },
    theme: 'SYSTEM',
    updatedAt: new Date(),
  },
  {
    studentId: 'st-ilya',
    phone: '+7 900 040-50-60',
    emailVisibleToStaff: true,
    phoneVisibleToStaff: false,
    notificationChannels: defaultSettingsFor('st-ilya').notificationChannels,
    theme: 'SYSTEM',
    updatedAt: new Date(),
  },
];

const staffRows: StaffRow[] = [
  {
    id: 'stf-maria',
    login: 'dean.kovaleva',
    fullName: 'Мария Петрова',
    position: 'Специалист деканата',
    email: 'maria.petrova@example.edu',
    faculty: 'ИТ',
  },
];

function buildRequests(): {
  requests: ServiceRequestRow[];
  requestEvents: RequestEventRow[];
} {
  const rand = prng(20261112);
  const mk = (
    id: string,
    studentId: string,
    type: ServiceRequestRow['type'],
    title: string,
    status: ServiceRequestRow['status'],
    createdOn: number,
    assignee: string | null = null,
    resultNote: string | null = null,
  ): ServiceRequestRow => {
    const createdAt = day(createdOn, 10, 15);
    return {
      id,
      studentId,
      number: newRequestNumber(rand, createdAt),
      type,
      title,
      status,
      assignee,
      resultNote,
      createdAt,
      updatedAt: day(createdOn + 1, 12, 0),
    };
  };

  const requests = [
    mk(
      'req-anna-1',
      'st-anna',
      'CERTIFICATE',
      'Справка об обучении для налоговой',
      'COMPLETED',
      -9,
      'Мария Петрова',
      'Справка готова, можно забрать в деканате (каб. 214)',
    ),
    mk(
      'req-anna-2',
      'st-anna',
      'DORMITORY',
      'Заявление на место в общежитии',
      'IN_PROGRESS',
      -3,
      'Мария Петрова',
      null,
    ),
    mk('req-ilya-1', 'st-ilya', 'STATEMENT', 'Заявление на академический отпуск', 'SUBMITTED', -2),
    mk(
      'req-ilya-2',
      'st-ilya',
      'PRACTICE',
      'Заявка на летнюю практику',
      'IN_PROGRESS',
      -6,
      'Мария Петрова',
      null,
    ),
    mk(
      'req-ilya-3',
      'st-ilya',
      'OTHER',
      'Вопрос о переносе пересдачи',
      'REJECTED',
      -12,
      'Мария Петрова',
      'Перенос невозможен: приказ уже утверждён',
    ),
  ];

  const requestEvents: RequestEventRow[] = [
    {
      id: 'evt-anna-1a',
      requestId: 'req-anna-1',
      actorRole: 'STUDENT',
      actorName: 'Анна Ковалёва',
      statusFrom: null,
      statusTo: 'SUBMITTED',
      message: 'Заявка подана через личный кабинет',
      createdAt: day(-9, 10, 15),
    },
    {
      id: 'evt-anna-1b',
      requestId: 'req-anna-1',
      actorRole: 'STAFF',
      actorName: 'Мария Петрова',
      statusFrom: 'SUBMITTED',
      statusTo: 'COMPLETED',
      message: 'Справка оформлена, ожидайте выдачи',
      createdAt: day(-7, 14, 30),
    },
    {
      id: 'evt-anna-2a',
      requestId: 'req-anna-2',
      actorRole: 'STUDENT',
      actorName: 'Анна Ковалёва',
      statusFrom: null,
      statusTo: 'SUBMITTED',
      message: 'Заявка подана через личный кабинет',
      createdAt: day(-3, 9, 5),
    },
    {
      id: 'evt-anna-2b',
      requestId: 'req-anna-2',
      actorRole: 'STAFF',
      actorName: 'Мария Петрова',
      statusFrom: 'SUBMITTED',
      statusTo: 'IN_PROGRESS',
      message: 'Проверяем свободные места',
      createdAt: day(-2, 11, 40),
    },
    {
      id: 'evt-ilya-1a',
      requestId: 'req-ilya-1',
      actorRole: 'STUDENT',
      actorName: 'Илья Смирнов',
      statusFrom: null,
      statusTo: 'SUBMITTED',
      message: 'Заявка подана через личный кабинет',
      createdAt: day(-2, 16, 20),
    },
    {
      id: 'evt-ilya-2a',
      requestId: 'req-ilya-2',
      actorRole: 'STUDENT',
      actorName: 'Илья Смирнов',
      statusFrom: null,
      statusTo: 'SUBMITTED',
      message: 'Заявка подана через личный кабинет',
      createdAt: day(-6, 13, 10),
    },
    {
      id: 'evt-ilya-2b',
      requestId: 'req-ilya-2',
      actorRole: 'STAFF',
      actorName: 'Мария Петрова',
      statusFrom: 'SUBMITTED',
      statusTo: 'IN_PROGRESS',
      message: 'Передано на кафедру',
      createdAt: day(-5, 10, 0),
    },
    {
      id: 'evt-ilya-3a',
      requestId: 'req-ilya-3',
      actorRole: 'STAFF',
      actorName: 'Мария Петрова',
      statusFrom: 'SUBMITTED',
      statusTo: 'REJECTED',
      message: 'Перенос невозможен: приказ уже утверждён',
      createdAt: day(-11, 15, 45),
    },
  ];

  return { requests, requestEvents };
}

const { requests, requestEvents } = buildRequests();

const grades: GradeRow[] = [
  {
    id: 'grd-anna-1',
    studentId: 'st-anna',
    elementCode: 'PI21-INFO-T1',
    elementName: 'Тест 1',
    disciplineCode: 'PI21-INFO',
    disciplineName: 'Информатика',
    score: 88,
    maxScore: 100,
    weight: 0.3,
    kind: 'TEST',
    gradedAt: day(-14, 12, 0),
    comment: null,
  },
  {
    id: 'grd-anna-2',
    studentId: 'st-anna',
    elementCode: 'PI21-PROG-L2',
    elementName: 'Лабораторная 2',
    disciplineCode: 'PI21-PROG',
    disciplineName: 'Программирование',
    score: 92,
    maxScore: 100,
    weight: 0.4,
    kind: 'LAB',
    gradedAt: day(-10, 12, 0),
    comment: 'Отличная работа с граничными случаями',
  },
  {
    id: 'grd-anna-3',
    studentId: 'st-anna',
    elementCode: 'PI21-DB-P1',
    elementName: 'Проект',
    disciplineCode: 'PI21-DB',
    disciplineName: 'Базы данных',
    score: 85,
    maxScore: 100,
    weight: 0.3,
    kind: 'PROJECT',
    gradedAt: day(-4, 12, 0),
    comment: null,
  },
  {
    id: 'grd-ilya-1',
    studentId: 'st-ilya',
    elementCode: 'EK11-MATH-EX',
    elementName: 'Экзамен',
    disciplineCode: 'EK11-MATH',
    disciplineName: 'Математический анализ',
    score: 74,
    maxScore: 100,
    weight: 0.6,
    kind: 'EXAM',
    gradedAt: day(-8, 12, 0),
    comment: null,
  },
  {
    id: 'grd-ilya-2',
    studentId: 'st-ilya',
    elementCode: 'EK11-ECON-T1',
    elementName: 'Тест 1',
    disciplineCode: 'EK11-ECON',
    disciplineName: 'Экономическая теория',
    score: 81,
    maxScore: 100,
    weight: 0.4,
    kind: 'TEST',
    gradedAt: day(-5, 12, 0),
    comment: null,
  },
];

const notifications: NotificationRow[] = [
  {
    id: 'ntf-anna-1',
    studentId: 'st-anna',
    type: 'REQUEST',
    title: 'Справка готова',
    body: 'Справка об обучении готова к выдаче в деканате (каб. 214).',
    isRead: false,
    createdAt: day(-7, 14, 35),
  },
  {
    id: 'ntf-anna-2',
    studentId: 'st-anna',
    type: 'GRADE',
    title: 'Новая оценка: Проект (Базы данных)',
    body: 'За проект по курсу «Базы данных» поставлено 85 из 100.',
    isRead: true,
    createdAt: day(-4, 12, 5),
  },
  {
    id: 'ntf-ilya-1',
    studentId: 'st-ilya',
    type: 'SCHEDULE',
    title: 'Пара перенесена',
    body: 'Практика по математическому анализу перенесена на 14:00.',
    isRead: false,
    createdAt: day(-1, 18, 0),
  },
  {
    id: 'ntf-ilya-2',
    studentId: 'st-ilya',
    type: 'DEADLINE',
    title: 'Дедлайн по практике',
    body: 'Заявку на летнюю практику согласуют до конца недели.',
    isRead: false,
    createdAt: day(-2, 9, 0),
  },
];

const appeals: AppealRow[] = [
  {
    id: 'apl-anna-1',
    studentId: 'st-anna',
    subject: 'Вопрос по зачёту по физкультуре',
    status: 'OPEN',
    createdAt: day(-2, 19, 0),
  },
  {
    id: 'apl-ilya-1',
    studentId: 'st-ilya',
    subject: 'Пересдача математического анализа',
    status: 'ANSWERED',
    createdAt: day(-9, 17, 30),
  },
];

const appealMessages: AppealMessageRow[] = [
  {
    id: 'msg-ilya-1a',
    appealId: 'apl-ilya-1',
    authorRole: 'STUDENT',
    authorName: 'Илья Смирнов',
    body: 'Здравствуйте! Возможна ли дополнительная пересдача?',
    createdAt: day(-9, 17, 30),
  },
  {
    id: 'msg-ilya-1b',
    appealId: 'apl-ilya-1',
    authorRole: 'STAFF',
    authorName: 'Мария Петрова',
    body: 'Пересдача назначена на пятницу, ауд. 12.',
    createdAt: day(-8, 10, 0),
  },
];

const schedule: ScheduleEventRow[] = [
  {
    id: 'sch-pi21-1',
    groupName: 'ПИ-21',
    disciplineCode: 'PI21-INFO',
    disciplineName: 'Информатика',
    date: day(0, 10, 0),
    startsAt: day(0, 10, 0),
    endsAt: day(0, 11, 30),
    kind: 'LECTURE',
    room: '301',
    teacherName: 'Петров Пётр Петрович',
    status: 'SCHEDULED',
    note: null,
  },
  {
    id: 'sch-pi21-2',
    groupName: 'ПИ-21',
    disciplineCode: 'PI21-PROG',
    disciplineName: 'Программирование',
    date: day(1, 12, 0),
    startsAt: day(1, 12, 0),
    endsAt: day(1, 13, 30),
    kind: 'LAB',
    room: '405',
    teacherName: 'Иванова Ирина Игоревна',
    status: 'ROOM_CHANGED',
    note: 'Перенесено из ауд. 310',
    previousRoom: '310',
  },
  {
    id: 'sch-pi21-3',
    groupName: 'ПИ-21',
    disciplineCode: 'PI21-DB',
    disciplineName: 'Базы данных',
    date: day(2, 14, 0),
    startsAt: day(2, 14, 0),
    endsAt: day(2, 15, 30),
    kind: 'PRACTICE',
    room: '212',
    teacherName: 'Соколов Сергей Сергеевич',
    status: 'SCHEDULED',
    note: null,
  },
  {
    id: 'sch-ek11-1',
    groupName: 'ЭК-11',
    disciplineCode: 'EK11-MATH',
    disciplineName: 'Математический анализ',
    date: day(0, 9, 0),
    startsAt: day(0, 9, 0),
    endsAt: day(0, 10, 30),
    kind: 'PRACTICE',
    room: '12',
    teacherName: 'Кузнецова Ксения Кирилловна',
    status: 'TIME_CHANGED',
    note: 'Начало в 9:00 вместо 10:40',
  },
  {
    id: 'sch-ek11-2',
    groupName: 'ЭК-11',
    disciplineCode: 'EK11-ECON',
    disciplineName: 'Экономическая теория',
    date: day(1, 15, 40),
    startsAt: day(1, 15, 40),
    endsAt: day(1, 17, 10),
    kind: 'SEMINAR',
    room: '18',
    teacherName: 'Орлов Олег Олегович',
    status: 'SCHEDULED',
    note: null,
  },
];

const exams: ExamSessionRow[] = [
  {
    id: 'exm-pi21-1',
    groupName: 'ПИ-21',
    disciplineCode: 'PI21-DB',
    disciplineName: 'Базы данных',
    kind: 'EXAM',
    date: day(12, 10, 0),
    startsAt: day(12, 10, 0),
    room: '301',
    note: null,
  },
  {
    id: 'exm-pi21-2',
    groupName: 'ПИ-21',
    disciplineCode: 'PI21-PROG',
    disciplineName: 'Программирование',
    kind: 'CREDIT',
    date: day(9, 12, 0),
    startsAt: day(9, 12, 0),
    room: '405',
    note: 'Допуск: все лабораторные сданы',
  },
  {
    id: 'exm-ek11-1',
    groupName: 'ЭК-11',
    disciplineCode: 'EK11-MATH',
    disciplineName: 'Математический анализ',
    kind: 'EXAM',
    date: day(14, 9, 0),
    startsAt: day(14, 9, 0),
    room: '12',
    note: null,
  },
];

/**
 * Seeds the fictional demo dataset. Idempotent: safe to call on every boot;
 * auth users are added only if missing (authStore may already hold sessions).
 */
export async function seedDemoData(db: MemoryDataDb, authStore: AuthStore): Promise<void> {
  db.seed({
    students,
    staff: staffRows,
    requests,
    requestEvents,
    grades,
    notifications,
    appeals,
    appealMessages,
    schedule,
    exams,
    settings,
  });

  // DIG-11 memory auth store: seed the demo logins (guarded — when the Prisma
  // store lands, the seed script for PostgreSQL takes this role over).
  const store = authStore as AuthStore & {
    seedUser?: (input: {
      id: string;
      login: string;
      passwordHash: string;
      role: 'STUDENT' | 'STAFF';
    }) => unknown;
    listUsers?: () => Array<{ login: string }>;
  };
  if (typeof store.seedUser !== 'function' || typeof store.listUsers !== 'function') return;
  const existing = new Set(store.listUsers().map((u) => u.login));
  const mk = async (login: keyof typeof DEMO_PASSWORDS, id: string, role: 'STUDENT' | 'STAFF') => {
    if (existing.has(login)) return;
    store.seedUser!({
      id,
      login,
      passwordHash: await hashPassword(DEMO_PASSWORDS[login]),
      role,
    });
  };
  await mk('anna', 'auth-anna', 'STUDENT');
  await mk('ilya', 'auth-ilya', 'STUDENT');
  await mk('dean', 'auth-dean', 'STAFF');
}
