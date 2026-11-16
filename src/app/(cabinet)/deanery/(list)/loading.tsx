import { Skeleton } from '@/components/ui/skeleton';

// DIG-39 — скелетон загрузки списка обращений. Живёт в route-group (list):
// сегмент чата [number] соседний, Suspense над notFound() не создаётся —
// контракт единого 404 не ломается (см. requests/[number]/page.tsx).
export default function DeaneryLoading() {
  return (
    <section
      className="mx-auto w-full max-w-5xl px-4 py-6 md:py-8"
      aria-busy="true"
      aria-label="Загрузка обращений"
    >
      <Skeleton className="h-7 w-64" />
      <Skeleton className="mt-2 h-4 w-72" />

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 rounded-card" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-card" />
      </div>
    </section>
  );
}
