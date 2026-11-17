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
  AnnouncementRow,
  AuditLogRow,
  CalendarSubscriptionRow,
  CertificateRow,
  CanonicalRequestEventRow,
  CanonicalRequestRow,
  CanonicalRequestTypeRow,
  DisciplineElementRow,
  DisciplineRow,
  ExamSessionRow,
  GradeRow,
  NotificationRow,
  NotificationType,
  RequestEventRow,
  RequestStatus,
  ScheduleEventRow,
  ServiceRequestRow,
  StaffRow,
  StudentNoteRow,
  StudentRow,
  StudentSettingsRow,
  /** DIG-34 — дедлайн задания курса и ручная задача студента. */
  StudyDeadlineRow,
  StudentTaskRow,
  TicketMessageRow,
  TicketRow,
  TicketStatus,
  TicketSubject,
  /** DIG-40 — обратная связь руководству (/feedback). */
  FeedbackKind,
  FeedbackRow,
  FeedbackStatus,
  FeedbackTarget,
  /** DIG-68 — каталог студенческих стартапов «МСП» (/msp). */
  MspCommentRow,
  MspProjectRow,
  MspVoteRow,
  /** DIG-43 — мероприятия вуза и запись (/events). */
  EventRegistrationRow,
  EventRow,  /** DIG-42 — «Дополнительное образование» (/dpo). */
  DpoDocumentRow,
  DpoEnrollmentRow,
  DpoProgramRow,} from './types';

/** DIG-48 — уведомление студенту, записываемое вместе с действием сотрудника. */
export interface StaffNotificationInput {
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
}

/** DIG-48 — смена статуса заявки сотрудником (все поля нужны адаптеру сразу). */
export interface StaffRequestUpdateInput {
  /** Актуальный статус строки (защита от гонки двух сотрудников). */
  from: RequestStatus;
  to: RequestStatus;
  /** Причина доработки/отказа; null — переход без комментария. */
  note: string | null;
  actorName: string;
  eventMessage: string;
  notification: StaffNotificationInput | null;
  now: Date;
}

/** DIG-48 — ответ сотрудника на обращение или «Решено». */
export interface StaffAppealMessageInput {
  authorName: string;
  /** Пустая строка допустима только при resolve=true. */
  body: string;
  resolve: boolean;
  notification: StaffNotificationInput | null;
  now: Date;
}

/** DIG-48 — публикация объявления сотрудником. */
export interface StaffAnnouncementInput {
  groupName: string | null;
  title: string;
  body: string;
  authorLogin: string;
  authorName: string;
  now: Date;
}

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
  // ── DIG-36: новости — отметки «Прочитано» (owner-scoped) ─────────────────
  /** Id прочитанных студентом новостей/объявлений. */
  listNewsReadIdsByStudent(studentId: string): Promise<string[]>;
  /** Ставит отметку «Прочитано»; идемпотентно (повтор — no-op). */
  markNewsReadByStudent(studentId: string, newsId: string): Promise<void>;

  // ── directory (ctx resolution) ────────────────────────────────────────────
  findStudentByLogin(login: string): Promise<StudentRow | null>;
  findStaffByLogin(login: string): Promise<StaffRow | null>;

  // ── existence probes (data-layer internal, see header) ───────────────────
  probeRequestByNumber(number: string): Promise<ServiceRequestRow | null>;
  probeRequestById(id: string): Promise<ServiceRequestRow | null>;
  probeNotificationById(id: string): Promise<NotificationRow | null>;
  probeAppealById(id: string): Promise<AppealRow | null>;
  probeStudentById(id: string): Promise<StudentRow | null>;
  /** DIG-39 — probe тикета по публичному номеру БЕЗ владельца (только аудит). */
  probeTicketByNumber(number: string): Promise<TicketRow | null>;
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

  // ── DIG-30: canonical requests «Заявки и справки» (owner-scoped) ────────
  /** Словарь типов заявок (RequestType): SLA, мгновенность, форма. */
  listCanonicalRequestTypes(): Promise<CanonicalRequestTypeRow[]>;
  findCanonicalRequestTypeByCode(code: string): Promise<CanonicalRequestTypeRow | null>;

  /** Probe по публичному номеру/id БЕЗ владельца — только для аудита отказа. */
  probeCanonicalRequestByNumber(number: string): Promise<CanonicalRequestRow | null>;
  probeCanonicalRequestById(id: string): Promise<CanonicalRequestRow | null>;

  findCanonicalRequestByStudentAndNumber(
    studentId: string,
    number: string,
  ): Promise<CanonicalRequestRow | null>;
  findCanonicalRequestByStudentAndId(
    studentId: string,
    id: string,
  ): Promise<CanonicalRequestRow | null>;
  listCanonicalRequestsByStudent(studentId: string): Promise<CanonicalRequestRow[]>;
  listCanonicalRequestEvents(requestId: string): Promise<CanonicalRequestEventRow[]>;

  /**
   * Атомарное создание: строка заявки + первое событие («Подана» /
   * «Документ сформирован»). id строки и события назначает адаптер.

  /**
   * Атомарное создание: строка заявки + первое событие («Подана» /
   * «Документ сформирован»). id строки и события назначает адаптер.
   * Нарушение UNIQUE номера — ошибка адаптера (приёмка DIG-30).
   */
  insertCanonicalRequest(
    row: Omit<CanonicalRequestRow, 'id'>,
    event: Omit<CanonicalRequestEventRow, 'id' | 'requestId'>,
  ): Promise<CanonicalRequestRow>;
  /**
   * Переход статуса: патч строки + событие истории одним вызовом.
   * null — заявки нет (событие не пишется в никуда).
   */
  saveCanonicalRequestStatus(
    requestId: string,
    patch: { status: CanonicalRequestRow['status']; updatedAt: Date },
    event: Omit<CanonicalRequestEventRow, 'id' | 'requestId'>,
  ): Promise<CanonicalRequestRow | null>;
  /**
   * Последняя заявка студента данного типа, созданная позже `createdAfter`
   * (окно повторного заказа DIG-30 — 24 часа). Дубликат — тот же ДОКУМЕНТ:
   * совпадает и тип, и значение ключевого поля формы (keyField/keyValue):
   * справка «для банка» не блокирует заказ «для военкомата».
   */
  findLatestCanonicalRequestByStudentAndType(
    studentId: string,
    typeCode: string,
    createdAfter: Date,
    keyField?: string | null,
    keyValue?: string | null,
  ): Promise<CanonicalRequestRow | null>;
  /** Следующий порядковый номер года (в PostgreSQL — request_number_seq). */
  nextCanonicalRequestSeq(year: number): Promise<number>;

  // ── grades / notifications / appeals (owner-scoped) ───────────────────────
  listGradesByStudent(studentId: string): Promise<GradeRow[]>;
  listNotificationsByStudent(studentId: string): Promise<NotificationRow[]>;
  // ── DIG-39: tickets — обращения с перепиской (owner-scoped) ──────────────
  /** Тикеты владельца, свежие сверху (по updatedAt). */
  listTicketsByStudent(studentId: string): Promise<TicketRow[]>;
  findTicketByStudentAndNumber(studentId: string, number: string): Promise<TicketRow | null>;
  /**
   * Обращение + первое сообщение студента пишутся одним вызовом (атомарно,
   * как appendAppealByStudent). Номер генерирует слой данных.
   */
  appendTicketByStudent(
    studentId: string,
    input: {
      number: string;
      subject: TicketSubject;
      body: string;
      attachments: string[];
      authorName: string;
      requestNumber: string | null;
      disciplineCode: string | null;
      createdAt: Date;
    },
  ): Promise<TicketRow>;
  /**
   * Сообщение в чат обращения. Одним вызовом обновляется активность тикета
   * (updatedAt = createdAt сообщения) и, если задано, статус/исполнитель
   * (бизнес-правило выбирает deanery.ts). null — тикета нет (defensive).
   */
  appendTicketMessage(
    ticketId: string,
    input: {
      authorRole: TicketMessageRow['authorRole'];
      authorName: string;
      body: string;
      attachments: string[];
      createdAt: Date;
      status?: TicketStatus;
      assigneeUserId?: string | null;
    },
  ): Promise<TicketMessageRow | null>;
  listTicketMessages(ticketId: string): Promise<TicketMessageRow[]>;
  /**
   * Прочтение: сообщения роли authorRole этого тикета получают readAt (там,
   * где ещё null). Вызывается ТОЛЬКО после проверки владельца в deanery.ts.
   *
   * ВНИМАНИЕ (раунд 2 ревью DIG-39): в текущем memory-прототипе это мутирует
   * данные при GET-рендере страницы чата (openTicketChat) — осознанный
   * компромисс до Prisma. При переезде на PostgreSQL (DIG-10/50) перенести
   * в явную мутацию (server action / POST), чтобы GET оставался без
   * мутаций (замечание раунда 2 ревью DIG-39).
   */
  /**
   * Прочтение: сообщения роли authorRole этого тикета получают readAt (там,
   * где ещё null). Отмечает их прочитанными одним вызовом адаптера; без
   * побочных эффектов; сигнатуры порта менять не придётся.
   */
  markTicketMessagesRead(
    ticketId: string,
    authorRole: TicketMessageRow['authorRole'],
    readAt: Date,
  ): Promise<boolean>;

  // ── DIG-40: feedback — предложения/жалобы руководству (/feedback) ────────
  /**
   * Подписанные обращения владельца, свежие сверху. Анонимные строки
   * (studentId = null) не попадают ни в чей список — у них нет владельца.
   */
  listFeedbackByStudent(studentId: string): Promise<FeedbackRow[]>;
  /**
   * Публичная лента решённых предложений («Что мы изменили по вашим
   * предложениям») — ОСОЗНАННОЕ исключение из owner-scope по образцу
   * findCertificateByCode: лента по определению общая, наружу из слоя
   * данных уходит только представление без автора (см. feedback.ts),
   * вызывать разрешено ТОЛЬКО getFeedbackPage.
   */
  listPublishedFeedbackOutcomes(): Promise<FeedbackRow[]>;
  findFeedbackByStudentAndNumber(studentId: string, number: string): Promise<FeedbackRow | null>;
  /** DIG-40 — probe по публичному номеру БЕЗ владельца (только аудит). */
  probeFeedbackByNumber(number: string): Promise<FeedbackRow | null>;
  /**
   * Создание обращения: `studentId = null` — анонимное (НИКАКАЯ связь с
   * пользователем не записывается). Номер и срок ответа передаёт слой
   * данных; id назначает адаптер.
   */
  appendFeedbackByStudent(
    studentId: string | null,
    input: {
      number: string;
      kind: FeedbackKind;
      target: FeedbackTarget;
      status: FeedbackStatus;
      text: string;
      attachments: string[];
      isAnonymous: boolean;
      dueAt: Date;
      createdAt: Date;
    },
  ): Promise<FeedbackRow>;

  // ── grades / notifications / appeals (owner-scoped) ───────────────────────
  listGradesByStudent(studentId: string): Promise<GradeRow[]>;
  listNotificationsByStudent(studentId: string): Promise<NotificationRow[]>;
  markNotificationReadByStudent(studentId: string, id: string): Promise<boolean>;
  /** DIG-35 — число непрочитанных владельца (счётчик колокольчика). */
  countUnreadNotificationsByStudent(studentId: string): Promise<number>;
  /** DIG-35 — «Отметить все прочитанными»; возвращает число изменённых строк. */
  markAllNotificationsReadByStudent(studentId: string): Promise<number>;
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

  // ── DIG-34: задачи студента (group-scoped дедлайны + owner-scoped ручные) ─
  /** Дедлайны заданий группы из системы курсов (в концепте — сиды). */
  listStudyDeadlinesByGroup(groupName: string): Promise<StudyDeadlineRow[]>;
  /** Ручные задачи владельца (включая отмеченные — фильтрация на слое выше). */
  listStudentTasksByStudent(studentId: string): Promise<StudentTaskRow[]>;
  /** Probe ручной задачи по id БЕЗ владельца — только для аудита отказа. */
  probeStudentTaskById(taskId: string): Promise<StudentTaskRow | null>;
  /** Отмечает СВОЮ ручную задачу выполненной; null — задачи нет/чужая. */
  markStudentTaskDoneByStudent(
    studentId: string,
    taskId: string,
    doneAt: Date,
  ): Promise<StudentTaskRow | null>;

  // ── DIG-47: реестр справок и публичная проверка подлинности ──────────────
  /**
   * Публичный поиск по коду проверки — ОСОЗНАННОЕ исключение из
   * owner-scope: страница /verify/<код> по определению работает без
   * входа, а код несёт 160 бит энтропии. Вызов разрешён ТОЛЬКО
   * certificates.ts, который отдаёт наружу публичное представление без
   * studentId и полного имени; любые другие употребления запрещены.
   */
  findCertificateByCode(code: string): Promise<CertificateRow | null>;
  /** Справка заявки владельца (find-or-create опирается на этот поиск). */
  findCertificateByStudentAndRequestId(
    studentId: string,
    requestId: string,
  ): Promise<CertificateRow | null>;
  /**
   * DIG-64 — поиск студента по SHA-256-хэшу персонального MCP-токена —
   * ОСОЗНАННОЕ исключение из owner-scope, как findCertificateByCode выше:
   * lookup возможен только по хэшу случайного токена с ≥128 битами
   * энтропии, а вызывать его разрешено ТОЛЬКО resolveMcpDemoToken из
   * src/server/data/mcp.ts, который тут же превращает результат в
   * скоупленный DataCtx владельца. Наружу из слоя данных студенческие поля
   * не уходят; userId берётся из записи токена (для аудита).
   */
  findStudentByMcpTokenHash(
    tokenHash: string,
  ): Promise<{ student: StudentRow; userId: string } | null>;
  /**
   * Выдача справки владельцу: код/номер генерирует вызывающий
   * (certificates.ts), адаптер обязан записать строку атомарно.
   */
  appendCertificateForStudent(studentId: string, input: CertificateRow): Promise<CertificateRow>;
  /**
   * Отзыв сотрудником факультета: адаптер сам присоединяет студента и
   * проверяет faculty; чужой/несуществующий код → null. Повторный отзыв
   * идемпотентен (revokedAt не перезаписывается).
   */
  revokeCertificateByStaff(
    faculty: string,
    code: string,
    input: { revokedAt: Date; reason: string | null },
  ): Promise<CertificateRow | null>;

  // ── DIG-63: живая ICS-подписка расписания и дедлайнов ────────────────────
  /** Активная подписка владельца (строка одна на студента). */
  findCalendarSubscriptionByStudent(studentId: string): Promise<CalendarSubscriptionRow | null>;
  /**
   * Поиск подписки по tokenId БЕЗ скоупа — осознанное исключение из
   * owner-scope по образцу findCertificateByCode: публичный фид по
   * определению читает без входа, а tokenId несёт 128 бит энтропии и
   * HMAC-подпись (проверяется в calendar.ts до этого вызова). Наружу из
   * слоя данных уходит только представление без studentId (см. calendar.ts);
   * любые другие употребления запрещены.
   */
  findCalendarSubscriptionByTokenId(tokenId: string): Promise<CalendarSubscriptionRow | null>;
  /** Upsert подписки владельца: один tokenId на строку (активная ссылка). */
  saveCalendarSubscriptionForStudent(
    studentId: string,
    input: { tokenId: string; createdAt: Date; rotatedAt: Date | null },
  ): Promise<CalendarSubscriptionRow>;
  /** Отзыв владельцем (ротация в кабинете); false — подписки нет. */
  deleteCalendarSubscriptionByStudent(studentId: string): Promise<boolean>;
  /**
   * Отзыв по логину владельца — контракт выхода из кабинета (login приходит
   * из живой сессии в server action, никогда не из ввода). false — у
   * логина нет студента или активной подписки.
   */
  deleteCalendarSubscriptionByLogin(login: string): Promise<boolean>;

  // ── staff scope ───────────────────────────────────────────────────────────
  listStudentsByFaculty(faculty: string): Promise<StudentRow[]>;

  // ── DIG-48: кабинет сотрудника (faculty-scoped, см. staff-workflow.ts) ────
  /** Все заявки студентов факультета, свежие первыми. */
  listRequestsByFaculty(faculty: string): Promise<ServiceRequestRow[]>;
  /**
   * Смена статуса сотрудником факультета: адаптер проверяет факультет
   * владельца и актуальность статуса (from), обновляет строку, дописывает
   * событие истории и уведомление студенту АТОМАРНО (один вызов — Prisma-
   * адаптер обязан использовать транзакцию). null — заявки нет, чужой
   * факультет или статус уже изменился (гонка).
   */
  updateRequestByStaff(
    faculty: string,
    number: string,
    input: StaffRequestUpdateInput,
  ): Promise<ServiceRequestRow | null>;
  /** Все обращения студентов факультета, свежие первыми. */
  listAppealsByFaculty(faculty: string): Promise<AppealRow[]>;
  /** Обращение студента факультета; null — нет или чужой факультет. */
  findAppealByFacultyAndId(faculty: string, appealId: string): Promise<AppealRow | null>;
  /**
   * Ответ сотрудника (resolve=false → ANSWERED) или «Решено» (true →
   * CLOSED): сообщение от сотрудника + смена статуса + уведомление
   * студенту — атомарно. null — обращения нет или чужой факультет.
   */
  appendAppealMessageByStaff(
    faculty: string,
    appealId: string,
    input: StaffAppealMessageInput,
  ): Promise<AppealRow | null>;
  /** Объявления факультета, свежие первыми. */
  listAnnouncementsByFaculty(faculty: string): Promise<AnnouncementRow[]>;
  /** Публикация объявления сотрудником факультета (группа НЕ проверяется — см. staff-workflow). */
  appendAnnouncementByStaff(
    faculty: string,
    input: StaffAnnouncementInput,
  ): Promise<AnnouncementRow>;

  // ── DIG-68: каталог студенческих стартапов «МСП» (/msp) ──────────────────
  /**
   * Весь каталог проектов — лента /msp по определению общая для
   * авторизованных (осознанное исключение из owner-scope, как
   * listPublishedFeedbackOutcomes: вход и роль проверяет msp.ts до вызова,
   * карточка проекта не содержит ничего сверх публичного запуска).
   */
  listMspProjects(): Promise<MspProjectRow[]>;
  /**
   * Все голоса каталога — только вход агрегатов (счётчики по проектам в
   * msp.ts), по образцу listGradesByGroup: наружу из слоя данных уходят
   * числа, не чужие строки.
   */
  listMspVotes(): Promise<MspVoteRow[]>;
  /** Голоса владельца (отметка «уже голосовал» в ленте и на карточке). */
  listMspVotesByStudent(studentId: string): Promise<MspVoteRow[]>;
  /**
   * Переключение голоса владельца: голос → повторный вызов снимает
   * (UNIQUE пары проект+студент, дубликат строки невозможен — строка
   * либо создаётся, либо удаляется). null — проекта не существует:
   * голосование только по существующему проекту.
   */
  toggleMspVote(
    studentId: string,
    projectId: string,
  ): Promise<{ voted: boolean; votes: number } | null>;
  /** Комментарии проекта, старые сверху. */
  listMspCommentsByProject(projectId: string): Promise<MspCommentRow[]>;
  /**
   * Комментарий владельца к проекту. null — проекта нет: комментарий
   * возможен только к существующему проекту.
   */
  appendMspComment(
    studentId: string,
    projectId: string,
    input: { authorName: string; body: string; createdAt: Date },
  ): Promise<MspCommentRow | null>;
  /**
   * Публикация запуска владельцем. Slug генерирует слой данных
   * (msp-slug.ts: детерминированный транслит заголовка + суффикс, занятые
   * slug'и учтены вызывающим); дубль slug — сбой генерации (UNIQUE).
   */
  createMspProject(
    studentId: string,
    input: {
      slug: string;
      title: string;
      tagline: string;
      description: string;
      tags: string[];
      authorName: string;
      letter: string;
      createdAt: Date;
    },
  ): Promise<MspProjectRow>;

  // ── DIG-43: мероприятия вуза и запись (/events) ──────────────────────────
  /**
   * Вся афиша мероприятий — каталог по определению общий для
   * авторизованных (осознанное исключение из owner-scope по образцу
   * listMspProjects: вход проверяет events.ts до вызова, карточка
   * события не содержит ничего сверх самой афиши). `from` — нижняя
   * граница даты (undefined — все, включая прошедшие); результат
   * отсортирован по startsAt по возрастанию (ties — по slug).
   */
  listEventsByRange(from?: Date): Promise<EventRow[]>;
  /** Записи владельца (чип «Записан» и отметка на карточке события). */
  listEventRegistrationsByStudent(studentId: string): Promise<EventRegistrationRow[]>;
  /**
   * Переключение записи владельца: запись → повторный вызов отменяет
   * (UNIQUE пара мероприятие+студент, дубликат строки невозможен — строка
   * либо создаётся, либо удаляется). null — мероприятия не существует.
   * Когда мест не осталось (занято ≥ capacity) запись НЕ создаётся:
   * { registered: false, taken } — слой событий превращает это в отказ
   * «Мест нет» (кнопка на экране при нуле мест disabled).
   */
  toggleEventRegistration(
    studentId: string,
    eventId: string,
  ): Promise<{ registered: boolean; taken: number } | null>;
  /**
   * Сколько студентов записано на мероприятие (агрегат: наружу из слоя
   * данных уходит число, не чужие строки — по образцу listMspVotes).
   */
  listEventAttendeeCount(eventId: string): Promise<number>;  // ── DIG-42: «Дополнительное образование» (/dpo) ──────────────────────────
  /**
   * Весь каталог программ ДПО — публичный контент (чтение — любой
   * вошедний, осознанное исключение из owner-scope, как listMspProjects:
   * вход проверяет dpo.ts до вызова, программа не содержит персональных
   * данных).
   */
  listDpoPrograms(): Promise<DpoProgramRow[]>;
  /** Записи владельца на программы ДПО (вкладка «Мои программы»). */
  listDpoEnrollmentsByStudent(studentId: string): Promise<DpoEnrollmentRow[]>;
  /**
   * Запись владельца на существующую программу. null — программы нет или
   * владелец уже записан (UNIQUE пара программа+студент): дубликат строки
   * невозможен.
   */
  enrollDpo(studentId: string, programId: string): Promise<DpoEnrollmentRow | null>;
  /** Документы ДПО владельца (договор/акт/квитанция/сертификат). */
  listDpoDocumentsByStudent(studentId: string): Promise<DpoDocumentRow[]>;
  // ── audit (append-only) ───────────────────────────────────────────────────
  appendAudit(
    event: Omit<AuditLogRow, 'id' | 'createdAt'> & { createdAt?: Date },
  ): Promise<AuditLogRow>;
}
