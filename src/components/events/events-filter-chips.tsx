// DIG-43 — чипы фильтров ленты «Мероприятия»: «Все», «На этой неделе»,
// «Мой факультет» (по тегу факультета контекста), «Карьера», «Онлайн».
// Чистые ссылки с query-параметром (?filter=) — состояние в URL, работает
// без JS; активный чип в стиле вкладок «МСП» (чёрная заливка, DIG-13).
import Link from 'next/link';

import { EVENTS_FILTER_LABELS, type EventsFilter } from '@/lib/events';

const ORDER: EventsFilter[] = ['all', 'week', 'faculty', 'career', 'online'];

export function EventsFilterChips({
  filter,
  showFaculty = true,
}: {
  filter: EventsFilter;
  /** Факультета в контексте нет — чип «Мой факультет» не показываем. */
  showFaculty?: boolean;
}) {
  const chips = ORDER.filter((chip) => chip !== 'faculty' || showFaculty);
  return (
    <nav aria-label="Фильтры мероприятий" className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => {
        const active = chip === filter;
        return (
          <Link
            key={chip}
            href={chip === 'all' ? '/events' : `/events?filter=${chip}`}
            data-testid={`events-filter-${chip}`}
            aria-current={active ? 'true' : undefined}
            className={
              active
                ? 'inline-flex h-9 items-center rounded-pill border border-foreground bg-foreground px-4 text-sm font-medium text-background'
                : 'inline-flex h-9 items-center rounded-pill border border-border bg-card px-4 text-sm font-medium text-foreground hover:border-muted-foreground/40'
            }
          >
            {EVENTS_FILTER_LABELS[chip]}
          </Link>
        );
      })}
    </nav>
  );
}
