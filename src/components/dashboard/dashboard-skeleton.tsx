import { Skeleton } from '@/components/ui/skeleton';

// DIG-20 — скелетон главной на время загрузки агрегата: зеркалит структуру
// экрана (тёмный hero + блоки), скрыт от скринридеров вместе с заглушками.
export function DashboardSkeleton() {
  return (
    <section
      aria-busy="true"
      aria-label="Главная загружается"
      className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 md:py-8"
    >
      {/* Hero */}
      <div className="rounded-block bg-neutral-900 p-6 md:p-8">
        <Skeleton className="h-6 w-64 bg-white/15" />
        <Skeleton className="mt-2 h-4 w-40 bg-white/10" />
        <Skeleton className="mt-3 h-5 w-full max-w-md bg-white/10" />
        <div className="mt-6 grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 bg-white/10" />
          ))}
        </div>
      </div>

      {/* Блоки */}
      {['skeleton-today', 'skeleton-deadlines', 'skeleton-progress', 'skeleton-actions', 'skeleton-news'].map(
        (key) => (
          <div key={key} className="rounded-card border border-border bg-card p-5 shadow-soft">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="mt-4 h-4 w-full" />
            <Skeleton className="mt-2 h-4 w-4/5" />
            <Skeleton className="mt-2 h-4 w-3/5" />
          </div>
        ),
      )}
    </section>
  );
}
