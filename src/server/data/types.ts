// DIG-12 — types of the isolated data layer.
//
// Structural row types mirror the DIG-9 Prisma schema (Student, ServiceRequest,
// Grade, Notification, Appeal, ScheduleEvent, ExamSession) so the layer can be
// driven by the in-memory adapter today and by a Prisma adapter one-to-one
// once the schema branch is merged. Enum unions deliberately do NOT import
// @prisma/client: the data layer must compile and test without it (DIG-11
// convention), the mapping enum↔union is a pure function in the adapter.

import type { CanonicalRequestStatus, RequestActor } from '../../lib/request-machine';

export type Role = 'STUDENT' | 'STAFF';

// Канонический мир заявок DIG-30: статусы (8 значений enum канона) и роли
// актёров переиспользуются из чистой машины состояний (lib/request-machine.ts).
export type { CanonicalRequestStatus, RequestActor };

export type RequestType = 'CERTIFICATE' | 'STATEMENT' | 'PRACTICE' | 'DORMITORY' | 'OTHER';

/**
 * Статус заявки. DIG-32: единый словарь UI — канон машины состояний
 * (lib/request-machine, 8 значений) плюс два ЛЕГАСИ-значения мира
 * prisma-сидов DIG-10 (NEEDS_REVISION / COMPLETED), которые на входе в
 * экран отображаются на канон функцией unifyRequestStatus
 * (lib/requests-view.ts): NEEDS_REVISION→NEEDS_FIX, COMPLETED→ISSUED.
 */
export type RequestStatus =
  | 'SUBMITTED'
  | 'ACCEPTED'
  | 'IN_PROGRESS'
  | 'READY'
  | 'ISSUED'
  | 'NEEDS_FIX'
  | 'REJECTED'
  | 'CANCELLED'
  | 'NEEDS_REVISION'
  | 'COMPLETED';

export type ActorRole = 'STUDENT' | 'STAFF';

export type NotificationType = 'SCHEDULE' | 'GRADE' | 'REQUEST' | 'NEWS' | 'DEADLINE' | 'SYSTEM';

/** DIG-19 — delivery channel of a notification (Telegram is «скоро»: off). */
export type NotificationChannel = 'PUSH' | 'EMAIL' | 'TELEGRAM';

/** DIG-19 — theme preference (DIG-44: dark is now applied to the UI). */
export type ThemePreference = 'LIGHT' | 'SYSTEM' | 'DARK';

/** DIG-44 — interface language (EN is a stub «скоро»: only RU is accepted). */
export type LanguagePreference = 'RU' | 'EN';

/** DIG-44 — UI font size applied to <html> (rem scale of the whole cabinet). */
export type FontSizePreference = 'NORMAL' | 'LARGE' | 'XLARGE';

/** DIG-44 — state of one dashboard widget (order = position in the array). */
export interface WidgetState {
  id: import('@/lib/dashboard-widgets').DashboardWidgetId;
  enabled: boolean;
}

/** DIG-44 — quiet hours window; notification generation pauses inside it. */
export interface QuietHoursSettings {
  enabled: boolean;
  /** «HH:MM» — window start. */
  from: string;
  /** «HH:MM» — window end (may be past midnight). */
  to: string;
}

/** DIG-58 — состояние подключения одного демо MCP-сервера (см. lib/mcp-servers). */
export interface McpServerState {
  id: import('@/lib/mcp-servers').McpServerId;
  connected: boolean;
}

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
 * DIG-44 adds the dashboard-widget list (order + visibility), quiet hours
 * and appearance prefs (language / font size / reduce motion).
 */
export interface StudentSettingsRow {
  studentId: string;
  phone: string | null;
  emailVisibleToStaff: boolean;
  phoneVisibleToStaff: boolean;
  notificationChannels: Record<NotificationType, Record<NotificationChannel, boolean>>;
  theme: ThemePreference;
  /** DIG-44 — порядок и видимость виджетов главной (см. lib/dashboard-widgets). */
  widgets: WidgetState[];
  /** DIG-44 — тихие часы (окно без генерации уведомлений в кабинете). */
  quietHours: QuietHoursSettings;
  /** DIG-44 — язык интерфейса (EN — заглушка «скоро»). */
  language: LanguagePreference;
  /** DIG-44 — размер шрифта интерфейса. */
  fontSize: FontSizePreference;
  /** DIG-44 — «Уменьшить анимацию». */
  reduceMotion: boolean;
  /**
   * DIG-65 — «Озвучка и голосовой ввод»: кнопка «Прослушать день» на
   * расписании и микрофон в AI-гиде (Web Speech API браузера, без внешних
   * ключей). По умолчанию включена; выключение скрывает голосовые функции
   * во всём кабинете.
   */
  voiceAssistant: boolean;
  /** DIG-58 — статусы подключения демо MCP-серверов (по каталогу lib/mcp-servers). */
  mcpConnections: McpServerState[];
  /** DIG-64 — персональный токен MCP-сервера деканата (хранится только хэш). */
  mcpToken: McpTokenRecord | null;
  updatedAt: Date;
}

/**
 * DIG-64 — персональный демо-MCP-токен студента: plaintext никогда не
 * сохраняется (только SHA-256-хэш, как у сессий DIG-11), превью — для
 * показа на вкладке «Настройка MCP». userId — auth-пользователь, выпустивший
 * токен (нужен, чтобы resolve строил ctx с честным actorUserId для аудита).
 */
export interface McpTokenRecord {
  tokenHash: string;
  tokenPreview: string;
  userId: string;
  createdAt: Date;
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

/**
 * DIG-30 — канонический мир заявок (модель Request схемы DIG-9, номер
 * «ЗД-ГГГГ-NNNNNN»). Существует ПАРАЛЛЕЛЬНО миру сидов (ServiceRequest,
 * номера SR-…) — оба мира заявки deliberately живут в слое данных
 * (см. reconcile DIG-49). Название заявки — «тип · ключевой параметр»
 * («Справка об обучении · для банка»), строится сервисом при подаче.
 */
export interface CanonicalRequestTypeRow {
  id: string;
  /** «CERT_ENROLLMENT», «GRADES_EXTRACT», «DIPLOMA_COPY»… */
  code: string;
  name: string;
  /** Срок готовности в РАБОЧИХ днях (выходные пропускаются, request-sla.ts). */
  etaDays: number | null;
  format: 'ELECTRONIC' | 'PAPER' | 'HYBRID';
  /** Мгновенный тип: при подаче сразу READY и PDF готов к скачиванию. */
  isInstant: boolean;
  /** JSON-схема полей формы (request-form-schema.ts валидирует zod'ом). */
  formSchema: unknown;
}

export interface CanonicalRequestRow {
  id: string;
  /** «ЗД-2026-000123» — публичный ключ, уникален. */
  number: string;
  studentId: string;
  typeCode: string;
  /** Денормализация имени типа (для списков без join по словарю). */
  typeName: string;
  /** Название «тип · ключевой параметр»; вычисляется при подаче. */
  title: string;
  params: Record<string, string>;
  status: CanonicalRequestStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CanonicalRequestEventRow {
  id: string;
  requestId: string;
  /** null = автоматика (создание мгновенной заявки сервисом). */
  actorUserId: string | null;
  actorRole: RequestActor | null;
  actorName: string;
  fromStatus: CanonicalRequestStatus | null;
  toStatus: CanonicalRequestStatus;
  /** Причина доработки/отказа или комментарий перехода. */
  comment: string | null;
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
  /**
   * DIG-35 — срочное уведомление (метка «Важно»): перенос/отмена пары сегодня,
   * недопуск, доработка заявки, дедлайн оплаты. Ставит ИСТОЧНИК уведомления,
   * не эвристика — поэтому необязательное поле.
   */
  important?: boolean;
  /** DIG-35 — подпись действия строки («Скачать», «Открыть расписание»); ведёт на link. */
  actionLabel?: string | null;
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
  /** DIG-24 — кто внёс изменение (панель «Детали пары»); null — «деканат». */
  changeAuthor?: string | null;
  /** DIG-24 — корпус аудитории (панель деталей); null — фолбэк «Главный корпус». */
  building?: string | null;
  /** DIG-24 — ссылка на онлайн-встречу (панель деталей). */
  onlineUrl?: string | null;
  /** DIG-24 — email преподавателя (панель деталей, «Написать»). */
  teacherEmail?: string | null;
  /** DIG-24 — домашнее задание пары (панель деталей). */
  homework?: string | null;
  /** DIG-24 — материалы пары (панель деталей). */
  materials?: string | null;
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

/** DIG-25 — дисциплина группы (кредиты для GPA и прогресса кредитов). */
export interface DisciplineRow {
  groupName: string;
  disciplineCode: string;
  disciplineName: string;
  /** Кредиты (ECTS) дисциплины. */
  credits: number;
  teacherName: string;
}

/**
 * DIG-25 — элемент плана контроля дисциплины: ПОЛНЫЙ план семестра,
 * включая ещё не оценённые элементы — на нём стоят «максимально возможная»
 * и «минимально гарантированная» оценки и needForTarget.
 */
export interface DisciplineElementRow {
  groupName: string;
  disciplineCode: string;
  disciplineName: string;
  elementCode: string;
  elementName: string;
  kind: ElementKind;
  /** Доля в итоговой оценке дисциплины (0..1). */
  weight: number;
  maxScore: number;
}

/**
 * DIG-29 — закреплённый студентом сервис каталога: одна строка на пару
 * (студент, сервис); порядок закрепления — по createdAt.
 */
export interface ServiceFavoriteRow {
  studentId: string;
  serviceId: string;
  createdAt: Date;
}

/**
<<<<<<< HEAD
 * DIG-36 — отметка «Прочитано» для новости/объявления: одна строка на пару
 * (студент, новость), owner-scoped по studentId. Сам контент новостей —
 * публичный вымышленный каталог (lib/news-catalog), здесь только отметки.
 */
export interface NewsReadRow {
  studentId: string;
  newsId: string;
  readAt: Date;
}

/**
=======
 * DIG-34 — дедлайн задания по дисциплине (система курсов; в концепте — сиды).
 * Групповая сущность: сдаёт вся группа, скоуп — `groupName`.
 */
export interface StudyDeadlineRow {
  id: string;
  groupName: string;
  disciplineCode: string;
  disciplineName: string;
  /** Название задания: «Тест 1 „Кинематика"». */
  title: string;
  /** Крайний срок сдачи. */
  dueAt: Date;
}

/**
 * DIG-34 — ручная задача студента (подписать документ, оплатить по договору):
 * выполняется вне кабинета и закрывается отметкой владельца. Скоуп —
 * `studentId`; отмеченные (doneAt) из открытого списка исчезают.
 */
export interface StudentTaskRow {
  id: string;
  studentId: string;
  /** Глагольная формулировка: «Оплатить обучение по договору». */
  title: string;
  /** Контекст (номер договора и т.п.); null — «Деканат». */
  note: string | null;
  dueAt: Date;
  doneAt: Date | null;
}


/**
 * DIG-47 — выданная справка: строка реестра проверки подлинности.
 * Публичный ключ — verificationCode (160 бит base32): по нему публичная
 * страница /verify/<код> отвечает БЕЗ входа, поэтому наружу из слоя
 * данных уходит только минимальное представление (см. certificates.ts) —
 * studentId/полное имя/заявка через публичный контракт не проходят.
 */
export interface CertificateRow {
  id: string;
  studentId: string;
  /** Заявка-основание (справки «вне заявки» — null, сид демо). */
  requestId: string | null;
  /** Тип документа, например «Справка об обучении». */
  documentType: string;
  /** Назначение («для банка»); null — по месту требования. */
  purpose: string | null;
  /** Номер справки на документе, «СП-ГГГГ-NNNNNN». */
  number: string;
  /** Канонический код проверки: base32 группами по 4 (≥128 бит). */
  verificationCode: string;
  issuedAt: Date;
  expiresAt: Date;
  /** Отзыв сотрудником деканата; null — действует. */
  revokedAt: Date | null;
  revokedReason: string | null;
}

/**
 * DIG-63 — живая ICS-подписка студента (расписание + дедлайны в системный
 * календарь): одна активная строка на студента. tokenId — неугадываемый
 * nonce внутри HMAC-подписанной ссылки (секрет только на сервере), поэтому
 * хранилище не содержит готового к употреблению bearer-секрета; ссылку
 * собирает слой данных при каждом чтении. Отзыв — удаление строки (выход
 * из кабинета): прежняя ссылка умирает навсегда, новый вход получает новый
 * tokenId.
 */
export interface CalendarSubscriptionRow {
  studentId: string;
  tokenId: string;
  createdAt: Date;
  /** Момент последней ротации (отзыв + повторная выдача); null — не ротировалась. */
  rotatedAt: Date | null;
}

/**
 * Строка настроек, как она лежит в хранилище: полная (DIG-44) или «легаси» —
 * записанная до DIG-44 без новых полей. Вход `normalizeSettings`, который
 * восстанавливает недостающее из значений по умолчанию.
 */
export type StoredStudentSettingsRow = Omit<
  StudentSettingsRow,
  | 'widgets'
  | 'quietHours'
  | 'language'
  | 'fontSize'
  | 'reduceMotion'
  | 'voiceAssistant'
  | 'mcpConnections'
  | 'mcpToken'
> &
  Partial<
    Pick<
      StudentSettingsRow,
      | 'widgets'
      | 'quietHours'
      | 'language'
      | 'fontSize'
      | 'reduceMotion'
      | 'voiceAssistant'
      | 'mcpConnections'
      | 'mcpToken'
    >
  >;

/**
>>>>>>> origin/main
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
