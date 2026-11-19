import Link from 'next/link';
import {
  FileWarning,
  MessagesSquare,
  NotebookPen,
  RotateCcw,
  ShieldAlert,
  SquareCheckBig,
  type LucideIcon,
} from 'lucide-react';

import { dueLabel, taskSourceLabel, taskActionLabel } from '@/lib/task-format';
import { t, type Locale } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { TaskSource, TaskView } from '@/server/data/tasks';

import { MarkTaskDoneButton } from './mark-task-done';

// DIG-34 — строка задачи: иконка источника, что сделать (глагол), откуда,
// срок и действие. Действие ведёт ровно туда, где задачу выполнить
// (критерий приёмки); у ручных задач вместо ссылки — отметка выполнения.
// Компонент серверобезопасный: клиентский островок — только кнопка отметки,
// поэтому строка переиспользуется виджетом главной «Что от меня ждут».

const SOURCE_ICON: Record<TaskSource, LucideIcon> = {
  REQUEST: FileWarning,
  COURSE: NotebookPen,
  SESSION: ShieldAlert,
  RETAKE: RotateCcw,
  DEANERY: MessagesSquare,
  MANUAL: SquareCheckBig,
};

export function TaskRow({
  task,
  locale = 'ru',
}: {
  task: TaskView;
  /** DIG-87 — локаль интерфейса (cookie du-locale, дефолт ru). */
  locale?: Locale;
}) {
  const Icon = SOURCE_ICON[task.source];
  const overdue = (task.daysLeft ?? 1) < 0;
  const dueToday = task.daysLeft === 0;

  return (
    <li
      data-testid="task-row"
      data-task-id={task.id}
      data-source={task.source}
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-2 rounded-card border p-3.5 shadow-soft',
        overdue ? 'border-error-soft bg-error-soft/40' : 'border-border bg-card',
      )}
    >
      <span
        aria-hidden="true"
        className="flex size-9 shrink-0 items-center justify-center rounded-pill bg-accent-soft text-accent-ink"
      >
        <Icon className="size-4" />
      </span>

      <div className="min-w-[12rem] flex-1">
        <p className="text-sm font-semibold text-neutral-900">{task.verb}</p>
        <p className="mt-0.5 text-xs text-neutral-600">
          {taskSourceLabel(task.source, locale)} · {task.origin}
        </p>
      </div>

      <span
        data-testid="task-due"
        title={task.dueAt === null ? t(locale, 'tasks.due.noneTitle') : undefined}
        className={cn(
          'shrink-0 rounded-pill px-2.5 py-0.5 text-[11px] font-semibold',
          overdue && 'bg-error-soft text-error-ink',
          !overdue && dueToday && 'bg-warning-soft text-warning-ink',
          !overdue && !dueToday && 'bg-muted text-muted-foreground',
        )}
      >
        {dueLabel(task.daysLeft, task.dueAt, locale)}
      </span>

      {task.manual ? (
        <MarkTaskDoneButton taskId={task.id.replace(/^manual-/, '')} locale={locale} />
      ) : (
        <Link
          data-testid="task-action"
          href={task.href}
          className="shrink-0 rounded-pill border border-border px-3 py-1.5 text-xs font-semibold text-neutral-700 transition-colors hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral-600"
        >
          {taskActionLabel(task.source as Exclude<TaskSource, 'MANUAL'>, locale)}
        </Link>
      )}
    </li>
  );
}
