import { cn } from 'cn';

// DIG-23: EventTypePill — общая пилюля типа занятия (цвет из токенов DIG-13).
// Используется в карточке пары и компактном списке мобильной недели.
import { LESSON_KIND_META } from '@/lib/schedule-cards';
import type { ScheduleKind } from '@/server/data/types';

export interface EventTypePillProps {
  kind: ScheduleKind;
  className?: string;
}

export function EventTypePill({ kind, className }: EventTypePillProps) {
  const meta = LESSON_KIND_META[kind];
  return (
    <span
      data-kind={kind}
      className={cn(
        'inline-flex w-fit items-center gap-1.5 rounded-pill px-2.5 py-0.5 text-xs font-semibold',
        meta.pill,
        className,
      )}
    >
      <span aria-hidden="true" className={cn('size-1.5 shrink-0 rounded-pill', meta.dot)} />
      {meta.label}
    </span>
  );
}
