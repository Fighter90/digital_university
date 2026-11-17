// DIG-43 — карточка мероприятия по публичному slug (никогда cuid).
// requireDataCtx() → openEventView(): чтение — любой вошедший (афиша
// общая), несуществующий slug — единый контрактный 404 (как в /msp/[slug];
// попытка пишется в аудит NOT_FOUND). Запись — только студент
// (owner-scoped action, сессия = владелец записи).
//
// NOTE: над этим сегментом НЕ должно быть loading.tsx — Suspense-граница
// стримит shell до notFound(), и несуществующий slug ответил бы 200 вместо
// контрактного 404. Скелетон ленты живёт в соседнем route-group (feed).
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CalendarDays, Clock, MapPin, Users, Video } from 'lucide-react';

import { EventCover } from '@/components/events/event-cover';
import { EventRegisterButton } from '@/components/events/event-register-button';
import { EVENT_KIND_LABELS, eventSpotsLabel } from '@/lib/events';
import { normalizeEventSlug, openEventView, requireDataCtx } from '@/server/data';
import { dataDb } from '@/server/data/db';
import { cn } from 'cn';

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const timeFormatter = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: rawSlug } = await params;
  let slug: string;
  try {
    slug = normalizeEventSlug(decodeURIComponent(rawSlug));
  } catch {
    // Некорректный percent-encoding (URIError) или пустой slug — тот же
    // контрактный 404, что для несуществующего мероприятия, а не 500.
    notFound();
  }
  const ctx = await requireDataCtx(`/events/${rawSlug}`);

  const detail = await openEventView(dataDb, ctx, slug);
  if (!detail) notFound();

  const { event, taken, spotsLeft, registeredByMe } = detail;
  const canRegister = ctx.role === 'STUDENT';
  const full = spotsLeft === 0;

  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-6 md:py-8">
      <Link
        href="/events"
        className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground"
      >
        ← В афишу мероприятий
      </Link>

      <article
        data-testid="event-detail"
        className="flex flex-col gap-4 overflow-hidden rounded-card border border-border bg-card shadow-soft"
      >
        <EventCover title={event.title} kind={event.kind} className="h-40 w-full" />

        <div className="flex flex-col gap-3 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-pill bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent-ink">
              {EVENT_KIND_LABELS[event.kind]}
            </span>
            {registeredByMe ? (
              <span
                data-testid="event-detail-chip"
                className="rounded-pill border border-emerald-300 bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700"
              >
                Записан
              </span>
            ) : null}
            <span
              data-testid="event-detail-spots"
              className={cn(
                'ml-auto text-xs font-medium',
                full ? 'text-red-600' : 'text-muted-foreground',
              )}
            >
              {eventSpotsLabel(event.capacity, taken)}
            </span>
          </div>

          <h1
            className="text-xl font-bold leading-snug tracking-heading"
            data-testid="event-detail-title"
          >
            {event.title}
          </h1>

          <dl className="flex flex-col gap-2 rounded-button bg-muted px-3 py-3 text-sm">
            <div className="flex items-center gap-2">
              <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="capitalize">{dateFormatter.format(event.startsAt)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span>
                {timeFormatter.format(event.startsAt)}–{timeFormatter.format(event.endsAt)}
              </span>
            </div>
            {event.isOnline ? (
              <div className="flex items-center gap-2">
                <Video className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span>
                  Онлайн
                  {event.onlineUrl ? (
                    <>
                      {' · '}
                      <a
                        href={event.onlineUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-accent-ink hover:underline"
                      >
                        ссылка на трансляцию
                      </a>
                    </>
                  ) : null}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span>{event.location}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Users className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span data-testid="event-detail-capacity">
                Вместимость: {event.capacity} · занято {taken}
              </span>
            </div>
          </dl>

          <div>
            <h2 className="mb-1 text-sm font-medium text-muted-foreground">О мероприятии</h2>
            <p
              className="whitespace-pre-line text-sm text-foreground"
              data-testid="event-detail-description"
            >
              {event.description}
            </p>
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
            <p className="text-xs text-muted-foreground">
              {registeredByMe
                ? 'Повторное нажатие отменяет запись. В расписание пар событие не добавляется (прототип).'
                : 'Запись бесплатна, место закрепляется сразу.'}
            </p>
            <EventRegisterButton
              eventId={event.id}
              spotsLeft={spotsLeft}
              registeredByMe={registeredByMe}
              canRegister={canRegister}
              testId="event-detail-register"
            />
          </div>
        </div>
      </article>

      {/* Друзья не пойдут — демо-заглушка прототипа: список друзей на
          мероприятии в концепте не наполняется (см. tasks.md DIG-43). */}
      <section
        data-testid="event-detail-friends"
        aria-label="Друзья не пойдут"
        className="mt-6 rounded-card border border-dashed border-border bg-card p-5"
      >
        <h2 className="text-base font-semibold">Друзья не пойдут</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Список друзей, идущих на мероприятие, — заглушка прототипа: в демо он не наполняется.
        </p>
      </section>
    </section>
  );
}
