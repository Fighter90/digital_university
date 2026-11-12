import { Skeleton } from '@/components/ui/skeleton';

// DIG-27 — скелетон загрузки зачётки (аккордеон семестров появляется
// после агрегата getGradebook). Сегмент /grades/[disciplineId] сознательно
// без loading.tsx — контракт единого 404 (см. requests/[number]/page.tsx).
export default function GradebookLoading() {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 md:py-8" aria-busy="true">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex-1">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="mt-2 h-4 w-72" />
        </div>
        <Skeleton className="h-11 w-52 rounded-button" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-[86px] rounded-card" />
        <Skeleton className="h-[86px] rounded-card" />
      </div>
      {[0, 1].map((i) => (
        <Skeleton key={i} className="h-16 rounded-card" />
      ))}
    </section>
  );
}
