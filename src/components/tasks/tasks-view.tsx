import { PartyPopper } from 'lucide-react';

import { EmptyState } from '@/components/ui/empty-state';
import { t, type Locale } from '@/lib/i18n';
import type { TaskGroupViews, TasksData } from '@/server/data/tasks';

import { TaskRow } from './task-row';

// DIG-34 — группы срочности экрана «Задачи»: Просрочено, Сегодня, На этой
// неделе, Позже (порядок фиксирует спека). Пустые группы скрываются,
// полный пустой список — «Все дела сделаны 🎉» (критерий приёмки).
// DIG-89 — EN-подписи групп и пустого состояния по локали.

const GROUPS: Array<{ key: keyof TaskGroupViews; titleKey: 'tasks.group.overdue' | 'tasks.group.today' | 'tasks.group.week' | 'tasks.group.later' }> = [
  { key: 'overdue', titleKey: 'tasks.group.overdue' },
  { key: 'today', titleKey: 'tasks.group.today' },
  { key: 'week', titleKey: 'tasks.group.week' },
  { key: 'later', titleKey: 'tasks.group.later' },
];

export function TasksView({ data, locale = 'ru' }: { data: TasksData; locale?: Locale }) {
  if (data.openCount === 0) {
    return (
      <div data-testid="tasks-empty">
        <EmptyState
          icon={PartyPopper}
          title={t(locale, 'tasks.empty.title')}
          description={t(locale, 'tasks.empty.desc')}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6" data-testid="tasks-screen">
      {GROUPS.map(({ key, titleKey }) => {
        const rows = data[key];
        if (rows.length === 0) return null;
        return (
          <section
            key={key}
            data-testid={`task-group-${key}`}
            aria-labelledby={`tasks-${key}-title`}
          >
            <h2
              id={`tasks-${key}-title`}
              className="flex items-center gap-2 text-base font-extrabold tracking-heading"
            >
              {t(locale, titleKey)}
              <span className="rounded-pill bg-muted px-2 py-0.5 text-xs font-semibold text-neutral-600">
                {rows.length}
              </span>
            </h2>
            <ol className="mt-3 flex flex-col gap-2">
              {rows.map((task) => (
                <TaskRow key={task.id} task={task} locale={locale} />
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
