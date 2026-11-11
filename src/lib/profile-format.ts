// DIG-19 — pure presentation helpers of the profile & settings screens.
// No server imports: every function here is safe for client components.

/**
 * «20231234» → «2023-12-••••34» — the student badge number is masked so the
 * screen never exposes the full value (the «Показать» button reveals it).
 * Non-digit separators are ignored; short/empty values keep only the last
 * two digits visible.
 */
export function maskStudentBadge(gradebookNumber: string): string {
  const digits = gradebookNumber.replace(/\D/g, '');
  if (digits.length >= 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-••••${digits.slice(-2)}`;
  }
  return `••••••${digits.slice(-2)}`;
}

/**
 * Academic year + term for the profile card. Autumn term: August–December
 * (year N/N+1), spring term: January–July (year N-1/N).
 */
export function currentAcademicPeriod(now: Date): { year: string; term: string } {
  const y = now.getFullYear();
  const month = now.getMonth();
  return month >= 7
    ? { year: `${y}/${y + 1}`, term: 'осенний семестр' }
    : { year: `${y - 1}/${y}`, term: 'весенний семестр' };
}

/**
 * «Активные сессии»: device label from the User-Agent. Only friendly names —
 * the raw UA string never reaches the UI.
 */
export function sessionDeviceLabel(userAgent: string | null): string {
  if (!userAgent) return 'Неизвестное устройство';
  const device = /iPhone|iPad/i.test(userAgent)
    ? 'iPhone'
    : /Android/i.test(userAgent)
      ? 'Android'
      : /Windows/i.test(userAgent)
        ? 'Windows'
        : /Mac OS X|Macintosh/i.test(userAgent)
          ? 'macOS'
          : null;
  const browser = /Edg\//i.test(userAgent)
    ? 'Edge'
    : /OPR\//i.test(userAgent)
      ? 'Opera'
      : /Chrome\//i.test(userAgent)
        ? 'Chrome'
        : /Firefox\//i.test(userAgent)
          ? 'Firefox'
          : /Safari\//i.test(userAgent)
            ? 'Safari'
            : null;
  if (!device && !browser) return 'Другое устройство';
  return [device, browser].filter(Boolean).join(' · ');
}

const sessionTimeFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

/** Session list time («11 нояб., 09:05»); old rows without a timestamp → «—». */
export function formatSessionTime(value: Date | null | undefined): string {
  return value ? sessionTimeFormatter.format(value) : '—';
}
