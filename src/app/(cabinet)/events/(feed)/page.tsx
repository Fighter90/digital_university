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

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter: rawFilter } = await searchParams;
  const filter = parseEventsFilter(rawFilter);
  const ctx = await requireDataCtx('/events');
  const page = await getEventsPage(dataDb, ctx, filter);
  const canRegister = ctx.role === 'STUDENT';

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-6 md:py-8">
      <header>
        <h1 className="text-xl font-bold tracking-heading sm:text-2xl">Мероприятия вуза</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Лекции, хакатоны, карьерные и культурные события — записывайтесь в один клик. Все
          мероприятия и места вымышленные.
        </p>
      </header>

      <div className="mt-4 flex flex-col gap-4">
        <EventsFilterChips filter={page.filter} showFaculty={ctx.faculty !== null} />

        {page.items.length === 0 ? (
          <EmptyState
            icon={CalendarHeart}
            title="Мероприятий не нашлось"
            description="Попробуйте другой фильтр — например, «Все»."
          />
        ) : (
          <ul className="flex flex-col gap-4" data-testid="events-feed">
            {page.items.map((view) => (
              <li key={view.event.id}>
                <EventCard view={view} canRegister={canRegister} />
              </li>
            ))}
          </ul>
        )}

        <p className="text-xs text-muted-foreground">
          Запись — один клик: повторное нажатие отменяет её. При нуля свободных мест кнопка
          становится неактивной («Мест нет»). События не добавляются в расписание пар — это
          прототип.
        </p>
      </div>
    </section>
  );
}
