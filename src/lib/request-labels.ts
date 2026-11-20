// DIG-12 — human-readable labels for request fields (RU) and badge tones.
// Pure mapping, no React — shared by the list page, the detail page and the
// future staff screens.
//
// DIG-32 — единый словарь статусов: метки канона берутся напрямую из
// машины состояний (lib/request-machine — один источник правды), экраны
// DIG-32+ рендерят только их. Легаси-метки (NEEDS_REVISION / COMPLETED,
// мир prisma-сидов DIG-10) остаются в записи для старых экранов, но в
// экран «Мои заявки» эти значения не попадают: unifyRequestStatus
// отображает их на канон (lib/requests-view.ts).
//
// DIG-33 — «время везде одинаковое и в поясе пользователя»: все метки
// времени заявок (список, карточка, история событий) форматирует ОДИН
// форматтер с ЯВНОЙ зоной Europe/Moscow — поясу пользователя прототипа
// (конвенция проекта: schedule-time.ts, PDF-документы, MCP-формат).
// Пояс машины сервера больше не протекает в интерфейс, а суффикс «МСК»
// делает зону видимой пользователю.

import { CANONICAL_REQUEST_STATUS_LABELS } from '@/lib/request-machine';
import { dictionaries, t } from '@/lib/i18n';
import type { RequestStatus, RequestType } from '@/server/data/types';

/** Пояс пользователя прототипа — единый для всех экранов заявок. */
export const REQUEST_TIME_ZONE = 'Europe/Moscow';

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  ...CANONICAL_REQUEST_STATUS_LABELS,
  // Легаси-значения — только для миров до DIG-32 (prisma-сиды); строки —
  // из словаря (DIG-89): RU байт-в-байт прежние, EN — английский словарь.
  NEEDS_REVISION: t('ru', 'request.legacy.NEEDS_REVISION'),
  COMPLETED: t('ru', 'request.legacy.COMPLETED'),
};

export const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  CERTIFICATE: t('ru', 'staff.type.CERTIFICATE'),
  STATEMENT: t('ru', 'staff.type.STATEMENT'),
  PRACTICE: t('ru', 'staff.type.PRACTICE'),
  DORMITORY: t('ru', 'staff.type.DORMITORY'),
  OTHER: t('ru', 'staff.type.OTHER'),
};

// DIG-89 — EN-подпись типа заявки (очередь сотрудника, карточки).

/** Тип заявки по локали: «Справка» / «Certificate». */
export function requestTypeLabel(type: RequestType, locale: 'ru' | 'en' = 'ru'): string {
  if (locale === 'en') return t('en', `staff.type.${type}` as const);
  return REQUEST_TYPE_LABELS[type];
}

// ── DIG-126 — канонические типы (словарь DIG-30) в очереди сотрудника ────────

/**
 * Канонический typeCode → класс легаси-типа: класс нужен фильтру очереди
 * «по типу» и SLA-фолбэку (когда у типа нет etaDays). Коды словаря DIG-30
 * («CERT_ENROLLMENT», «ACADEMIC_LEAVE», «MATERIAL_AID»…) — префиксные.
 */
export function canonicalQueueType(typeCode: string): RequestType {
  if (
    typeCode.startsWith('CERT') ||
    typeCode.startsWith('GRADES') ||
    typeCode.startsWith('SCHOLARSHIP') ||
    typeCode.startsWith('DIPLOMA')
  ) {
    return 'CERTIFICATE';
  }
  if (typeCode.startsWith('DORM')) return 'DORMITORY';
  if (typeCode.startsWith('PRACTICE')) return 'PRACTICE';
  return 'STATEMENT';
}

/**
 * Подпись типа канона по локали: RU — имя типа словаря (typeName строки,
 * демо-контент); EN — ключ staff.canonicalType.<CODE>, без ключа —
 * класс типа (EN никогда не показывает кириллицу).
 */
export function canonicalTypeLabel(
  locale: 'ru' | 'en',
  typeCode: string,
  typeName: string,
): string {
  if (locale !== 'en') return typeName;
  const key = `staff.canonicalType.${typeCode}` as import('@/lib/i18n').TranslationKey;
  const text = (dictionaries.en as Record<string, string>)[key];
  return text ?? requestTypeLabel(canonicalQueueType(typeCode), 'en');
}

export const REQUEST_STATUS_TONES: Record<RequestStatus, string> = {
  SUBMITTED: 'bg-blue-50 text-blue-700 border-blue-200',
  ACCEPTED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  IN_PROGRESS: 'bg-amber-50 text-amber-700 border-amber-200',
  READY: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  ISSUED: 'bg-green-50 text-green-700 border-green-200',
  NEEDS_FIX: 'bg-orange-50 text-orange-700 border-orange-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
  CANCELLED: 'bg-neutral-100 text-neutral-600 border-neutral-200',
  // Легаси-тона (см. выше) — до миграции старых экранов.
  NEEDS_REVISION: 'bg-orange-50 text-orange-700 border-orange-200',
  COMPLETED: 'bg-green-50 text-green-700 border-green-200',
};

const dateTimeFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: REQUEST_TIME_ZONE,
});

const dateTimeFormatterEn = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: REQUEST_TIME_ZONE,
});

/**
 * «16 ноября, 10:05 МСК» — единственный формат времени заявок.
 * DIG-69: locale='en' → en-US и суффикс «MSK»; RU — байт-в-байт прежний.
 */
export function formatRequestDate(value: Date, locale: 'ru' | 'en' = 'ru'): string {
  return locale === 'en'
    ? `${dateTimeFormatterEn.format(value)} MSK`
    : `${dateTimeFormatter.format(value)} ${t('ru', 'request.mskSuffix')}`;
}
