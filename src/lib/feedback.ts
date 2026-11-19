// DIG-40 — чистый модуль канала обратной связи «Предложение или жалоба
// руководству»: типы обращения, адресаты, видимые статусы, подписи и
// объяснения анонимности. Без React и серверных импортов — общий источник
// правды для экрана, слоя данных и тестов (как lib/tickets для DIG-39).
//
// DIG-89 — подписи и пояснения получили локаль (дефолт 'ru' — прежние
// байт-в-байт строки); EN — словарь i18n.

import { t, type Locale } from '@/lib/i18n';
import type { FeedbackKind, FeedbackStatus, FeedbackTarget } from '@/server/data/types';

/** Типы обращения — фиксированный список из задачи. */
export const FEEDBACK_KINDS: FeedbackKind[] = ['SUGGESTION', 'COMPLAINT', 'GRATITUDE'];

// DIG-89 — подписи из словаря: RU байт-в-байт прежние литералы, EN — словарь.

export const FEEDBACK_KIND_LABELS: Record<FeedbackKind, string> = {
  SUGGESTION: t('ru', 'feedback.type.SUGGESTION'),
  COMPLAINT: t('ru', 'feedback.type.COMPLAINT'),
  GRATITUDE: t('ru', 'feedback.type.GRATITUDE'),
};

/** Адресаты — фиксированный список из задачи. */
export const FEEDBACK_TARGETS: FeedbackTarget[] = [
  'DEANERY',
  'ACADEMIC_OFFICE',
  'PROGRAM_MANAGEMENT',
  'UNIVERSITY_MANAGEMENT',
];

export const FEEDBACK_TARGET_LABELS: Record<FeedbackTarget, string> = {
  DEANERY: t('ru', 'feedback.target.DEANERY'),
  ACADEMIC_OFFICE: t('ru', 'feedback.target.ACADEMIC_OFFICE'),
  PROGRAM_MANAGEMENT: t('ru', 'feedback.target.PROGRAM_MANAGEMENT'),
  UNIVERSITY_MANAGEMENT: t('ru', 'feedback.target.UNIVERSITY_MANAGEMENT'),
};

/**
 * Видимые статусы обращения — ровно три. Внутренние статусы слоя данных
 * (NEW/IN_REVIEW/ANSWERED/RESOLVED) маппятся чистой функцией
 * `feedbackViewStatus` (как ticketViewStatus в DIG-39).
 */
export type FeedbackViewStatus = 'NEW' | 'ANSWERED' | 'RESOLVED';

export const FEEDBACK_VIEW_STATUS_LABELS: Record<FeedbackViewStatus, string> = {
  NEW: t('ru', 'feedback.status.NEW'),
  ANSWERED: t('ru', 'feedback.status.ANSWERED'),
  RESOLVED: t('ru', 'feedback.status.RESOLVED'),
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
export const FEEDBACK_RESPONSE_PROMISE = t('ru', 'feedback.responsePromise');

/**
 * Что увидит адресат — объяснение под переключателем «Анонимно».
 * Включено: обращение не хранит связь с пользователем нигде (приёмка DIG-40),
 * поэтому отследить его в кабинете нельзя.
 */
export const ANONYMOUS_EXPLANATION_ON = t('ru', 'feedback.anon.hint.on');

/** Выключено (по умолчанию): адресат видит автора — так проще ответить. */
export const ANONYMOUS_EXPLANATION_OFF = t('ru', 'feedback.anon.hint.off');

/** Пояснение на странице подтверждения анонимного обращения. */
export const ANONYMOUS_SENT_NOTE = t('ru', 'feedback.anon.notTrackable');

/** Пояснение страницы подтверждения: почему не показывается содержимое. */
export const SENT_PRIVACY_NOTE = t('ru', 'feedback.sent.previewNote');

/** Лимиты вложений: до 3 файлов, каждый до 5 МБ (байты не хранятся). */
export const MAX_FEEDBACK_ATTACHMENTS = 3;
export const MAX_FEEDBACK_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const MAX_FEEDBACK_ATTACHMENT_NAME_LENGTH = 80;

/** Границы текста обращения. */
export const MIN_FEEDBACK_TEXT_LENGTH = 1;
export const MAX_FEEDBACK_TEXT_LENGTH = 2000;

/** Заголовок публичной ленты решённых предложений — дословно из задачи. */
export const FEEDBACK_OUTCOMES_TITLE = t('ru', 'feedback.outcomes.title');

const dueFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
});

/** Срок ответа на карточке и в подтверждении: «до 25 ноября». */
export function formatFeedbackDueAt(dueAt: Date): string {
  return `${t('ru', 'feedback.duePrefix')} ${dueFormatter.format(dueAt)}`;
}

const monthFormatter = new Intl.DateTimeFormat('ru-RU', {
  month: 'long',
  year: 'numeric',
});

/** Месяц публикации результата в ленте: «октябрь 2026». */
export function formatOutcomeMonth(resolvedAt: Date): string {
  return monthFormatter.format(resolvedAt);
}

// ── DIG-89 — EN-подписи по локали ────────────────────────────────────────────

/** EN-обещание срока ответа (для карточек на EN). */
export const FEEDBACK_RESPONSE_PROMISE_EN =
  'We review submissions within 3 business days';

/** Подпись типа обращения: «Предложение» / «Suggestion». */
export function feedbackTypeLabel(kind: FeedbackKind, locale: Locale = 'ru'): string {
  if (locale === 'en') return t('en', `feedback.type.${kind}` as const);
  return FEEDBACK_KIND_LABELS[kind];
}

/** Подпись адресата: «Деканат» / «Deanery». */
export function feedbackTargetLabel(target: FeedbackTarget, locale: Locale = 'ru'): string {
  if (locale === 'en') return t('en', `feedback.target.${target}` as const);
  return FEEDBACK_TARGET_LABELS[target];
}

/** Подпись видимого статуса: «На рассмотрении» / «Under review». */
export function feedbackStatusLabel(status: FeedbackViewStatus, locale: Locale = 'ru'): string {
  if (locale === 'en') return t('en', `feedback.status.${status}` as const);
  return FEEDBACK_VIEW_STATUS_LABELS[status];
}

/** Срок ответа по локали: «до 25 ноября» / «by November 25». */
export function feedbackDueLabel(dueAt: Date, locale: Locale = 'ru'): string {
  if (locale === 'en') {
    return `by ${new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'long' }).format(dueAt)}`;
  }
  return formatFeedbackDueAt(dueAt);
}

/** Обещание срока ответа по локали. */
export function feedbackResponsePromise(locale: Locale = 'ru'): string {
  return locale === 'en' ? FEEDBACK_RESPONSE_PROMISE_EN : FEEDBACK_RESPONSE_PROMISE;
}

/** Объяснение анонимности по локали (под переключателем). */
export function feedbackAnonymousHint(enabled: boolean, locale: Locale = 'ru'): string {
  if (locale === 'en') return t('en', enabled ? 'feedback.anon.hint.on' : 'feedback.anon.hint.off');
  return enabled ? ANONYMOUS_EXPLANATION_ON : ANONYMOUS_EXPLANATION_OFF;
}

/** Заголовок ленты «Что мы изменили» по локали. */
export function feedbackOutcome(locale: Locale = 'ru'): string {
  return locale === 'en' ? t('en', 'feedback.outcomes.title') : FEEDBACK_OUTCOMES_TITLE;
}
