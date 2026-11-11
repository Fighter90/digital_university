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
  ExamSessionRow,
  GradeRow,
  NotificationRow,
  RequestEventRow,
  ScheduleEventRow,
  ServiceRequestRow,
  StaffRow,
  StudentRow,
} from './types';

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

  // ── requests (owner-scoped) ───────────────────────────────────────────────
  listRequestsByStudent(studentId: string): Promise<ServiceRequestRow[]>;
  findRequestByStudentAndNumber(
    studentId: string,
    number: string,
  ): Promise<ServiceRequestRow | null>;
  findRequestByStudentAndId(studentId: string, id: string): Promise<ServiceRequestRow | null>;
  listRequestEvents(requestId: string): Promise<RequestEventRow[]>;

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

  // ── staff scope ───────────────────────────────────────────────────────────
  listStudentsByFaculty(faculty: string): Promise<StudentRow[]>;

  // ── audit (append-only) ───────────────────────────────────────────────────
  appendAudit(
    event: Omit<AuditLogRow, 'id' | 'createdAt'> & { createdAt?: Date },
  ): Promise<AuditLogRow>;
}
