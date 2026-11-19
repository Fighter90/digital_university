// DIG-89 — EN-словарь ДЕМО-КОНТЕНТА и локализация уведомлений чтением.
//
// Паттерн DIG-87 (dashboard-format): схема БД не меняется, EN-контент сид-записей
// живёт здесь и выбирается по locale при рендере. Ключи — стабильные id сида
// (prisma/seed.ts и demo-seed.ts), RU-контент остаётся каноном дефолтной локали.
//
// МОДуль чистый (без next/headers и серверных импортов): импортируется и
// сервером, и клиентскими компонентами. Никакой кириллицы в EN-значениях —
// юнит-тест i18n-en-part3 проверяет это по всем записям.

import type { Locale } from '@/lib/i18n';
import {
  ACTION_LABELS_EN,
  DISCIPLINE_EN_BY_CODE,
  DISCIPLINE_EN_BY_NAME,
  FACULTY_EN,
  FUNDING_EN,
  GROUP_EN,
  NOTIFICATION_BODY_RULES_EN,
  NOTIFICATION_TITLE_RULES_EN,
  PROGRAM_EN,
  RU_MONTH_TO_EN,
  STUDY_FORM_EN,
  enDatePhrase,
  enRequestBody,
  enRequestName,
  NEWS_SOURCES_EN,
} from '@/lib/ru-translit';
import { requestNumberLabel } from '@/lib/requests-view';

// ── факультеты / группы / учебные формы (короткие подписи сида) ─────────────

/** EN-подпись факультета сида («ИТ» → «IT»); неизвестное — как есть. */
export function enFacultyLabel(faculty: string | null | undefined): string {
  if (!faculty) return '—';
  return FACULTY_EN[faculty] ?? faculty;
}

/** EN-подпись группы сида («ПИ-21» → «PI-21»); неизвестное — как есть. */
export function enGroupLabel(group: string | null | undefined): string {
  if (!group) return '—';
  return GROUP_EN[group] ?? group;
}

/** EN-подпись формы обучения («очная» → «full-time»). */
export function enStudyFormLabel(form: string | null | undefined): string {
  if (!form) return '—';
  return STUDY_FORM_EN[form] ?? form;
}

/** EN-подпись основы обучения («бюджет» → «state-funded»). */
export function enFundingLabel(funding: string | null | undefined): string {
  if (!funding) return '—';
  return FUNDING_EN[funding] ?? funding;
}

/** Подпись по локали-обёртка: RU — как есть, EN — словарь сида. */
export function localizedFaculty(locale: Locale, faculty: string | null | undefined): string {
  if (locale === 'en') return enFacultyLabel(faculty);
  return faculty ?? '—';
}

export function localizedGroup(locale: Locale, group: string | null | undefined): string {
  if (locale === 'en') return enGroupLabel(group);
  return group ?? '—';
}

// ── дисциплины сида (по коду и по RU-имени) — таблицы в ru-translit ──────────

/** EN-имя дисциплины по коду или RU-имени; неизвестное — как есть. */
export function enDisciplineName(
  key: { code?: string | null; name?: string | null } | string,
): string {
  if (typeof key === 'string') return DISCIPLINE_EN_BY_NAME[key] ?? key;
  if (key.code && DISCIPLINE_EN_BY_CODE[key.code]) return DISCIPLINE_EN_BY_CODE[key.code]!;
  if (key.name) return DISCIPLINE_EN_BY_NAME[key.name] ?? key.name;
  return key.name ?? '';
}

// ── программы (сид студентов) — таблица в ru-translit ────────────────────────

export function enProgramName(program: string | null | undefined): string {
  if (!program) return '—';
  return PROGRAM_EN[program] ?? program;
}

// ── мероприятия (/events, сид buildEvents) ───────────────────────────────────

export interface EnEventContent {
  title: string;
  description: string;
  location: string;
}

const EVENTS_EN: Record<string, EnEventContent> = {
  'ev-lecture-ai': {
    title: 'Lecture: how large language models work',
    description:
      'Open lecture by senior students and IT faculty: from tokens and embeddings to why models hallucinate. We break down the transformer step by step and run a tiny model right in the room. All examples use fictional prototype datasets.',
    location: 'Online stream',
  },
  'ev-career-day': {
    title: 'IT faculty career day',
    description:
      'Fictional partner companies, alumni stands and a quick resume review: in one evening you can visit every stand and book a mock interview. Come with one question about where to grow next — leave with three answers. All demo employers are fictional.',
    location: 'Main building, atrium',
  },
  'ev-tour': {
    title: 'Campus and labs tour',
    description:
      'Ninety minutes across the main campus spots: the library with its book-museum corner, the robotics lab and the main building rooftop with the best city view. Few spots — a small group so everyone can hear.',
    location: 'Main building, lobby',
  },
  'ev-hackathon': {
    title: 'Digital Breakthrough Hackathon',
    description:
      'A two-day hackathon for students of every faculty: teams form on site, tracks cover study services, campus life and a green campus. Dried apricots, coffee and fictional prizes guaranteed; the jury are deanery staff within the prototype.',
    location: 'Technopark, room 301',
  },
  'ev-webinar': {
    title: 'Online webinar: the data analyst career',
    description:
      'One hour about the analyst career track: first-year tasks, the tool stack and how to learn on real (in the demo — fictional) datasets. Half the webinar is Q&A — send questions in advance.',
    location: 'Online stream',
  },
  'ev-culture-night': {
    title: 'Culture night: open-air cinema',
    description:
      'An evening screening of student cinema classics on the square by the main building: a blanket, a thermos and good vibes. Half the programme is shorts filmed by students for the prototype contest.',
    location: 'Campus square',
  },
  'ev-openlab': {
    title: 'Open Lab: open doors at the labs',
    description:
      'Three hours of open doors at the teaching labs: robots, a computer-vision bench and a server room with legacy hardware being revived. Ask any questions — even about thesis projects.',
    location: 'Lab building',
  },
  'ev-resume': {
    title: 'Workshop: IT resumes and interviews',
    description:
      'An online career-center workshop: we review attendee resumes live and run a mock interview. Send your resume in advance — a few will be discussed as examples (all prototype data is fictional).',
    location: 'Online stream',
  },
};

/** EN-контент мероприятия по id; неизвестный id — null. */
export function enEvent(id: string): EnEventContent | null {
  return EVENTS_EN[id] ?? null;
}

/** Контент мероприятия по локали: RU — как в сиде, EN — словарь по id. */
export function localizedEvent(
  locale: Locale,
  row: { id: string; title: string; description: string; location: string; tags?: string[] | null },
): { title: string; description: string; location: string; tags: string[] } {
  if (locale !== 'en') {
    return {
      title: row.title,
      description: row.description,
      location: row.location,
      tags: row.tags ?? [],
    };
  }
  const en = enEvent(row.id);
  if (!en) {
    return {
      title: row.title,
      description: row.description,
      location: row.location,
      tags: row.tags ?? [],
    };
  }
  return { ...en, tags: row.tags ?? [] };
}

// ── программы ДПО (/dpo, сид buildDpoCatalog) ────────────────────────────────

export interface EnDpoProgram {
  title: string;
  description: string;
  tags: string[];
}

const DPO_PROGRAMS_EN: Record<string, EnDpoProgram> = {
  'dpo-analytics': {
    title: 'Data Analytics',
    description:
      'Collecting, cleaning and visualizing data on real cases: from spreadsheets to dashboards. The final project is an analytical report for a fictional university.',
    tags: ['data', 'SQL', 'dashboards'],
  },
  'dpo-uxui': {
    title: 'UX/UI Design',
    description:
      'User research, prototyping and design systems: from a scenario to a clickable mobile app mockup. Course cases are fictional.',
    tags: ['design', 'Figma', 'prototyping'],
  },
  'dpo-pm': {
    title: 'Project Management',
    description:
      'Planning, roles and communication in study and student projects: roadmap, risks and defending the project before a board (demo cases).',
    tags: ['management', 'agile'],
  },
  'dpo-python': {
    title: 'Python for Research',
    description:
      'The researcher Python stack: pandas, visualization and routine automation. We process fictional datasets of student surveys.',
    tags: ['python', 'science'],
  },
  'dpo-pedagogy': {
    title: 'Digital Pedagogy',
    description:
      'Online formats, feedback and assessment in a digital environment: designing a lesson for blended learning. The prototype is a showcase without document issuance.',
    tags: ['pedagogy', 'online lesson'],
  },
  'dpo-cybersec': {
    title: 'Cybersecurity Basics',
    description:
      'Basic digital-life hygiene: passwords, phishing, encryption and secure device settings. A practicum on isolated fictional examples.',
    tags: ['security', 'privacy'],
  },
};

export function enDpoProgram(id: string): EnDpoProgram | null {
  return DPO_PROGRAMS_EN[id] ?? null;
}

const DPO_DOCS_EN: Record<string, string> = {
  'dpo-doc-1': 'Training contract for the Data Analytics program',
  'dpo-doc-2': 'Certificate of educational services rendered',
  'dpo-doc-3': 'Professional development certificate: Python for Research',
};

export function enDpoDocTitle(id: string): string | null {
  return DPO_DOCS_EN[id] ?? null;
}

// ── каталог МСП (/msp, сид buildMspCatalog) ──────────────────────────────────

export interface EnMspProject {
  title: string;
  tagline: string;
  description: string;
  tags: string[];
}

const MSP_PROJECTS_EN: Record<string, EnMspProject> = {
  'msp-konspekt': {
    title: 'Notes Bot',
    tagline: 'AI lecture notes in a minute',
    description:
      'A student uploads a recording or lecture outline and the bot assembles structured notes with definitions and self-check questions. A thesis-prototype draft: runs on fictional recordings, sends nothing outside.',
    tags: ['ai', 'study', 'notes'],
  },
  'msp-repetitor': {
    title: 'Tutor.Market',
    tagline: 'A tutoring marketplace run by senior students',
    description:
      'Senior students publish consultations for their disciplines and freshmen book right from the cabinet. In the concept — a showcase with fictional profiles: ratings, reviews and slots are invented for the demo.',
    tags: ['mentoring', 'consultations'],
  },
  'msp-deadline': {
    title: 'Deadline Radar',
    tagline: 'Every semester deadline on one timeline',
    description:
      'Gathers course, retake and payment deadlines into a single timeline and sends quiet reminders three days ahead. An idea born after a sophomore’s first exam season; demo data is fictional.',
    tags: ['deadlines', 'planning'],
  },
  'msp-biblio': {
    title: 'BookSwap',
    tagline: 'Textbook exchange between cohorts',
    description:
      'Students mark textbooks they no longer need and junior cohorts reserve them for the next semester. A paper-form prototype of the catalog: all books and owners are fictional.',
    tags: ['books', 'sharing'],
  },
  'msp-timlider': {
    title: 'TeamLeader',
    tagline: 'Find a team for a hackathon or a course project',
    description:
      'Student cards with skills and roles: a designer looks for a frontender, a team lead assembles a squad before the contest deadline. Inside the demo — only fictional participants and projects.',
    tags: ['teams', 'hackathon'],
  },
  'msp-studcoffee': {
    title: 'StudentCoffee',
    tagline: 'A map of coffee shops with a student discount',
    description:
      'A student project about coffee near campus: a map of spots, busy hours and the student discount percentage. Every coffee shop in the demo is fictional — no real venues or commerce.',
    tags: ['campus', 'discounts'],
  },
  'msp-stipfond': {
    title: 'Stipend Fund',
    tagline: 'A calculator for scholarships and grants',
    description:
      'Estimates the expected scholarship from academic performance and suggests fictional contest grants matching the student profile. A first spreadsheet prototype; demo numbers are invented.',
    tags: ['scholarships', 'grants'],
  },
};

export function enMspProject(id: string): EnMspProject | null {
  return MSP_PROJECTS_EN[id] ?? null;
}

const MSP_COMMENTS_EN: Record<string, string> = {
  'msp-cmt-1':
    'Uploaded yesterday’s lecture notes — the structured outline with definitions came together in a minute. Nice!',
  'msp-cmt-2': 'Please add a PDF export for the notes — I want to print them before the seminar.',
  'msp-cmt-3':
    'The coffee shop by the second building is marked correctly on the map, and the student discount works.',
  'msp-cmt-4':
    'Booked a calculus consultation — the slots are visible right on the card, very convenient.',
  'msp-cmt-5':
    'We assembled a team for the contest in one evening: two frontenders and a designer found via the cards.',
};

export function enMspComment(id: string): string | null {
  return MSP_COMMENTS_EN[id] ?? null;
}

/** Контент проекта МСП по локали: RU — как в сиде, EN — словарь по id. */
export function localizedMspProject(
  locale: Locale,
  row: { id: string; title: string; tagline: string; description: string; tags: string[] },
): { title: string; tagline: string; description: string; tags: string[] } {
  const en = locale === 'en' ? enMspProject(row.id) : null;
  if (!en)
    return { title: row.title, tagline: row.tagline, description: row.description, tags: row.tags };
  return { title: en.title, tagline: en.tagline, description: en.description, tags: en.tags };
}

/** Текст комментария МСП по локали (сид-комментарии — по id). */
export function localizedMspComment(locale: Locale, row: { id: string; body: string }): string {
  if (locale !== 'en') return row.body;
  return enMspComment(row.id) ?? row.body;
}

// ── новости и объявления (/news, lib/news-catalog) ───────────────────────────

export interface EnNewsContent {
  title: string;
  excerpt: string;
  body?: string[];
  source?: string;
  attachments?: Array<{ name: string; sizeLabel: string }>;
}

const NEWS_EN: Record<string, EnNewsContent> = {
  'retake-order': {
    title: 'Retake rules have changed',
    excerpt:
      'From November 16 retakes follow the new procedure: first attempt with a board, then the second. The schedule is in the Session section.',
    source: 'Deanery',
    attachments: [{ name: 'Retake procedure (excerpt)', sizeLabel: 'TXT · 2 KB' }],
    body: [
      'From November 16 the fall semester follows the updated retake procedure. The first attempt takes place with a board, the second — on additional dates agreed with the deanery.',
      'The Computer Science retake is set for November 18, room 305, starting at 9:00. Bring your gradebook and student ID.',
      'The procedure was prepared by the deanery together with the departments. If the retake date conflicts with an illness or another valid reason, submit an application via the Requests section — the date will be moved.',
    ],
  },
  'scholarship-increased-docs': {
    title: 'Applications open for the increased scholarship',
    excerpt:
      'Documents for the increased state academic scholarship are accepted until November 30: studies, research, sports and community work.',
    source: 'Scholarship office',
    body: [
      'The scholarship board accepts documents for the increased state academic scholarship until November 30 inclusive.',
      'Achievements of the latest period count: excellent grades, publications, olympiad and contest wins, sports results and volunteer hours.',
      'A grade certificate is available instantly in the Performance section — the gradebook transcript downloads as a PDF. The lists will be approved by December 15.',
    ],
  },
  'pi21-lab-deadline': {
    title: 'Lab reports due November 24',
    excerpt:
      'Lab reports for Programming and Databases are accepted until November 24. Late work goes through the deanery only.',
    source: 'Deanery',
    body: [
      'For the Programming and Databases disciplines, lab reports are accepted until November 24 inclusive.',
      'The report format and the title-page template are in the course materials. Late work is accepted only via a deanery application with a valid reason.',
    ],
  },
  'pi21-curator-hour': {
    title: 'Curator hour: planning the exam session',
    excerpt:
      'On Friday, November 20, at 15:40 — a curator hour on session planning: consultation schedule, exam admission and retakes.',
    source: 'Group curator',
    body: [
      'The PI-21 group curator will host a meeting on session planning: how to structure preparation, when the consultations are and what exam admission requires.',
      'The meeting takes place on November 20 at 15:40, room 305. Questions can be sent in advance via Tickets with the subject “Consultation”.',
    ],
  },
  'pi21-algorithms-consult': {
    title: 'Extra consultation on algorithms',
    excerpt:
      'An extra consultation before the Algorithms and Data Structures colloquium: November 25, 16:00, room 402. Bring your course questions.',
    source: 'Computer science department',
    body: [
      'Before the Algorithms and Data Structures colloquium the teacher will hold an extra consultation: November 25 at 16:00, room 402.',
      'The colloquium topics are published in the course materials. The consultation covers complexity problems and graph traversals — bring your own examples.',
    ],
  },
  'ek11-retake-window': {
    title: 'EK-11 retake window: new slots',
    excerpt:
      'Extra calculus retake slots are open for EK-11: November 20 and 21. Sign up via a deanery ticket.',
    source: 'Deanery',
    body: [
      'Extra calculus retake slots are open for group EK-11: November 20 and 21, room 12.',
      'Sign up via Tickets with the subject “Retake”. Specify your preferred day — the deanery will confirm the slot with an in-cabinet notification.',
    ],
  },
  'ek11-quiz': {
    title: 'Economics quiz for EC students',
    excerpt:
      'The Economics faculty runs an inter-group quiz on November 28. Teams of three, register by November 25.',
    source: 'EC student council',
    body: [
      'The Economics faculty invites students to an inter-group economics quiz: November 28 at 14:00, room 18.',
      'Teams of three per group; registration is open until November 25 via group leaders. Winners receive tickets to the “Data Economics” conference.',
    ],
  },
  'it-hackathon': {
    title: 'IT faculty hackathon: registration open',
    excerpt:
      'Teams up to four, two tracks: student services and learning analytics. Registration until November 30, finals on December 12.',
    source: 'IT student council',
    attachments: [{ name: 'Hackathon regulations', sizeLabel: 'TXT · 1 KB' }],
    body: [
      'The IT faculty opens hackathon registration: teams up to four people, two tracks — student services and learning analytics.',
      'Teams work December 5–11 online; the finals and demos are on December 12 in room 402. For finalists the deanery reschedules classes upon request.',
      'The regulations with judging criteria and the jury lineup are attached to the news.',
    ],
  },
  'it-scholarship-science': {
    title: 'IT faculty scholarship for research papers',
    excerpt:
      'A faculty scholarship for research papers: applications until December 5. A 2026 publication or conference talk is required.',
    source: 'IT research board',
    body: [
      'The IT faculty established a named scholarship for research papers: one publication or conference talk from 2026 qualifies you to apply.',
      'Applications are accepted by the faculty research supervisor until December 5. The list of partner conferences is on the faculty board and in the FAQ, “Scholarships and payouts”.',
    ],
  },
  'it-labs-update': {
    title: 'IT computer classes: software update',
    excerpt:
      'From November 24 the dev environment updates in rooms 301 and 405. Classes follow the regular schedule; profiles will reset.',
    source: 'Computing center',
    body: [
      'From November 24 the development environment and compilers update in computer rooms 301 and 405. Classes follow the regular schedule.',
      'Local profiles in the rooms will reset — keep your work in personal repositories. Access is still by student ID card.',
    ],
  },
  'ek-roundtable': {
    title: 'Alumni round table of the Economics faculty',
    excerpt:
      'Economics faculty alumni discuss careers in analytics and finance: November 26 at 16:30, room 22. Open to everyone.',
    source: 'Economics faculty',
    body: [
      'On November 26 at 16:30 the Economics faculty hosts an alumni round table: careers in analytics, finance and consulting.',
      'Admission is open to students of all years, room 22. Questions for the speakers are collected in advance via the faculty student council.',
    ],
  },
  'university-library-night': {
    title: 'Library Night: programme and sign-up',
    excerpt:
      'On November 20 the library is open until midnight: quests, book recommendations and a quiet exam-prep zone. Student ID required.',
    source: 'Library',
    body: [
      'On November 20 the main library runs “Library Night”: the reading hall and a quiet exam-prep zone stay open until midnight.',
      'The programme includes a stacks quest, reading-curator recommendations and a tea point. Entry is free with a student ID.',
    ],
  },
  'university-dorm-movein': {
    title: 'Dormitory move-in: second wave',
    excerpt:
      'The second move-in wave for dormitory No. 2 starts December 1. Apply in the cabinet, type “Dormitory”, bring your contract.',
    source: 'Dormitory office',
    body: [
      'The dormitory office opened the second move-in wave for dormitory No. 2: move-in from December 1 to December 15.',
      'The application is submitted in the cabinet: Requests section, type “Dormitory”. Bring your contract and passport to move-in; the board allocates the spots.',
    ],
  },
  'university-dorm-payment': {
    title: 'New dormitory payment schedule',
    excerpt:
      'From December, dormitory payments are accepted by the 10th of each month. Over 5 days late — via the move-in board.',
    source: 'Dormitory office',
    body: [
      'From December, dormitory payments are accepted by the 10th of the current month — a single schedule for all buildings.',
      'Delays over 5 days are reviewed by the move-in board. Payment details and the procedure are in the FAQ, “Dormitory”, or with the dorm supervisor.',
    ],
  },
  'university-contest-deanery': {
    title: 'Digital services contest: student track',
    excerpt:
      'The university digital services contest opened a student track: ideas for the cabinet, schedule and requests. Applications until December 10.',
    source: 'University IT service',
    body: [
      'The university digital services contest opened a student track: propose improvements for the personal cabinet, schedule and requests.',
      'Applications are accepted until December 10; the format is a short idea description and a scenario. The best prototypes will move into development with the university IT team.',
    ],
  },
};

export function enNewsItem(id: string): EnNewsContent | null {
  return NEWS_EN[id] ?? null;
}

/** EN-подпись источника новости — таблица в ru-translit; неизвестное — как есть. */
export function enNewsSource(source: string): string {
  return NEWS_SOURCES_EN[source] ?? source;
}

// ── seed-уведомления (demo-seed buildNotifications + buildTickets) ──────────

const NOTIFICATION_SEED_EN: Record<string, { title: string; body: string }> = {
  'ntf-anna-1': {
    title: 'Class "Databases" rescheduled to room 214',
    body: 'The Databases lab today at 12:20 takes place in room 214 instead of 301 (change by the deanery).',
  },
  'ntf-anna-2': {
    title: 'Military deferment certificate is ready',
    body: 'The certificate is issued: a PDF with a verification code is available in the request card; pick-up in room 214.',
  },
  'ntf-anna-3': {
    title: 'Dormitory application accepted for processing',
    body: 'Maria Kovaleva is checking available spots; we will notify you separately once it is ready.',
  },
  'ntf-anna-4': {
    title: 'New grade: 85/100 — Databases project',
    body: 'The Databases course project scored 85 out of 100 (weight 0.3 in the final grade).',
  },
  'ntf-anna-5': {
    title: 'Dormitory payment — due November 25',
    body: 'The November invoice is issued: 3,450 ₽. Details and the receipt are in the dormitory application card.',
  },
  'ntf-anna-6': {
    title: 'Sign-up for pre-session consultations is open',
    body: 'Pre-session consultations are already on the group schedule. Sign up via “Deanery”, ticket subject “Consultation”.',
  },
  'ntf-anna-7': {
    title: 'Computer Science colloquium debt — due before the session',
    body: 'The Computer Science colloquium is not passed — a retake is required for exam admission: November 24 at 9:00, room 305.',
  },
  'ntf-anna-8': {
    title: 'Class "Physics" is cancelled today',
    body: 'The Physics lab today at 10:40 will not take place (building maintenance). The deanery apologizes for the inconvenience.',
  },
  'ntf-anna-9': {
    title: 'Ticket reply',
    body: 'Maria Kovaleva replied to your dormitory ticket.',
  },
  'ntf-ilya-1': {
    title: 'Class "Calculus" starts today at 9:00',
    body: 'The Calculus practice today: starts at 9:00 instead of 10:40 (same room, room 12).',
  },
  'ntf-ilya-2': {
    title: 'Contract payment — due November 20',
    body: 'The November payment under the training contract: 48,000 ₽. Attach the payment receipt to a deanery ticket.',
  },
  'ntf-ilya-3': {
    title: 'Request "Statistics credit transfer" — needs fixes',
    body: 'Attach a scan of the training contract and the course syllabus (hours, topics). Deadline — 5 business days.',
  },
  'ntf-ilya-4': {
    title: 'New grade: 81/100 — Economic Theory test',
    body: 'Test 1 in Economic Theory scored 81 out of 100 (weight 0.4 in the final grade).',
  },
  'ntf-ilya-5': {
    title: 'Summer internship request forwarded to the department',
    body: 'Maria Kovaleva forwarded the request to the economics department; a reply is expected by the end of the month.',
  },
  'ntf-ilya-6': {
    title: 'Cabinet updated: notifications are now grouped',
    body: 'The “Studies”, “Requests”, “Deanery” and “Finance” filters live in the Notifications section.',
  },
};

export function enNotificationSeed(id: string): { title: string; body: string } | null {
  return NOTIFICATION_SEED_EN[id] ?? null;
}

// ── сид-дедлайны курсов и ручные задачи ─────────────────────────────────────

const DEADLINES_EN: Record<string, string> = {
  'dl-pi21-phys-test': 'Test 1: Kinematics',
  'dl-pi21-hist-case': 'Case seminar: The Reforms of Alexander II',
  'dl-pi21-disc-project': 'Individual project: Graphs',
  'dl-pi21-alg-essay': 'Essay: NP-completeness',
  'dl-ek11-econ-essay': 'Essay: Labor markets',
  'dl-ek11-math-hw': 'Homework: Limits',
};

export function enStudyDeadline(id: string): string | null {
  return DEADLINES_EN[id] ?? null;
}

const STUDENT_TASKS_EN: Record<string, { title: string; note: string }> = {
  'task-anna-sign': {
    title: 'Sign the personal data processing consent',
    note: 'Scan of the signed consent',
  },
  'task-anna-pay': {
    title: 'Pay for studies under the contract',
    note: 'Contract DOG-2025-0147, second payment',
  },
  'task-ilya-pay': {
    title: 'Pay the remaining amount under the contract',
    note: 'Contract payment schedule',
  },
};

export function enStudentTask(id: string): { title: string; note: string } | null {
  return STUDENT_TASKS_EN[id] ?? null;
}

// ── обращения сотрудников (/staff/appeals) и тикеты деканата ────────────────

const APPEAL_SUBJECTS_EN: Record<string, string> = {
  'apl-anna-1': 'Physical education credit question',
  'apl-anna-2': 'Moving a Programming lab',
  'apl-ilya-1': 'Calculus retake',
};

export function enAppealSubject(id: string): string | null {
  return APPEAL_SUBJECTS_EN[id] ?? null;
}

/**
 * Тема обращения по локали: EN — словарь сида по id (неизвестное — RU-фолбэк,
 * пользовательские данные не выдумываем), RU — как в сиде байт-в-байт.
 */
export function localizeAppealSubject(
  locale: Locale,
  appeal: { id: string; subject: string },
): string {
  if (locale !== 'en') return appeal.subject;
  return enAppealSubject(appeal.id) ?? appeal.subject;
}

const APPEAL_MESSAGES_EN: Record<string, string> = {
  'msg-ilya-1a': 'Hello! Is an extra retake possible?',
  'msg-ilya-1b': 'The retake is scheduled for Friday, room 12.',
  'msg-anna-2a': 'Hello! Can the Wednesday lab be moved?',
  'msg-anna-2b': 'The lab moves to Thursday, room 305. Please confirm.',
  'msg-anna-1a': 'Hello! Does the PE credit from last semester count?',
};

export function enAppealMessage(id: string): string | null {
  return APPEAL_MESSAGES_EN[id] ?? null;
}

const TICKET_MESSAGES_EN: Record<string, string> = {
  'tktmsg-a-1':
    'Hello! Could you tell me when the decision on my dormitory application is due? Attaching a study certificate.',
  'tktmsg-a-2':
    'Good afternoon! The application has been accepted for processing; we are checking available spots. You will hear from us by the end of the week.',
  'tktmsg-b-1':
    'Please check the project grade for Databases: the cabinet shows 85, while 90 was announced at the defense.',
  'tktmsg-i-1': 'How do I transfer from a paid seat to a state-funded one?',
  'tktmsg-i-2':
    'A transfer application is submitted to the deanery by July 5. Requirements: GPA at least 4.0 and no academic debts. Your application was registered as No. 214.',
};

export function enTicketMessage(id: string): string | null {
  return TICKET_MESSAGES_EN[id] ?? null;
}

// ── объявления сотрудника ────────────────────────────────────────────────────

const ANNOUNCEMENTS_EN: Record<string, { title: string; body: string }> = {
  'ann-demo-pi21': {
    title: 'PI-21 group meeting',
    body: 'Tomorrow at 10:00, room 305: session and internship questions. Bring your gradebooks.',
  },
};

export function enAnnouncement(id: string): { title: string; body: string } | null {
  return ANNOUNCEMENTS_EN[id] ?? null;
}

/** Титул/текст объявления по локали: EN — словарь сида по id, RU — байт-в-байт. */
export function localizeAnnouncement(
  locale: Locale,
  row: { id: string; title: string; body: string },
): { title: string; body: string } {
  if (locale !== 'en') return { title: row.title, body: row.body };
  const en = enAnnouncement(row.id);
  return en ?? { title: row.title, body: row.body };
}

// ── обратная связь: сид-тексты ───────────────────────────────────────────────

const FEEDBACK_TEXTS_EN: Record<string, string> = {
  'fb-anna-1':
    'Please add a building filter to the schedule — it is handy to see only the classes nearby.',
  'fb-anna-2': 'Thank you for the extra consultations before the session — they really helped!',
  'fb-ilya-1':
    'The projector in room 12 of the economics building does not read laptops — half of the classes start with fixing the hardware.',
  'fb-anon-1':
    'Please add a dark theme to the cabinet — evening shifts in the library would be easier on the eyes.',
};

/** Публичная лента «Что мы изменили»: пары предложение → результат по номеру. */
const FEEDBACK_OUTCOMES_EN: Record<string, { suggestion: string; outcome: string }> = {
  'FB-2026-ZA11Q': {
    suggestion:
      'Let students book a deanery specialist right from the cabinet — nobody wants to wait in a corridor queue.',
    outcome:
      'Booking now lives in “Deanery”: the ticket goes to the program manager and the reply arrives in the cabinet.',
  },
  'FB-2026-ZB22R': {
    suggestion:
      'Show the certificate lead time right at order time, not after a call to the deanery.',
    outcome:
      'The lead time is now visible at order time and on the request card — counted in business days.',
  },
  'FB-2026-ZC33S': {
    suggestion:
      'Add a building filter to the schedule so only the classes in my building are visible.',
    outcome: 'The schedule gained a building picker: classes are filtered by the building.',
  },
};

export function enFeedbackOutcome(number: string): { suggestion: string; outcome: string } | null {
  return FEEDBACK_OUTCOMES_EN[number] ?? null;
}

export function enFeedbackText(id: string): string | null {
  return FEEDBACK_TEXTS_EN[id] ?? null;
}

// ── люди сида: имена и инициалы (DIG-93) ─────────────────────────────────────
// Таблицы с русскими ключами — в src/lib/ru-translit.ts (этот модуль не несёт
// кириллических литералов: тест i18n-en-part3 сканирует исходники).

import {
  CYRILLIC_LETTER,
  ELEMENT_NAME_EN,
  MANUAL_TASK_ORIGIN_RU,
  PEOPLE_NAME_EN,
  REQUEST_DESTINATION_EN,
  REQUEST_REASON_EN,
  SCHEDULE_NOTES_EN,
  TASK_VERB_EN,
  enAdmissionReasonText,
  enCountdownLabel,
  enExamKindLabel,
  enExamStatusLabel,
  enManualContractOrigin,
  enSeasonTitle,
  requestNumberFromTaskOrigin,
  submitTaskVerbTail,
} from '@/lib/ru-translit';

/** EN-имя демо-персоны; неизвестное — как есть (RU-фолбэк). */
export function enPersonName(name: string | null | undefined): string {
  if (!name) return '';
  return PEOPLE_NAME_EN[name] ?? name;
}

/** Имя персоны по локали: RU — как в сиде, EN — словарь. */
export function localizePersonName(locale: Locale, name: string | null | undefined): string {
  if (locale !== 'en') return name ?? '';
  return enPersonName(name);
}

/** Имя из профиля (полное ФИО): RU — как есть, EN — словарь. */
export function localizeProfileFullName(
  locale: Locale,
  fullName: string | null | undefined,
): string | null {
  if (!fullName) return null;
  return localizePersonName(locale, fullName);
}

/**
 * Инициалы аватара по локали.
 *  RU — прежнее поведение: первые буквы двух слов ФИО («АС»).
 *  EN — инициалы EN-имени из словаря («Anna Smirnova» → «AS»); неизвестное
 *  имя — инициалы из префикса email/логина («petr.novy@…» → «PN»), чтобы
 *  на EN никогда не появлялись кириллические буквы.
 */
export function localizeInitials(
  locale: Locale,
  name: string | null | undefined,
  fallbackEmail?: string | null,
): string {
  if (locale !== 'en') {
    return (name ?? '')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? '')
      .join('');
  }
  const enName = enPersonName(name ?? '');
  if (enName && !CYRILLIC_LETTER.test(enName)) {
    return enName
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? '')
      .join('');
  }
  // Фолбэк: префикс email/логина «petr.novy» → «PN».
  const prefix = (fallbackEmail ?? '').split('@')[0] ?? '';
  const fromEmail = prefix
    .split(/[.\s_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  if (fromEmail !== '') return fromEmail;
  // Совсем неизвестная персона: латинские буквы имени (кириллицу не рисуем).
  return (name ?? '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => {
      const letter = word[0]?.toUpperCase() ?? '';
      return CYRILLIC_LETTER.test(letter) ? '' : letter;
    })
    .join('');
}

/** EN-заметка пары/пересдачи; null и неизвестное — как есть (RU-фолбэк). */
export function enScheduleNote(note: string | null | undefined): string | null {
  if (!note) return note ?? null;
  return SCHEDULE_NOTES_EN[note] ?? note;
}

/** EN-имя элемента контроля; неизвестное — как есть. */
export function enElementName(name: string): string {
  return ELEMENT_NAME_EN[name] ?? name;
}

/**
 * Название заявки с ключевым параметром по локали: «Справка об обучении ·
 * для военкомата» → «Enrollment certificate · for the military office».
 * RU — байт-в-байт.
 */
export function localizeRequestCardTitle(locale: Locale, title: string): string {
  if (locale !== 'en') return title;
  const parts = title.split(' · ');
  const name = enRequestName(parts[0] ?? title);
  if (parts.length === 1) return name;
  const rest = parts.slice(1).map((part) => REQUEST_DESTINATION_EN[part] ?? part);
  return [name, ...rest].join(' · ');
}

/** Причина доработки/отказа по локали (EN — словарь канонических строк). */
export function localizeRequestReason(locale: Locale, reason: string | null): string | null {
  if (locale !== 'en' || reason === null) return reason;
  return REQUEST_REASON_EN[reason] ?? reason;
}

/** Титул сессии («Зимняя сессия») → EN; неизвестное — как есть. */
export { enSeasonTitle, enCountdownLabel } from '@/lib/ru-translit';

/** Диапазон сессии («23 декабря – 1 января») → EN-фраза дат. */
export function enSessionRangeLabel(label: string): string {
  return label
    .split('–')
    .map((part) => enDatePhrase(part.trim()))
    .join(' – ');
}

// ── задачи (/tasks): локализация глаголов и источников по локали ─────────────

/**
 * Одна строка задачи по локали. RU — байт-в-байт. EN-правила по источнику:
 *  - REQUEST: origin «Название · параметр · номер» → EN-название + транслит
 *    номера («ЗД-…» → «ZD-…», как в карточке заявки);
 *  - COURSE: «Сдать: {дедлайн}» → EN-глагол словаря + EN-титул по id сида;
 *  - SESSION: «Сдать: {элемент}» → EN-глагол + EN-имя элемента контроля;
 *  - RETAKE: origin-дисциплина → EN-имя дисциплины;
 *  - DEANERY: origin-тема обращения → EN по id сида;
 *  - MANUAL: title/note → EN по id ручной задачи.
 */
export function localizeTaskView(
  locale: Locale,
  task: {
    id: string;
    source: 'REQUEST' | 'COURSE' | 'SESSION' | 'RETAKE' | 'DEANERY' | 'MANUAL';
    verb: string;
    origin: string;
  },
): { verb: string; origin: string } {
  if (locale !== 'en') return { verb: task.verb, origin: task.origin };
  let verb = task.verb;
  let origin = task.origin;

  switch (task.source) {
    case 'REQUEST': {
      verb = TASK_VERB_EN[verb] ?? verb;
      // «Название · номер»: хвост «ЗД-2026-…» / «SR-2026-…» — канонический
      // номер заявки (на EN показывается транслитом «ZD-…», как в карточке).
      const parts = origin.split(' · ');
      const number = requestNumberFromTaskOrigin(origin);
      const titleParts = number === null ? parts : parts.slice(0, -1);
      origin =
        localizeRequestCardTitle('en', titleParts.join(' · ')) +
        (number ? ` · ${requestNumberLabel(number, 'en')}` : '');
      break;
    }
    case 'COURSE': {
      // Глагол может прийти уже собранным словарём с RU-титулом внутри
      // («Submit: Тест 1 «Кинематика»») или каноничным RU («Сдать: …») —
      // титул пересобираем по id сида, иначе по хвосту-элементу.
      const seedId = task.id.replace(/^course-/, '');
      const tail = submitTaskVerbTail(verb);
      const title = enStudyDeadline(seedId) ?? (tail !== null ? enElementName(tail) : null);
      if (title !== null) verb = `Submit: ${title}`;
      origin = enDisciplineName(origin);
      break;
    }
    case 'SESSION': {
      const tail = submitTaskVerbTail(verb);
      if (tail !== null) verb = `Submit: ${enElementName(tail)}`;
      origin = enDisciplineName(origin);
      break;
    }
    case 'RETAKE': {
      verb = TASK_VERB_EN[verb] ?? verb;
      origin = enDisciplineName(origin);
      break;
    }
    case 'DEANERY': {
      verb = TASK_VERB_EN[verb] ?? verb;
      const seedId = task.id.replace(/^deanery-/, '');
      origin = enAppealSubject(seedId) ?? origin;
      break;
    }
    case 'MANUAL': {
      const seedId = task.id.replace(/^manual-/, '');
      const en = enStudentTask(seedId);
      verb = en?.title ?? verb;
      // «Договор об образовании У-2026-114» → «Training contract U-2026-114»;
      // иные известные note — из словаря сида, неизвестные — как есть.
      const ruled = enManualContractOrigin(origin);
      origin = ruled ?? en?.note ?? (origin === MANUAL_TASK_ORIGIN_RU ? 'Deanery' : origin);
      break;
    }
  }
  return { verb, origin };
}

/** Локализация групп задач (вью агрегата /tasks и блока главной). */
export function localizeTasksData<G>(data: G, locale: Locale): G {
  if (locale !== 'en') return data;
  const dataRecord = data as Record<string, unknown>;
  const out = { ...dataRecord };
  for (const key of ['overdue', 'today', 'week', 'later']) {
    const list = dataRecord[key];
    if (Array.isArray(list)) {
      out[key] = list.map((task) => {
        const localized = localizeTaskView(locale, task as never);
        return { ...(task as object), ...localized };
      });
    }
  }
  return out as G;
}

// ── успеваемость (/grades): имена в агрегате ─────────────────────────────────

/** Структурный срез агрегата «Успеваемости» (только поля с демо-именами). */
export interface LocalizablePerformance {
  disciplines: Array<{
    disciplineCode: string;
    disciplineName: string;
    teacherName: string | null;
  }>;
  debts: Array<{ disciplineCode: string; disciplineName: string }>;
}

/**
 * Имена дисциплин/преподавателей/долгов агрегата по локали. RU — как есть
 * (тот же объект); EN — новые объекты, канон не мутируется.
 */
export function localizePerformanceData<D extends LocalizablePerformance>(
  locale: Locale,
  data: D,
): D {
  if (locale !== 'en') return data;
  return {
    ...data,
    disciplines: data.disciplines.map((discipline) => ({
      ...discipline,
      disciplineName: enDisciplineName({
        code: discipline.disciplineCode,
        name: discipline.disciplineName,
      }),
      teacherName: discipline.teacherName === null ? null : enPersonName(discipline.teacherName),
    })),
    debts: data.debts.map((debt) => ({
      ...debt,
      disciplineName: enDisciplineName({ code: debt.disciplineCode, name: debt.disciplineName }),
    })),
  };
}

// ── сессия (/grades/session): локализация вью агрегата ───────────────────────

interface SessionExamLike {
  disciplineCode: string;
  disciplineName: string;
  kindLabel: string;
  teacherName: string | null;
  statusLabel: string;
  admissionReason: string | null;
}

interface SessionRetakeLike {
  disciplineCode: string;
  disciplineName: string;
  note: string | null;
}

interface SessionConsultationLike {
  disciplineCode: string;
  disciplineName: string;
  teacherName: string;
}

interface SessionDataLike {
  seasonTitle: string;
  rangeLabel: string | null;
  countdown: { days: number; label: string } | null;
  exams: SessionExamLike[];
  retakes: SessionRetakeLike[];
  consultations: SessionConsultationLike[];
}

/** Причина недопуска («Не сдано: Тест 2») → EN («Missing: Test 2»). */
export function enAdmissionReason(reason: string | null): string | null {
  if (reason === null) return null;
  return enAdmissionReasonText(reason);
}

/**
 * Локализация вью «Сессии» (SessionData): шапка, статусы, причины,
 * дисциплины, преподаватели, заметки пересдач. RU — байт-в-байт (toEqual).
 */
export function localizeSessionData<D extends SessionDataLike>(locale: Locale, data: D): D {
  if (locale !== 'en') return data;
  return {
    ...data,
    seasonTitle: enSeasonTitle(data.seasonTitle),
    rangeLabel: data.rangeLabel === null ? null : enSessionRangeLabel(data.rangeLabel),
    countdown:
      data.countdown === null
        ? null
        : { ...data.countdown, label: enCountdownLabel(data.countdown.label) },
    exams: data.exams.map((exam) => ({
      ...exam,
      disciplineName: enDisciplineName({ code: exam.disciplineCode, name: exam.disciplineName }),
      kindLabel: enExamKindLabel(exam.kindLabel),
      teacherName: exam.teacherName === null ? null : enPersonName(exam.teacherName),
      statusLabel: enExamStatusLabel(exam.statusLabel),
      admissionReason: enAdmissionReason(exam.admissionReason),
    })),
    retakes: data.retakes.map((retake) => ({
      ...retake,
      disciplineName: enDisciplineName({
        code: retake.disciplineCode,
        name: retake.disciplineName,
      }),
      note: enScheduleNote(retake.note),
    })),
    consultations: data.consultations.map((item) => ({
      ...item,
      disciplineName: enDisciplineName({ code: item.disciplineCode, name: item.disciplineName }),
      teacherName: enPersonName(item.teacherName),
    })),
  };
}

// Таблицы с русскими ключами/регэкспами — в src/lib/ru-translit.ts.

/** RU-титул/текст заявки в «кавычках-ёлочках» → EN-кавычки. */

/** RU-титул/текст заявки в «кавычках-ёлочках» → EN-кавычки. */
function enQuotes(text: string): string {
  return text.replace(/«/g, '"').replace(/»/g, '"');
}

export interface LocalizableNotification {
  id?: string;
  title: string;
  body: string;
  actionLabel?: string | null;
}

export interface LocalizedNotification {
  title: string;
  body: string;
  actionLabel: string | null;
}

/**
 * Локализация строки уведомления по locale:
 *  1) seed-строка — точный словарь по id;
 *  2) runtime-строка — детерминированные шаблоны прототипа;
 *  3) неизвестное — строка возвращается как есть (RU-фолбэк).
 * RU-локаль возвращает исходные строки байт-в-байт.
 */
export function localizeNotification(
  locale: Locale,
  row: LocalizableNotification,
): LocalizedNotification {
  const actionLabel = (row.actionLabel ?? null) === null ? null : (row.actionLabel ?? null);
  const enAction = actionLabel === null ? null : (ACTION_LABELS_EN[actionLabel] ?? actionLabel);
  if (locale !== 'en') {
    return { title: row.title, body: row.body, actionLabel };
  }

  // 1) seed по id.
  const seed = row.id ? enNotificationSeed(row.id) : null;
  if (seed) return { title: seed.title, body: seed.body, actionLabel: enAction };

  // 2) известные шаблоны рантайма: формулы целиком (включая общий
  // префикс «Заявка …» → «Request …»), затем кавычки-ёлочки → EN-кавычки.
  let title = row.title;
  for (const [re, replacement] of NOTIFICATION_TITLE_RULES_EN) {
    title = title.replace(re, replacement);
  }

  // body: составные формулы (пересдача, ассистент, email, обращения, пары)…
  let body: string | null = row.body;
  for (const rule of NOTIFICATION_BODY_RULES_EN) {
    const out = rule(body);
    if (out !== null) {
      body = out;
      break;
    }
  }

  // …и схема ««Тип»: …» (canonical-requests): имя типа + предложения.
  if (body === row.body) {
    const named = enRequestBody(body);
    if (named !== null) body = named;
  }

  return { title: enQuotes(title), body: enQuotes(body), actionLabel: enAction };
}
