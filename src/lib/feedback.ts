// DIG-40 — чистый модуль канала обратной связи «Предложение или жалоба
// руководству»: типы обращения, адресаты, видимые статусы, подписи и
// объяснения анонимности. Без React и серверных импортов — общий источник
// правды для экрана, слоя данных и тестов (как lib/tickets для DIG-39).

import type { FeedbackKind, FeedbackStatus, FeedbackTarget } from '@/server/data/types';

/** Типы обращения — фиксированный список из задачи. */
export const FEEDBACK_KINDS: FeedbackKind[] = ['SUGGESTION', 'COMPLAINT', 'GRATITUDE'];

export const FEEDBACK_KIND_LABELS: Record<FeedbackKind, string> = {
  SUGGESTION: 'Предложение',
  COMPLAINT: 'Жалоба',
  GRATITUDE: 'Благодарность',
};

/** Адресаты — фиксированный список из задачи. */
export const FEEDBACK_TARGETS: FeedbackTarget[] = [
  'DEANERY',
  'ACADEMIC_OFFICE',
  'PROGRAM_MANAGEMENT',
  'UNIVERSITY_MANAGEMENT',
];

export const FEEDBACK_TARGET_LABELS: Record<FeedbackTarget, string> = {
  DEANERY: 'Деканат',
  ACADEMIC_OFFICE: 'Учебный офис',
  PROGRAM_MANAGEMENT: 'Руководство программы',
  UNIVERSITY_MANAGEMENT: 'Руководство вуза',
};

/**
 * Видимые статусы обращения — ровно три. Внутренние статусы слоя данных
 * (NEW/IN_REVIEW/ANSWERED/RESOLVED) маппятся чистой функцией
 * `feedbackViewStatus` (как ticketViewStatus в DIG-39).
 */
export type FeedbackViewStatus = 'NEW' | 'ANSWERED' | 'RESOLVED';

export const FEEDBACK_VIEW_STATUS_LABELS: Record<FeedbackViewStatus, string> = {
  NEW: 'На рассмотрении',
  ANSWERED: 'Отвечено',
  RESOLVED: 'Решено',
};

export const FEEDBACK_VIEW_STATUS_TONES: Record<FeedbackViewStatus, string> = {
  NEW: 'bg-blue-50 text-blue-700 border-blue-200',
  ANSWERED: 'bg-amber-50 text-amber-700 border-amber-200',
  RESOLVED: 'bg-green-50 text-green-700 border-green-200',
};

/** NEW/IN_REVIEW → «На рассмотрении», ANSWERED → «Отвечено», RESOLVED → «Решено». */
export function feedbackViewStatus(status: FeedbackStatus): FeedbackViewStatus {
  switch (status) {
    case 'ANSWERED':
      return 'ANSWERED';
    case 'RESOLVED':
      return 'RESOLVED';
    case 'NEW':
    case 'IN_REVIEW':
      return 'NEW';
  }
}

/** Срок ответа — 3 рабочих дня (выходные пропускаются, lib/request-sla). */
export const FEEDBACK_RESPONSE_DAYS = 3;

/** Обещание срока ответа — на экране и на карточке. */
export const FEEDBACK_RESPONSE_PROMISE = 'Рассматриваем обращения в течение 3 рабочих дней';

/**
 * Что увидит адресат — объяснение под переключателем «Анонимно».
 * Включено: обращение не хранит связь с пользователем нигде (приёмка DIG-40),
 * поэтому отследить его в кабинете нельзя.
 */
export const ANONYMOUS_EXPLANATION_ON =
  'Адресат увидит только текст и вложения — без вашего имени, группы и номера зачётки. Отследить обращение в кабинете нельзя: оно не связано с вашим аккаунтом.';

/** Выключено (по умолчанию): адресат видит автора — так проще ответить. */
export const ANONYMOUS_EXPLANATION_OFF =
  'Адресат увидит ваше имя и учебную группу — так проще ответить предметно.';

/** Пояснение на странице подтверждения анонимного обращения. */
export const ANONYMOUS_SENT_NOTE =
  'Обращение не связано с вашим аккаунтом: оно не появится в списке обращений, и открыть его карточку нельзя.';

/** Пояснение страницы подтверждения: почему не показывается содержимое. */
export const SENT_PRIVACY_NOTE =
  'На странице подтверждения текст и вложения не показываются — только номер, статус и срок ответа.';

/** Лимиты вложений: до 3 файлов, каждый до 5 МБ (байты не хранятся). */
export const MAX_FEEDBACK_ATTACHMENTS = 3;
export const MAX_FEEDBACK_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const MAX_FEEDBACK_ATTACHMENT_NAME_LENGTH = 80;

/** Границы текста обращения. */
export const MIN_FEEDBACK_TEXT_LENGTH = 1;
export const MAX_FEEDBACK_TEXT_LENGTH = 2000;

/** Заголовок публичной ленты решённых предложений — дословно из задачи. */
export const FEEDBACK_OUTCOMES_TITLE = 'Что мы изменили по вашим предложениям';

const dueFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
});

/** Срок ответа на карточке и в подтверждении: «до 25 ноября». */
export function formatFeedbackDueAt(dueAt: Date): string {
  return `до ${dueFormatter.format(dueAt)}`;
}

const monthFormatter = new Intl.DateTimeFormat('ru-RU', {
  month: 'long',
  year: 'numeric',
});

/** Месяц публикации результата в ленте: «октябрь 2026». */
export function formatOutcomeMonth(resolvedAt: Date): string {
  return monthFormatter.format(resolvedAt);
}
