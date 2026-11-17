// DIG-42 — чипы фильтра каталога по формату обучения (?format=): обычные
// ссылки — состояние в URL, работает без JS (паттерн MspSortTabs, стиль Chip).
import Link from 'next/link';
import { t, type Locale } from '@/lib/i18n';
import type { DpoFormatFilter } from '@/server/data';

const FORMATS: Array<{
  value: DpoFormatFilter;
  labelKey: 'dpo.format.all' | 'dpo.format.online' | 'dpo.format.offline' | 'dpo.format.hybrid';
}> = [
  { value: 'ALL', labelKey: 'dpo.format.all' },
  { value: 'ONLINE', labelKey: 'dpo.format.online' },
  { value: 'OFFLINE', labelKey: 'dpo.format.offline' },
  { value: 'HYBRID', labelKey: 'dpo.format.hybrid' },
];

export function DpoFormatChips({
  format,
  locale = 'ru',
}: {
  format: DpoFormatFilter;
  locale?: Locale;
}) {
  return (
    <nav
      aria-label="Фильтр по формату обучения"
      className="flex flex-wrap items-center gap-2"
      data-testid="dpo-format-chips"
    >
      {FORMATS.map((chip) => {
        const active = chip.value === format;
        return (
          <Link
            key={chip.value}
            href={chip.value === 'ALL' ? '/dpo' : `/dpo?format=${chip.value}`}
            data-testid={`dpo-format-${chip.value.toLowerCase()}`}
            aria-current={active ? 'true' : undefined}
            className={
              active
                ? 'inline-flex h-9 items-center rounded-pill border border-foreground bg-foreground px-4 text-sm font-medium text-background'
                : 'inline-flex h-9 items-center rounded-pill border border-border bg-card px-4 text-sm font-medium text-foreground hover:border-muted-foreground/40'
            }
          >
            {t(locale, chip.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}
