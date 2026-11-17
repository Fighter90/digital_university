// DIG-32 — клиентская часть списка «Мои заявки»: пилюли-фильтры со
// счётчиками (Все · В работе · Нужно действие · Готовы · Архив), поиск
// по номеру и названию, сортировка «Нужна доработка наверх». Карточки
// приходят готовыми из слоя данных (единый словарь статусов) — здесь
// только фильтрация без перезагрузки.
'use client';

import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';

import {
  REQUEST_FILTERS,
  filterRequests,
  requestFilterCounts,
  type RequestCardView,
  type RequestFilterKey,
} from '@/lib/requests-view';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { riseDelayStyle } from '@/lib/motion';
import { RequestCard } from './request-card';

export function RequestsBrowser({ cards }: { cards: RequestCardView[] }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<RequestFilterKey>('ALL');

  const counts = useMemo(() => requestFilterCounts(cards), [cards]);
  const visible = useMemo(() => filterRequests(cards, filter, query), [cards, filter, query]);
  const noMatch = cards.length > 0 && visible.length === 0;

  return (
    <div>
      <div className="relative">
        <Search
          aria-hidden="true"
          className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <input
          data-testid="requests-search"
          type="search"
          aria-label="Поиск по номеру и названию заявки"
          placeholder="Номер или название: ЗД-2026, военкомат…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="h-11 w-full rounded-button border border-border bg-card pl-10 pr-3 text-sm text-foreground shadow-soft outline-none transition-colors placeholder:text-muted-foreground focus:border-muted-foreground/40"
        />
      </div>

      <div
        data-testid="requests-filters"
        role="group"
        aria-label="Фильтры заявок"
        className="mt-3 flex gap-2 overflow-x-auto pb-1"
      >
        {REQUEST_FILTERS.map(({ key, label }) => (
          <Chip key={key} active={filter === key} onClick={() => setFilter(key)}>
            {label}
            <span
              aria-hidden="true"
              className={`min-w-5 rounded-pill px-1.5 text-center text-xs font-bold ${
                filter === key
                  ? 'bg-background/20 text-background'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {counts[key]}
            </span>
          </Chip>
        ))}
      </div>

      {noMatch ? (
        <EmptyState
          className="mt-4"
          icon={Search}
          title="Ничего не найдено"
          description="Попробуйте другой номер или название — или сбросьте фильтр."
          action={
            <button
              type="button"
              data-testid="requests-reset"
              onClick={() => {
                setQuery('');
                setFilter('ALL');
              }}
              className="inline-flex items-center gap-1.5 rounded-button border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground shadow-soft transition-colors hover:bg-muted"
            >
              <X aria-hidden="true" className="size-4" />
              Сбросить фильтры
            </button>
          }
        />
      ) : (
        <ul data-testid="requests-list" className="mt-4 flex flex-col gap-3">
          {visible.map((request, index) => (
            <li key={request.id} className="animate-rise" style={riseDelayStyle(index)}>
              <RequestCard request={request} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
