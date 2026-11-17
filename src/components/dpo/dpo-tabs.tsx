// DIG-42 — вкладки экрана «Дополнительное образование» (?tab=): обычные
// ссылки, работают без JS; активная вкладка помечена aria-current="page"
// (паттерн SettingsTabs). prefetch={false} — как у настроек: страница
// мутируется server action записи, устаревший prefetch откатывал бы UI.
import Link from 'next/link';
import { t, type Locale } from '@/lib/i18n';
import { cn } from 'cn';
import { DPO_TABS, dpoTabHref, type DpoTabId } from '@/lib/dpo-tabs';

export function DpoTabs({
  active,
  format,
  locale = 'ru',
}: {
  active: DpoTabId;
  /** Текущий фильтр формата (?format=) — сохраняется при возврате в «Каталог». */
  format?: string;
  locale?: Locale;
}) {
  return (
    <nav
      aria-label="Разделы дополнительного образования"
      className="flex flex-wrap gap-2"
      data-testid="dpo-tabs"
    >
      {DPO_TABS.map((tab) => {
        const selected = tab.id === active;
        return (
          <Link
            key={tab.id}
            href={dpoTabHref(tab.id, format)}
            prefetch={false}
            aria-current={selected ? 'page' : undefined}
            data-testid={`dpo-tab-${tab.id}`}
            className={cn(
              'rounded-pill border px-4 py-1.5 text-sm font-semibold transition-colors',
              selected
                ? 'border-transparent bg-foreground text-background'
                : 'border-border bg-card text-neutral-700 hover:border-coral-200 hover:bg-coral-50',
            )}
          >
            {t(locale, `dpo.tab.${tab.id}`)}
          </Link>
        );
      })}
    </nav>
  );
}
