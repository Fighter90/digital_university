// DIG-28 — блок «Пересдачи» экрана «Сессия»: дисциплина, дата и время,
// аудитория, примечание деканата и запись в один клик (server action
// создаёт заявку и уведомление). Презентационный серверный компонент,
// кнопка записи — клиентская форма.
import { Clock, DoorOpen } from 'lucide-react';

import { formatSessionTime } from '@/lib/session-format';
import { sessionDateShort } from '@/lib/performance-format';
import { t, type Locale } from '@/lib/i18n';
import type { SessionRetakeItem } from '@/server/data/session';
import { RetakeSignupForm } from './retake-signup-form';

export function RetakeList({
  retakes,
  locale = 'ru',
}: {
  retakes: SessionRetakeItem[];
  /** DIG-89 — локаль интерфейса (cookie du-locale, дефолт ru). */
  locale?: Locale;
}) {
  return (
    <section
      data-testid="session-retakes"
      aria-label={t(locale, 'session.retakes.aria')}
      className="animate-rise rounded-card border border-border bg-card p-5 shadow-soft"
      style={{ '--du-rise-delay': '120ms' } as React.CSSProperties}
    >
      <h2 className="text-base font-extrabold tracking-heading">
        {t(locale, 'session.retakes.title')}
      </h2>
      <ul className="mt-3 flex flex-col divide-y divide-border">
        {retakes.map((retake) => (
          <li
            key={retake.examId}
            data-testid={`retake-item-${retake.examId}`}
            className="flex flex-col gap-2 py-3.5 first:pt-0 last:pb-0"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className="font-semibold">{retake.disciplineName}</p>
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock aria-hidden="true" className="size-3.5" />
                {sessionDateShort(retake.date, locale)}, {formatSessionTime(retake.startsAt)}
              </p>
            </div>
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <DoorOpen aria-hidden="true" className="size-3.5" />
              {t(locale, 'session.room.short', { room: retake.room })}
            </p>
            {retake.note ? (
              <p className="text-sm text-muted-foreground">{retake.note}</p>
            ) : null}
            <div className="mt-1">
              <RetakeSignupForm
                examId={retake.examId}
                requested={retake.requested}
                requestNumber={retake.requestNumber}
                signUpAvailable={retake.signUpAvailable}
                locale={locale}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
