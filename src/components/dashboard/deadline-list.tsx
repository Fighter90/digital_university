import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { cn } from 'cn';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Icon } from '@/components/ui/icon';
import { daysLeftLabel } from '@/lib/dashboard-format';
import type { DashboardSection, DeadlineView } from '@/server/data/dashboard';

// DIG-20: «Ближайшие дедлайны» — дата-бейдж, задание (зачёт/экзамен/пересдача),
// дисциплина, «осталось N дн.» (красным при ≤3 днях) и кнопка действия
// в раздел расписания/сессии.

export interface DeadlineListProps {
  section: DashboardSection<DeadlineView[]>;
}

export function DeadlineList({ section }: DeadlineListProps) {
  if (!section.ok) {
    return <ErrorState title="Блок «Дедлайны» не загрузился" description="Обновите страницу — остальные блоки на месте." />;
  }
  const items = section.value;

  return (
    <section aria-labelledby="dashboard-deadlines-heading" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2
          id="dashboard-deadlines-heading"
          className="text-lg font-extrabold tracking-heading sm:text-xl"
        >
          Ближайшие дедлайны
        </h2>
        <Link
          href="/schedule"
          className="inline-flex items-center gap-1 text-sm font-medium text-accent-ink hover:underline"
        >
          Вся сессия
          <Icon icon={ArrowRight} size={14} />
        </Link>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="Дедлайнов нет"
          description="Ближайшие зачёты и экзамены появятся здесь, когда их утвердит деканат."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => {
            const urgent = item.daysLeft <= 3;
            const label = daysLeftLabel(item.daysLeft);
            return (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-card border border-border bg-card p-4 shadow-soft sm:gap-4"
              >
                {/* Дата-бейдж: число + короткий месяц */}
                <span
                  aria-hidden="true"
                  className="flex w-12 shrink-0 flex-col items-center rounded-card border border-border bg-accent-soft py-1.5 text-accent-ink sm:w-14"
                >
                  <span className="text-lg font-extrabold leading-none tracking-heading">
                    {item.dayBadge}
                  </span>
                  <span className="mt-0.5 text-[11px] font-medium">{item.monthBadge}</span>
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-muted-foreground">{item.kindLabel}</p>
                  <p className="truncate text-sm font-semibold sm:text-base">
                    {item.disciplineName}
                  </p>
                  <p
                    data-urgent={urgent ? 'true' : undefined}
                    className={cn(
                      'mt-0.5 text-xs font-semibold',
                      urgent ? 'text-error-ink' : 'text-muted-foreground',
                    )}
                  >
                    {label}
                  </p>
                </div>

                <Link
                  href="/schedule"
                  className="lift-hover shrink-0 rounded-button border border-border bg-card px-3 py-2 text-xs font-semibold sm:text-sm"
                >
                  Подробнее
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
