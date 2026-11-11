// DIG-22 — скелетон экрана «Расписание: неделя» на время загрузки RSC-данных.
import { Skeleton } from '@/components/ui/skeleton';

export default function ScheduleLoading() {
  return (
    <section
      aria-hidden="true"
      className="mx-auto flex w-full max-w-[1200px] flex-col gap-4"
      data-testid="schedule-skeleton"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="size-9" />
          <Skeleton className="size-9" />
          <Skeleton className="h-7 w-44" />
        </div>
        <Skeleton className="h-10 w-72" />
      </div>
      <div className="flex gap-5">
        <div className="hidden w-60 shrink-0 flex-col gap-4 lg:flex">
          <Skeleton className="h-56 rounded-card" />
          <Skeleton className="h-44 rounded-card" />
          <Skeleton className="h-20 rounded-card" />
        </div>
        <Skeleton className="h-[820px] min-w-0 flex-1 rounded-card" />
      </div>
    </section>
  );
}
