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
import { formatCanonicalRequestNumber } from './canonical-request-number';
import { newRequestNumber } from './request-number';
import { newTicketNumber } from './ticket-number';
import { FEEDBACK_RESPONSE_DAYS } from '@/lib/feedback';
import { addWorkingDays } from '@/lib/request-sla';
import type {
  AppealMessageRow,
  AppealRow,
  AnnouncementRow,
  CertificateRow,
  CanonicalRequestEventRow,
  CanonicalRequestRow,
  CanonicalRequestTypeRow,
  DisciplineElementRow,
  DisciplineRow,
  ExamSessionRow,
  FeedbackRow,
  GradeRow,
  NotificationRow,
  RequestEventRow,
  ScheduleEventRow,
  ServiceRequestRow,
  StaffRow,
  StudentRow,
  StudentSettingsRow,
  /** DIG-34 — дедлайны заданий курса и ручные задачи студентов. */
  StudyDeadlineRow,
  StudentTaskRow,
  TicketMessageRow,
  TicketRow,
  /** DIG-68 — каталог студенческих стартапов «МСП» (/msp). */
  MspCommentRow,
  MspProjectRow,
  MspVoteRow,
  /** DIG-42 — «Дополнительное образование» (/dpo). */
  DpoDocumentRow,
  DpoEnrollmentRow,
  DpoProgramRow,
} from './types';
import { newMspSlug } from './msp-slug';

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
    widgets: defaultSettingsFor('st-anna').widgets,
    quietHours: defaultSettingsFor('st-anna').quietHours,
    language: 'RU',
    fontSize: 'NORMAL',
    reduceMotion: false,
    voiceAssistant: true,
    mcpConnections: defaultSettingsFor('st-anna').mcpConnections,
    mcpToken: null,
    updatedAt: new Date(),
  },
  {
    studentId: 'st-ilya',
    phone: '+7 900 040-50-60',
    emailVisibleToStaff: true,
    phoneVisibleToStaff: false,
    notificationChannels: defaultSettingsFor('st-ilya').notificationChannels,
    theme: 'SYSTEM',
    widgets: defaultSettingsFor('st-ilya').widgets,
    quietHours: defaultSettingsFor('st-ilya').quietHours,
    language: 'RU',
    fontSize: 'NORMAL',
    reduceMotion: false,
    voiceAssistant: true,
    mcpConnections: defaultSettingsFor('st-ilya').mcpConnections,
    mcpToken: null,
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
      // DIG-32: карта миграции DIG-49 — COMPLETED → ISSUED (единый словарь).
      'ISSUED',
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
    // DIG-48 — очередь сотрудника: просроченная по SLA (справка, SLA 3 дня,
    // подана 9 дней назад) и свежая «сегодня» — для сводки деканата.
    mk('req-anna-4', 'st-anna', 'CERTIFICATE', 'Справка для военкомата', 'SUBMITTED', -9),
    mk('req-anna-5', 'st-anna', 'STATEMENT', 'Заявление на перезачёт дисциплины', 'SUBMITTED', 0),
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
      // DIG-32: карта миграции DIG-49 — COMPLETED → ISSUED (единый словарь).
      statusTo: 'ISSUED',
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
    // DIG-48 — события новых заявок очереди сотрудника.
    {
      id: 'evt-anna-4a',
      requestId: 'req-anna-4',
      actorRole: 'STUDENT',
      actorName: 'Анна Ковалёва',
      statusFrom: null,
      statusTo: 'SUBMITTED',
      message: 'Заявка подана через личный кабинет',
      createdAt: day(-9, 11, 30),
    },
    {
      id: 'evt-anna-5a',
      requestId: 'req-anna-5',
      actorRole: 'STUDENT',
      actorName: 'Анна Ковалёва',
      statusFrom: null,
      statusTo: 'SUBMITTED',
      message: 'Заявка подана через личный кабинет',
      createdAt: day(0, 10, 15),
    },
  ];

  return { requests, requestEvents };
}

const { requests, requestEvents } = buildRequests();

// DIG-34 — дедлайны заданий по дисциплинам (система курсов; в концепте —
// сиды). Групповые: сдаёт вся ПИ-21/ЭК-11; сроки покрывают все группы
// задач — Просрочено / Сегодня / На этой неделе / Позже (конец дня).
const studyDeadlines: StudyDeadlineRow[] = [
  {
    id: 'dl-pi21-phys-test',
    groupName: 'ПИ-21',
    disciplineCode: 'PI21-PHYS',
    disciplineName: 'Физика',
    title: 'Тест 1 «Кинематика»',
    dueAt: day(-2, 23, 59),
  },
  {
    id: 'dl-pi21-hist-case',
    groupName: 'ПИ-21',
    disciplineCode: 'PI21-HIST',
    disciplineName: 'История',
    title: 'Кейс-семинар «Реформы Александра II»',
    dueAt: day(0, 23, 59),
  },
  {
    id: 'dl-pi21-disc-project',
    groupName: 'ПИ-21',
    disciplineCode: 'PI21-DISC',
    disciplineName: 'Дискретная математика',
    title: 'Индивидуальный проект «Графы»',
    dueAt: day(3, 23, 59),
  },
  {
    id: 'dl-pi21-alg-essay',
    groupName: 'ПИ-21',
    disciplineCode: 'PI21-ALG',
    disciplineName: 'Алгоритмы и структуры данных',
    title: 'Реферат «NP-полнота»',
    dueAt: day(21, 23, 59),
  },
  {
    id: 'dl-ek11-econ-essay',
    groupName: 'ЭК-11',
    disciplineCode: 'EK11-ECON',
    disciplineName: 'Экономическая теория',
    title: 'Эссе «Рынки труда»',
    dueAt: day(1, 23, 59),
  },
  {
    id: 'dl-ek11-math-hw',
    groupName: 'ЭК-11',
    disciplineCode: 'EK11-MATH',
    disciplineName: 'Математический анализ',
    title: 'Домашняя работа «Пределы»',
    dueAt: day(6, 23, 59),
  },
];

// DIG-34 — ручные задачи (подписать документ, оплатить по договору):
// выполняются вне кабинета, закрываются отметкой «выполнено» владельцем.
const studentTasks: StudentTaskRow[] = [
  {
    id: 'task-anna-sign',
    studentId: 'st-anna',
    title: 'Подписать согласие на обработку персональных данных',
    note: null,
    dueAt: day(-1, 18, 0),
    doneAt: null,
  },
  {
    id: 'task-anna-pay',
    studentId: 'st-anna',
    title: 'Оплатить обучение по договору',
    note: 'Договор об образовании У-2026-114',
    dueAt: day(5, 18, 0),
    doneAt: null,
  },
  {
    id: 'task-ilya-pay',
    studentId: 'st-ilya',
    title: 'Оплатить оставшуюся часть по договору',
    note: 'Договор об образовании У-2025-407',
    dueAt: day(9, 18, 0),
    doneAt: null,
  },
];

// DIG-47 — демо-реестр справок. Код проверки — НЕ секрет (страница
// проверки публична по самому замыслу), фиксированные значения нужны для
// стабильного демо жюри и e2e: действительная справка Анны и отозванная
// справка Ильи. Справка заявки req-anna-1 не сеется — она выдаётся
// лениво (код генерируется криптографически) при первом открытии
// карточки заявки или скачивании PDF.
export const DEMO_CERTIFICATES = {
  annaValid: {
    code: 'QK4W-R7X2-M5DJ-V3TH-PL6N-B2QF-UXK3-ZD6A',
  },
  /** Отдельные действительные справки: применяются e2e отзыва (параллельные проекты 1440/360). */
  annaRevokeDesktop: {
    code: 'P7QM-X3TB-K6VD-H4LN-F2RS-C5QB-W2XK-Z4MT',
  },
  annaRevokeMobile: {
    code: 'T5WQ-C2XV-N7KD-M3LP-R6SF-B4QG-Y2HK-V7ZT',
  },
  ilyaRevoked: {
    code: 'YT3Q-C6VB-N2KH-W5LM-R7XD-P4FS-J6GQ-Z3MT',
  },
} as const;

const certificateExpiry = (offsetDays: number): Date => {
  const d = day(offsetDays, 12, 0);
  d.setFullYear(d.getFullYear() + 1);
  return d;
};

const certificates: CertificateRow[] = [
  {
    id: 'cert-demo-anna',
    studentId: 'st-anna',
    requestId: null, // справка выдана деканатом напрямую (вне заявки)
    documentType: 'Справка об обучении',
    purpose: 'для предъявления по месту требования',
    number: 'СП-2026-000412',
    verificationCode: DEMO_CERTIFICATES.annaValid.code,
    issuedAt: day(-5, 12, 0),
    expiresAt: certificateExpiry(-5),
    revokedAt: null,
    revokedReason: null,
  },
  {
    id: 'cert-demo-anna-bank',
    studentId: 'st-anna',
    requestId: null,
    documentType: 'Справка об обучении',
    purpose: 'для предъявления в банк',
    number: 'СП-2026-000431',
    verificationCode: DEMO_CERTIFICATES.annaRevokeDesktop.code,
    issuedAt: day(-4, 12, 0),
    expiresAt: certificateExpiry(-4),
    revokedAt: null,
    revokedReason: null,
  },
  {
    id: 'cert-demo-anna-military',
    studentId: 'st-anna',
    requestId: null,
    documentType: 'Справка для отсрочки от армии',
    purpose: 'для военкомата по месту учёбы',
    number: 'СП-2026-000442',
    verificationCode: DEMO_CERTIFICATES.annaRevokeMobile.code,
    issuedAt: day(-3, 12, 0),
    expiresAt: certificateExpiry(-3),
    revokedAt: null,
    revokedReason: null,
  },
  {
    id: 'cert-demo-ilya',
    studentId: 'st-ilya',
    requestId: null,
    documentType: 'Справка об обучении',
    purpose: 'для предъявления по месту требования',
    number: 'СП-2026-000777',
    verificationCode: DEMO_CERTIFICATES.ilyaRevoked.code,
    issuedAt: day(-30, 12, 0),
    expiresAt: certificateExpiry(-30),
    revokedAt: day(-1, 15, 0),
    revokedReason: 'Отозвано деканатом: выдана ошибочно',
  },
];

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
  // DIG-34 — обращение Анны с ответом сотрудника: источник задачи
  // «Ответить на обращение» (последнее сообщение — от деканата, не закрыто).
  {
    id: 'apl-anna-2',
    studentId: 'st-anna',
    subject: 'Перенос лабораторной по программированию',
    status: 'ANSWERED',
    createdAt: day(-3, 9, 30),
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
  {
    id: 'msg-anna-2a',
    appealId: 'apl-anna-2',
    authorRole: 'STUDENT',
    authorName: 'Анна Ковалёва',
    body: 'Здравствуйте! Возможен ли перенос лабораторной со среды?',
    createdAt: day(-3, 9, 30),
  },
  {
    id: 'msg-anna-2b',
    appealId: 'apl-anna-2',
    authorRole: 'STAFF',
    authorName: 'Мария Петрова',
    body: 'Лабораторная переносится на четверг, ауд. 305. Подтвердите, пожалуйста.',
    createdAt: day(-1, 10, 15),
  },
  // DIG-48 — сообщение открытого обращения Анны (факультет «ИТ» — чат
  // виден сотруднику demo-кабинета).
  {
    id: 'msg-anna-1a',
    appealId: 'apl-anna-1',
    authorRole: 'STUDENT',
    authorName: 'Анна Ковалёва',
    body: 'Здравствуйте! Засчитывается ли зачёт по физкультуре за прошлый семестр?',
    createdAt: day(-2, 19, 5),
  },
];

// DIG-48 — демо-объявление сотрудника (факультет «ИТ»): список раздела
// «Объявления» не пуст при первом открытии.
const announcements: AnnouncementRow[] = [
  {
    id: 'ann-demo-pi21',
    faculty: 'ИТ',
    groupName: 'ПИ-21',
    title: 'Собрание группы ПИ-21',
    body: 'Завтра в 10:00, ауд. 305: вопросы сессии и практики. Возьмите зачётные книжки.',
    authorLogin: 'dean.kovaleva',
    authorName: 'Мария Петрова',
    createdAt: day(-1, 13, 0),
  },
];

// DIG-39 — обращения в деканат (тикет с перепиской). У Анны два обращения:
// «Ждём вас» — переписка с менеджером, вложение и привязка к её заявке на
// общежитие (ответ менеджера НЕПРОЧИТАН — точка в списке + уведомление
// TICKET со ссылкой на чат), и «Открыто» — новое обращение с привязкой к
// дисциплине её группы. У Ильи — «Решено». Все номера вымышленные.
function buildTickets(): {
  tickets: TicketRow[];
  ticketMessages: TicketMessageRow[];
  ticketNotifications: NotificationRow[];
} {
  // Сид номеров тикетов независим от заявок — детерминизм сохраняется.
  const rand = prng(20261139);
  const dormRequest = requests.find((r) => r.id === 'req-anna-2');
  if (!dormRequest) throw new Error('seed: ticket needs req-anna-2');

  const ticketA: TicketRow = {
    id: 'tkt-anna-1',
    studentId: 'st-anna',
    number: newTicketNumber(rand, day(-4, 11, 20)),
    subject: 'OTHER',
    status: 'ANSWERED',
    assigneeUserId: 'auth-dean',
    requestNumber: dormRequest.number,
    disciplineCode: null,
    createdAt: day(-4, 11, 20),
    updatedAt: day(-1, 16, 40),
  };
  const ticketB: TicketRow = {
    id: 'tkt-anna-2',
    studentId: 'st-anna',
    number: newTicketNumber(rand, day(0, 9, 5)),
    subject: 'GRADES',
    status: 'OPEN',
    assigneeUserId: null,
    requestNumber: null,
    disciplineCode: 'PI21-DB',
    createdAt: day(0, 9, 5),
    updatedAt: day(0, 9, 5),
  };
  const ticketIlya: TicketRow = {
    id: 'tkt-ilya-1',
    studentId: 'st-ilya',
    number: newTicketNumber(rand, day(-13, 12, 10)),
    subject: 'TRANSFER',
    status: 'RESOLVED',
    assigneeUserId: 'auth-dean',
    requestNumber: null,
    disciplineCode: null,
    createdAt: day(-13, 12, 10),
    updatedAt: day(-12, 10, 25),
  };

  const ticketMessages: TicketMessageRow[] = [
    {
      id: 'tktmsg-a-1',
      ticketId: ticketA.id,
      authorRole: 'STUDENT',
      authorName: 'Анна Ковалёва',
      body: 'Здравствуйте! Подскажите, пожалуйста, когда будет решение по моему заявлению на общежитие? Прикладываю справку с места учёбы.',
      attachments: ['справка-с-места-учёбы.pdf'],
      createdAt: day(-4, 11, 20),
      readAt: day(-1, 16, 35),
    },
    {
      id: 'tktmsg-a-2',
      ticketId: ticketA.id,
      authorRole: 'STAFF',
      authorName: 'Мария Петрова',
      body: 'Добрый день! Заявление принято в работу, проверяем свободные места. Ответ дадим до конца недели.',
      attachments: ['скан-заявления.pdf'],
      createdAt: day(-1, 16, 40),
      readAt: null, // непрочитанный ответ менеджера — точка в списке + уведомление
    },
    {
      id: 'tktmsg-b-1',
      ticketId: ticketB.id,
      authorRole: 'STUDENT',
      authorName: 'Анна Ковалёва',
      body: 'Проверьте, пожалуйста, оценку за проект по «Базам данных»: в кабинете 85, а на защите объявили 90.',
      attachments: [],
      createdAt: day(0, 9, 5),
      readAt: null,
    },
    {
      id: 'tktmsg-i-1',
      ticketId: ticketIlya.id,
      authorRole: 'STUDENT',
      authorName: 'Илья Смирнов',
      body: 'Как перевестись с платного обучения на бюджетное место?',
      attachments: [],
      createdAt: day(-13, 12, 10),
      readAt: day(-12, 10, 20),
    },
    {
      id: 'tktmsg-i-2',
      ticketId: ticketIlya.id,
      authorRole: 'STAFF',
      authorName: 'Мария Петрова',
      body: 'Заявление на перевод подаётся в деканат до 5 июля. Условия — средний балл не ниже 4.0 и отсутствие долгов. Ваше заявление зарегистрировали под №214.',
      attachments: [],
      createdAt: day(-12, 10, 25),
      readAt: day(-12, 14, 0),
    },
  ];

  const ticketNotifications: NotificationRow[] = [
    {
      id: 'ntf-anna-9',
      studentId: 'st-anna',
      type: 'TICKET',
      title: 'Ответ по обращению',
      body: 'Мария Петрова ответила в обращении по общежитию.',
      isRead: true,
      createdAt: day(-1, 16, 41),
      link: `/deanery/${ticketA.number}`,
    },
  ];

  return { tickets: [ticketA, ticketB, ticketIlya], ticketMessages, ticketNotifications };
}

const { tickets, ticketMessages, ticketNotifications } = buildTickets();

// DIG-40 — обратная связь руководству (/feedback). У Анны два подписанных
// обращения («На рассмотрении» и «Отвечено»), у Ильи — жалоба («На
// рассмотрении»), плюс одно АНОНИМНОЕ обращение: studentId = null — связи
// с пользователем нет нигде (приёмка DIG-40), в списках оно не видно и
// по карточке не открывается никому. Отдельно — три решённых предложения
// в публичной ленте «Что мы изменили по вашим предложениям» (тоже без
// авторов). Все тексты и номера вымышленные.
export const DEMO_FEEDBACK = {
  /** Номер анонимного сида — e2e проверяет, что карточка отвечает 404 всем. */
  anonymousNumber: 'FB-2026-QA77X',
} as const;

function buildFeedback(): FeedbackRow[] {
  const mk = (
    id: string,
    studentId: string | null,
    number: string,
    kind: FeedbackRow['kind'],
    target: FeedbackRow['target'],
    status: FeedbackRow['status'],
    text: string,
    createdOn: number,
    extras: Partial<FeedbackRow> = {},
  ): FeedbackRow => {
    const createdAt = day(createdOn, 14, 30);
    return {
      id,
      studentId,
      number,
      kind,
      target,
      status,
      text,
      attachments: extras.attachments ?? [],
      isAnonymous: extras.isAnonymous ?? studentId === null,
      publishedOutcome: extras.publishedOutcome ?? null,
      createdAt,
      dueAt: addWorkingDays(createdAt, FEEDBACK_RESPONSE_DAYS),
      updatedAt: extras.updatedAt ?? createdAt,
    };
  };

  return [
    mk(
      'fb-anna-1',
      'st-anna',
      'FB-2026-KM41P',
      'SUGGESTION',
      'DEANERY',
      'NEW',
      'Добавьте, пожалуйста, в расписание фильтр по корпусу — удобно видеть только пары рядом.',
      -3,
    ),
    mk(
      'fb-anna-2',
      'st-anna',
      'FB-2026-WN82T',
      'GRATITUDE',
      'PROGRAM_MANAGEMENT',
      'ANSWERED',
      'Спасибо за дополнительные консультации перед сессией — очень помогли!',
      -9,
      { updatedAt: day(-6, 11, 15) },
    ),
    mk(
      'fb-ilya-1',
      'st-ilya',
      'FB-2026-RB53D',
      'COMPLAINT',
      'UNIVERSITY_MANAGEMENT',
      'NEW',
      'В аудитории 12 экономического корпуса проектор не читает ноутбуки — половина пар начинается с починки техники.',
      -2,
    ),
    // Анонимное обращение: НИКАКОЙ связи с пользователем (studentId: null).
    mk(
      'fb-anon-1',
      null,
      DEMO_FEEDBACK.anonymousNumber,
      'SUGGESTION',
      'ACADEMIC_OFFICE',
      'NEW',
      'Опубликуйте шаблоны заявлений прямо в кабинете, чтобы не искать на сайте.',
      -1,
    ),
    // Публичная лента «Что мы изменили по вашим предложениям» — решённые
    // предложения с результатом, без авторов.
    mk(
      'fb-out-1',
      null,
      'FB-2026-ZA11Q',
      'SUGGESTION',
      'DEANERY',
      'RESOLVED',
      'Сделайте запись к специалисту деканата прямо из кабинета — не хочется занимать очередь в коридоре.',
      -45,
      {
        publishedOutcome:
          'Запись появилась в разделе «Связь с деканатом»: обращение уходит менеджеру программы, ответ — в кабинете.',
        updatedAt: day(-20, 10, 0),
      },
    ),
    mk(
      'fb-out-2',
      null,
      'FB-2026-ZB22R',
      'SUGGESTION',
      'ACADEMIC_OFFICE',
      'RESOLVED',
      'Показывайте срок готовности справки сразу при заказе, а не после звонка в деканат.',
      -38,
      {
        publishedOutcome:
          'Срок готовности теперь виден при заказе и на карточке заявки — считается по рабочим дням.',
        updatedAt: day(-14, 10, 0),
      },
    ),
    mk(
      'fb-out-3',
      null,
      'FB-2026-ZC33S',
      'SUGGESTION',
      'UNIVERSITY_MANAGEMENT',
      'RESOLVED',
      'Добавьте в расписание фильтр по корпусу, чтобы видеть только пары в своём здании.',
      -30,
      {
        publishedOutcome: 'В расписании появился выбор корпуса: пары фильтруются по зданию.',
        updatedAt: day(-7, 10, 0),
      },
    ),
  ];
}

const feedbackRows = buildFeedback();

// DIG-68 — каталог студенческих стартапов «МСП» (/msp): 7 вымышленных
// студенческих проектов (только фиктивные названия, никаких реальных
// компаний), голоса шестерых демо-студентов и комментарии. «Запуск дня» —
// «Конспект-бот» (максимум голосов), детерминировано, без random.
// Slug'и генерирует тот же newMspSlug, что и публикацию из кабинета, —
// ссылки стабильны между сборками.
function buildMspCatalog(): {
  mspProjects: MspProjectRow[];
  mspVotes: MspVoteRow[];
  mspComments: MspCommentRow[];
} {
  // (автор, название, слоган, описание, теги, дней назад)
  const drafts: Array<{
    id: string;
    authorId: string;
    authorName: string;
    title: string;
    tagline: string;
    description: string;
    tags: string[];
    daysAgo: number;
    /** Кто голосовал: логины-заглушки переводятся в id студентов ниже. */
    voters: string[];
  }> = [
    {
      id: 'msp-konspekt',
      authorId: 'st-anna',
      authorName: 'Анна Ковалёва',
      title: 'Конспект-бот',
      tagline: 'ИИ-конспекты лекций за минуту',
      description:
        'Студент загружает запись или тезисы пары, а бот собирает структурированный конспект с определениями и вопросами для самопроверки. Черновик дипломного прототипа: работает на вымышленных записях, ничего не отправляет наружу.',
      tags: ['ai', 'учёба', 'конспекты'],
      daysAgo: 5,
      voters: ['st-ilya', 'st-mate-dmitry', 'st-mate-polina', 'st-mate-artem', 'st-mate-sofia'],
    },
    {
      id: 'msp-repetitor',
      authorId: 'st-mate-dmitry',
      authorName: 'Дмитрий Волков',
      title: 'Репетитор.Маркет',
      tagline: 'Маркетплейс репетиторов от старшекурсников',
      description:
        'Старшекурсники публикуют консультации по своим дисциплинам, первокурсники записываются прямо из кабинета. В концепте — витрина с вымышленными профилями: рейтинги, отзывы и слоты придуманы для демо.',
      tags: ['наставничество', 'консультации'],
      daysAgo: 4,
      voters: ['st-anna', 'st-ilya', 'st-mate-polina', 'st-mate-sofia'],
    },
    {
      id: 'msp-deadline',
      authorId: 'st-anna',
      authorName: 'Анна Ковалёва',
      title: 'Дедлайн-радар',
      tagline: 'Все сроки семестра на одной шкале',
      description:
        'Собирает дедлайны курсов, пересдач и оплат в одну таймлайн-шкалу и присылает тихие напоминания за три дня. Задумка второкурсницы после первой сессии; данные в демо — вымышленные.',
      tags: ['дедлайны', 'планирование'],
      daysAgo: 2,
      voters: ['st-ilya', 'st-mate-dmitry', 'st-mate-polina'],
    },
    {
      id: 'msp-biblio',
      authorId: 'st-mate-polina',
      authorName: 'Полина Егорова',
      title: 'БиблиоОбмен',
      tagline: 'Обмен учебниками между курсами',
      description:
        'Студенты помечают ненужные учебники, младшие курсы бронируют их для следующего семестра. Прототип каталога на бумажных формах: все книги и владельцы вымышленные.',
      tags: ['книги', 'шеринг'],
      daysAgo: 3,
      voters: ['st-anna', 'st-mate-artem'],
    },
    {
      id: 'msp-timlider',
      authorId: 'st-mate-artem',
      authorName: 'Артём Фёдоров',
      title: 'ТимЛидер',
      tagline: 'Поиск команды для хакатона и курсовой',
      description:
        'Карточки студентов с навыками и ролями: дизайнер ищет фронтендера, тимлид собирает команду к дедлайну конкурса. Внутри демо — только вымышленные участники и проекты.',
      tags: ['команды', 'хакатон'],
      daysAgo: 2,
      voters: ['st-anna', 'st-mate-sofia'],
    },
    {
      id: 'msp-studcoffee',
      authorId: 'st-ilya',
      authorName: 'Илья Смирнов',
      title: 'СтудКофе',
      tagline: 'Карта кофеен со студенческой скидкой',
      description:
        'Студенческий проект о кофе рядом с кампусом: карта точек, часы загрузки и «студенческий» процент. Все кофейни в демо вымышленные, никаких реальных заведений и коммерции.',
      tags: ['кампус', 'скидки'],
      daysAgo: 7,
      voters: ['st-anna'],
    },
    {
      id: 'msp-stipfond',
      authorId: 'st-mate-sofia',
      authorName: 'София Гусева',
      title: 'СтипФонд',
      tagline: 'Калькулятор стипендий и грантов',
      description:
        'Считает ожидаемую стипендию по успеваемости и подсказывает вымышленные гранты конкурса под профиль студента. Первый прототип на таблицах, цифры в демо придуманы.',
      tags: ['стипендии', 'гранты'],
      daysAgo: 1,
      voters: [],
    },
  ];

  const taken: string[] = [];
  const mspProjects: MspProjectRow[] = drafts.map((draft) => {
    const slug = newMspSlug(draft.title, taken);
    taken.push(slug);
    return {
      id: draft.id,
      slug,
      title: draft.title,
      tagline: draft.tagline,
      description: draft.description,
      tags: draft.tags,
      authorStudentId: draft.authorId,
      authorName: draft.authorName,
      createdAt: day(-draft.daysAgo, 12, 0),
      letter: draft.title.charAt(0).toUpperCase(),
    };
  });

  const mspVotes: MspVoteRow[] = [];
  let voteSeq = 0;
  for (const draft of drafts) {
    for (const voterId of draft.voters) {
      voteSeq += 1;
      mspVotes.push({
        projectId: draft.id,
        studentId: voterId,
        createdAt: day(-draft.daysAgo + 1, 9, voteSeq % 50),
      });
    }
  }

  const mkComment = (
    id: string,
    projectId: string,
    studentId: string,
    authorName: string,
    body: string,
    daysAgo: number,
    hour: number,
  ): MspCommentRow => ({
    id,
    projectId,
    studentId,
    authorName,
    body,
    createdAt: day(-daysAgo, hour),
  });

  const mspComments: MspCommentRow[] = [
    mkComment(
      'msp-cmt-1',
      'msp-konspekt',
      'st-ilya',
      'Илья Смирнов',
      'Загрузил конспект вчерашней лекции — структура с определениями собралась за минуту, годно!',
      4,
      18,
    ),
    mkComment(
      'msp-cmt-2',
      'msp-konspekt',
      'st-mate-polina',
      'Полина Егорова',
      'Сделайте, пожалуйста, выгрузку конспекта в PDF — хочется печатать перед семинаром.',
      3,
      10,
    ),
    mkComment(
      'msp-cmt-3',
      'msp-studcoffee',
      'st-anna',
      'Анна Ковалёва',
      'Кофейня у второго корпуса на карте отмечена верно, скидка по студенческому работает.',
      6,
      15,
    ),
    mkComment(
      'msp-cmt-4',
      'msp-repetitor',
      'st-mate-sofia',
      'София Гусева',
      'Записалась на консультацию по матанализу — слоты видно прямо в карточке, удобно.',
      2,
      13,
    ),
    mkComment(
      'msp-cmt-5',
      'msp-timlider',
      'st-ilya',
      'Илья Смирнов',
      'Собрали команду на конкурс за вечер: два фронтендера и дизайнер нашлись через карточки.',
      1,
      21,
    ),
  ];

  return { mspProjects, mspVotes, mspComments };
}

const { mspProjects, mspVotes, mspComments } = buildMspCatalog();

// DIG-42 — «Дополнительное образование» (/dpo): 6 вымышленных программ
// (названия обобщённые, никаких реальных провайдеров), 2 записи Анны с
// демо-прогрессом (60 % и 10 %) и 3 её документа (договор, акт, сертификат).
// Реальной зачисляемости и оплаты нет: «Записаться» только ставит строку
// записи владельца, цена 0 читается как «бесплатно для прототипа».
function buildDpoCatalog(): {
  dpoPrograms: DpoProgramRow[];
  dpoEnrollments: DpoEnrollmentRow[];
  dpoDocuments: DpoDocumentRow[];
} {
  const dpoPrograms: DpoProgramRow[] = [
    {
      id: 'dpo-analytics',
      slug: 'analitika-dannyh',
      title: 'Аналитика данных',
      description:
        'Сбор, очистка и визуализация данных на реальных кейсах: от таблиц до дашбордов. Финальный проект — аналитический отчёт для вымышленного университета.',
      hours: 72,
      format: 'ONLINE',
      startsAt: day(14, 10),
      price: 0,
      tags: ['данные', 'SQL', 'дашборды'],
      facultyTag: 'ИТ',
    },
    {
      id: 'dpo-uxui',
      slug: 'ux-ui-dizayn',
      title: 'UX/UI дизайн',
      description:
        'Исследование пользователей, прототипы и дизайн-системы: от сценария до кликабельного макета мобильного приложения. Кейсы в курсе вымышленные.',
      hours: 108,
      format: 'HYBRID',
      startsAt: day(21, 18),
      price: 24000,
      tags: ['дизайн', 'Figma', 'прототипы'],
      facultyTag: 'Дизайн',
    },
    {
      id: 'dpo-pm',
      slug: 'proektnoe-upravlenie',
      title: 'Проектное управление',
      description:
        'Планирование, роли и коммуникации в учебных и студенческих проектах: roadmap, риски и защита проекта перед комиссией (демо-кейсы).',
      hours: 64,
      format: 'OFFLINE',
      startsAt: day(30, 16),
      price: 18000,
      tags: ['управление', 'agile'],
      facultyTag: 'Менеджмент',
    },
    {
      id: 'dpo-python',
      slug: 'python-dlya-issledovaniy',
      title: 'Python для исследований',
      description:
        'Python-стек исследователя: pandas, визуализация и автоматизация рутины. Разбираем обработку вымышленных датасетов студенческих опросов.',
      hours: 96,
      format: 'ONLINE',
      startsAt: day(10, 19),
      price: 15000,
      tags: ['python', 'наука'],
      facultyTag: 'ИТ',
    },
    {
      id: 'dpo-pedagogy',
      slug: 'tsifrovaya-pedagogika',
      title: 'Цифровая педагогика',
      description:
        'Онлайн-форматы, обратная связь и оценивание в цифровой среде: проектирование урока под смешанное обучение. Прототип — витрина без выдачи документов.',
      hours: 36,
      format: 'ONLINE',
      startsAt: day(17, 17),
      price: 0,
      tags: ['педагогика', 'онлайн-урок'],
      facultyTag: 'Педагогика',
    },
    {
      id: 'dpo-cybersec',
      slug: 'kiberbezopasnost-osnovy',
      title: 'Кибербезопасность основы',
      description:
        'Базовая гигиена digital-жизни: пароли, фишинг, шифрование и безопасные настройки устройств. Практикум на изолированных вымышленных примерах.',
      hours: 72,
      format: 'HYBRID',
      startsAt: day(24, 18),
      price: 21000,
      tags: ['безопасность', 'приватность'],
      facultyTag: 'Безопасность',
    },
  ];

  // Две записи Анны с демо-прогрессом (приёмка: 60 % и 10 %).
  const dpoEnrollments: DpoEnrollmentRow[] = [
    {
      programId: 'dpo-analytics',
      studentId: 'st-anna',
      enrolledAt: day(-40, 12, 30),
      progressPercent: 60,
    },
    {
      programId: 'dpo-uxui',
      studentId: 'st-anna',
      enrolledAt: day(-12, 20, 10),
      progressPercent: 10,
    },
  ];

  // Три документа Анны: договор и акт по «Аналитике данных», сертификат
  // за завершённый (в вымышленной истории) «Python для исследований».
  const dpoDocuments: DpoDocumentRow[] = [
    {
      id: 'dpo-doc-1',
      studentId: 'st-anna',
      programId: 'dpo-analytics',
      kind: 'CONTRACT',
      title: 'Договор на обучение по программе «Аналитика данных»',
      issuedAt: day(-40, 12, 45),
      number: 'ДПО-2026-0141',
    },
    {
      id: 'dpo-doc-2',
      studentId: 'st-anna',
      programId: 'dpo-analytics',
      kind: 'ACT',
      title: 'Акт об оказании образовательных услуг',
      issuedAt: day(-20, 11, 0),
      number: 'ДПО-АКТ-2026-0093',
    },
    {
      id: 'dpo-doc-3',
      studentId: 'st-anna',
      programId: 'dpo-python',
      kind: 'CERTIFICATE',
      title: 'Сертификат о повышении квалификации «Python для исследований»',
      issuedAt: day(-60, 15, 30),
      number: 'ДПО-СЕРТ-2026-0057',
    },
  ];

  return { dpoPrograms, dpoEnrollments, dpoDocuments };
}

const { dpoPrograms, dpoEnrollments, dpoDocuments } = buildDpoCatalog();

const schedule: ScheduleEventRow[] = [
  {
    // DIG-24 — обычная пара с полным составом панели: корпус, email
    // преподавателя, домашнее задание и материалы.
    id: 'sch-pi21-1',
    groupName: 'ПИ-21',
    disciplineCode: 'PI21-INFO',
    disciplineName: 'Информатика',
    date: day(0, 10, 0),
    startsAt: day(0, 10, 0),
    endsAt: day(0, 11, 30),
    kind: 'LECTURE',
    room: '301',
    building: 'Главный корпус',
    teacherName: 'Петров Пётр Петрович',
    teacherEmail: 'p.petrov@example.edu',
    status: 'SCHEDULED',
    note: null,
    homework: 'Подготовить вопросы к коллоквиуму',
    materials: 'Конспект лекции №7, слайды в библиотеке',
  },
  // DIG-20 — насыщенный «сегодня» для главной: 4 пары, одна перенесена
  // (214 → 305), одна отменена, одна онлайн (строка-резюме героя).
  // Пары «сегодня» — sch-pi21-4/5/6, блок ниже после sch-pi21-3.
  {
    // DIG-24 — перенос с причиной и автором изменения (жёлтый блок панели).
    id: 'sch-pi21-2',
    groupName: 'ПИ-21',
    disciplineCode: 'PI21-PROG',
    disciplineName: 'Программирование',
    date: day(1, 12, 0),
    startsAt: day(1, 12, 0),
    endsAt: day(1, 13, 30),
    kind: 'LAB',
    room: '405',
    building: 'Лабораторный корпус',
    teacherName: 'Иванова Ирина Игоревна',
    teacherEmail: 'i.ivanova@example.edu',
    status: 'ROOM_CHANGED',
    note: 'Перенесено из ауд. 310',
    previousRoom: '310',
    changeNote: 'В ауд. 310 монтируют новое оборудование',
    changeAuthor: 'Мария Петрова (деканат)',
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
    teacherEmail: 's.sokolov@example.edu',
    status: 'SCHEDULED',
    note: null,
  },
  {
    // DIG-24 — перенос «сегодня» с причиной и автором (жёлтый блок панели).
    id: 'sch-pi21-4',
    groupName: 'ПИ-21',
    disciplineCode: 'PI21-PROG',
    disciplineName: 'Программирование',
    date: day(0, 12, 0),
    startsAt: day(0, 12, 0),
    endsAt: day(0, 13, 30),
    kind: 'LAB',
    room: '305',
    building: 'Главный корпус',
    teacherName: 'Иванова Ирина Игоревна',
    teacherEmail: 'i.ivanova@example.edu',
    status: 'ROOM_CHANGED',
    note: 'Пара перенесена в ауд. 305',
    previousRoom: '214',
    previousStartsAt: day(0, 12, 0),
    changeNote: 'Аудитория 214 занята факультетским мероприятием',
    changeAuthor: 'Мария Петрова (деканат)',
    homework: 'Задача 7 до следующей пары',
    materials: 'Конспект лекции №7',
  },
  {
    // DIG-24 — отмена с причиной и «что делать» (красный блок панели).
    id: 'sch-pi21-5',
    groupName: 'ПИ-21',
    disciplineCode: 'PI21-PHYS',
    disciplineName: 'Физика',
    date: day(0, 14, 0),
    startsAt: day(0, 14, 0),
    endsAt: day(0, 15, 30),
    kind: 'LAB',
    room: '212',
    building: 'Лабораторный корпус',
    teacherName: 'Соколов Сергей Сергеевич',
    teacherEmail: 's.sokolov@example.edu',
    status: 'CANCELLED',
    note: 'Лаборатория закрыта',
    changeNote: 'Занятие будет восполнено 20 ноября, ауд. 212',
    changeAuthor: 'Мария Петрова (деканат)',
  },
  {
    // DIG-24 — онлайн-пара со ссылкой на встречу.
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
    teacherEmail: 'o.orlov@example.edu',
    status: 'SCHEDULED',
    note: null,
    onlineUrl: 'https://meet.example.edu/hist-seminar',
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
 * DIG-30 — словарь типов канонических заявок («Заявки и справки») и пара
 * живых заявок Анны: мгновенная справка (READY, можно скачать) и бумажный
 * дубликат диплома в очереди. Всё вымышленное.
 */
function buildCanonicalRequests(): {
  types: CanonicalRequestTypeRow[];
  requests: CanonicalRequestRow[];
  events: CanonicalRequestEventRow[];
} {
  const types: CanonicalRequestTypeRow[] = [
    {
      id: 'crt-cert',
      code: 'CERT_ENROLLMENT',
      name: 'Справка об обучении',
      etaDays: 1,
      format: 'ELECTRONIC',
      isInstant: true,
      formSchema: {
        keyField: 'purpose',
        fields: [
          {
            key: 'purpose',
            label: 'Назначение',
            type: 'enum',
            required: true,
            options: ['для банка', 'для военкомата', 'по месту требования', 'для работодателя'],
          },
        ],
      },
    },
    {
      id: 'crt-extract',
      code: 'GRADES_EXTRACT',
      name: 'Выписка оценок',
      etaDays: 1,
      format: 'ELECTRONIC',
      isInstant: true,
      formSchema: null,
    },
    {
      id: 'crt-diploma',
      code: 'DIPLOMA_COPY',
      name: 'Дубликат диплома',
      etaDays: 5,
      format: 'PAPER',
      isInstant: false,
      formSchema: {
        keyField: 'reason',
        fields: [{ key: 'reason', label: 'Причина', type: 'text', required: true, maxLength: 200 }],
      },
    },
    {
      id: 'crt-academic',
      code: 'ACADEMIC_LEAVE',
      name: 'Заявление на академический отпуск',
      etaDays: 3,
      format: 'HYBRID',
      isInstant: false,
      formSchema: {
        keyField: 'period',
        fields: [
          { key: 'period', label: 'Период', type: 'text', required: true, maxLength: 60 },
          { key: 'reason', label: 'Причина', type: 'text', required: true },
          { key: 'from', label: 'Дата начала', type: 'date', required: true },
        ],
      },
    },
  ];

  const certCreated = day(0, 9, 5); // сегодня утром — окно 24 ч активно
  const diplomaCreated = day(-3, 11, 40);
  const deferCreated = day(-2, 11, 20);
  const deferFixAt = day(-1, 10, 5);

  // DIG-33 — заявки Ильи: отдельный мир мутационных e2e карточки.
  // Сквозная нумерация года (nextCanonicalRequestSeq сканирует все заявки):
  // у Анны 1–3, у Ильи 4–6 — номера уникальны и детерминированы.
  const ilyaCertCreated = day(-1, 9, 30);
  const ilyaAcademicCreated = day(-5, 12, 10);
  const ilyaAcademicFixAt = day(-2, 14, 45);
  const ilyaPaperCreated = day(-1, 15, 20);

  const requests: CanonicalRequestRow[] = [
    {
      id: 'creq-demo-cert',
      number: formatCanonicalRequestNumber(certCreated.getFullYear(), 1),
      studentId: 'st-anna',
      typeCode: 'CERT_ENROLLMENT',
      typeName: 'Справка об обучении',
      title: 'Справка об обучении · для банка',
      params: { purpose: 'для банка' },
      status: 'READY',
      createdAt: certCreated,
      updatedAt: certCreated,
    },
    {
      id: 'creq-demo-diploma',
      number: formatCanonicalRequestNumber(diplomaCreated.getFullYear(), 2),
      studentId: 'st-anna',
      typeCode: 'DIPLOMA_COPY',
      typeName: 'Дубликат диплома',
      title: 'Дубликат диплома · утрата оригинала',
      params: { reason: 'утрата оригинала' },
      status: 'SUBMITTED',
      createdAt: diplomaCreated,
      updatedAt: diplomaCreated,
    },
    // DIG-32 — «Нужна доработка» для пилюли «Нужно действие» и закрепления
    // наверху списка: сотрудник вернул справку с причиной из задачи.
    {
      id: 'creq-demo-defer',
      number: formatCanonicalRequestNumber(deferCreated.getFullYear(), 3),
      studentId: 'st-anna',
      typeCode: 'CERT_ENROLLMENT',
      typeName: 'Справка об обучении',
      title: 'Справка об обучении · для военкомата',
      params: {
        purpose: 'для военкомата',
        // DIG-33 — мета мастера заказа: карточка показывает её в
        // «Параметрах» и во «Вложениях» (в прототипе передаются только
        // имена и размеры файлов, сами файлы не хранятся).
        wizard: JSON.stringify({
          destination: 'Военкомат',
          language: 'RU',
          copies: 1,
          delivery: 'PICKUP',
          comment: '',
          attachments: [
            { name: 'scan-passport.png', size: 1258291 },
            { name: 'voenny-bilet.pdf', size: 884736 },
          ],
        }),
      },
      status: 'NEEDS_FIX',
      createdAt: deferCreated,
      updatedAt: deferFixAt,
    },
    // ── DIG-33: мир Ильи (мутационные e2e карточки) ─────────────────────────
    {
      id: 'creq-demo-ilya-cert',
      number: formatCanonicalRequestNumber(ilyaCertCreated.getFullYear(), 4),
      studentId: 'st-ilya',
      typeCode: 'CERT_ENROLLMENT',
      typeName: 'Справка об обучении',
      title: 'Справка об обучении · для банка',
      params: { purpose: 'для банка' },
      status: 'READY',
      createdAt: ilyaCertCreated,
      updatedAt: ilyaCertCreated,
    },
    {
      id: 'creq-demo-ilya-academic',
      number: formatCanonicalRequestNumber(ilyaAcademicCreated.getFullYear(), 5),
      studentId: 'st-ilya',
      typeCode: 'ACADEMIC_LEAVE',
      typeName: 'Заявление на академический отпуск',
      title: 'Заявление на академический отпуск · весенний семестр',
      params: {
        period: 'весенний семестр',
        reason: 'по семейным обстоятельствам',
        from: '2027-03-01',
        wizard: JSON.stringify({
          destination: 'Деканат ЭК',
          language: 'RU',
          copies: 1,
          delivery: 'PICKUP',
          comment: 'Нужны два подписанных экземпляра',
          attachments: [{ name: 'scan-zayavlenie.pdf', size: 524288 }],
        }),
      },
      status: 'NEEDS_FIX',
      createdAt: ilyaAcademicCreated,
      updatedAt: ilyaAcademicFixAt,
    },
    {
      id: 'creq-demo-ilya-paper',
      number: formatCanonicalRequestNumber(ilyaPaperCreated.getFullYear(), 6),
      studentId: 'st-ilya',
      typeCode: 'DIPLOMA_COPY',
      typeName: 'Дубликат диплома',
      title: 'Дубликат диплома · повреждение оригинала',
      params: { reason: 'повреждение оригинала' },
      status: 'SUBMITTED',
      createdAt: ilyaPaperCreated,
      updatedAt: ilyaPaperCreated,
    },
  ];

  const events: CanonicalRequestEventRow[] = [
    {
      id: 'cev-demo-cert',
      requestId: 'creq-demo-cert',
      actorUserId: 'auth-anna',
      actorRole: 'STUDENT',
      actorName: 'Анна Ковалёва',
      fromStatus: null,
      toStatus: 'READY',
      comment: 'Документ сформирован автоматически',
      createdAt: certCreated,
    },
    {
      id: 'cev-demo-diploma',
      requestId: 'creq-demo-diploma',
      actorUserId: 'auth-anna',
      actorRole: 'STUDENT',
      actorName: 'Анна Ковалёва',
      fromStatus: null,
      toStatus: 'SUBMITTED',
      comment: null,
      createdAt: diplomaCreated,
    },
    {
      id: 'cev-demo-defer-submit',
      requestId: 'creq-demo-defer',
      actorUserId: 'auth-anna',
      actorRole: 'STUDENT',
      actorName: 'Анна Ковалёва',
      fromStatus: null,
      toStatus: 'SUBMITTED',
      comment: null,
      createdAt: deferCreated,
    },
    {
      id: 'cev-demo-defer-fix',
      requestId: 'creq-demo-defer',
      actorUserId: 'auth-dean',
      actorRole: 'STAFF',
      actorName: 'Мария Петрова',
      fromStatus: 'SUBMITTED',
      toStatus: 'NEEDS_FIX',
      comment: 'Укажите ФИО латиницей',
      createdAt: deferFixAt,
    },
    // ── DIG-33: история заявок Ильи ─────────────────────────────────────────
    {
      id: 'cev-demo-ilya-cert',
      requestId: 'creq-demo-ilya-cert',
      actorUserId: 'auth-ilya',
      actorRole: 'STUDENT',
      actorName: 'Илья Смирнов',
      fromStatus: null,
      toStatus: 'READY',
      comment: 'Документ сформирован автоматически',
      createdAt: ilyaCertCreated,
    },
    {
      id: 'cev-demo-ilya-academic-submit',
      requestId: 'creq-demo-ilya-academic',
      actorUserId: 'auth-ilya',
      actorRole: 'STUDENT',
      actorName: 'Илья Смирнов',
      fromStatus: null,
      toStatus: 'SUBMITTED',
      comment: null,
      createdAt: ilyaAcademicCreated,
    },
    {
      id: 'cev-demo-ilya-academic-fix',
      requestId: 'creq-demo-ilya-academic',
      actorUserId: 'auth-dean',
      actorRole: 'STAFF',
      actorName: 'Мария Петрова',
      fromStatus: 'SUBMITTED',
      toStatus: 'NEEDS_FIX',
      comment: 'Приложите скан подписанного заявления',
      createdAt: ilyaAcademicFixAt,
    },
    {
      id: 'cev-demo-ilya-paper-submit',
      requestId: 'creq-demo-ilya-paper',
      actorUserId: 'auth-ilya',
      actorRole: 'STUDENT',
      actorName: 'Илья Смирнов',
      fromStatus: null,
      toStatus: 'SUBMITTED',
      comment: null,
      createdAt: ilyaPaperCreated,
    },
  ];
  return { types, requests, events };
}

const {
  types: canonicalRequestTypes,
  requests: canonicalRequests,
  events: canonicalRequestEvents,
} = buildCanonicalRequests();

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
    // DIG-30 — канонические заявки «Заявки и справки» (номера ЗД-…).
    canonicalRequestTypes,
    canonicalRequests,
    canonicalRequestEvents,
    grades: [...grades, ...mateGrades],
    notifications: [...notifications, ...ticketNotifications],
    appeals,
    appealMessages,
    tickets,
    ticketMessages,
    // DIG-48 — демо-объявление раздела «Объявления» сотрудника.
    announcements,
    schedule,
    // DIG-40 — обратная связь руководству: подписанные, анонимное и лента.
    feedback: feedbackRows,
    // DIG-68 — каталог студенческих стартапов «МСП»: 7 вымышленных запусков.
    mspProjects,
    mspVotes,
    mspComments,
    // DIG-42 — «Дополнительное образование»: 6 программ, 2 записи, 3 документа.
    dpoPrograms,
    dpoEnrollments,
    dpoDocuments,
    exams,
    settings,
    // DIG-25 — справочники успеваемости: дисциплины с кредитами и план контроля.
    disciplines: disciplineRows,
    elements: elementRows,
    // DIG-34 — источники экрана «Задачи»: дедлайны курсов и ручные задачи.
    studyDeadlines,
    studentTasks,
    // DIG-47 — реестр справок: действительная (Анна) и отозванная (Илья).
    certificates,
    newsRead: [{ studentId: 'st-anna', newsId: 'retake-order', readAt: day(-1, 18, 20) }],
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
