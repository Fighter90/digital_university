// DIG-43 — карточка мероприятия в ленте /events: обложка-заглушка
// (градиент + иконка типа), бейдж типа и чип «Записан», дата/время,
// место или «Онлайн», «Осталось N мест» (0 — «Мест нет») и кнопка записи.
// Клик по обложке/заголовку → карточка /events/<slug>; кнопка записи —
// сосед блока со ссылкой (не вложена в <a>).
import Link from 'next/link';
import { CalendarDays, MapPin, Video } from 'lucide-react';

import { cn } from 'cn';

import { localizedEvent } from '@/lib/en-demo-content';

import { EventCover } from '@/components/events/event-cover';
import { EventRegisterButton } from '@/components/events/event-register-button';
import { eventKindLabel, spotsLeftLabel } from '@/lib/events';
import { t, type Locale } from '@/lib/i18n';
import type { EventView } from '@/server/data';

const dayFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
  weekday: 'short',
});
const dayFormatterEn = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'short',
  weekday: 'short',
});
const timeFormatter = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });

export function EventCard({
  view,
  canRegister = true,
  locale = 'ru',
}: {
  view: EventView;
  canRegister?: boolean;
  /** DIG-89 — локаль интерфейса (cookie du-locale, дефолт ru). */
  locale?: Locale;
}) {
  const { taken, spotsLeft, registeredByMe } = view;
  // DIG-89 — EN-рендер демо-события: титул/место из словаря по id.
  const event =
    locale === 'en'
      ? { ...view.event, ...localizedEvent('en', view.event) }
      : view.event;
  const full = spotsLeft === 0;
  return (
    <article
      data-testid={`event-card-${event.slug}`}
      className="overflow-hidden rounded-card border border-border bg-card shadow-soft"
    >
      <Link
        href={`/events/${event.slug}`}
        className="block focus-visible:outline-2"
        aria-label={event.title}
      >
        <EventCover title={event.title} kind={event.kind} className="h-28 w-full" />
      </Link>

      <div className="flex flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-pill bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent-ink">
            {eventKindLabel(event.kind, locale)}
          </span>
          {registeredByMe ? (
            <span
              data-testid={`event-chip-${event.slug}`}
              className="rounded-pill border border-emerald-300 bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700"
            >
              {t(locale, 'events.registered')}
            </span>
          ) : null}
          <span
            data-testid={`event-spots-${event.slug}`}
            className={cn(
              'ml-auto text-xs font-medium',
              full ? 'text-red-600' : 'text-muted-foreground',
            )}
          >
            {spotsLeftLabel(spotsLeft, locale)}
          </span>
        </div>

        <h3 className="text-base font-semibold leading-snug">
          <Link
            href={`/events/${event.slug}`}
            data-testid={`event-link-${event.slug}`}
            className="hover:text-accent-ink focus-visible:outline-2 focus-visible:outline-coral-600"
          >
            {event.title}
          </Link>
        </h3>

        <p className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="size-3.5" aria-hidden="true" />
            {(locale === 'en' ? dayFormatterEn : dayFormatter).format(event.startsAt)} ·{' '}
            {timeFormatter.format(event.startsAt)}–
            {timeFormatter.format(event.endsAt)}
          </span>
          {event.isOnline ? (
            <span className="inline-flex items-center gap-1">
              <Video className="size-3.5" aria-hidden="true" />
              {t(locale, 'events.online')}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" aria-hidden="true" />
              {event.location}
            </span>
          )}
        </p>

        <div className="mt-1 flex items-center justify-between gap-2">
          <Link
            href={`/events/${event.slug}`}
            className="text-xs font-medium text-accent-ink hover:underline"
          >
            {t(locale, 'events.card.more')}
          </Link>
          <EventRegisterButton
            eventId={event.id}
            spotsLeft={spotsLeft}
            registeredByMe={registeredByMe}
            canRegister={canRegister}
            testId={`event-register-${event.slug}`}
            locale={locale}
          />
        </div>
      </div>
    </article>
  );
}
