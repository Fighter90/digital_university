import { Skeleton } from '@/components/ui/skeleton';

// DIG-40 — скелетон загрузки экрана «Обратная связь». Живёт в route-group
// (list): сегменты [number] и sent/[number] соседние, Suspense над
// notFound() не создаётся — контракт единого 404 не ломается
// (см. requests/[number]/page.tsx и deanery/(list)/loading.tsx).
export default function FeedbackLoading() {
  return (
    <section
      className="mx-auto w-full max-w-5xl px-4 py-6 md:py-8"
      aria-busy="true"
      aria-label="Загрузка обратной связи"
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
