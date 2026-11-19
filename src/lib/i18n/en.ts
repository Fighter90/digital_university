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
  // DIG-73 — MCP documentation page.
  'menu.mcp': 'Connect your assistant (MCP)',
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
  // DIG-73 — MCP documentation page.
  'title.mcp': 'Connect your assistant (MCP)',
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

  // ── DIG-86 — Accessibility tab: large text and no effects ────────────────
  'settings.tab.accessibility': 'Accessibility',
  'settings.a11yTitle': 'Large text and no effects',
  'settings.a11yHint':
    'Low-vision mode: larger text and a static interface without animations or shadows. The setting is independent of system preferences and applies to the whole cabinet.',
  'settings.a11yLargeText': 'Large text',
  'settings.a11yLargeTextHint':
    '125% base size, stronger weights and wider spacing — across the whole cabinet.',
  'settings.a11yNoEffects': 'No effects',
  'settings.a11yNoEffectsHint':
    'Animations, smooth reveals and shadows are disabled — the interface is static.',
  'settings.a11ySaved': 'Saved — accessibility mode applied across the whole cabinet.',
  'settings.a11yIdle': 'Changes are saved instantly and applied across the whole cabinet.',

  // ── toasts ───────────────────────────────────────────────────────────────
  'toast.saved': 'Saved',
  'toast.savedDesc': 'Your changes have been applied',
  'toast.localeChanged': 'Interface language changed',
  'toast.error': 'Something went wrong',
  'toast.errorDesc': 'Please try again.',

  // ── DIG-42 — continuing education (/dpo) ─────────────────────────────────
  'title.dpo': 'Continuing education',
  'menu.dpo': 'Extra education',
  'dpo.subtitle':
    'Courses and professional training: catalog, your enrollments and documents. All data is fictional; no real admissions in the prototype.',
  'dpo.tab.catalog': 'Program catalog',
  'dpo.tab.my': 'My programs',
  'dpo.tab.docs': 'Documents',
  'dpo.format.all': 'All',
  'dpo.format.online': 'Online',
  'dpo.format.offline': 'On-site',
  'dpo.format.hybrid': 'Hybrid',
  'dpo.card.hours': '{hours} academic hours',
  'dpo.card.startsAt': 'Starts {date}',
  'dpo.price.free': 'Free in the prototype',
  'dpo.price.rub': '₽{price}',
  'dpo.enroll': 'Enroll',
  'dpo.enroll.done': 'Enrolled ✓',
  'dpo.enroll.alreadyTitle': 'You are already enrolled in this program',
  'dpo.enroll.studentsOnly': 'Enrollment is available to students',
  'dpo.continue': 'Continue',
  'dpo.my.continueHint': 'Course materials will appear in the full version of the cabinet',
  'dpo.my.progressOf': '{percent} %',
  'dpo.my.progressAria': 'Progress in “{title}”',
  'dpo.my.emptyTitle': 'No enrollments yet',
  'dpo.my.emptyDesc': 'Pick a program in the catalog and enroll — it will appear here.',
  'dpo.docs.emptyTitle': 'No documents yet',
  'dpo.docs.emptyDesc': 'Contracts, acts and certificates for your programs will appear here.',
  'dpo.catalog.emptyTitle': 'No programs found',
  'dpo.catalog.emptyDesc': 'Nothing matches this format — try another filter.',
  'dpo.doc.contract': 'Contract',
  'dpo.doc.act': 'Act',
  'dpo.doc.receipt': 'Receipt',
  'dpo.doc.certificate': 'Certificate',
  'dpo.download': 'Download',
  'dpo.doc.downloadHint': 'Available after graduation',

  // ── DIG-84 — /grades: performance summary ─────────────────────────────────
  'grades.semestersAria': 'Semesters',
  'grades.term.fall.short': 'Fall',
  'grades.term.spring.short': 'Spring',
  'grades.term.fall.full': 'Fall semester',
  'grades.term.spring.full': 'Spring semester',
  'grades.gpaRingLabel': 'Semester GPA',
  'grades.gpaTitle': 'GPA',
  'grades.overallPrefix': 'Overall:',
  'grades.deltaTo': 'vs {semester}',
  'grades.credits': 'Credits',
  'grades.creditsSuffix': 'of {required}',
  'grades.groupRating': 'Group ranking',
  'grades.rankOf': '{rank} of {total}',
  'grades.howCalculated': 'How it works',
  'grades.bestPercent': 'You are in the top {percent}% of your group',
  'grades.soleStudent': 'You are the only student in the group',
  'grades.errorTitle': 'Performance failed to load',
  'grades.errorDesc': 'Refresh the page — if the error persists, contact the deanery.',
  'grades.emptyTitle': 'No grades yet',
  'grades.sessionLink': 'Exam session — consultations and exams schedule',
  'grades.appealLink': 'Found a grading mistake? Write to the deanery',

  // plain-word hints for abbreviations
  'grades.gpaHint':
    'GPA is the average score weighted by discipline credits: a 5-credit course counts twice as much as a 2.5-credit one. Ongoing disciplines are included with their current accumulated score.',
  'grades.creditsHint':
    'Credits are units of course volume (ECTS). The whole program requires 240 credits; completed disciplines with a score at or above the pass threshold are counted.',
  'grades.creditsShortHint':
    'A credit is the volume of a discipline: 1 credit ≈ 36 academic hours.',
  'grades.percentileHint':
    'Your place in the group is based on the overall GPA among the students of the group. GPA is the credit-weighted score across all disciplines; “top N%” is the share of the group with a score no higher than yours.',

  // discipline cards: thresholds and admission
  'grades.creditsShort': '{credits} cr.',
  'grades.level.excellent': 'Excellent',
  'grades.level.good': 'Good',
  'grades.level.satisfactory': 'Satisfactory',
  'grades.level.belowPass': 'Below the pass threshold',
  'grades.level.noGrades': 'No grades yet',
  'grades.level.riskUnreachable': 'Threshold out of reach',
  'grades.level.passSecured': 'Threshold already secured',
  'grades.level.passNotGuaranteed': 'Threshold not guaranteed yet',
  'grades.maxPossible': 'of a possible {score}',
  'grades.noTeacher': 'No teacher listed',
  'grades.admission.graded': 'Exam passed',
  'grades.admission.admitted': 'Admitted to the exam',
  'grades.admission.notAdmitted': 'Not admitted to the exam',

  // traffic light
  'grades.tl.debtsTitle': 'Debts pending',
  'grades.tl.debtsPhrase': '{count} active debts. Nearest retake — {discipline}',
  'grades.tl.toDebts': 'To debts',
  'grades.tl.riskTitle': 'At risk',
  'grades.tl.riskPhrase':
    '{count} {word} in the risk zone: in {discipline} the {threshold}-point threshold is out of reach — talk to the teacher',
  'grades.tl.toSession': 'To exams',
  'grades.tl.okTitle': 'All good',
  'grades.tl.okPhrase': 'All current grades are above the pass threshold — keep it up',
  'grades.tl.idleTitle': 'No grades yet',
  'grades.tl.idlePhrase': 'No grades in this semester yet',

  // empty semester and “first assessment”
  'grades.kind.exam': 'Exam',
  'grades.kind.credit': 'Credit test',
  'grades.emptyNote.assessment':
    'First assessment — {kind} in {discipline} on {date}. Grades will appear after it.',
  'grades.emptyNote.current':
    'No grades in this semester yet — they will appear after the first assessment.',
  'grades.emptyNote.past':
    'No grades were recorded for this semester — they will appear after the first assessment.',

  // debts
  'grades.debtsTitle': 'Debts',
  'grades.debt.assigned': 'Scheduled',
  'grades.debt.overdue': 'Overdue',
  'grades.debt.closed': 'Cleared',
  'grades.debt.overduePhrase': 'The retake was on {date} — the debt is still open',
  'grades.debt.assignedToday': 'The retake is scheduled for {date} — today',
  'grades.debt.assignedIn': 'The retake is scheduled for {date} ({days} {word} left)',
  'grades.debt.closedPhrase': 'The debt is cleared — the retake on {date} has been credited',
  'grades.retakeSignup': 'Sign up for the retake',

  // ── DIG-84 — gradebook and transcript ─────────────────────────────────────
  'gradebook.studentsOnlyDesc':
    'The gradebook shows a student’s grades — this section stays empty for staff.',
  'gradebook.downloadTranscript': 'Download transcript PDF',
  'gradebook.subtitle':
    'Grades by semester with results. The transcript downloads instantly — no request, no queue.',
  'gradebook.overallAverage': 'Overall GPA',
  'gradebook.creditsEarned': 'Credits earned',
  'gradebook.creditsOf': '{earned} of {required}',
  'gradebook.emptyTitle': 'No grades yet',
  'gradebook.emptyDesc':
    'As soon as the deanery posts the first grades, they will appear here by semester. You can already download the transcript — it will be empty.',
  'gradebook.averageOf': 'Average: {average}',
  'gradebook.creditsLabel': 'Credits: {earned} of {total}',
  'gradebook.col.discipline': 'Discipline',
  'gradebook.col.control': 'Assessment',
  'gradebook.col.credits': 'Credits',
  'gradebook.col.final': 'Final',
  'gradebook.col.date': 'Date',
  'gradebook.noFinalYet': 'Final grade not posted yet',
  'gradebook.semesterEmpty':
    'No grades in this semester yet — the result will appear once the deanery posts grades.',
  'control.EXAM': 'Exam',
  'control.DIFF_CREDIT': 'Diff. credit test',
  'control.CREDIT': 'Credit test',

  // transcript PDF (document)
  'transcript.title': 'Academic transcript',
  'transcript.university': 'Digital Deanery (demonstration university)',
  'transcript.concept': 'Concept entry for the hackathon. All data is fictional.',
  'transcript.student': 'Student: {name}',
  'transcript.studentMissing': 'Student: —',
  'transcript.groupCourse': 'Group: {group}   Year: {course}',
  'transcript.program': 'Program: {program}',
  'transcript.gradebookNo': 'Gradebook number: {number}',
  'transcript.issueDate': 'Issue date: {date}',
  'transcript.col.discipline': 'Discipline',
  'transcript.col.control': 'Assessment',
  'transcript.col.credits': 'Cr',
  'transcript.col.final': 'Final',
  'transcript.col.date': 'Date',
  'transcript.semesterLine': 'Semester average: {average}   Credits: {earned} of {total}',
  'transcript.noGrades': 'No grades in the gradebook.',
  'transcript.overallAverage': 'Overall GPA: {average}',
  'transcript.creditsEarned': 'Credits earned: {earned} of {required}',
  'transcript.verifyTitle': 'Document authenticity verification',
  'transcript.verifyCode': 'Verification code: {code}',
  'transcript.verifyLink': 'Verify via the link or QR code: {url}',
  'transcript.generated': 'Prototype electronic document. Generated: {datetime}',

  // ── DIG-84 — request card (/requests/[number]) ────────────────────────────
  'requests.subtitle':
    'Certificates and statements in one place: you always see where each request is and what is expected next.',
  'requests.backAll': '← All requests',
  'requests.submittedPrefix': 'submitted',
  'requests.resultTitle': 'Result',
  'requests.certificateReady': 'Certificate ready',
  'requests.certificateDesc':
    'Download the PDF or verify it by code — the verification page opens without signing in (for a bank, military office or employer).',
  'requests.downloadCertificate': 'Download certificate (PDF)',
  'requests.verifyAuthenticity': 'Verify authenticity',
  'requests.historyTitle': 'Request history',
  'requests.expectedAfterFix': 'Due — after the fix',
  'requests.readyBy': 'Ready by {date}',
  'requests.ledBy': 'Handled by: {name}',
  'requests.ledByUnassigned': 'a deanery staff member',
  'requests.fixAlert': 'Revision needed. What to fix: {reason}',
  'requests.rejectedAlert': 'Rejected: {reason}',
  'requests.documentReady': 'Document ready',
  'requests.documentDesc':
    'PDF with a verification QR code. Download it as many times as you need — the document is generated on download.',
  'requests.previewAria': 'Preview of document {number}',
  'requests.previewFallback': 'Preview is not supported by this browser — download the PDF below.',
  'requests.cancelRequest': 'Cancel the request',
  'requests.paramsTitle': 'Request parameters',
  'requests.attachments': 'Attachments',
  'requests.param.language': 'Language',
  'requests.param.destination': 'Submitted to',
  'requests.param.copies': 'Copies',
  'requests.param.delivery': 'Delivery method',
  'requests.param.comment': 'Comment',
  'requests.fix.label': 'What was fixed',
  'requests.fix.placeholder': 'For example: fixed the name in Latin script, attached a scan',
  'requests.fix.success': 'Request resubmitted',
  'requests.email.send': 'Send by email',
  'requests.email.sending': 'Sending…',
  'requests.email.sentTo': 'Sent to {email}',
  'requests.copy': 'Copy',
  'requests.copied': 'Copied',
  'requests.copyAria': 'Copy request number {number}',

  // ── DIG-84 — AI insight “What changed” ────────────────────────────────────
  'insight.title': 'What changed',
  'insight.badge': 'AI analysis',
  'insight.subtitle': 'Demo analysis of your grades in {semester}, no external services.',
  'insight.chartAria': 'Average score chart',
  'insight.pointAria': '{date} — average {average} out of 100',
  'insight.currentPrefix': '{date} — average score',
  'insight.outOf100': 'out of 100',
  'insight.deltaToPrev': 'vs previous',
  'insight.firstWork': 'first work of the semester',
  'insight.worksTitle': 'Works in the average ({count}):',
  'insight.scoreOf': '{score} out of {max}',
  'insight.h.none': 'No new grades in the last month',
  'insight.d.none': 'The average holds at {current} out of 100.',
  'insight.h.new.one':
    'One new grade appeared this month — the average reached {current} out of 100',
  'insight.h.new.many':
    '{count} {word} appeared this month — the average reached {current} out of 100',
  'insight.d.new.first': 'The average is set by “{work}” ({discipline}, {score} out of {max}).',
  'insight.h.up': 'The average rose by {delta} {word} this month: from {baseline} to {current}',
  'insight.h.down': 'The average fell by {delta} {word} this month: from {baseline} to {current}',
  'insight.h.flat': 'The average is unchanged this month: {current} out of 100',
  'insight.d.flat': 'Recent works ({count}) did not move the average.',
  'insight.d.topWork':
    '“{work}” ({discipline}, {score} out of {max}) {verb} the average the most: {value} {word}.',
  'insight.verb.up': 'raised',
  'insight.verb.down': 'lowered',
};
