// DIG-12 — the ONLY sanctioned way for pages, components, routes and actions
// to reach application data. Import from '@/server/data', never from the db
// or Prisma directly (eslint no-restricted-imports pins this).

export { toDataCtx, requireDataCtx } from './context';
export { listRequests, getRequestByNumber, listRequestEvents } from './requests';
export { listGrades } from './grades';
export { listNotifications, markNotificationRead } from './notifications';
export { listAppeals, getAppeal, listAppealMessages } from './appeals';
export { listSchedule, listExams } from './schedule';
export { listFacultyStudents, getFacultyStudent } from './staff';
export {
  defaultSettingsFor,
  getOwnProfile,
  getOwnSettings,
  updateOwnContacts,
  updateOwnNotificationChannel,
  updateOwnTheme,
  createNotificationForStudent,
  createDataErrorAppeal,
  DATA_ERROR_APPEAL_SUBJECT,
  NOTIFICATION_SETTING_TYPES,
} from './profile';
export { denyAccess } from './access';
export { uniformNotFoundResponse } from './http';
export { ensureAppData } from './bootstrap';
export {
  newRequestNumber,
  normalizeRequestNumber,
  isValidRequestNumber,
  REQUEST_NUMBER_PATTERN,
} from './request-number';
export type { DataDb } from './port';
export {
  type DataCtx,
  type Role,
  type RequestType,
  type RequestStatus,
  type NotificationType,
  type NotificationChannel,
  type ThemePreference,
  type AppealStatus,
  type ScheduleKind,
  type ScheduleStatus,
  type ExamKind,
  type ElementKind,
  type DenialReason,
  type AuditLogRow,
  type StudentRow,
  type StaffRow,
  type StudentSettingsRow,
  type ServiceRequestRow,
  type RequestEventRow,
  type GradeRow,
  type NotificationRow,
  type AppealRow,
  type AppealMessageRow,
  type ScheduleEventRow,
  type ExamSessionRow,
} from './types';
