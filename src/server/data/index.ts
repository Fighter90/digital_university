// DIG-12 — the ONLY sanctioned way for pages, components, routes and actions
// to reach application data. Import from '@/server/data', never from the db
// or Prisma directly (eslint no-restricted-imports pins this).

export { toDataCtx, requireDataCtx } from './context';
export { resolveShellUser } from './shell-user';
export { listRequests, getRequestByNumber, listRequestEvents } from './requests';
export { listGrades } from './grades';
export { getPerformance, needForTarget } from './performance';
export type {
  CreditsView,
  DebtItem,
  DebtStatus,
  DisciplinePerformance,
  GpaView,
  PerformanceData,
  RatingView,
} from './performance';
export { createGradeAppeal, getDisciplineCard, getGradebook } from './gradebook';
export type {
  DisciplineCardData,
  DisciplineCardPart,
  DisciplineExamView,
  DisciplineGradeRowView,
  GradebookData,
  GradebookDisciplineView,
  GradebookSemesterView,
  GradebookStudentView,
} from './gradebook';
export {
  listNotifications,
  markNotificationRead,
  countUnreadNotifications,
  markAllNotificationsRead,
} from './notifications';
export { listAppeals, getAppeal, listAppealMessages } from './appeals';
export { listSchedule, listExams } from './schedule';
export { getSession, createRetakeRequest } from './session';
export type {
  SessionConsultationItem,
  SessionData,
  SessionExamItem,
  SessionRetakeItem,
} from './session';
export {
  applyScheduleChange,
  deleteEventNote,
  getDay,
  getEventDetails,
  getMonth,
  getNextStudyDay,
  getSchedule,
  getToday,
  getWeek,
  MAX_NOTE_LENGTH,
  saveEventNote,
} from './schedule';
export type {
  NextStudyDayView,
  ScheduleChangeInput,
  ScheduleEventDetails,
  ScheduleRangeInput,
  StaffChangeStatus,
} from './schedule';
export { listFacultyStudents, getFacultyStudent } from './staff';
export { getDashboard } from './dashboard';
export type {
  DashboardData,
  DashboardSection,
  DeadlineView,
  DisciplineBarView,
  DebtView,
  ProgressView,
  RequestsView,
  TodayLessonView,
  TodayView,
} from './dashboard';
export { listDeaneryNews } from './news';
export type { DeaneryNewsItem } from './news';
export { getServicesPage, toggleFavoriteService, MAX_FAVORITES } from './services';
export type { ServicesPageData, ServiceToggleResult } from './services';
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
export type { DataDb, SchedulePeriod, ScheduleChangePatch } from './port';
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
  type StudentNoteRow,
  type ExamSessionRow,
  type DisciplineRow,
  type DisciplineElementRow,
  type ServiceFavoriteRow,
} from './types';
