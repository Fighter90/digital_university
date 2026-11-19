// DIG-31 — карта «сервис каталога (DIG-29) → тип заявки (словарь DIG-30)».
// Ссылки каталога и FAQ вида /requests?order=<id> открывают мастер заказа
// с предвыбранным типом; там, где каталог описывает конкретное назначение
// («Справка для отсрочки от армии»), предзаполняется и ключевое поле формы.
//
// Неизвестный id (в том числе «new» от кнопки «Заказать справку») — это
// НЕ ошибка: мастер открывается без предвыбора, студент выбирает тип сам.
// Модуль чистый: работает и на сервере, и в клиентском мастере.
//
// DIG-87 — подсказки типов и метки форматов по локали (дефолт 'ru').

import { t, type Locale } from '@/lib/i18n';

/** Предвыбор мастера: тип словаря + опциональные значения полей формы. */
export interface OrderTarget {
  typeCode: string;
  preset?: Record<string, string>;
}

const ORDER_TYPE_BY_SERVICE: Record<string, OrderTarget> = {
  'cert-enrollment': { typeCode: 'CERT_ENROLLMENT' },
  'cert-defer': { typeCode: 'CERT_ENROLLMENT', preset: { purpose: 'для военкомата' } },
  'cert-grades': { typeCode: 'GRADES_EXTRACT' },
  'stmt-academic-leave': { typeCode: 'ACADEMIC_LEAVE' },
  // DIG-41 — действия экрана «Финансы» (/finance).
  'fin-material-aid': { typeCode: 'MATERIAL_AID' },
  'fin-scholarship-cert': { typeCode: 'SCHOLARSHIP_CERT' },
};

/**
 * Разобрать параметр ?order= ссылки. null — мастера без предвыбора
 * (кнопка «new», неизвестный сервис, пустое значение).
 */
export function orderTargetForService(serviceId: string | null | undefined): OrderTarget | null {
  if (typeof serviceId !== 'string') return null;
  const id = serviceId.trim().toLowerCase();
  if (id === '' || id === 'new') return null;
  return ORDER_TYPE_BY_SERVICE[id] ?? null;
}

/** Одна строка «что это за документ» для шага 1 мастера (RU-канон). */
export const REQUEST_TYPE_HINTS: Record<string, string> = {
  CERT_ENROLLMENT: 'Подтверждает, что вы студент вуза: программа, курс, форма обучения',
  GRADES_EXTRACT: 'Официальная выписка оценок и среднего балла за все сессии',
  DIPLOMA_COPY: 'Заверенная копия диплома для работодателя или госорганов',
  ACADEMIC_LEAVE: 'Заявление на перерыв в учёбе до одного года с сохранением статуса',
  MATERIAL_AID: 'Единовременная поддержка из фонда вуза по заявлению студента',
  SCHOLARSHIP_CERT: 'Сумма назначенной стипендии и срок её выплаты',
};

const HINT_KEYS: Record<
  string,
  | 'wizard.hint.CERT_ENROLLMENT'
  | 'wizard.hint.GRADES_EXTRACT'
  | 'wizard.hint.DIPLOMA_COPY'
  | 'wizard.hint.ACADEMIC_LEAVE'
  | 'wizard.hint.MATERIAL_AID'
  | 'wizard.hint.SCHOLARSHIP_CERT'
> = {
  CERT_ENROLLMENT: 'wizard.hint.CERT_ENROLLMENT',
  GRADES_EXTRACT: 'wizard.hint.GRADES_EXTRACT',
  DIPLOMA_COPY: 'wizard.hint.DIPLOMA_COPY',
  ACADEMIC_LEAVE: 'wizard.hint.ACADEMIC_LEAVE',
  MATERIAL_AID: 'wizard.hint.MATERIAL_AID',
  SCHOLARSHIP_CERT: 'wizard.hint.SCHOLARSHIP_CERT',
};

/** Подсказка типа для шага 1 мастера по локали (RU — прежние байт-в-байт). */
export function requestTypeHint(typeCode: string, locale: Locale = 'ru'): string {
  const key = HINT_KEYS[typeCode];
  if (!key) return t(locale, 'wizard.hint.fallback');
  return t(locale, key);
}

/** Метки формата словаря типов по локали (CanonicalRequestTypeRow.format). */
export const REQUEST_FORMAT_LABELS: Record<'ELECTRONIC' | 'PAPER' | 'HYBRID', string> = {
  ELECTRONIC: 'PDF',
  PAPER: 'Бумажный документ',
  HYBRID: 'PDF и оригинал',
};

/** Метка формата по локали: «Бумажный документ» / «Paper document». */
export function requestFormatLabel(
  format: 'ELECTRONIC' | 'PAPER' | 'HYBRID',
  locale: Locale = 'ru',
): string {
  if (format === 'ELECTRONIC') return 'PDF';
  return t(locale, format === 'PAPER' ? 'wizard.format.PAPER' : 'wizard.format.HYBRID');
}
