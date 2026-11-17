// DIG-69 — английский словарь интерфейса.
//
// Набор ключей строго равен русскому (тип Record<keyof typeof ru, string>
// ловит расхождение на компиляции, юнит-тест — на рантайме).
//
// ДЕМО-КОНТЕНТ (ФИО, дисциплины, новости) не переводится — словарь покрывает
// только интерфейс кабинета.
import type { RuDictionary } from './ru';

export const en: Record<keyof RuDictionary, string> = {
  // ── menu ─────────────────────────────────────────────────────────────────
  'menu.dashboard': 'Home',
  'menu.tasks': 'Tasks',
  'menu.schedule': 'Schedule',
  'menu.grades': 'Grades',
  'menu.gradesShort': 'Grades',
  'menu.requests': 'Requests & certificates',
  'menu.requestsShort': 'Requests',
  'menu.notifications': 'Notifications',
  'menu.deanery': 'Deanery contact',
  'menu.feedback': 'Feedback',
  'menu.help': 'FAQ',
  'menu.guide': 'Guide',
  'menu.people': 'Directory',
  'menu.aiAssistant': 'AI assistant',
  'menu.profile': 'Profile',
  'menu.settings': 'Settings',
  'menu.more': 'More',
  'menu.staff': 'Overview',
  'menu.staffRequests': 'Requests',
  'menu.staffAppeals': 'Appeals',
  'menu.staffAnnouncements': 'Announcements',

  // ── page titles ──────────────────────────────────────────────────────────
  'title.dashboard': 'Home',
  'title.staffHome': 'Staff home',
  'title.tasks': 'Tasks',
  'title.schedule': 'Schedule',
  'title.grades': 'Academic performance',
  'title.gradebook': 'Gradebook',
  'title.session': 'Exam session',
  'title.requests': 'My requests',
  'title.notifications': 'Notifications',
  'title.deanery': 'Messages to the deanery',
  'title.feedback': 'Feedback to the management',
  'title.help': 'FAQ',
  'title.guide': 'How to use the cabinet',
  'title.people': 'Directory',
  'title.profile': 'Profile',
  'title.settings': 'Settings',
  'title.more': 'More',
  'title.news': 'News & announcements',
  'title.services': 'Services catalog',
  'title.staffDashboard': 'Deanery overview',
  'title.staffRequests': 'Request queue',
  'title.staffAppeals': 'Student appeals',
  'title.staffAnnouncements': 'Announcements',

  // ── concept banner ───────────────────────────────────────────────────────
  'concept.pill': 'Concept entry for the hackathon',
  'concept.banner':
    'Concept entry for the hackathon — not an official university service. All data is fictional.',
  'concept.bannerAria': 'Concept entry for the hackathon',

  // ── shell (menu / tab bar / search / sign out) ───────────────────────────
  'shell.skipToContent': 'Skip to content',
  'shell.navAria': 'Cabinet sections',
  'shell.tabsAria': 'Mobile navigation',
  'shell.brandAria': 'Digital Deanery — to the home page',
  'shell.brandName': 'Digital Deanery',
  'shell.searchAria': 'Search the cabinet (Command+K)',
  'shell.searchPlaceholder': 'Find a class, a teacher, a certificate…',
  'shell.assistantAria': 'AI assistant',
  'shell.userMenuAria': 'User menu',
  'shell.logout': 'Sign out',
  'shell.deadlineTitle': 'Next deadline',

  // ── language switch ──────────────────────────────────────────────────────
  'locale.switchAria': 'Interface language / Язык интерфейса',
  'locale.ru': 'Русский',
  'locale.en': 'English',

  // ── request filters ──────────────────────────────────────────────────────
  'filter.ALL': 'All',
  'filter.IN_WORK': 'In progress',
  'filter.NEEDS_ACTION': 'Action needed',
  'filter.READY': 'Ready',
  'filter.ARCHIVE': 'Archive',

  // ── request statuses ─────────────────────────────────────────────────────
  'status.SUBMITTED': 'Submitted',
  'status.ACCEPTED': 'Accepted',
  'status.IN_PROGRESS': 'In progress',
  'status.READY': 'Ready',
  'status.ISSUED': 'Issued',
  'status.NEEDS_FIX': 'Needs revision',
  'status.REJECTED': 'Rejected',
  'status.CANCELLED': 'Cancelled',
  'status.NEEDS_REVISION': 'Needs revision',
  'status.COMPLETED': 'Completed',

  // ── pipeline stepper ─────────────────────────────────────────────────────
  'stepper.stepOf': 'Step {step} of {total}',
  'stepper.stepOfLabel': 'Step {step} of {total}: {label}',

  // ── request card ─────────────────────────────────────────────────────────
  'card.submittedAt': 'submitted {date}',
  'card.downloadPdf': 'Download PDF',
  'card.fix': 'Fix',
  'card.cancel': 'Cancel',
  'card.cancelPending': 'Cancelling…',
  'card.cancelConfirm': 'Cancel this request? This action cannot be undone.',
  'card.openAria': 'Open request {number} — {title}',

  // ── next action line ─────────────────────────────────────────────────────
  'next.NEEDS_FIX': 'Revision needed: {reason}',
  'next.NEEDS_FIX_BARE': 'Revision needed',
  'next.REJECTED': 'Rejected: {reason}',
  'next.REJECTED_BARE': 'Rejected by the deanery',
  'next.READY': 'The document is ready for download',
  'next.ISSUED': 'Issued on {date}',
  'next.CANCELLED': 'Cancelled on {date}',
  'next.ACCEPTED_UNTIL': 'Ready by {date}',
  'next.ACCEPTED_BARE': 'Accepted by the deanery',
  'next.IN_PROGRESS_UNTIL': 'Ready by {date}',
  'next.IN_PROGRESS_BARE': 'The deanery is preparing the document',
  'next.SUBMITTED_UNTIL': 'Ready by {date}',
  'next.SUBMITTED_BARE': 'Waiting to be accepted by the deanery',

  // ── staff transition buttons ─────────────────────────────────────────────
  'action.ACCEPTED': 'Accept',
  'action.IN_PROGRESS': 'Start processing',
  'action.READY': 'Ready for pickup',
  'action.ISSUED': 'Issued',
  'action.NEEDS_FIX': 'Data fix needed',
  'action.NEEDS_REVISION': 'Needs revision',
  'action.COMPLETED': 'Completed',
  'action.REJECTED': 'Reject',
  'action.CANCELLED': 'Cancel',

  // ── transition confirmations ─────────────────────────────────────────────
  'taction.ACCEPTED': 'Request accepted',
  'taction.IN_PROGRESS': 'Request taken into processing',
  'taction.READY': 'Request ready for pickup',
  'taction.ISSUED': 'Document issued',
  'taction.NEEDS_FIX': 'Request returned for a data fix',
  'taction.NEEDS_REVISION': 'Request returned for revision',
  'taction.COMPLETED': 'Request completed',
  'taction.REJECTED': 'Request rejected',
  'taction.CANCELLED': 'Request cancelled',

  // ── staff status form ────────────────────────────────────────────────────
  'staffForm.title': 'Change status',
  'staffForm.reasonLabel': 'Reason (required for “Needs revision” and “Reject”)',

  // ── appeal statuses ──────────────────────────────────────────────────────
  'appeal.OPEN': 'New',
  'appeal.ANSWERED': 'Answered',
  'appeal.CLOSED': 'Closed',

  // ── empty states ─────────────────────────────────────────────────────────
  'empty.requestsTitle': 'No requests yet',
  'empty.requestsDesc':
    'Order a certificate or write a statement — the request will appear here with its ready-by date.',
  'empty.requestsStaffTitle': 'Student requests',
  'empty.requestsStaffDesc':
    'This section shows a student’s requests: it stays empty for staff. Staff reads are recorded in the access log.',
  'empty.noMatchTitle': 'Nothing found',
  'empty.noMatchDesc': 'Try another number or title — or reset the filter.',
  'empty.resetFilters': 'Reset filters',
  'empty.staffOnlyTitle': 'For students only',
  'empty.tasksStaffTitle': 'For students only',
  'empty.deaneryStaffDesc':
    'Threads with conversations open in the student cabinet. The staff inbox lives in the staff cabinet.',
  'empty.feedbackStaffDesc':
    'Suggestions, complaints and thank-yous to the management are created in the student cabinet.',
  'empty.tasksStaffDesc':
    'Tasks are collected per study group and student data. The staff cabinet with the request queue is a separate screen.',

  // ── requests list: search and CTA ────────────────────────────────────────
  'requests.searchAria': 'Search by request number and title',
  'requests.searchPlaceholder': 'Number or title: SR-2026, military office…',
  'requests.filtersAria': 'Request filters',
  'cta.orderCertificate': 'Order a certificate',

  // ── form buttons ─────────────────────────────────────────────────────────
  'btn.submit': 'Submit',
  'btn.submitting': 'Submitting…',
  'btn.saving': 'Saving…',
  'btn.resubmit': 'Resubmit',
  'btn.askQuestion': 'Ask a question',
  'btn.sendFeedback': 'Send message',
  'btn.createTicket': 'Create appeal',
  'btn.save': 'Save',
  'btn.cancel': 'Cancel',
  'btn.retry': 'Retry',

  // ── settings labels ──────────────────────────────────────────────────────
  'settings.tab.home': 'Home',
  'settings.tab.notifications': 'Notifications',
  'settings.tab.security': 'Security',
  'settings.tab.appearance': 'Appearance',
  'settings.tab.mcp': 'MCP setup',
  'settings.languageTitle': 'Interface language',
  'settings.languageHint': 'Switch the cabinet interface between Russian and English.',

  // ── toasts ───────────────────────────────────────────────────────────────
  'toast.saved': 'Saved',
  'toast.savedDesc': 'Your changes have been applied',
  'toast.localeChanged': 'Interface language changed',
  'toast.error': 'Something went wrong',
  'toast.errorDesc': 'Please try again.',
};
