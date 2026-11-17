// DIG-68 — переключатель сортировки ленты «МСП»: «Новые» / «Топ».
// Чистые ссылки с query-параметром (?sort=) — состояние в URL, работает
// без JS; активная вкладка в стиле Chip (чёрная заливка, DIG-13).
import Link from 'next/link';

import type { MspSort } from '@/server/data';

const TABS: Array<{ value: MspSort; label: string }> = [
  { value: 'new', label: 'Новые' },
  { value: 'top', label: 'Топ' },
];

export function MspSortTabs({ sort }: { sort: MspSort }) {
  return (
    <nav aria-label="Сортировка каталога" className="flex items-center gap-2">
      {TABS.map((tab) => {
        const active = tab.value === sort;
        return (
          <Link
            key={tab.value}
            href={tab.value === 'new' ? '/msp' : '/msp?sort=top'}
            data-testid={`msp-sort-${tab.value}`}
            aria-current={active ? 'true' : undefined}
            className={
              active
                ? 'inline-flex h-9 items-center rounded-pill border border-foreground bg-foreground px-4 text-sm font-medium text-background'
                : 'inline-flex h-9 items-center rounded-pill border border-border bg-card px-4 text-sm font-medium text-foreground hover:border-muted-foreground/40'
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
