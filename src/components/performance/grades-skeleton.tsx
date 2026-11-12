// DIG-26 — скелетон экрана «Успеваемость: сводка» на время загрузки
// RSC-данных: зеркалит структуру экрана (сводка, светофор, карточки,
// долги), скрыт от скринридеров вместе с заглушками.
import { Skeleton } from '@/components/ui/skeleton';

export function GradesSkeleton() {
  return (
    <section
      aria-busy="true"
      aria-label="Успеваемость загружается"
      className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 md:py-8"
      data-testid="grades-skeleton"
    >
      {/* Заголовок + пилюли семестров */}
      <div>
        <Skeleton className="h-7 w-56" />
        <div className="mt-3 flex gap-2">
          <Skeleton className="h-8 w-32 rounded-pill" />
          <Skeleton className="h-8 w-32 rounded-pill" />
        </div>
      </div>

      {/* Сводка: кольцо GPA + кредиты + рейтинг */}
      <div className="rounded-card border border-border bg-card p-5 shadow-soft">
        <div className="flex items-center gap-5">
          <Skeleton className="size-20 rounded-pill" />
          <div className="flex-1">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-2 h-3 w-52" />
          </div>
        </div>
        <Skeleton className="mt-5 h-3 w-full" />
        <Skeleton className="mt-2 h-3 w-2/3" />
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      </div>

      {/* Светофор */}
      <Skeleton className="h-16 rounded-card" />

      {/* Карточки дисциплин */}
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-card border border-border bg-card p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-8 w-14" />
          </div>
          <Skeleton className="mt-3 h-3 w-36" />
          <Skeleton className="mt-3 h-2 w-full" />
        </div>
      ))}

      {/* Долги */}
      <div className="rounded-card border border-border bg-card p-5 shadow-soft">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="mt-3 h-4 w-full" />
        <Skeleton className="mt-2 h-4 w-3/4" />
      </div>
    </section>
  );
}
