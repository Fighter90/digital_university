// DIG-31 — карта «сервис каталога (DIG-29) → тип заявки (словарь DIG-30)».
// Ссылки каталога и FAQ вида /requests?order=<id> открывают мастер заказа
// с предвыбранным типом; там, где каталог описывает конкретное назначение
// («Справка для отсрочки от армии»), предзаполняется и ключевое поле формы.
//
// Неизвестный id (в том числе «new» от кнопки «Заказать справку») — это
// НЕ ошибка: мастер открывается без предвыбора, студент выбирает тип сам.
// Модуль чистый: работает и на сервере, и в клиентском мастере.

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

/** Одна строка «что это за документ» для шага 1 мастера. */
export const REQUEST_TYPE_HINTS: Record<string, string> = {
  CERT_ENROLLMENT: 'Подтверждает, что вы студент вуза: программа, курс, форма обучения',
  GRADES_EXTRACT: 'Официальная выписка оценок и среднего балла за все сессии',
  DIPLOMA_COPY: 'Заверенная копия диплома для работодателя или госорганов',
  ACADEMIC_LEAVE: 'Заявление на перерыв в учёбе до одного года с сохранением статуса',
};

const FALLBACK_TYPE_HINT = 'Официальный документ деканата';

export function requestTypeHint(typeCode: string): string {
  return REQUEST_TYPE_HINTS[typeCode] ?? FALLBACK_TYPE_HINT;
}

/** Метки формата словаря типов (CanonicalRequestTypeRow.format). */
export const REQUEST_FORMAT_LABELS: Record<'ELECTRONIC' | 'PAPER' | 'HYBRID', string> = {
  ELECTRONIC: 'PDF',
  PAPER: 'Бумажный документ',
  HYBRID: 'PDF и оригинал',
};
