// DIG-44 — тихие часы: окно времени, в котором уведомления в кабинете не
// генерируются. Чистые функции (без React и серверных импортов) — окно
// поддерживает переход через полночь (22:00 → 08:00).

export interface QuietHours {
  enabled: boolean;
  /** «HH:MM» — начало окна. */
  from: string;
  /** «HH:MM» — конец окна. */
  to: string;
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Строгая проверка «HH:MM» (00:00–23:59) — сервер отклоняет остальное. */
export function isValidTime(value: string): boolean {
  return TIME_RE.test(value);
}

/** Окно валидно, если оба конца — «HH:MM» и они не равны (нулевое окно бессмысленно). */
export function isValidQuietHours(quiet: QuietHours): boolean {
  return isValidTime(quiet.from) && isValidTime(quiet.to) && quiet.from !== quiet.to;
}

function minutesOf(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Попадает ли момент `now` в активное окно тихих часов. Окно трактуется как
 * полуинтервал [from, to): граница `to` уже «тихая» зона закончилаcь.
 * Переход через полночь: from > to → тихо, если now ≥ from ИЛИ now < to.
 * Выключенные или вырожденные окна никогда не подавляют.
 */
export function isWithinQuietHours(quiet: QuietHours, now: Date): boolean {
  if (!quiet.enabled || !isValidQuietHours(quiet)) return false;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const from = minutesOf(quiet.from);
  const to = minutesOf(quiet.to);
  if (from < to) return nowMinutes >= from && nowMinutes < to;
  // Окно через полночь (например, 22:00 → 08:00).
  return nowMinutes >= from || nowMinutes < to;
}
