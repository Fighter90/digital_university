// DIG-12 — the ONLY sanctioned way for pages, components, routes and actions
// to reach application data. Import from '@/server/data', never from the db
// or Prisma directly (eslint no-restricted-imports pins this).

export { toDataCtx, requireDataCtx } from './context';
export { resolveShellUser } from './shell-user';
export { listRequests, getRequestByNumber, listRequestEvents } from './requests';
export { listGrades } from './grades';
export { getGradeInsight } from './grade-insight';
export type { GradeInsight } from '@/lib/grade-insight';
export { getGroupRating, getPerformance, needForTarget } from './performance';
export type {
  CreditsView,
  DebtItem,
  DebtStatus,
  DisciplinePerformance,
  GpaView,
  GroupRatingView,
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
export {
  getDeaneryPage,
  openTicketChat,
  createTicket,
  replyToTicket,
  appendManagerMessage,
  MAX_TICKET_ATTACHMENTS,
  MAX_ATTACHMENT_NAME_LENGTH,
  MIN_TICKET_BODY_LENGTH,
  MAX_TICKET_BODY_LENGTH,
} from './deanery';
export type {
  DeaneryPageData,
  TicketChatData,
  TicketListItem,
  CreateTicketInput,
  CreateTicketResult,
  ReplyInput,
  ReplyResult,
} from './deanery';
export {
  newTicketNumber,
  normalizeTicketNumber,
  isValidTicketNumber,
  TICKET_NUMBER_PATTERN,
} from './ticket-number';
export {
  getFeedbackPage,
  createFeedback,
  openFeedbackCard,
  getFeedbackSentView,
  MIN_FEEDBACK_TEXT_LENGTH,
  MAX_FEEDBACK_TEXT_LENGTH,
} from './feedback';
export type {
  FeedbackPageData,
  FeedbackOutcomeView,
  FeedbackSentView,
  CreateFeedbackInput,
  CreateFeedbackResult,
} from './feedback';
export {
  newFeedbackNumber,
  normalizeFeedbackNumber,
  isValidFeedbackNumber,
  FEEDBACK_NUMBER_PATTERN,
} from './feedback-number';
// DIG-68 — каталог студенческих стартапов «МСП» (/msp).
export {
  addMspCommentToProject,
  getMspPage,
  launchMspProject,
  mspLetterOf,
  openMspProjectView,
  parseMspSort,
  parseMspTags,
  toggleMspVoteForProject,
  MAX_MSP_COMMENT_LENGTH,
  MAX_MSP_DESCRIPTION_LENGTH,
  MAX_MSP_TAGLINE_LENGTH,
  MAX_MSP_TAG_LENGTH,
  MAX_MSP_TAGS,
  MAX_MSP_TITLE_LENGTH,
  MIN_MSP_COMMENT_LENGTH,
  MIN_MSP_DESCRIPTION_LENGTH,
  MIN_MSP_TAGLINE_LENGTH,
  MIN_MSP_TAG_LENGTH,
  MIN_MSP_TITLE_LENGTH,
} from './msp';
export type {
  AddMspCommentInput,
  AddMspCommentResult,
  LaunchMspProjectInput,
  LaunchMspProjectResult,
  MspPageData,
  MspProjectDetail,
  MspProjectView,
  MspSort,
  ToggleMspVoteResult,
} from './msp';
// DIG-42 — «Дополнительное образование» (/dpo).
export {
  enrollDpoProgram,
  filterDpoCatalog,
  getDpoCatalog,
  getDpoDocuments,
  getDpoMyPrograms,
  parseDpoFormat,
} from './dpo';
export type { DpoCatalogView, DpoFormatFilter, DpoMyProgramView, EnrollDpoResult } from './dpo';
export {
  MSP_SLUG_PATTERN,
  mspSlugBase,
  mspSlugSuffix,
  newMspSlug,
  normalizeMspSlug,
} from './msp-slug';
// DIG-43 — мероприятия вуза и запись (/events).
export {
  getDashboardEvents,
  getEventsPage,
  normalizeEventSlug,
  openEventView,
  parseEventsFilter,
  toggleEventRegistrationForStudent,
} from './events';
export type {
  EventDetail,
  EventView,
  EventsPageData,
  EventsSummary,
  ToggleEventRegistrationResult,
} from './events';
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
export { getPeopleDirectory, getPersonCard, MAX_UPCOMING_EVENTS } from './people';
export type {
  PeopleDirectoryData,
  PersonCardData,
  PersonListEntry,
  PersonUpcomingEvent,
} from './people';
export {
  answerStaffAppeal,
  changeStaffRequestStatus,
  createStaffAnnouncement,
  getStaffAppealThread,
  getStaffAppeals,
  getStaffQueue,
  getStaffRequestDetail,
  getStaffSummaryData,
  listFacultyGroups,
  listStaffAnnouncements,
  resolveStaffAppeal,
} from './staff-workflow';
export type {
  StaffAppealItem,
  StaffAppealThread,
  StaffAnnouncementResult,
  StaffQueueItem,
  StaffRequestDetail,
  StaffStatusChangeResult,
  StaffSummaryData,
} from './staff-workflow';
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
export { searchCabinet } from './search';
export type { SearchResponse, SearchGroup, SearchHit, SearchHitKind } from '@/lib/search-core';
export { getServicesPage, toggleFavoriteService, MAX_FAVORITES } from './services';
export type { ServicesPageData, ServiceToggleResult } from './services';
export { getFinancePage } from './finance';
export type { FinancePageData, FinanceStudentView } from './finance';
export {
  getCertificatePdfInput,
  getOrCreateCertificateForRequest,
  getOrCreateDocumentVerification,
  getStaffCertificatePdfInput,
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
export type {
  DataDb,
  SchedulePeriod,
  ScheduleChangePatch,
  StaffNotificationInput,
  StaffRequestUpdateInput,
  StaffAppealMessageInput,
  StaffAnnouncementInput,
} from './port';
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
  type CertificateRow,
  type CalendarSubscriptionRow,
  type TicketRow,
  type TicketMessageRow,
  type TicketStatus,
  type TicketSubject,
  type AnnouncementRow,
  type FeedbackRow,
  type FeedbackKind,
  type FeedbackTarget,
  type FeedbackStatus,
  /** DIG-68 — каталог студенческих стартапов «МСП» (/msp). */
  type MspCommentRow,
  type MspProjectRow,
  type MspVoteRow,
  /** DIG-43 — мероприятия вуза и запись (/events). */
  type CampusEventKind,
  type EventRegistrationRow,
  type EventRow,
  /** DIG-42 — «Дополнительное образование» (/dpo). */
  type DpoDocumentKind,
  type DpoDocumentRow,
  type DpoEnrollmentRow,
  type DpoFormat,
  type DpoProgramRow,
} from './types';
