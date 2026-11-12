// DIG-12 — the persistence port of the data layer.
//
// Two properties are enforced by the signatures themselves:
//
// 1. Every read/write carries its scope as a REQUIRED argument
//    (`studentId` / `groupName` / `faculty`). An adapter cannot be queried
//    "without a filter", so forgetting the owner check is impossible.
// 2. `probe*` methods are existence probes reserved to the data layer: they
//    look a row up WITHOUT an owner to distinguish «foreign» (OWNERSHIP_DENIED)
//    from «missing» (NOT_FOUND) for the audit log. Probe results must never
//    leave src/server/data/ — the caller gets null either way (uniform 404).
//
// Adapters: `createMemoryDataDb()` (tests + the running prototype until the
// Prisma schema branch lands) and, one-to-one by types, a future Prisma
// adapter (DIG-10 integration).

import type {
  AppealMessageRow,
  AppealRow,
  AuditLogRow,
  DisciplineElementRow,
  DisciplineRow,
  ExamSessionRow,
  GradeRow,
  NotificationRow,
  NotificationType,
  RequestEventRow,
  ScheduleEventRow,
  ServiceRequestRow,
  StaffRow,
  StudentNoteRow,
  StudentRow,
  StudentSettingsRow,
} from './types';

/** DIG-21 — полуинтервал периода расписания [from, to) в инстантах времени. */
export interface SchedulePeriod {
  from: Date;
  to: Date;
}

/** DIG-21 — изменение пары сотрудником деканата (событие изменения). */
export interface ScheduleChangePatch {
  status: ScheduleEventRow['status'];
  room?: string | null;
  startsAt?: Date;
  endsAt?: Date;
  date?: Date;
  previousRoom?: string | null;
  previousStartsAt?: Date | null;
  changeNote?: string | null;
}

export interface DataDb {
  // ── directory (ctx resolution) ────────────────────────────────────────────
  findStudentByLogin(login: string): Promise<StudentRow | null>;
  findStaffByLogin(login: string): Promise<StaffRow | null>;

  // ── existence probes (data-layer internal, see header) ───────────────────
  probeRequestByNumber(number: string): Promise<ServiceRequestRow | null>;
  probeRequestById(id: string): Promise<ServiceRequestRow | null>;
  probeNotificationById(id: string): Promise<NotificationRow | null>;
  probeAppealById(id: string): Promise<AppealRow | null>;
  probeStudentById(id: string): Promise<StudentRow | null>;
  /** DIG-27 — probe дисциплины по коду БЕЗ скоупа группы (только аудит отказа). */
  probeDisciplineByCode(disciplineCode: string): Promise<DisciplineRow | null>;
  /** DIG-28 — probe контрольной сессии по id БЕЗ скоупа группы (только аудит). */
  probeExamById(id: string): Promise<ExamSessionRow | null>;

  // ── requests (owner-scoped) ───────────────────────────────────────────────
  listRequestsByStudent(studentId: string): Promise<ServiceRequestRow[]>;
  findRequestByStudentAndNumber(
    studentId: string,
    number: string,
  ): Promise<ServiceRequestRow | null>;
  findRequestByStudentAndId(studentId: string, id: string): Promise<ServiceRequestRow | null>;
  listRequestEvents(requestId: string): Promise<RequestEventRow[]>;
  /**
   * DIG-28 — заявка, созданная студентом через кабинет (первое событие
   * SUBMITTED пишется тем же вызовом, атомарно с заявкой). Публичный номер
   * генерирует слой данных и передаёт готовым.
   */
  appendRequestByStudent(
    studentId: string,
    input: {
      type: ServiceRequestRow['type'];
      title: string;
      number: string;
      createdAt: Date;
      eventMessage: string;
      actorName: string;
    },
  ): Promise<ServiceRequestRow>;

  // ── grades / notifications / appeals (owner-scoped) ───────────────────────
  listGradesByStudent(studentId: string): Promise<GradeRow[]>;
  listNotificationsByStudent(studentId: string): Promise<NotificationRow[]>;
  markNotificationReadByStudent(studentId: string, id: string): Promise<boolean>;
  listAppealsByStudent(studentId: string): Promise<AppealRow[]>;
  findAppealByStudentAndId(studentId: string, id: string): Promise<AppealRow | null>;
  listAppealMessages(appealId: string): Promise<AppealMessageRow[]>;

  // ── schedule / exams (group-scoped) ───────────────────────────────────────
  listScheduleByGroup(groupName: string): Promise<ScheduleEventRow[]>;
  listExamsByGroup(groupName: string): Promise<ExamSessionRow[]>;

  // ── DIG-25: успеваемость (group-scoped справочники + оценки группы) ──────
  /** Дисциплины группы с кредитами (GPA взвешен кредитами). */
  listDisciplinesByGroup(groupName: string): Promise<DisciplineRow[]>;
  /** Полный план контроля группы: все элементы, включая неоценённые. */
  listDisciplineElementsByGroup(groupName: string): Promise<DisciplineElementRow[]>;
  /**
   * Оценки ВСЕХ студентов группы — только для агрегатов рейтинга внутри
   * слоя данных (наружу идут места/перцентили, не чужие строки).
   */
  listGradesByGroup(groupName: string): Promise<GradeRow[]>;

  // ── DIG-21: schedule by period / notes / staff changes ────────────────────
  /**
   * Пары группы за полуинтервал [from, to) по startsAt, отсортированные по
   * времени. PostgreSQL-адаптер обязан опираться на индекс
   * ScheduleEvent @@index([groupId, startsAt]) / @@index([groupName, date]).
   */
  listScheduleByGroupRange(groupName: string, period: SchedulePeriod): Promise<ScheduleEventRow[]>;
  /** Probe пары по id БЕЗ скоупа группы — только для аудита отказа. */
  probeScheduleEventById(id: string): Promise<ScheduleEventRow | null>;
  /** Патч пары сотрудником (событие изменения). null — пары нет. */
  saveScheduleEventChange(
    eventId: string,
    patch: ScheduleChangePatch,
  ): Promise<ScheduleEventRow | null>;
  /** Студенты группы — для fan-out уведомлений об изменениях расписания. */
  listStudentsByGroup(groupName: string): Promise<StudentRow[]>;

  /** Заметка студента к паре (уникальна по паре студент+пара). */
  findNoteByStudentAndEvent(studentId: string, eventId: string): Promise<StudentNoteRow | null>;
  /** Probe заметки по паре БЕЗ владельца — только для аудита отказа. */
  probeNoteByEvent(eventId: string): Promise<StudentNoteRow | null>;
  /** Upsert заметки: создаёт или обновляет текст (createdAt сохраняется). */
  saveNoteByStudent(
    studentId: string,
    eventId: string,
    input: { text: string; createdAt: Date },
  ): Promise<StudentNoteRow>;
  /** Удаляет СВОЮ заметку к паре; false — заметки нет. */
  deleteNoteByStudent(studentId: string, eventId: string): Promise<boolean>;

  // ── profile & settings (owner-scoped, DIG-19) ────────────────────────────
  /** Own profile read — the id comes from ctx.studentId, never from input. */
  findStudentById(id: string): Promise<StudentRow | null>;
  findSettingsByStudent(studentId: string): Promise<StudentSettingsRow | null>;
  /** Replaces the whole settings row of the student (all-or-nothing row). */
  saveSettingsByStudent(
    studentId: string,
    settings: StudentSettingsRow,
  ): Promise<StudentSettingsRow>;
  updateStudentContacts(studentId: string, input: { email: string }): Promise<StudentRow | null>;
  /**
   * Notification GENERATION entry (DIG-19): appends a row to the student's
   * feed. The suppression by channel matrix lives in profile.ts (business
   * rule), the storage itself stays dumb.
   */
  appendNotificationToStudent(
    studentId: string,
    input: {
      type: NotificationType;
      title: string;
      body: string;
      createdAt: Date;
      /** DIG-21 — путь в кабинете (например, «/schedule» для событий расписания). */
      link?: string | null;
    },
  ): Promise<NotificationRow>;
  /** «Нашли ошибку в данных?» — creates an OPEN appeal + first student message. */
  appendAppealByStudent(
    studentId: string,
    input: { subject: string; message: string; authorName: string; createdAt: Date },
  ): Promise<AppealRow>;

  // ── DIG-29: каталог сервисов — избранное (owner-scoped) ──────────────────
  /** Id закреплённых сервисов студента в порядке закрепления (createdAt). */
  listFavoriteServiceIdsByStudent(studentId: string): Promise<string[]>;
  /** Закрепляет сервис; идемпотентно (повтор — no-op). */
  addFavoriteServiceByStudent(studentId: string, serviceId: string): Promise<void>;
  /** Снимает закрепление; идемпотентно (несуществующее — no-op). */
  removeFavoriteServiceByStudent(studentId: string, serviceId: string): Promise<void>;

  // ── staff scope ───────────────────────────────────────────────────────────
  listStudentsByFaculty(faculty: string): Promise<StudentRow[]>;

  // ── audit (append-only) ───────────────────────────────────────────────────
  appendAudit(
    event: Omit<AuditLogRow, 'id' | 'createdAt'> & { createdAt?: Date },
  ): Promise<AuditLogRow>;
}
