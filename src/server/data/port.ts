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
  CalendarSubscriptionRow,
  CertificateRow,
  CanonicalRequestEventRow,
  CanonicalRequestRow,
  CanonicalRequestTypeRow,  DisciplineElementRow,
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
  /** DIG-34 — дедлайн задания курса и ручная задача студента. */
  StudyDeadlineRow,
  StudentTaskRow,
  TicketMessageRow,
  TicketRow,
  TicketStatus,
  TicketSubject,} from './types';

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
    id: string,
  listCanonicalRequestsByStudent(studentId: string): Promise<CanonicalRequestRow[]>;
  listCanonicalRequestEvents(requestId: string): Promise<CanonicalRequestEventRow[]>;

  /**
   * Атомарное создание: строка заявки + первое событие («Подана» /
   * «Документ сформирован»). id строки и события назначает адаптер.
   * Нарушение UNIQUE номера — ошибка адаптера (приёмка DIG-30).
   */
  insertCanonicalRequest(
    row: Omit<CanonicalRequestRow, 'id'>,
    event: Omit<CanonicalRequestEventRow, 'id' | 'requestId'>,
  ): Promise<CanonicalRequestRow>;
   * Переход статуса: патч строки + событие истории одним вызовом.
   * null — заявки нет (событие не пишется в никуда).
  saveCanonicalRequestStatus(
    requestId: string,
    patch: { status: CanonicalRequestRow['status']; updatedAt: Date },
   * Последняя заявка студента данного типа, созданная позже `createdAfter`
   * (окно повторного заказа DIG-30 — 24 часа). Дубликат — тот же ДОКУМЕНТ:
   * совпадает и тип, и значение ключевого поля формы (keyField/keyValue):
   * справка «для банка» не блокирует заказ «для военкомата».
  findLatestCanonicalRequestByStudentAndType(
    typeCode: string,
    createdAfter: Date,
    keyField?: string | null,
    keyValue?: string | null,
  /** Следующий порядковый номер года (в PostgreSQL — request_number_seq). */
  nextCanonicalRequestSeq(year: number): Promise<number>;
  // ── DIG-39: tickets — обращения с перепиской (owner-scoped) ──────────────
  /** Тикеты владельца, свежие сверху (по updatedAt). */
  listTicketsByStudent(studentId: string): Promise<TicketRow[]>;
  findTicketByStudentAndNumber(studentId: string, number: string): Promise<TicketRow | null>;
   * Обращение + первое сообщение студента пишутся одним вызовом (атомарно,
   * как appendAppealByStudent). Номер генерирует слой данных.
  appendTicketByStudent(
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
   * Сообщение в чат обращения. Одним вызовом обновляется активность тикета
   * (updatedAt = createdAt сообщения) и, если задано, статус/исполнитель
   * (бизнес-правило выбирает deanery.ts). null — тикета нет (defensive).
  appendTicketMessage(
    ticketId: string,
      authorRole: TicketMessageRow['authorRole'];
      status?: TicketStatus;
      assigneeUserId?: string | null;
  ): Promise<TicketMessageRow | null>;
  listTicketMessages(ticketId: string): Promise<TicketMessageRow[]>;
   * Прочтение: сообщения роли authorRole этого тикета получают readAt (там,
   * где ещё null). Вызывается ТОЛЬКО после проверки владельца в deanery.ts.
   *
   * ВНИМАНИЕ (раунд 2 ревью DIG-39): в текущем memory-прототипе это мутирует
   * данные при GET-рендере страницы чата (openTicketChat) — осознанный
   * компромисс до Prisma. При переезде на PostgreSQL (DIG-10/50) перенести
   * в явную мутацию (server action / POST), чтобы GET оставался без
   * побочных эффектов; сигнатуры порта менять не придётся.
   */  markTicketMessagesRead(
    authorRole: TicketMessageRow['authorRole'],
    readAt: Date,
  ): Promise<boolean>;
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

  // ── audit (append-only) ───────────────────────────────────────────────────
  appendAudit(
    event: Omit<AuditLogRow, 'id' | 'createdAt'> & { createdAt?: Date },
  ): Promise<AuditLogRow>;
}
