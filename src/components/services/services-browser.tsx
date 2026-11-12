'use client';

// DIG-29 — клиентский каталог «Все сервисы»: поиск с подсветкой совпадений
// и категории пилюлями (фильтруют совместно), сетка карточек. Роль уже
// отфильтрована на сервере; favoriteIds приходят из слоя данных.
import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';

import {
  CATEGORY_LABELS,
  matchService,
  servicesForRole,
  type ServiceCategory,
} from '@/lib/services-catalog';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { ServiceCard } from './service-card';

export function ServicesBrowser({ favoriteIds }: { favoriteIds: string[] }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<ServiceCategory | 'ALL'>('ALL');

  const services = useMemo(() => servicesForRole('STUDENT'), []);
  const favorites = useMemo(() => new Set(favoriteIds), [favoriteIds]);
  const visible = services.filter(
    (service) =>
      (category === 'ALL' || service.category === category) && matchService(service, query),
  );

  return (
    <div data-testid="services-catalog">
      <div className="relative">
        <Search
          aria-hidden="true"
          className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <input
          data-testid="services-search"
          type="search"
          aria-label="Поиск по каталогу"
          placeholder="Найти сервис: справка, заявление…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="h-11 w-full rounded-button border border-border bg-card pl-10 pr-3 text-sm text-foreground shadow-soft outline-none transition-colors placeholder:text-muted-foreground focus:border-muted-foreground/40"
        />
      </div>

      <div
        data-testid="services-categories"
        role="group"
        aria-label="Категории сервисов"
        className="mt-3 flex gap-2 overflow-x-auto pb-1"
      >
        <Chip active={category === 'ALL'} onClick={() => setCategory('ALL')}>
          Все
        </Chip>
        {(Object.keys(CATEGORY_LABELS) as ServiceCategory[]).map((key) => (
          <Chip key={key} active={category === key} onClick={() => setCategory(key)}>
            {CATEGORY_LABELS[key]}
          </Chip>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          className="mt-4"
          title="Ничего не найдено"
          description="Попробуйте другой запрос или сбросьте категорию."
        />
      ) : (
        <ul
          data-testid="services-grid"
          className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
        >
          {visible.map((service) => (
            <li key={service.id}>
              <ServiceCard service={service} query={query} isFavorite={favorites.has(service.id)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
