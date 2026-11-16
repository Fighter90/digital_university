// DIG-12 — the ONLY sanctioned way for pages, components, routes and actions
// to reach application data. Import from '@/server/data', never from the db
// or Prisma directly (eslint no-restricted-imports pins this).

export { toDataCtx, requireDataCtx } from './context';
export { resolveShellUser } from './shell-user';
export { listRequests, getRequestByNumber, listRequestEvents } from './requests';
export { listGrades } from './grades';
export { getGradeInsight } from './grade-insight';
export type { GradeInsight } from '@/lib/grade-insight';
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
export { getTasks, getTasksSummary, groupTasks, markTaskDone } from './tasks';
export type { TaskGroupViews, TaskSource, TasksData, TasksSummary, TaskView } from './tasks';
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
export { getNewsPage, getNewsArticle, markNewsRead, listDeaneryNews } from './news';
export type {
  DeaneryNewsItem,
  NewsArticleData,
  NewsCardView,
  NewsPageData,
  NewsPageInput,
} from './news';
export { parseNewsScope, parseNewsTopic } from '@/lib/news-catalog';
export { listDeaneryNews } from './news';
export type { DeaneryNewsItem } from './news';
export { searchCabinet } from './search';
export type { SearchResponse, SearchGroup, SearchHit, SearchHitKind } from '@/lib/search-core';export { getServicesPage, toggleFavoriteService, MAX_FAVORITES } from './services';
export type { ServicesPageData, ServiceToggleResult } from './services';
export {
  getCertificatePdfInput,
  getOrCreateCertificateForRequest,
  newCertificateNumber,
  revokeCertificateByCode,
  verifyCertificateByCode,
  CERTIFICATE_VALIDITY_DAYS,
} from './certificates';
export type {
  CertificatePdfInput,
  CertificatePublicView,
  RevokeCertificateInput,
} from './certificates';
export {
  buildCalendarFeed,
  getOrCreateCalendarSubscription,
  resolveCalendarFeed,
  revokeCalendarSubscriptionOfLogin,
  icsTokenSecret,
} from './calendar';
export type { CalendarFeedData, CalendarSubscriptionView } from './calendar';
export {
  checkRequestTransition,
  allowedRequestTransitions,
  formatStatusTransition,
  isTerminalRequestStatus,
} from '../../lib/request-machine';
export type {
  CanonicalRequestStatus,
  RequestActor,
  RequestTransitionRule,
  RequestTransitionInput,
  RequestTransitionCheck,
} from '../../lib/request-machine';
export { slaReadyDate, addWorkingDays, formatReadyBy, isWeekend } from '../../lib/request-sla';
export {
  defaultSettingsFor,
  getOwnProfile,
  getOwnSettings,
  updateOwnContacts,
  updateOwnMcpConnection,
  updateOwnNotificationChannel,
  updateOwnTheme,
  createNotificationForStudent,
  createDataErrorAppeal,
  DATA_ERROR_APPEAL_SUBJECT,
  NOTIFICATION_SETTING_TYPES,
} from './profile';
export { denyAccess } from './access';
export { getAssistantContext, createAssistantRequest, reportAssistantAnswer } from './assistant';
export { ASSISTANT_REPORT_SUBJECT } from './assistant';
export { uniformNotFoundResponse } from './http';
export { ensureAppData } from './bootstrap';
export {
  newRequestNumber,
  normalizeRequestNumber,
  decodeRequestNumberParam,
  isValidRequestNumber,
  REQUEST_NUMBER_PATTERN,
} from './request-number';
export {
  formatCanonicalRequestNumber,
  canonicalRequestNumberYear,
  canonicalRequestNumberSeq,
  isValidCanonicalRequestNumber,
  CANONICAL_REQUEST_NUMBER_PATTERN,
} from './canonical-request-number';
export {
  REQUEST_DUPLICATE_WINDOW_MS,
  listCanonicalRequestTypes,
  createCanonicalRequest,
  transitionCanonicalRequest,
  getCanonicalRequestByNumber,
  getCanonicalRequestById,
  listCanonicalRequestsByStudent,
  listCanonicalRequestEvents,
  createRequestQuestionAppeal,
  sendRequestDocumentByEmail,
  CANONICAL_REQUEST_STATUS_LABELS,
} from './canonical-requests';
export type {
  CreateCanonicalRequestInput,
  CreateCanonicalRequestResult,
  TransitionCanonicalRequestInput,
  TransitionCanonicalRequestResult,
  SendDocumentByEmailResult,
} from './canonical-requests';
export type { DataDb, SchedulePeriod, ScheduleChangePatch } from './port';
export { getRequestsScreen } from './requests-screen';
export type { RequestsScreenData } from './requests-screen';
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
  type CanonicalRequestRow,
  type CanonicalRequestTypeRow,
  type CanonicalRequestEventRow,
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
  type NewsReadRow,
  type CertificateRow,
  type CalendarSubscriptionRow,} from './types';
