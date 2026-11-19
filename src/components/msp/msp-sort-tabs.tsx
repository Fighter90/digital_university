// DIG-68 — переключатель сортировки ленты «МСП»: «Новые» / «Топ».
// Чистые ссылки с query-параметром (?sort=) — состояние в URL, работает
// без JS; активная вкладка в стиле Chip (чёрная заливка, DIG-13).
import Link from 'next/link';

import type { MspSort } from '@/server/data';
import { t, type Locale } from '@/lib/i18n';

const TABS: Array<{ value: MspSort; labelKey: 'msp.sort.new' | 'msp.sort.top' }> = [
  { value: 'new', labelKey: 'msp.sort.new' },
  { value: 'top', labelKey: 'msp.sort.top' },
];

export function MspSortTabs({ sort, locale = 'ru' }: { sort: MspSort; locale?: Locale }) {
  return (
    <nav aria-label={t(locale, 'msp.sort.aria')} className="flex items-center gap-2">
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
            {t(locale, tab.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}
