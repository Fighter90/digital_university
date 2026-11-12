import { Skeleton } from '@/components/ui/skeleton';

// DIG-29 — скелетон загрузки каталога сервисов (агрегат getServicesPage
// появляется после сессии). Единица сетки совпадает с реальной страницей.
export default function ServicesLoading() {
  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-6 md:py-8" aria-busy="true">
      <Skeleton className="h-7 w-56" />
      <Skeleton className="mt-2 h-4 w-72" />

      <Skeleton className="mt-6 h-5 w-64" />
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-44 rounded-card" />
        ))}
      </div>

      <div className="mt-8 flex gap-2 overflow-hidden">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-9 w-28 shrink-0 rounded-pill" />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-44 rounded-card" />
        ))}
      </div>
    </section>
  );
}
