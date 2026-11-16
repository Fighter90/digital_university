import { PartyPopper } from 'lucide-react';

import { EmptyState } from '@/components/ui/empty-state';
import type { TaskGroupViews, TasksData } from '@/server/data/tasks';

import { TaskRow } from './task-row';

// DIG-34 — группы срочности экрана «Задачи»: Просрочено, Сегодня, На этой
// неделе, Позже (порядок фиксирует спека). Пустые группы скрываются,
// полный пустой список — «Все дела сделаны 🎉» (критерий приёмки).

const GROUPS: Array<{ key: keyof TaskGroupViews; title: string }> = [
  { key: 'overdue', title: 'Просрочено' },
  { key: 'today', title: 'Сегодня' },
  { key: 'week', title: 'На этой неделе' },
  { key: 'later', title: 'Позже' },
];

export function TasksView({ data }: { data: TasksData }) {
  if (data.openCount === 0) {
    return (
      <div data-testid="tasks-empty">
        <EmptyState
          icon={PartyPopper}
          title="Все дела сделаны 🎉"
          description="Сейчас от вас ничего не требуется — новые задачи появятся здесь, когда деканат или курсы их назначат."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6" data-testid="tasks-screen">
      {GROUPS.map(({ key, title }) => {
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
              {title}
              <span className="rounded-pill bg-muted px-2 py-0.5 text-xs font-semibold text-neutral-600">
                {rows.length}
              </span>
            </h2>
            <ol className="mt-3 flex flex-col gap-2">
              {rows.map((task) => (
                <TaskRow key={task.id} task={task} />
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
