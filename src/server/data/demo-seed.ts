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
  DisciplineElementRow,
  DisciplineRow,
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
  'anna.smirnova': 'anna-demo-2026',
  'ilya.petrov': 'ilya-demo-2026',
  'dean.kovaleva': 'dean-demo-2026',
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

// DIG-25 — справочник дисциплин с кредитами (GPA взвешен кредитами,
// «Кредиты: набрано / требуется»). Все данные вымышленные.
const disciplineRows: DisciplineRow[] = [
  d('ПИ-21', 'PI21-INFO', 'Информатика', 4, 'Петров Пётр Петрович'),
  d('ПИ-21', 'PI21-PROG', 'Программирование', 6, 'Иванова Ирина Игоревна'),
  d('ПИ-21', 'PI21-DB', 'Базы данных', 5, 'Соколов Сергей Сергеевич'),
  d('ПИ-21', 'PI21-PHYS', 'Физика', 4, 'Соколов Сергей Сергеевич'),
  d('ПИ-21', 'PI21-HIST', 'История', 3, 'Орлов Олег Олегович'),
  d('ПИ-21', 'PI21-ALG', 'Алгоритмы и структуры данных', 5, 'Иванова Ирина Игоревна'),
  d('ПИ-21', 'PI21-DISC', 'Дискретная математика', 4, 'Кузнецова Ксения Кирилловна'),
  d('ЭК-11', 'EK11-MATH', 'Математический анализ', 5, 'Кузнецова Ксения Кирилловна'),
  d('ЭК-11', 'EK11-ECON', 'Экономическая теория', 4, 'Орлов Олег Олегович'),
];

function d(
  groupName: string,
  disciplineCode: string,
  disciplineName: string,
  credits: number,
  teacherName: string,
): DisciplineRow {
  return { groupName, disciplineCode, disciplineName, credits, teacherName };
}

// DIG-25 — план контроля: ВСЕ элементы семестра, включая ещё не оценённые
// (на них стоят «максимально возможная»/«минимально гарантированная» и
// needForTarget). Веса согласованы с оценками выше.
const elementRows: DisciplineElementRow[] = [
  el('ПИ-21', 'PI21-INFO', 'Информатика', 'PI21-INFO-T1', 'Тест 1', 'TEST', 0.3, 100),
  el('ПИ-21', 'PI21-INFO', 'Информатика', 'PI21-INFO-K', 'Коллоквиум', 'TEST', 0.3, 100),
  el('ПИ-21', 'PI21-INFO', 'Информатика', 'PI21-INFO-EX', 'Экзамен', 'EXAM', 0.4, 100),
  el('ПИ-21', 'PI21-PROG', 'Программирование', 'PI21-PROG-L2', 'Лабораторная 2', 'LAB', 0.4, 100),
  el('ПИ-21', 'PI21-PROG', 'Программирование', 'PI21-PROG-L3', 'Лабораторная 3', 'LAB', 0.2, 100),
  el('ПИ-21', 'PI21-PROG', 'Программирование', 'PI21-PROG-CR', 'Зачёт', 'TEST', 0.4, 100),
  el('ПИ-21', 'PI21-DB', 'Базы данных', 'PI21-DB-P1', 'Проект', 'PROJECT', 0.3, 100),
  el('ПИ-21', 'PI21-DB', 'Базы данных', 'PI21-DB-T2', 'Тест 2', 'TEST', 0.2, 100),
  el('ПИ-21', 'PI21-DB', 'Базы данных', 'PI21-DB-EX', 'Экзамен', 'EXAM', 0.5, 100),
  el('ПИ-21', 'PI21-PHYS', 'Физика', 'PI21-PHYS-T', 'Тест 1', 'TEST', 0.4, 100),
  el('ПИ-21', 'PI21-PHYS', 'Физика', 'PI21-PHYS-EX', 'Экзамен', 'EXAM', 0.6, 100),
  el('ПИ-21', 'PI21-HIST', 'История', 'PI21-HIST-S', 'Семинар', 'TEST', 1, 100),
  el('ПИ-21', 'PI21-ALG', 'Алгоритмы и структуры данных', 'PI21-ALG-T', 'Тест 1', 'TEST', 0.3, 100),
  el(
    'ПИ-21',
    'PI21-ALG',
    'Алгоритмы и структуры данных',
    'PI21-ALG-EX',
    'Экзамен',
    'EXAM',
    0.7,
    100,
  ),
  el('ПИ-21', 'PI21-DISC', 'Дискретная математика', 'PI21-DISC-T', 'Тест 1', 'TEST', 0.4, 100),
  el('ПИ-21', 'PI21-DISC', 'Дискретная математика', 'PI21-DISC-EX', 'Экзамен', 'EXAM', 0.6, 100),
  el('ЭК-11', 'EK11-MATH', 'Математический анализ', 'EK11-MATH-T1', 'Тест 1', 'TEST', 0.4, 100),
  el('ЭК-11', 'EK11-MATH', 'Математический анализ', 'EK11-MATH-EX', 'Экзамен', 'EXAM', 0.6, 100),
  el('ЭК-11', 'EK11-ECON', 'Экономическая теория', 'EK11-ECON-T1', 'Тест 1', 'TEST', 0.4, 100),
  el('ЭК-11', 'EK11-ECON', 'Экономическая теория', 'EK11-ECON-EX', 'Экзамен', 'EXAM', 0.6, 100),
];

function el(
  groupName: string,
  disciplineCode: string,
  disciplineName: string,
  elementCode: string,
  elementName: string,
  kind: DisciplineElementRow['kind'],
  weight: number,
  maxScore: number,
): DisciplineElementRow {
  return {
    groupName,
    disciplineCode,
    disciplineName,
    elementCode,
    elementName,
    kind,
    weight,
    maxScore,
  };
}

// DIG-25 — сокурсники Анны (только для рейтинга в группе; без входа в
// кабинет — авторизованных пользователей для них нет). Итоги весны
// 2025/26: Дмитрий 87.11 > Анна 49.37 > Артём 48.00 > Полина 46.67 >
// София 42.78 — Анна вторая из пяти («входите в 40% лучших»).
const groupMates: StudentRow[] = [
  mate('st-mate-dmitry', 'dmitry.volkov', 'Дмитрий Волков', '20231235'),
  mate('st-mate-polina', 'polina.egorova', 'Полина Егорова', '20231236'),
  mate('st-mate-artem', 'artem.fedorov', 'Артём Фёдоров', '20231237'),
  mate('st-mate-sofia', 'sofia.guseva', 'София Гусева', '20231238'),
];

function mate(id: string, login: string, fullName: string, gradebookNumber: string): StudentRow {
  return {
    id,
    login,
    fullName,
    email: `${login}@example.edu`,
    groupName: 'ПИ-21',
    course: 2,
    faculty: 'ИТ',
    program: 'Прикладная информатика',
    programCode: '09.03.04',
    studyForm: 'очная',
    funding: 'бюджет',
    gradebookNumber,
  };
}

// Завершённый весенний семестр 2025/26 (итоги): у Анны ALG 87 / DISC 74.
const mateGrades: GradeRow[] = [
  grd('st-anna', 'PI21-ALG-T', 90, -270),
  grd('st-anna', 'PI21-ALG-EX', 85, -180),
  grd('st-anna', 'PI21-DISC-T', 70, -265),
  grd('st-anna', 'PI21-DISC-EX', 77, -175),
  // Дмитрий Волков: ALG 92, DISC 81
  grd('st-mate-dmitry', 'PI21-ALG-T', 95, -270),
  grd('st-mate-dmitry', 'PI21-ALG-EX', 90, -180),
  grd('st-mate-dmitry', 'PI21-DISC-T', 84, -265),
  grd('st-mate-dmitry', 'PI21-DISC-EX', 79, -175),
  // Полина Егорова: ALG 48, DISC 45
  grd('st-mate-polina', 'PI21-ALG-T', 55, -270),
  grd('st-mate-polina', 'PI21-ALG-EX', 45, -180),
  grd('st-mate-polina', 'PI21-DISC-T', 45, -265),
  grd('st-mate-polina', 'PI21-DISC-EX', 45, -175),
  // Артём Фёдоров: ALG 52, DISC 43
  grd('st-mate-artem', 'PI21-ALG-T', 50, -270),
  grd('st-mate-artem', 'PI21-ALG-EX', 53, -180),
  grd('st-mate-artem', 'PI21-DISC-T', 40, -265),
  grd('st-mate-artem', 'PI21-DISC-EX', 45, -175),
  // София Гусева: ALG 45, DISC 40
  grd('st-mate-sofia', 'PI21-ALG-T', 55, -270),
  grd('st-mate-sofia', 'PI21-ALG-EX', 40, -180),
  grd('st-mate-sofia', 'PI21-DISC-T', 40, -265),
  grd('st-mate-sofia', 'PI21-DISC-EX', 40, -175),
];

/** Оценка по элементу плана (демо-сид): дисциплина/вес/макс берутся из плана. */
function grd(studentId: string, elementCode: string, score: number, offsetDays: number): GradeRow {
  const plan = elementRows.find((row) => row.elementCode === elementCode);
  if (!plan) throw new Error(`seed: unknown element ${elementCode}`);
  return {
    id: `grd-${studentId}-${elementCode}`,
    studentId,
    elementCode,
    elementName: plan.elementName,
    disciplineCode: plan.disciplineCode,
    disciplineName: plan.disciplineName,
    score,
    maxScore: plan.maxScore,
    weight: plan.weight,
    kind: plan.kind,
    gradedAt: day(offsetDays, 12, 0),
    comment: null,
  };
}

// DIG-35 — центр уведомлений (демо-сид): каждая строка называет объект и что
// изменилось, все четыре категории фильтров представлены (Учёба = SCHEDULE
// и GRADE, Заявки = REQUEST, Деканат = NEWS и SYSTEM, Финансы = DEADLINE).
// «Важно» — только срочное: перенос/отмена пары сегодня, недопуск (долг),
// доработка заявки, дедлайн оплаты. У Анны ровно 3 непрочитанных — контракт
// e2e каркаса («3» на колокольчике) остаётся зелёным.
const notifications: NotificationRow[] = [
  // ── Анна (ПИ-21, бюджет): 8 строк, 3 непрочитанных ────────────────────────
  {
    id: 'ntf-anna-1',
    studentId: 'st-anna',
    type: 'SCHEDULE',
    title: 'Пара «Базы данных» перенесена в ауд. Б-204',
    body: 'Сегодня практика «Базы данных» в 12:00 пройдёт в Б-204 вместо А-312 (замена от деканата).',
    isRead: false,
    createdAt: day(0, 8, 5),
    link: '/schedule',
    important: true,
    actionLabel: 'Открыть расписание',
  },
  {
    id: 'ntf-anna-2',
    studentId: 'st-anna',
    type: 'REQUEST',
    title: 'Справка для военкомата готова',
    body: 'Справка оформлена: PDF с QR-кодом доступен в карточке заявки, забрать можно в каб. 214.',
    isRead: false,
    createdAt: day(0, 10, 40),
    link: '/requests',
    actionLabel: 'Скачать',
  },
  {
    id: 'ntf-anna-3',
    studentId: 'st-anna',
    type: 'REQUEST',
    title: 'Заявление на общежитие принято в работу',
    body: 'Мария Петрова проверяет свободные места; о готовности сообщим отдельным уведомлением.',
    isRead: false,
    createdAt: day(-1, 16, 20),
    link: '/requests',
  },
  {
    id: 'ntf-anna-4',
    studentId: 'st-anna',
    type: 'GRADE',
    title: 'Новая оценка: 85/100 — проект «Базы данных»',
    body: 'Проект по курсу «Базы данных» оценён на 85 из 100 (вес 0.3 в итоговой оценке).',
    isRead: true,
    createdAt: day(-1, 18, 5),
    link: '/grades',
  },
  {
    id: 'ntf-anna-5',
    studentId: 'st-anna',
    type: 'DEADLINE',
    title: 'Оплата за общежитие — до 25 ноября',
    body: 'Счёт за ноябрь выставлен: 3 450 ₽. Реквизиты и квитанция — в карточке заявления на общежитие.',
    isRead: true,
    createdAt: day(-3, 9, 30),
    link: '/requests',
    important: true,
  },
  {
    id: 'ntf-anna-6',
    studentId: 'st-anna',
    type: 'NEWS',
    title: 'Открыта запись на консультации перед сессией',
    body: 'Слоты с 18 декабря; запись — через «Связь с деканатом», тема обращения «Консультация».',
    isRead: true,
    createdAt: day(-5, 12, 0),
    link: '/deanery',
  },
  {
    id: 'ntf-anna-7',
    studentId: 'st-anna',
    type: 'DEADLINE',
    title: 'Долг по коллоквиуму «Информатика» — до начала сессии',
    body: 'Коллоквиум сдан на 3/10: до закрытия долга нет допуска к экзамену. Пересдача 21 декабря, ауд. А-401.',
    isRead: true,
    createdAt: day(-7, 10, 0),
    link: '/grades',
    important: true,
  },
  {
    id: 'ntf-anna-8',
    studentId: 'st-anna',
    type: 'SCHEDULE',
    title: 'Консультация по физике в пятницу отменена',
    body: 'Соколов С. С. уехал на конференцию; тема переносится на следующую неделю, время прежнее.',
    isRead: true,
    createdAt: day(-2, 8, 45),
    link: '/schedule',
  },

  // ── Илья (ЭК-11, контракт): 6 строк, 3 непрочитанных ──────────────────────
  {
    id: 'ntf-ilya-1',
    studentId: 'st-ilya',
    type: 'SCHEDULE',
    title: 'Семинар «Математический анализ» сегодня отменён',
    body: 'Пара в 14:00 отменена — Кузнецова К. К. болеет. Догоняющее занятие согласуют с деканатом.',
    isRead: false,
    createdAt: day(0, 9, 15),
    link: '/schedule',
    important: true,
    actionLabel: 'Открыть расписание',
  },
  {
    id: 'ntf-ilya-2',
    studentId: 'st-ilya',
    type: 'DEADLINE',
    title: 'Оплата по договору — до 20 ноября',
    body: 'Платёж за ноябрь по договору обучения: 48 000 ₽. Чек об оплате прикрепите к обращению в деканат.',
    isRead: false,
    createdAt: day(0, 7, 30),
    link: '/deanery',
    important: true,
  },
  {
    id: 'ntf-ilya-3',
    studentId: 'st-ilya',
    type: 'REQUEST',
    title: 'Заявка «Перезачёт статистики» — нужна доработка',
    body: 'Приложите скан договора об обучении и программу дисциплины (часы, темы). Срок — 5 рабочих дней.',
    isRead: false,
    createdAt: day(-1, 11, 20),
    link: '/requests',
    important: true,
    actionLabel: 'Открыть заявку',
  },
  {
    id: 'ntf-ilya-4',
    studentId: 'st-ilya',
    type: 'GRADE',
    title: 'Новая оценка: 81/100 — тест «Экономическая теория»',
    body: 'Тест 1 по «Экономической теории» оценён на 81 из 100 (вес 0.4 в итоговой оценке).',
    isRead: true,
    createdAt: day(-1, 19, 0),
    link: '/grades',
  },
  {
    id: 'ntf-ilya-5',
    studentId: 'st-ilya',
    type: 'REQUEST',
    title: 'Заявка на летнюю практику передана на кафедру',
    body: 'Мария Петрова передала заявку на кафедру экономики; ответ ожидается до конца месяца.',
    isRead: true,
    createdAt: day(-5, 10, 0),
    link: '/requests',
  },
  {
    id: 'ntf-ilya-6',
    studentId: 'st-ilya',
    type: 'SYSTEM',
    title: 'Кабинет обновлён: уведомления теперь по категориям',
    body: 'Фильтры «Учёба», «Заявки», «Деканат» и «Финансы» — в разделе «Уведомления».',
    isRead: true,
    createdAt: day(-8, 9, 0),
    link: '/notifications',
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
  // DIG-20 — насыщенный «сегодня» для главной: 4 пары, одна перенесена
  // (214 → 305), одна отменена, одна онлайн (строка-резюме героя).
  // Пары «сегодня» — sch-pi21-4/5/6, блок ниже после sch-pi21-3.
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
    id: 'sch-pi21-4',
    groupName: 'ПИ-21',
    disciplineCode: 'PI21-PROG',
    disciplineName: 'Программирование',
    date: day(0, 12, 0),
    startsAt: day(0, 12, 0),
    endsAt: day(0, 13, 30),
    kind: 'LAB',
    room: '305',
    teacherName: 'Иванова Ирина Игоревна',
    status: 'ROOM_CHANGED',
    note: 'Пара перенесена в ауд. 305',
    previousRoom: '214',
  },
  {
    id: 'sch-pi21-5',
    groupName: 'ПИ-21',
    disciplineCode: 'PI21-PHYS',
    disciplineName: 'Физика',
    date: day(0, 14, 0),
    startsAt: day(0, 14, 0),
    endsAt: day(0, 15, 30),
    kind: 'LAB',
    room: '212',
    teacherName: 'Соколов Сергей Сергеевич',
    status: 'CANCELLED',
    note: 'Лаборатория закрыта',
  },
  {
    id: 'sch-pi21-6',
    groupName: 'ПИ-21',
    disciplineCode: 'PI21-HIST',
    disciplineName: 'История',
    date: day(0, 15, 40),
    startsAt: day(0, 15, 40),
    endsAt: day(0, 17, 10),
    kind: 'SEMINAR',
    room: 'Онлайн',
    teacherName: 'Орлов Олег Олегович',
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
  // DIG-28 — консультации перед зачётами и экзаменом сессии (kind
  // CONSULTATION): экран «Сессия» собирает их из расписания группы.
  {
    id: 'sch-pi21-consult-db',
    groupName: 'ПИ-21',
    disciplineCode: 'PI21-DB',
    disciplineName: 'Базы данных',
    date: day(1, 16, 0),
    startsAt: day(1, 16, 0),
    endsAt: day(1, 17, 30),
    kind: 'CONSULTATION',
    room: '212',
    teacherName: 'Соколов Сергей Сергеевич',
    status: 'SCHEDULED',
    note: 'Перед зачётом «Защита проекта»',
  },
  {
    id: 'sch-pi21-consult-prog',
    groupName: 'ПИ-21',
    disciplineCode: 'PI21-PROG',
    disciplineName: 'Программирование',
    date: day(8, 12, 0),
    startsAt: day(8, 12, 0),
    endsAt: day(8, 13, 30),
    kind: 'CONSULTATION',
    room: '405',
    teacherName: 'Иванова Ирина Игоревна',
    status: 'SCHEDULED',
    note: 'Перед зачётом',
  },
  {
    id: 'sch-pi21-consult-info',
    groupName: 'ПИ-21',
    disciplineCode: 'PI21-INFO',
    disciplineName: 'Информатика',
    date: day(11, 10, 0),
    startsAt: day(11, 10, 0),
    endsAt: day(11, 11, 30),
    kind: 'CONSULTATION',
    room: '301',
    teacherName: 'Петров Пётр Петрович',
    status: 'SCHEDULED',
    note: 'Перед экзаменом',
  },
  {
    id: 'sch-ek11-consult-math',
    groupName: 'ЭК-11',
    disciplineCode: 'EK11-MATH',
    disciplineName: 'Математический анализ',
    date: day(13, 9, 0),
    startsAt: day(13, 9, 0),
    endsAt: day(13, 10, 30),
    kind: 'CONSULTATION',
    room: '12',
    teacherName: 'Кузнецова Ксения Кирилловна',
    status: 'SCHEDULED',
    note: 'Перед экзаменом',
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
  // DIG-20 — дедлайны главной: exm-pi21-3 — срочный CREDIT +2 дня для
  // красного «осталось N дн.» в «Ближайших дедлайнах»; exm-pi21-4 —
  // академический долг Анны (бейдж риска «Как у меня дела» +
  // «До пересдачи N дней» в сводке героя).
  {
    id: 'exm-pi21-3',
    groupName: 'ПИ-21',
    disciplineCode: 'PI21-DB',
    disciplineName: 'Базы данных',
    kind: 'CREDIT',
    date: day(2, 10, 40),
    startsAt: day(2, 10, 40),
    room: '212',
    note: 'Защита проекта — дедлайн сдачи работы',
  },
  {
    id: 'exm-pi21-4',
    groupName: 'ПИ-21',
    disciplineCode: 'PI21-INFO',
    disciplineName: 'Информатика',
    kind: 'RETAKE',
    date: day(7, 9, 0),
    startsAt: day(7, 9, 0),
    room: '305',
    note: 'Пересдача коллоквиума',
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
  // DIG-28 — зачёт ЭК-11: тест сдан, экзамен ещё нет → статус «Допущен»
  // (у Ильи на экране «Сессия» видно зелёную пилюлю допуска).
  {
    id: 'exm-ek11-2',
    groupName: 'ЭК-11',
    disciplineCode: 'EK11-ECON',
    disciplineName: 'Экономическая теория',
    kind: 'CREDIT',
    date: day(16, 12, 0),
    startsAt: day(16, 12, 0),
    room: '14',
    note: null,
  },
  // DIG-25 — долги Анны: прошедшая пересдача с незакрытым долгом (OVERDUE)
  // и закрытый долг по завершённой весенней дисциплине (CLOSED, итог 74).
  {
    id: 'exm-pi21-5',
    groupName: 'ПИ-21',
    disciplineCode: 'PI21-PROG',
    disciplineName: 'Программирование',
    kind: 'RETAKE',
    date: day(-3, 9, 0),
    startsAt: day(-3, 9, 0),
    room: '405',
    note: 'Пересдача лабораторных',
  },
  {
    id: 'exm-pi21-6',
    groupName: 'ПИ-21',
    disciplineCode: 'PI21-DISC',
    disciplineName: 'Дискретная математика',
    kind: 'RETAKE',
    date: day(-5, 9, 0),
    startsAt: day(-5, 9, 0),
    room: '212',
    note: 'Пересдача экзамена (закрыто)',
  },
];

/**
 * Seeds the fictional demo dataset. Idempotent: safe to call on every boot;
 * auth users are added only if missing (authStore may already hold sessions).
 */
export async function seedDemoData(db: MemoryDataDb, authStore: AuthStore): Promise<void> {
  db.seed({
    students: [...students, ...groupMates],
    staff: staffRows,
    requests,
    requestEvents,
    grades: [...grades, ...mateGrades],
    notifications,
    appeals,
    appealMessages,
    schedule,
    exams,
    settings,
    // DIG-25 — справочники успеваемости: дисциплины с кредитами и план контроля.
    disciplines: disciplineRows,
    elements: elementRows,
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
  await mk('anna.smirnova', 'auth-anna', 'STUDENT');
  await mk('ilya.petrov', 'auth-ilya', 'STUDENT');
  await mk('dean.kovaleva', 'auth-dean', 'STAFF');
}
