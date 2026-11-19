// DIG-30 — расчётная дата готовности заявки по SLA типа (etaDays).
//
// etaDays считается в РАБОЧИХ днях (см. комментарий RequestType в
// prisma/schema.prisma): суббота и воскресенье пропускаются, поэтому
// «пятница + 1» — понедельник. Праздники в прототипе не задаются
// (производственный календарь вуза — вне скоупа концепта), функция
// принимает только календарные выходные. Время суток сохраняется.
//
// Чистый модуль без серверных импортов: используется сервисом заявок
// и тестируется напрямую.

const SUNDAY = 0;
const SATURDAY = 6;

export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === SUNDAY || day === SATURDAY;
}

/**
 * Прибавить `days` рабочих дней к дате (сама дата не мутируется).
 * Старт из выходного не считается рабочим днём: «суббота + 1» — понедельник.
 */
export function addWorkingDays(from: Date, days: number): Date {
  const result = new Date(from);
  let remaining = days;
  while (remaining > 0) {
    result.setDate(result.getDate() + 1);
    if (!isWeekend(result)) remaining -= 1;
  }
  return result;
}

/**
 * Расчётная дата готовности: null, когда SLA не задан (etaDays == null)
 * или некорректен (отрицательный). 0 дней — тот же момент (сегодня).
 */
export function slaReadyDate(now: Date, etaDays: number | null | undefined): Date | null {
  if (etaDays === null || etaDays === undefined || etaDays < 0) return null;
  if (etaDays === 0) return new Date(now);
  return addWorkingDays(now, etaDays);
}

const readyByFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  // DIG-33 — дата готовности в том же поясе пользователя, что и все
  // метки времени заявок (Europe/Moscow, см. lib/request-labels.ts).
  timeZone: 'Europe/Moscow',
});

const readyByFormatterEn = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'long',
  timeZone: 'Europe/Moscow',
});

/**
 * «до 14 ноября» — часть уведомления о статусе заявки (без года).
 * DIG-84: locale='en' → «November 20»; RU — прежний формат байт-в-байт.
 */
export function formatReadyBy(date: Date, locale: 'ru' | 'en' = 'ru'): string {
  return locale === 'en' ? readyByFormatterEn.format(date) : readyByFormatter.format(date);
}
