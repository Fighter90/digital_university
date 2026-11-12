// DIG-28 — сборщик ICS-календаря («Добавить всю сессию в календарь»).
//
// Чистая функция без серверных импортов: детерминирована при равных входах
// (DTSTAMP — параметр), совместима с RFC 5545 настолько, насколько это нужно
// календарям Google/Apple:
//  - только CRLF-переводы строк;
//  - экранирование \ ; , и переводов строк в текстовых значениях;
//  - свёртка длинных строк: не длиннее 75 символов, продолжение — CRLF+пробел
//    (развёртывание восстанавливает исходную строку);
//  - плавающее локальное время (DTSTART без Z и без TZID) — события
//    попадают в календарь в локальном часовом поясе подписчика.

export interface IcsEventInput {
  /** Стабильный глобальный идентификатор события (UID обязателен). */
  uid: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  location?: string | null;
  description?: string | null;
}

export interface BuildIcsOptions {
  /** Имя календаря (X-WR-CALNAME), например «Зимняя сессия · ПИ-21». */
  name?: string;
  /** Метка генерации (DTSTAMP); по умолчанию — текущий момент. */
  now?: Date;
}

const CRLF = '\r\n';
const MAX_LINE = 75;

/** Экранирование текстового значения: \ → \\, ; → \;, , → \,, CRLF → \n. */
export function icsEscape(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n/g, '\\n')
    .replace(/\r/g, '\\n')
    .replace(/\n/g, '\\n');
}

/** Плавающее локальное время: 20261222T100000. */
export function icsDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `T${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

/** Свёртка строки по RFC 5545: первая строка ≤ 75, продолжения — CRLF+пробел. */
function foldLine(line: string): string {
  if (line.length <= MAX_LINE) return line;
  const parts: string[] = [line.slice(0, MAX_LINE)];
  let rest = line.slice(MAX_LINE);
  while (rest.length > MAX_LINE - 1) {
    parts.push(` ${rest.slice(0, MAX_LINE - 1)}`);
    rest = rest.slice(MAX_LINE - 1);
  }
  if (rest.length > 0) parts.push(` ${rest}`);
  return parts.join(CRLF);
}

/** Полная строка свойства со свёрткой. */
function prop(name: string, value: string): string {
  return foldLine(`${name}:${value}`);
}

/** VCALENDAR с VEVENT на каждое событие; порядок входа сохраняется. */
export function buildIcsCalendar(
  events: readonly IcsEventInput[],
  options: BuildIcsOptions = {},
): string {
  const stamp = icsDateTime(options.now ?? new Date());
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Digital Deanery//Session Export//RU',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];
  if (options.name) lines.push(prop('X-WR-CALNAME', icsEscape(options.name)));

  for (const event of events) {
    lines.push(
      'BEGIN:VEVENT',
      prop('UID', icsEscape(event.uid)),
      prop('DTSTAMP', stamp),
      prop('DTSTART', icsDateTime(event.startsAt)),
      prop('DTEND', icsDateTime(event.endsAt)),
      prop('SUMMARY', icsEscape(event.title)),
    );
    if (event.location) lines.push(prop('LOCATION', icsEscape(event.location)));
    if (event.description) lines.push(prop('DESCRIPTION', icsEscape(event.description)));
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join(CRLF) + CRLF;
}
