// DIG-12 — in-memory adapter of the data port.
//
// Serves two purposes until the Prisma schema branch (DIG-10) is merged and
// PostgreSQL is wired:
//  - unit tests seed exact fixtures via `seed()` and assert isolation;
//  - the running prototype (jury demo) holds the fictional demo dataset.
// Swapping to PostgreSQL later is a one-line change in src/server/data/db.ts:
// a Prisma adapter implements the very same `DataDb` signatures.

import type { DataDb } from './port';
import type {
  AppealMessageRow,
  AppealRow,
  AuditLogRow,
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

export interface MemorySeed {
  students?: StudentRow[];
  staff?: StaffRow[];
  requests?: ServiceRequestRow[];
  requestEvents?: RequestEventRow[];
  grades?: GradeRow[];
  notifications?: NotificationRow[];
  appeals?: AppealRow[];
  appealMessages?: AppealMessageRow[];
  schedule?: ScheduleEventRow[];
  exams?: ExamSessionRow[];
  /** DIG-19 — per-student profile settings (contacts visibility, channels, theme). */
  settings?: StudentSettingsRow[];
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
  let grades: GradeRow[] = [];
  let notifications: NotificationRow[] = [];
  let appeals: AppealRow[] = [];
  let appealMessages: AppealMessageRow[] = [];
  let schedule: ScheduleEventRow[] = [];
  let exams: ExamSessionRow[] = [];
  let settings: StudentSettingsRow[] = [];
  let audit: AuditLogRow[] = [];
  let auditSeq = 0;
  let notificationSeq = 0;
  let appealSeq = 0;
  let appealMessageSeq = 0;

  const by = <T, K extends keyof T>(rows: T[], key: K, value: T[K]) =>
    rows.find((row) => row[key] === value) ?? null;

  return {
    seed(seed: MemorySeed) {
      students = seed.students ? seed.students.map(clone) : [];
      staff = seed.staff ? seed.staff.map(clone) : [];
      requests = seed.requests ? seed.requests.map(clone) : [];
      requestEvents = seed.requestEvents ? seed.requestEvents.map(clone) : [];
      grades = seed.grades ? seed.grades.map(clone) : [];
      notifications = seed.notifications ? seed.notifications.map(clone) : [];
      appeals = seed.appeals ? seed.appeals.map(clone) : [];
      appealMessages = seed.appealMessages ? seed.appealMessages.map(clone) : [];
      schedule = seed.schedule ? seed.schedule.map(clone) : [];
      exams = seed.exams ? seed.exams.map(clone) : [];
      settings = seed.settings ? seed.settings.map(clone) : [];
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
    async probeStudentById(id) {
      return clone(by(students, 'id', id));
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

    async listScheduleByGroup(groupName) {
      return schedule.filter((s) => s.groupName === groupName).map(clone);
    },
    async listExamsByGroup(groupName) {
      return exams.filter((e) => e.groupName === groupName).map(clone);
    },

    async listStudentsByFaculty(faculty) {
      return students.filter((s) => s.faculty === faculty).map(clone);
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
