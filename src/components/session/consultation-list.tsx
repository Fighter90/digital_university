// DIG-28 — консультации перед экзаменами экрана «Сессия» (из расписания
// группы, kind CONSULTATION): дата, время, аудитория, преподаватель.
// Презентационный серверный компонент.
import { Clock, DoorOpen, User } from 'lucide-react';

import { formatSessionTime } from '@/lib/session-format';
import { sessionDateShort } from '@/lib/performance-format';
import { t, type Locale } from '@/lib/i18n';
import type { SessionConsultationItem } from '@/server/data/session';

export function ConsultationList({
  consultations,
  locale = 'ru',
}: {
  consultations: SessionConsultationItem[];
  /** DIG-89 — локаль интерфейса (cookie du-locale, дефолт ru). */
  locale?: Locale;
}) {
  return (
    <section
      data-testid="session-consultations"
      aria-label={t(locale, 'session.consultations.aria')}
      className="animate-rise rounded-card border border-border bg-card p-5 shadow-soft"
      style={{ '--du-rise-delay': '180ms' } as React.CSSProperties}
    >
      <h2 className="text-base font-extrabold tracking-heading">
        {t(locale, 'session.consultations.title')}
      </h2>
      <ul className="mt-3 flex flex-col divide-y divide-border">
        {consultations.map((consult) => (
          <li
            key={consult.eventId}
            data-testid="consultation-item"
            className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className="font-semibold">{consult.disciplineName}</p>
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock aria-hidden="true" className="size-3.5" />
                {sessionDateShort(consult.date, locale)},{' '}
                <span className="whitespace-nowrap">
                  {formatSessionTime(consult.startsAt)} – {formatSessionTime(consult.endsAt)}
                </span>
              </p>
            </div>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <DoorOpen aria-hidden="true" className="size-3.5" />
                {t(locale, 'session.room.short', { room: consult.room })}
              </span>
              <span className="inline-flex min-w-0 items-center gap-1">
                <User aria-hidden="true" className="size-3.5 shrink-0" />
                <span className="truncate">{consult.teacherName}</span>
              </span>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
