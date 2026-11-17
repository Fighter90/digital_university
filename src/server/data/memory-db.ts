// DIG-12 — in-memory adapter of the data port.
//
// Serves two purposes until the Prisma schema branch (DIG-10) is merged and
// PostgreSQL is wired:
//  - unit tests seed exact fixtures via `seed()` and assert isolation;
//  - the running prototype (jury demo) holds the fictional demo dataset.
// Swapping to PostgreSQL later is a one-line change in src/server/data/db.ts:
// a Prisma adapter implements the very same `DataDb` signatures.

import type {
  DataDb,
  ScheduleChangePatch,
  SchedulePeriod,
  StaffAnnouncementInput,
  StaffAppealMessageInput,
  StaffRequestUpdateInput,
} from './port';
import type {
  AppealMessageRow,
  AppealRow,
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
  NewsReadRow,
  RequestEventRow,
  ScheduleEventRow,
  ServiceRequestRow,
  StaffRow,
  StudentNoteRow,
  StudentRow,
  StudentSettingsRow,
  ServiceFavoriteRow,
  StudyDeadlineRow,
  StudentTaskRow,
  TicketMessageRow,
  TicketRow,
  AnnouncementRow /** DIG-40 — обратная связь руководству (/feedback). */,
  FeedbackRow,
  /** DIG-68 — каталог студенческих стартапов «МСП» (/msp). */
  MspCommentRow,
  MspProjectRow,
  MspVoteRow,
  /** DIG-42 — «Дополнительное образование» (/dpo). */
  DpoDocumentRow,
  DpoEnrollmentRow,
  DpoProgramRow,
} from './types';
import { canonicalRequestNumberSeq } from './canonical-request-number';
export interface MemorySeed {
  students?: StudentRow[];
  staff?: StaffRow[];
  requests?: ServiceRequestRow[];
  requestEvents?: RequestEventRow[];
  /** DIG-30 — канонические заявки «Заявки и справки» (номера ЗД-…). */
  canonicalRequestTypes?: CanonicalRequestTypeRow[];
  canonicalRequests?: CanonicalRequestRow[];
  canonicalRequestEvents?: CanonicalRequestEventRow[];
  grades?: GradeRow[];
  notifications?: NotificationRow[];
  /** DIG-36 — отметки «Прочитано» новостей/объявлений. */
  newsRead?: NewsReadRow[];
  appeals?: AppealRow[];
  appealMessages?: AppealMessageRow[];
  /** DIG-39 — обращения с перепиской. */
  tickets?: TicketRow[];
  ticketMessages?: TicketMessageRow[];
  /** DIG-40 — обратная связь руководству (включая анонимные и ленту). */
  feedback?: FeedbackRow[];
  schedule?: ScheduleEventRow[];
  exams?: ExamSessionRow[];
  /** DIG-19 — per-student profile settings (contacts visibility, channels, theme). */
  settings?: StudentSettingsRow[];
  /** DIG-21 — заметки студентов к парам расписания. */
  notes?: StudentNoteRow[];
  /** DIG-25 — справочник дисциплин группы (кредиты) и план контроля. */
  disciplines?: DisciplineRow[];
  elements?: DisciplineElementRow[];
  /** DIG-29 — закреплённые студентом сервисы каталога. */
  serviceFavorites?: ServiceFavoriteRow[];
  /** DIG-34 — дедлайны заданий группы (система курсов, в концепте — сиды). */
  studyDeadlines?: StudyDeadlineRow[];
  /** DIG-34 — ручные задачи студентов (подписать/оплатить…). */
  studentTasks?: StudentTaskRow[];
  /** DIG-47 — реестр выданных справок (проверка подлинности по коду). */
  certificates?: CertificateRow[];
  /** DIG-63 — активные ICS-подписки студентов (одна на студента). */
  calendarSubscriptions?: CalendarSubscriptionRow[]; /** DIG-48 — объявления сотрудников деканата. */
  announcements?: AnnouncementRow[];
  /** DIG-68 — проекты каталога «МСП» (студенческие стартапы). */
  mspProjects?: MspProjectRow[];
  /** DIG-68 — голоса студентов за проекты (UNIQUE пары проект+студент). */
  mspVotes?: MspVoteRow[];
  /** DIG-68 — комментарии к проектам каталога. */
  mspComments?: MspCommentRow[];
  /** DIG-42 — программы каталога «Дополнительное образование» (/dpo). */
  dpoPrograms?: DpoProgramRow[];
  /** DIG-42 — записи студентов на программы (UNIQUE пары программа+студент). */
  dpoEnrollments?: DpoEnrollmentRow[];
  /** DIG-42 — документы студентов по программам ДПО. */
  dpoDocuments?: DpoDocumentRow[];
}

export interface MemoryDataDb extends DataDb {
  /** Test/demo helper: replaces the whole dataset (never called in pages). */
  seed(seed: MemorySeed): void;
  /** Test-only: live audit log for isolation assertions. */
  auditEvents(): AuditLogRow[];
}

const clone = <T>(row: T): T => structuredClone(row);

export function createMemoryDataDb(): MemoryDataDb {
  let students: StudentRow[] = [];
  let staff: StaffRow[] = [];
  let requests: ServiceRequestRow[] = [];
  let requestEvents: RequestEventRow[] = [];
  let canonicalRequestTypes: CanonicalRequestTypeRow[] = [];
  let canonicalRequests: CanonicalRequestRow[] = [];
  let canonicalRequestEvents: CanonicalRequestEventRow[] = [];
  let grades: GradeRow[] = [];
  let notifications: NotificationRow[] = [];
  let appeals: AppealRow[] = [];
  let appealMessages: AppealMessageRow[] = [];
  let tickets: TicketRow[] = [];
  let ticketMessages: TicketMessageRow[] = [];
  let feedbacks: FeedbackRow[] = [];
  let schedule: ScheduleEventRow[] = [];
  let exams: ExamSessionRow[] = [];
  let disciplines: DisciplineRow[] = [];
  let elements: DisciplineElementRow[] = [];
  let settings: StudentSettingsRow[] = [];
  let notes: StudentNoteRow[] = [];
  let serviceFavorites: ServiceFavoriteRow[] = [];
  let studyDeadlines: StudyDeadlineRow[] = [];
  let studentTasks: StudentTaskRow[] = [];
  let certificates: CertificateRow[] = [];
  let calendarSubscriptions: CalendarSubscriptionRow[] = [];
  let newsRead: NewsReadRow[] = [];
  let announcements: AnnouncementRow[] = [];
  let mspProjects: MspProjectRow[] = [];
  let mspVotes: MspVoteRow[] = [];
  let mspComments: MspCommentRow[] = [];
  // DIG-42 — «Дополнительное образование» (/dpo).
  let dpoPrograms: DpoProgramRow[] = [];
  let dpoEnrollments: DpoEnrollmentRow[] = [];
  let dpoDocuments: DpoDocumentRow[] = [];
  let audit: AuditLogRow[] = [];
  let auditSeq = 0;
  let notificationSeq = 0;
  let appealSeq = 0;
  let appealMessageSeq = 0;
  let ticketSeq = 0;
  let ticketMessageSeq = 0;
  let feedbackSeq = 0;
  let noteSeq = 0;
  let requestSeq = 0;
  let requestEventSeq = 0;
  let certificateSeq = 0;
  let canonicalRequestSeq = 0;
  let canonicalEventSeq = 0;
  let announcementSeq = 0;
  let mspProjectSeq = 0;
  let mspCommentSeq = 0;
  const by = <T, K extends keyof T>(rows: T[], key: K, value: T[K]) =>
    rows.find((row) => row[key] === value) ?? null;

  return {
    seed(seed: MemorySeed) {
      students = seed.students ? seed.students.map(clone) : [];
      staff = seed.staff ? seed.staff.map(clone) : [];
      requests = seed.requests ? seed.requests.map(clone) : [];
      requestEvents = seed.requestEvents ? seed.requestEvents.map(clone) : [];
      canonicalRequestTypes = seed.canonicalRequestTypes
        ? seed.canonicalRequestTypes.map(clone)
        : [];
      canonicalRequests = seed.canonicalRequests ? seed.canonicalRequests.map(clone) : [];
      canonicalRequestEvents = seed.canonicalRequestEvents
        ? seed.canonicalRequestEvents.map(clone)
        : [];
      grades = seed.grades ? seed.grades.map(clone) : [];
      notifications = seed.notifications ? seed.notifications.map(clone) : [];
      appeals = seed.appeals ? seed.appeals.map(clone) : [];
      appealMessages = seed.appealMessages ? seed.appealMessages.map(clone) : [];
      tickets = seed.tickets ? seed.tickets.map(clone) : [];
      ticketMessages = seed.ticketMessages ? seed.ticketMessages.map(clone) : [];
      feedbacks = seed.feedback ? seed.feedback.map(clone) : [];
      schedule = seed.schedule ? seed.schedule.map(clone) : [];
      exams = seed.exams ? seed.exams.map(clone) : [];
      disciplines = seed.disciplines ? seed.disciplines.map(clone) : [];
      elements = seed.elements ? seed.elements.map(clone) : [];
      settings = seed.settings ? seed.settings.map(clone) : [];
      notes = seed.notes ? seed.notes.map(clone) : [];
      serviceFavorites = seed.serviceFavorites ? seed.serviceFavorites.map(clone) : [];
      studyDeadlines = seed.studyDeadlines ? seed.studyDeadlines.map(clone) : [];
      studentTasks = seed.studentTasks ? seed.studentTasks.map(clone) : [];
      certificates = seed.certificates ? seed.certificates.map(clone) : [];
      calendarSubscriptions = seed.calendarSubscriptions
        ? seed.calendarSubscriptions.map(clone)
        : [];
      newsRead = seed.newsRead ? seed.newsRead.map(clone) : [];
      announcements = seed.announcements ? seed.announcements.map(clone) : [];
      mspProjects = seed.mspProjects ? seed.mspProjects.map(clone) : [];
      mspVotes = seed.mspVotes ? seed.mspVotes.map(clone) : [];
      mspComments = seed.mspComments ? seed.mspComments.map(clone) : [];
      // DIG-42 — «Дополнительное образование» (/dpo).
      dpoPrograms = seed.dpoPrograms ? seed.dpoPrograms.map(clone) : [];
      dpoEnrollments = seed.dpoEnrollments ? seed.dpoEnrollments.map(clone) : [];
      dpoDocuments = seed.dpoDocuments ? seed.dpoDocuments.map(clone) : [];
      audit = [];
    },

    auditEvents() {
      return audit;
    },

    async findStudentByLogin(login) {
      return clone(by(students, 'login', login));
    },
    async findStaffByLogin(login) {
      return clone(by(staff, 'login', login));
    },

    async probeRequestByNumber(number) {
      return clone(by(requests, 'number', number));
    },
    async probeRequestById(id) {
      return clone(by(requests, 'id', id));
    },
    async probeNotificationById(id) {
      return clone(by(notifications, 'id', id));
    },
    async probeAppealById(id) {
      return clone(by(appeals, 'id', id));
    },
    // DIG-39 — probe тикета по публичному номеру без владельца: различение
    // «чужой» (OWNERSHIP_DENIED) и «несуществующий» (NOT_FOUND) — только для
    // аудита; наружу из слоя данных в обоих случаях уходит null.
    async probeTicketByNumber(number) {
      return clone(by(tickets, 'number', number));
    },
    async probeStudentById(id) {
      return clone(by(students, 'id', id));
    },
    // DIG-28 — probe контрольной по id без скоупа группы: различение
    // «чужая» (OWNERSHIP_DENIED) и «несуществующая» (NOT_FOUND) — только
    // для аудита; наружу из слоя данных в обоих случаях уходит null.
    async probeExamById(id) {
      return clone(by(exams, 'id', id));
    },
    // DIG-27 — probe дисциплины по коду без скоупа группы: различение
    // «чужая» (OWNERSHIP_DENIED) и «несуществующая» (NOT_FOUND) — только
    // для аудита; наружу из слоя данных в обоих случаях уходит null.
    async probeDisciplineByCode(disciplineCode) {
      return clone(by(disciplines, 'disciplineCode', disciplineCode));
    },

    // ── DIG-19: profile & settings (owner-scoped) ──────────────────────────
    async findStudentById(id) {
      return clone(by(students, 'id', id));
    },
    async findSettingsByStudent(studentId) {
      return clone(by(settings, 'studentId', studentId));
    },
    async saveSettingsByStudent(studentId, next) {
      const row: StudentSettingsRow = { ...clone(next), studentId };
      const index = settings.findIndex((s) => s.studentId === studentId);
      if (index === -1) {
        settings.push(row);
      } else {
        settings[index] = row;
      }
      return clone(row);
    },
    async updateStudentContacts(studentId, input) {
      const row = students.find((s) => s.id === studentId);
      if (!row) return null;
      row.email = input.email;
      return clone(row);
    },
    async appendNotificationToStudent(studentId, input) {
      notificationSeq += 1;
      const row: NotificationRow = {
        id: `ntf-gen-${notificationSeq}`,
        studentId,
        type: input.type,
        title: input.title,
        body: input.body,
        link: input.link ?? null,
        isRead: false,
        createdAt: input.createdAt,
      };
      notifications.push(row);
      return clone(row);
    },
    async appendAppealByStudent(studentId, input) {
      appealSeq += 1;
      const row: AppealRow = {
        id: `apl-new-${appealSeq}`,
        studentId,
        subject: input.subject,
        status: 'OPEN',
        createdAt: input.createdAt,
      };
      appeals.push(row);
      appealMessageSeq += 1;
      appealMessages.push({
        id: `msg-new-${appealMessageSeq}`,
        appealId: row.id,
        authorRole: 'STUDENT',
        authorName: input.authorName,
        body: input.message,
        createdAt: input.createdAt,
      });
      return clone(row);
    },

    async listRequestsByStudent(studentId) {
      return requests.filter((r) => r.studentId === studentId).map(clone);
    },
    async findRequestByStudentAndNumber(studentId, number) {
      return clone(
        requests.find((r) => r.studentId === studentId && r.number === number) ?? null,
      ) as ServiceRequestRow | null;
    },
    async findRequestByStudentAndId(studentId, id) {
      return clone(
        requests.find((r) => r.studentId === studentId && r.id === id) ?? null,
      ) as ServiceRequestRow | null;
    },
    async listRequestEvents(requestId) {
      return requestEvents.filter((e) => e.requestId === requestId).map(clone);
    },
    // DIG-28 — заявка из кабинета: строка заявки + первое событие SUBMITTED
    // пишутся вместе (как appendAppealByStudent — атомарно в адаптере).
    async appendRequestByStudent(studentId, input) {
      requestSeq += 1;
      const row: ServiceRequestRow = {
        id: `req-new-${requestSeq}`,
        studentId,
        number: input.number,
        type: input.type,
        title: input.title,
        status: 'SUBMITTED',
        assignee: null,
        resultNote: null,
        createdAt: input.createdAt,
        updatedAt: input.createdAt,
      };
      requests.push(row);
      requestEventSeq += 1;
      requestEvents.push({
        id: `reqevt-new-${requestEventSeq}`,
        requestId: row.id,
        actorRole: 'STUDENT',
        actorName: input.actorName,
        statusFrom: null,
        statusTo: 'SUBMITTED',
        message: input.eventMessage,
        createdAt: input.createdAt,
      });
      return clone(row);
    },

    // ── DIG-30: canonical requests «Заявки и справки» (owner-scoped) ──────
    async listCanonicalRequestTypes() {
      return canonicalRequestTypes.map(clone);
    },
    async findCanonicalRequestTypeByCode(code) {
      return clone(by(canonicalRequestTypes, 'code', code));
    },
    async probeCanonicalRequestByNumber(number) {
      return clone(by(canonicalRequests, 'number', number));
    },
    async probeCanonicalRequestById(id) {
      return clone(by(canonicalRequests, 'id', id));
    },
    async findCanonicalRequestByStudentAndNumber(studentId, number) {
      return clone(
        canonicalRequests.find((r) => r.studentId === studentId && r.number === number) ?? null,
      );
    },
    async findCanonicalRequestByStudentAndId(studentId, id) {
      return clone(canonicalRequests.find((r) => r.studentId === studentId && r.id === id) ?? null);
    },
    async listCanonicalRequestsByStudent(studentId) {
      return canonicalRequests
        .filter((r) => r.studentId === studentId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map(clone);
    },
    async listCanonicalRequestEvents(requestId) {
      return canonicalRequestEvents
        .filter((e) => e.requestId === requestId)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map(clone);
    },
    async insertCanonicalRequest(row, event) {
      if (by(canonicalRequests, 'number', row.number)) {
        // UNIQUE «number» из миграции DIG-9: дубль номера — сбой хранения.
        throw new Error('duplicate canonical request number');
      }
      canonicalRequestSeq += 1;
      const created: CanonicalRequestRow = { ...clone(row), id: `creq-${canonicalRequestSeq}` };
      canonicalRequests.push(created);
      canonicalEventSeq += 1;
      canonicalRequestEvents.push({
        ...clone(event),
        id: `cev-${canonicalEventSeq}`,
        requestId: created.id,
      });
      return clone(created);
    },
    async saveCanonicalRequestStatus(requestId, patch, event) {
      const row = canonicalRequests.find((r) => r.id === requestId);
      if (!row) return null;
      row.status = patch.status;
      row.updatedAt = patch.updatedAt;
      canonicalEventSeq += 1;
      canonicalRequestEvents.push({
        ...clone(event),
        id: `cev-${canonicalEventSeq}`,
        requestId,
      });
      return clone(row);
    },
    async findLatestCanonicalRequestByStudentAndType(
      studentId,
      typeCode,
      createdAfter,
      keyField,
      keyValue,
    ) {
      const candidates = canonicalRequests
        .filter(
          (r) =>
            r.studentId === studentId &&
            r.typeCode === typeCode &&
            r.createdAt.getTime() >= createdAfter.getTime() &&
            // Дубликат = тот же документ: совпадает и ключевой параметр.
            (keyField == null || (r.params[keyField] ?? '') === (keyValue ?? '')),
        )
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return candidates.length > 0 ? clone(candidates[0]!) : null;
    },
    async nextCanonicalRequestSeq(year) {
      const prefix = `ЗД-${year}-`;
      let max = 0;
      for (const row of canonicalRequests) {
        if (!row.number.startsWith(prefix)) continue;
        const seq = canonicalRequestNumberSeq(row.number);
        if (seq !== null && seq > max) max = seq;
      }
      return max + 1;
    },

    async listGradesByStudent(studentId) {
      return grades.filter((g) => g.studentId === studentId).map(clone);
    },

    async listNotificationsByStudent(studentId) {
      return notifications.filter((n) => n.studentId === studentId).map(clone);
    },
    async markNotificationReadByStudent(studentId, id) {
      const row = notifications.find((n) => n.studentId === studentId && n.id === id);
      if (!row) return false;
      row.isRead = true;
      return true;
    },
    async countUnreadNotificationsByStudent(studentId) {
      return notifications.filter((n) => n.studentId === studentId && !n.isRead).length;
    },
    async markAllNotificationsReadByStudent(studentId) {
      let marked = 0;
      for (const row of notifications) {
        if (row.studentId === studentId && !row.isRead) {
          row.isRead = true;
          marked += 1;
        }
      }
      return marked;
    },

    async listAppealsByStudent(studentId) {
      return appeals.filter((a) => a.studentId === studentId).map(clone);
    },
    async findAppealByStudentAndId(studentId, id) {
      return clone(
        appeals.find((a) => a.studentId === studentId && a.id === id) ?? null,
      ) as AppealRow | null;
    },
    async listAppealMessages(appealId) {
      return appealMessages.filter((m) => m.appealId === appealId).map(clone);
    },

    // ── DIG-39: tickets — обращения с перепиской (owner-scoped) ───────────
    async listTicketsByStudent(studentId) {
      return tickets
        .filter((t) => t.studentId === studentId)
        .sort(
          (a, b) =>
            b.updatedAt.getTime() - a.updatedAt.getTime() ||
            b.createdAt.getTime() - a.createdAt.getTime(),
        )
        .map(clone);
    },
    async findTicketByStudentAndNumber(studentId, number) {
      return clone(
        tickets.find((t) => t.studentId === studentId && t.number === number) ?? null,
      ) as TicketRow | null;
    },
    async appendTicketByStudent(studentId, input) {
      ticketSeq += 1;
      const row: TicketRow = {
        id: `tkt-new-${ticketSeq}`,
        studentId,
        number: input.number,
        subject: input.subject,
        status: 'OPEN',
        assigneeUserId: null,
        requestNumber: input.requestNumber,
        disciplineCode: input.disciplineCode,
        createdAt: input.createdAt,
        updatedAt: input.createdAt,
      };
      tickets.push(row);
      ticketMessageSeq += 1;
      ticketMessages.push({
        id: `tktmsg-new-${ticketMessageSeq}`,
        ticketId: row.id,
        authorRole: 'STUDENT',
        authorName: input.authorName,
        body: input.body,
        attachments: [...input.attachments],
        createdAt: input.createdAt,
        readAt: null,
      });
      return clone(row);
    },
    async appendTicketMessage(ticketId, input) {
      const ticket = tickets.find((t) => t.id === ticketId);
      if (!ticket) return null;
      ticketMessageSeq += 1;
      const row: TicketMessageRow = {
        id: `tktmsg-new-${ticketMessageSeq}`,
        ticketId,
        authorRole: input.authorRole,
        authorName: input.authorName,
        body: input.body,
        attachments: [...input.attachments],
        createdAt: input.createdAt,
        readAt: null,
      };
      ticketMessages.push(row);
      // Активность тикета = время последнего сообщения; статус/исполнитель
      // задаёт бизнес-правило через input.
      ticket.updatedAt = input.createdAt;
      if (input.status) ticket.status = input.status;
      if (input.assigneeUserId !== undefined) ticket.assigneeUserId = input.assigneeUserId;
      return clone(row);
    },
    async listTicketMessages(ticketId) {
      return ticketMessages
        .filter((m) => m.ticketId === ticketId)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map(clone);
    },
    async markTicketMessagesRead(ticketId, authorRole, readAt) {
      let changed = false;
      for (const message of ticketMessages) {
        if (message.ticketId === ticketId && message.authorRole === authorRole && !message.readAt) {
          message.readAt = readAt;
          changed = true;
        }
      }
      return changed;
    },

    // ── DIG-40: feedback — предложения/жалобы руководству (/feedback) ─────
    // Анонимные строки (studentId = null) не видны ни в чьих списках: у них
    // нет владельца (приёмка DIG-40 — никакой связи с пользователем).
    async listFeedbackByStudent(studentId) {
      return feedbacks
        .filter((f) => f.studentId === studentId)
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
        .map(clone);
    },
    // Публичная лента решённых предложений — осознанное исключение из
    // owner-scope (см. port.ts): наружу уходят только строки с результатом.
    async listPublishedFeedbackOutcomes() {
      return feedbacks
        .filter((f) => f.publishedOutcome !== null)
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
        .map(clone);
    },
    async findFeedbackByStudentAndNumber(studentId, number) {
      return clone(feedbacks.find((f) => f.studentId === studentId && f.number === number) ?? null);
    },
    // Probe по номеру БЕЗ владельца: различение «чужой» (OWNERSHIP_DENIED) и
    // «несуществующий» (NOT_FOUND) — только для аудита; наружу в обоих
    // случаях уходит null (единый 404 без оракула существования).
    async probeFeedbackByNumber(number) {
      return clone(by(feedbacks, 'number', number));
    },
    async appendFeedbackByStudent(studentId, input) {
      feedbackSeq += 1;
      const row: FeedbackRow = {
        id: `fb-new-${feedbackSeq}`,
        // null = анонимное обращение: связь с пользователем не записывается.
        studentId,
        number: input.number,
        kind: input.kind,
        target: input.target,
        status: input.status,
        text: input.text,
        attachments: [...input.attachments],
        isAnonymous: input.isAnonymous,
        publishedOutcome: null,
        createdAt: input.createdAt,
        dueAt: input.dueAt,
        updatedAt: input.createdAt,
      };
      feedbacks.push(row);
      return clone(row);
    },

    async listScheduleByGroup(groupName) {
      return schedule.filter((s) => s.groupName === groupName).map(clone);
    },
    async listExamsByGroup(groupName) {
      return exams.filter((e) => e.groupName === groupName).map(clone);
    },

    // ── DIG-25: справочники успеваемости (group-scoped) ───────────────────
    async listDisciplinesByGroup(groupName) {
      return disciplines.filter((row) => row.groupName === groupName).map(clone);
    },
    async listDisciplineElementsByGroup(groupName) {
      return elements.filter((row) => row.groupName === groupName).map(clone);
    },
    async listGradesByGroup(groupName) {
      // Оценки студентов группы — вход агрегата рейтинга; наружу из слоя
      // данных уходят только агрегаты (место/перцентиль владельца ctx).
      const ids = new Set(students.filter((s) => s.groupName === groupName).map((s) => s.id));
      return grades.filter((row) => ids.has(row.studentId)).map(clone);
    },

    // ── DIG-21: schedule by period / notes / staff changes ────────────────
    async listScheduleByGroupRange(groupName, period) {
      const from = period.from.getTime();
      const to = period.to.getTime();
      return schedule
        .filter(
          (s) =>
            s.groupName === groupName && s.startsAt.getTime() >= from && s.startsAt.getTime() < to,
        )
        .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
        .map(clone);
    },
    async probeScheduleEventById(id) {
      return clone(by(schedule, 'id', id));
    },
    async saveScheduleEventChange(eventId, patch: ScheduleChangePatch) {
      const row = schedule.find((s) => s.id === eventId);
      if (!row) return null;
      Object.assign(row, structuredClone(patch));
      return clone(row);
    },
    async listStudentsByGroup(groupName) {
      return students.filter((s) => s.groupName === groupName).map(clone);
    },

    async findNoteByStudentAndEvent(studentId, eventId) {
      return clone(notes.find((n) => n.studentId === studentId && n.eventId === eventId) ?? null);
    },
    async probeNoteByEvent(eventId) {
      return clone(by(notes, 'eventId', eventId));
    },
    async saveNoteByStudent(studentId, eventId, input) {
      const existing = notes.find((n) => n.studentId === studentId && n.eventId === eventId);
      if (existing) {
        existing.text = input.text; // createdAt сохраняется (уникальная заметка к паре)
        return clone(existing);
      }
      noteSeq += 1;
      const row: StudentNoteRow = {
        id: `note-${noteSeq}`,
        studentId,
        eventId,
        text: input.text,
        createdAt: input.createdAt,
      };
      notes.push(row);
      return clone(row);
    },
    async deleteNoteByStudent(studentId, eventId) {
      const index = notes.findIndex((n) => n.studentId === studentId && n.eventId === eventId);
      if (index === -1) return false;
      notes.splice(index, 1);
      return true;
    },

    // ── DIG-29: избранное каталога сервисов (owner-scoped) ────────────────
    async listFavoriteServiceIdsByStudent(studentId) {
      return serviceFavorites
        .filter((f) => f.studentId === studentId)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map((f) => f.serviceId);
    },
    async addFavoriteServiceByStudent(studentId, serviceId) {
      const exists = serviceFavorites.some(
        (f) => f.studentId === studentId && f.serviceId === serviceId,
      );
      if (!exists) {
        serviceFavorites.push({ studentId, serviceId, createdAt: new Date() });
      }
    },
    async removeFavoriteServiceByStudent(studentId, serviceId) {
      serviceFavorites = serviceFavorites.filter(
        (f) => !(f.studentId === studentId && f.serviceId === serviceId),
      );
    },

    // ── DIG-34: дедлайны курса (group-scoped) и ручные задачи (owner-scoped) ─
    async listStudyDeadlinesByGroup(groupName) {
      return studyDeadlines.filter((d) => d.groupName === groupName).map(clone);
    },
    async listStudentTasksByStudent(studentId) {
      return studentTasks.filter((t) => t.studentId === studentId).map(clone);
    },
    // DIG-34 — probe ручной задачи по id без владельца: различение «чужая»
    // (OWNERSHIP_DENIED) и «несуществующая» (NOT_FOUND) — только для аудита;
    // наружу из слоя данных в обоих случаях уходит null.
    async probeStudentTaskById(taskId) {
      return clone(by(studentTasks, 'id', taskId));
    },
    async markStudentTaskDoneByStudent(studentId, taskId, doneAt) {
      const row = studentTasks.find((t) => t.studentId === studentId && t.id === taskId);
      if (!row) return null;
      // Идемпотентно: повторная отметка сохраняет первый doneAt.
      row.doneAt ??= doneAt;
      return clone(row);
    },

    // ── DIG-47: реестр справок (публичная проверка по коду) ────────────────
    async findCertificateByCode(code) {
      return clone(by(certificates, 'verificationCode', code));
    },
    async findCertificateByStudentAndRequestId(studentId, requestId) {
      return clone(
        certificates.find((c) => c.studentId === studentId && c.requestId === requestId) ?? null,
      );
    },
    async appendCertificateForStudent(studentId, input) {
      if (input.studentId !== studentId) {
        throw new Error('appendCertificateForStudent: input.studentId must equal the scope');
      }
      certificateSeq += 1;
      const row: CertificateRow = { ...clone(input), id: input.id || `cert-new-${certificateSeq}` };
      certificates.push(row);
      return clone(row);
    },
    async revokeCertificateByStaff(faculty, code, input) {
      const row = certificates.find((c) => c.verificationCode === code);
      if (!row) return null;
      const owner = students.find((s) => s.id === row.studentId);
      if (!owner || owner.faculty !== faculty) return null;
      if (row.revokedAt) return clone(row); // идемпотентно: дата не перезаписывается
      row.revokedAt = input.revokedAt;
      row.revokedReason = input.reason;
      return clone(row);
    },

    // ── DIG-63: активные ICS-подписки (одна строка на студента) ─────────────
    async findCalendarSubscriptionByStudent(studentId) {
      return clone(by(calendarSubscriptions, 'studentId', studentId));
    },
    // Поиск по tokenId без скоупа — осознанное исключение (см. port.ts):
    // публичный фид читает без входа;tokenId несёт 128 бит + HMAC-подпись,
    // которую calendar.ts проверяет до этого вызова.
    async findCalendarSubscriptionByTokenId(tokenId) {
      return clone(by(calendarSubscriptions, 'tokenId', tokenId));
    },
    async saveCalendarSubscriptionForStudent(studentId, input) {
      const row: CalendarSubscriptionRow = {
        studentId,
        tokenId: input.tokenId,
        createdAt: input.createdAt,
        rotatedAt: input.rotatedAt,
      };
      const index = calendarSubscriptions.findIndex((s) => s.studentId === studentId);
      if (index === -1) {
        calendarSubscriptions.push(row);
      } else {
        calendarSubscriptions[index] = row;
      }
      return clone(row);
    },
    // ── DIG-36: отметки «Прочитано» новостей (owner-scoped) ───────────────
    async listNewsReadIdsByStudent(studentId) {
      return newsRead
        .filter((r) => r.studentId === studentId)
        .sort((a, b) => a.readAt.getTime() - b.readAt.getTime())
        .map((r) => r.newsId);
    },
    async markNewsReadByStudent(studentId, newsId) {
      const exists = newsRead.some((r) => r.studentId === studentId && r.newsId === newsId);
      if (!exists) {
        newsRead.push({ studentId, newsId, readAt: new Date() });
      }
    },

    async deleteCalendarSubscriptionByStudent(studentId) {
      const before = calendarSubscriptions.length;
      calendarSubscriptions = calendarSubscriptions.filter((s) => s.studentId !== studentId);
      return calendarSubscriptions.length < before;
    },
    async deleteCalendarSubscriptionByLogin(login) {
      const owner = students.find((s) => s.login === login);
      if (!owner) return false;
      const before = calendarSubscriptions.length;
      calendarSubscriptions = calendarSubscriptions.filter((s) => s.studentId !== owner.id);
      return calendarSubscriptions.length < before;
    },

    async listStudentsByFaculty(faculty) {
      return students.filter((s) => s.faculty === faculty).map(clone);
    },

    // ── DIG-64: персональный MCP-токен (lookup по хэшу — см. port.ts) ─────
    async findStudentByMcpTokenHash(tokenHash) {
      const row = settings.find((s) => s.mcpToken?.tokenHash === tokenHash);
      if (!row) return null;
      const student = students.find((s) => s.id === row.studentId);
      if (!student) return null;
      return { student: clone(student), userId: row.mcpToken!.userId };
    },

    // ── DIG-48: кабинет сотрудника (faculty-scoped) ────────────────────────
    async listRequestsByFaculty(faculty) {
      const facultyStudentIds = new Set(
        students.filter((s) => s.faculty === faculty).map((s) => s.id),
      );
      return requests
        .filter((r) => facultyStudentIds.has(r.studentId))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map(clone);
    },
    async updateRequestByStaff(faculty, number, input: StaffRequestUpdateInput) {
      const row = requests.find((r) => r.number === number);
      if (!row) return null;
      const owner = students.find((s) => s.id === row.studentId);
      if (!owner || owner.faculty !== faculty) return null;
      if (row.status !== input.from) return null; // гонка: статус уже изменился
      row.status = input.to;
      // Исполнитель: «Взять в работу» назначает всегда, прочие переходы
      // заполняют пустое поле (не перезаписывая чужую работу).
      if (input.to === 'IN_PROGRESS' || !row.assignee) row.assignee = input.actorName;
      if (input.note !== null) row.resultNote = input.note;
      row.updatedAt = input.now;
      requestEventSeq += 1;
      requestEvents.push({
        id: `reqevt-staff-${requestEventSeq}`,
        requestId: row.id,
        actorRole: 'STAFF',
        actorName: input.actorName,
        statusFrom: input.from,
        statusTo: input.to,
        message: input.eventMessage,
        createdAt: input.now,
      });
      if (input.notification) {
        notificationSeq += 1;
        notifications.push({
          id: `ntf-staff-${notificationSeq}`,
          studentId: row.studentId,
          type: input.notification.type,
          title: input.notification.title,
          body: input.notification.body,
          link: input.notification.link ?? null,
          isRead: false,
          createdAt: input.now,
        });
      }
      return clone(row);
    },
    async listAppealsByFaculty(faculty) {
      const facultyStudentIds = new Set(
        students.filter((s) => s.faculty === faculty).map((s) => s.id),
      );
      return appeals
        .filter((a) => facultyStudentIds.has(a.studentId))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map(clone);
    },
    async findAppealByFacultyAndId(faculty, appealId) {
      const row = appeals.find((a) => a.id === appealId);
      if (!row) return null;
      const owner = students.find((s) => s.id === row.studentId);
      if (!owner || owner.faculty !== faculty) return null;
      return clone(row);
    },
    async appendAppealMessageByStaff(faculty, appealId, input: StaffAppealMessageInput) {
      const row = appeals.find((a) => a.id === appealId);
      if (!row) return null;
      const owner = students.find((s) => s.id === row.studentId);
      if (!owner || owner.faculty !== faculty) return null;
      if (input.body.trim().length > 0 || input.resolve) {
        appealMessageSeq += 1;
        appealMessages.push({
          id: `msg-staff-${appealMessageSeq}`,
          appealId: row.id,
          authorRole: 'STAFF',
          authorName: input.authorName,
          body: input.body,
          createdAt: input.now,
        });
      }
      row.status = input.resolve ? 'CLOSED' : 'ANSWERED';
      if (input.notification) {
        notificationSeq += 1;
        notifications.push({
          id: `ntf-staff-${notificationSeq}`,
          studentId: row.studentId,
          type: input.notification.type,
          title: input.notification.title,
          body: input.notification.body,
          link: input.notification.link ?? null,
          isRead: false,
          createdAt: input.now,
        });
      }
      return clone(row);
    },
    async listAnnouncementsByFaculty(faculty) {
      return announcements
        .filter((a) => a.faculty === faculty)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map(clone);
    },
    async appendAnnouncementByStaff(faculty, input: StaffAnnouncementInput) {
      announcementSeq += 1;
      const row: AnnouncementRow = {
        id: `ann-new-${announcementSeq}`,
        faculty,
        groupName: input.groupName,
        title: input.title,
        body: input.body,
        authorLogin: input.authorLogin,
        authorName: input.authorName,
        createdAt: input.now,
      };
      announcements.push(row);
      return clone(row);
    },

    // ── DIG-68: каталог студенческих стартапов «МСП» (/msp) ────────────────
    async listMspProjects() {
      return mspProjects.map(clone);
    },
    // Все голоса — вход агрегатов счётчиков (msp.ts); наружу уходят числа.
    async listMspVotes() {
      return mspVotes.map(clone);
    },
    async listMspVotesByStudent(studentId) {
      return mspVotes
        .filter((v) => v.studentId === studentId)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map(clone);
    },
    // Переключение голоса: строки пары (проект, студент) всегда 0/1 —
    // повторный вызов снимает голос (строка удаляется), дубликат невозможен.
    async toggleMspVote(studentId, projectId) {
      const project = by(mspProjects, 'id', projectId);
      if (!project) return null;
      const exists = mspVotes.some((v) => v.projectId === projectId && v.studentId === studentId);
      if (exists) {
        mspVotes = mspVotes.filter(
          (v) => !(v.projectId === projectId && v.studentId === studentId),
        );
      } else {
        mspVotes.push({ projectId, studentId, createdAt: new Date() });
      }
      const votes = mspVotes.filter((v) => v.projectId === projectId).length;
      return { voted: !exists, votes };
    },
    async listMspCommentsByProject(projectId) {
      return mspComments
        .filter((c) => c.projectId === projectId)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map(clone);
    },
    // Комментарий только к СУЩЕСТВУЮЩЕМУ проекту: null — проекта нет.
    async appendMspComment(studentId, projectId, input) {
      const project = by(mspProjects, 'id', projectId);
      if (!project) return null;
      mspCommentSeq += 1;
      const row: MspCommentRow = {
        id: `msp-cmt-${mspCommentSeq}`,
        projectId,
        studentId,
        authorName: input.authorName,
        body: input.body,
        createdAt: input.createdAt,
      };
      mspComments.push(row);
      return clone(row);
    },
    async createMspProject(studentId, input) {
      // UNIQUE slug из генерации слоя (msp-slug.ts учитывает занятые):
      // дубль — сбой контракта, а не тихая перезапись.
      if (mspProjects.some((p) => p.slug === input.slug)) {
        throw new Error('duplicate msp project slug');
      }
      mspProjectSeq += 1;
      const row: MspProjectRow = {
        id: `msp-prj-${mspProjectSeq}`,
        slug: input.slug,
        title: input.title,
        tagline: input.tagline,
        description: input.description,
        tags: [...input.tags],
        authorStudentId: studentId,
        authorName: input.authorName,
        createdAt: input.createdAt,
        letter: input.letter,
      };
      mspProjects.push(row);
      return clone(row);
    },

    // ── DIG-42: «Дополнительное образование» (/dpo) ────────────────────────
    async listDpoPrograms() {
      return dpoPrograms.map(clone);
    },
    async listDpoEnrollmentsByStudent(studentId) {
      return dpoEnrollments
        .filter((e) => e.studentId === studentId)
        .sort((a, b) => a.enrolledAt.getTime() - b.enrolledAt.getTime())
        .map(clone);
    },
    // Запись владельца: только на СУЩЕСТВУЮЩУЮ программу, UNIQUE пара
    // программа+студент — повторный вызов возвращает null (не дубль строки).
    async enrollDpo(studentId, programId) {
      const program = by(dpoPrograms, 'id', programId);
      if (!program) return null;
      if (dpoEnrollments.some((e) => e.programId === programId && e.studentId === studentId)) {
        return null;
      }
      const row: DpoEnrollmentRow = {
        programId,
        studentId,
        enrolledAt: new Date(),
        progressPercent: 0,
      };
      dpoEnrollments.push(row);
      return clone(row);
    },
    async listDpoDocumentsByStudent(studentId) {
      return dpoDocuments
        .filter((d) => d.studentId === studentId)
        .sort((a, b) => b.issuedAt.getTime() - a.issuedAt.getTime())
        .map(clone);
    },

    async appendAudit(event) {
      auditSeq += 1;
      const row: AuditLogRow = {
        id: `audit-${auditSeq}`,
        createdAt: event.createdAt ?? new Date(),
        actorUserId: event.actorUserId,
        actorLogin: event.actorLogin,
        actorRole: event.actorRole,
        resourceType: event.resourceType,
        resourceRef: event.resourceRef,
        reason: event.reason,
        outcome: 'DENIED',
      };
      audit.push(row);
      return clone(row);
    },
  };
}
