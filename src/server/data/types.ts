// DIG-12 — types of the isolated data layer.
//
// Structural row types mirror the DIG-9 Prisma schema (Student, ServiceRequest,
// Grade, Notification, Appeal, ScheduleEvent, ExamSession) so the layer can be
// driven by the in-memory adapter today and by a Prisma adapter one-to-one
// once the schema branch is merged. Enum unions deliberately do NOT import
// @prisma/client: the data layer must compile and test without it (DIG-11
// convention), the mapping enum↔union is a pure function in the adapter.

export type Role = 'STUDENT' | 'STAFF';

export type RequestType = 'CERTIFICATE' | 'STATEMENT' | 'PRACTICE' | 'DORMITORY' | 'OTHER';

export type RequestStatus =
  'SUBMITTED' | 'IN_PROGRESS' | 'NEEDS_REVISION' | 'COMPLETED' | 'REJECTED';

export type ActorRole = 'STUDENT' | 'STAFF';

export type NotificationType = 'SCHEDULE' | 'GRADE' | 'REQUEST' | 'NEWS' | 'DEADLINE' | 'SYSTEM';

/** DIG-19 — delivery channel of a notification (Telegram is «скоро»: off). */
export type NotificationChannel = 'PUSH' | 'EMAIL' | 'TELEGRAM';

/** DIG-19 — theme preference (dark is reserved but disabled in the UI). */
export type ThemePreference = 'LIGHT' | 'SYSTEM' | 'DARK';

export type AppealStatus = 'OPEN' | 'ANSWERED' | 'CLOSED';

export type ScheduleKind = 'LECTURE' | 'PRACTICE' | 'LAB' | 'SEMINAR' | 'CONSULTATION';

export type ScheduleStatus = 'SCHEDULED' | 'ROOM_CHANGED' | 'TIME_CHANGED' | 'CANCELLED';

export type ExamKind = 'CREDIT' | 'EXAM' | 'RETAKE';

export type ElementKind = 'HOMEWORK' | 'LAB' | 'TEST' | 'PROJECT' | 'EXAM';

/**
 * Security context of every data-layer call. Produced from the live session
 * (`requireUser()` of DIG-11) via `toDataCtx()` — never from URL parameters,
 * which is what makes IDOR impossible by construction:
 *
 * - a STUDENT is scoped by `studentId` (personal rows) and `groupName`
 *   (group schedule/exams);
 * - a STAFF member is scoped by `faculty` and has NO studentId — student
 *   functions reject such a context with an audited ROLE_MISMATCH.
 */
export interface DataCtx {
  /** Auth user id (session owner) — audit trail only, never an access key. */
  userId: string;
  login: string;
  role: Role;
  /** STUDENT only: id of the Student row that owns all personal data. */
  studentId: string | null;
  /** STUDENT only: study group — the only group whose schedule is visible. */
  groupName: string | null;
  /** STUDENT and STAFF: faculty (students see their own, staff their faculty). */
  faculty: string | null;
}

export interface StudentRow {
  id: string;
  login: string;
  fullName: string;
  email: string;
  groupName: string;
  course: number;
  faculty: string;
  /** Направление подготовки: код + название ведутся деканатом по отдельности. */
  program: string;
  programCode: string | null;
  studyForm: string;
  /** Бюджет/контракт — бесплатных значений нет, ведёт деканат. */
  funding: string | null;
  gradebookNumber: string;
}

/**
 * DIG-19 — editable side of the profile: contacts (phone + visibility for
 * teachers), notification channel matrix and the theme preference.
 * One row per student; created lazily from `defaultSettingsFor` on first read.
 */
export interface StudentSettingsRow {
  studentId: string;
  phone: string | null;
  emailVisibleToStaff: boolean;
  phoneVisibleToStaff: boolean;
  notificationChannels: Record<NotificationType, Record<NotificationChannel, boolean>>;
  theme: ThemePreference;
  updatedAt: Date;
}

export interface StaffRow {
  id: string;
  login: string;
  fullName: string;
  position: string;
  email: string;
  faculty: string;
}

/** Public, non-sequential request number (`SR-2026-A1B2C`) — see request-number.ts. */
export interface ServiceRequestRow {
  id: string;
  studentId: string;
  number: string;
  type: RequestType;
  title: string;
  status: RequestStatus;
  assignee: string | null;
  resultNote: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RequestEventRow {
  id: string;
  requestId: string;
  actorRole: ActorRole;
  actorName: string;
  statusFrom: RequestStatus | null;
  statusTo: RequestStatus;
  message: string;
  createdAt: Date;
}

/** Flattened grade row (element fields are denormalized for the demo store). */
export interface GradeRow {
  id: string;
  studentId: string;
  elementCode: string;
  elementName: string;
  disciplineCode: string;
  disciplineName: string;
  score: number;
  maxScore: number;
  weight: number;
  kind: ElementKind;
  gradedAt: Date;
  comment: string | null;
}

export interface NotificationRow {
  id: string;
  studentId: string;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: Date;
  /** Куда ведёт уведомление в кабинете (например, «/schedule»); опционально. */
  link?: string | null;
}

export interface AppealRow {
  id: string;
  studentId: string;
  subject: string;
  status: AppealStatus;
  createdAt: Date;
}

export interface AppealMessageRow {
  id: string;
  appealId: string;
  authorRole: ActorRole;
  authorName: string;
  body: string;
  createdAt: Date;
}

export interface ScheduleEventRow {
  id: string;
  groupName: string;
  disciplineCode: string;
  disciplineName: string;
  date: Date;
  startsAt: Date;
  endsAt: Date;
  kind: ScheduleKind;
  room: string;
  teacherName: string;
  status: ScheduleStatus;
  note: string | null;
  /** DIG-9 schema: the room/time before a ROOM_CHANGED / TIME_CHANGED event. */
  previousRoom?: string | null;
  previousStartsAt?: Date | null;
  /** DIG-21 — причина изменения, оставленная сотрудником деканата. */
  changeNote?: string | null;
}

/** DIG-21 — заметка студента к конкретной паре (уникальна по паре студент+пара). */
export interface StudentNoteRow {
  id: string;
  studentId: string;
  eventId: string;
  text: string;
  createdAt: Date;
}

export interface ExamSessionRow {
  id: string;
  groupName: string;
  disciplineCode: string;
  disciplineName: string;
  kind: ExamKind;
  date: Date;
  startsAt: Date;
  room: string;
  note: string | null;
}

/**
 * Why access was denied. `OWNERSHIP_DENIED` / `OUTSIDE_FACULTY` mean the row
 * exists but belongs to someone else; `NOT_FOUND` — no such row. The HTTP
 * answer is IDENTICAL (404) for both — the reason goes only to the audit log,
 * so the response never becomes an existence oracle.
 */
export type DenialReason = 'OWNERSHIP_DENIED' | 'OUTSIDE_FACULTY' | 'ROLE_MISMATCH' | 'NOT_FOUND';

export interface AuditLogRow {
  id: string;
  actorUserId: string | null;
  actorLogin: string | null;
  actorRole: Role | null;
  /** What was probed, e.g. 'request' | 'appeal' | 'student' | 'notification'. */
  resourceType: string;
  /** The URL-level reference used in the attempt (number / cuid). */
  resourceRef: string;
  reason: DenialReason;
  outcome: 'DENIED';
  createdAt: Date;
}
