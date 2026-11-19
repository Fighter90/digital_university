// DIG-43 — «Мероприятия» (/events): афиша событий вуза и запись. Лента
// карточек с фильтрами чипами — query-параметр ?filter= (состояние в URL,
// работает без JS), сортировка по дате старта по возрастанию. Чтение —
// любой вошедший; запись owner-scoped по сессии студента (см.
// server/actions/events.ts и server/data/events.ts).
//
// Плашка «Концепт для конкурса» — общий баннер root layout.
import { CalendarHeart } from 'lucide-react';

import { EventCard } from '@/components/events/event-card';
import { EventsFilterChips } from '@/components/events/events-filter-chips';
import { EmptyState } from '@/components/ui/empty-state';
import { getEventsPage, parseEventsFilter, requireDataCtx } from '@/server/data';
import { dataDb } from '@/server/data/db';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { localizedEvent } from '@/lib/en-demo-content';

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter: rawFilter } = await searchParams;
  const filter = parseEventsFilter(rawFilter);
  const [ctx, locale] = await Promise.all([requireDataCtx('/events'), getLocale()]);
  const page = await getEventsPage(dataDb, ctx, filter);
  const canRegister = ctx.role === 'STUDENT';

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-6 md:py-8">
      <header>
        <h1 className="text-xl font-bold tracking-heading sm:text-2xl">{t(locale, 'events.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(locale, 'events.subtitle')}
        </p>
      </header>

      <div className="mt-4 flex flex-col gap-4">
        <EventsFilterChips filter={page.filter} showFaculty={ctx.faculty !== null} locale={locale} />

        {page.items.length === 0 ? (
          <EmptyState
            icon={CalendarHeart}
            title={t(locale, 'events.empty.title')}
            description={t(locale, 'events.empty.desc')}
          />
        ) : (
          <ul className="flex flex-col gap-4" data-testid="events-feed">
            {page.items.map((view) => (
              <li key={view.event.id}>
                {locale === 'en' ? (
                  <EventCard
                    view={{ ...view, event: { ...view.event, ...localizedEvent('en', view.event) } }}
                    canRegister={canRegister}
                    locale={locale}
                  />
                ) : (
                  <EventCard view={view} canRegister={canRegister} locale={locale} />
                )}
              </li>
            ))}
          </ul>
        )}

        <p className="text-xs text-muted-foreground">
          {t(locale, 'events.hint')}
        </p>
      </div>
    </section>
  );
}
