// DIG-36 — скелетон ленты новостей: показывается в Suspense, пока агрегат
// getNewsPage читает скоуп и отметки «Прочитано» (тот же паттерн, что у
// DashboardSkeleton DIG-20).
export function NewsSkeleton() {
  return (
    <div aria-hidden="true" className="mx-auto w-full max-w-5xl px-4 py-6 md:py-8">
      <div className="h-7 w-72 animate-pulse rounded-pill bg-neutral-200" />
      <div className="mt-6 h-28 w-full animate-pulse rounded-card bg-neutral-200" />
      <div className="mt-6 flex gap-2">
        {[80, 130, 90].map((w) => (
          <div
            key={w}
            className="h-9 animate-pulse rounded-pill bg-neutral-200"
            style={{ width: w }}
          />
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        {[64, 84, 120, 110, 120].map((w, i) => (
          <div
            key={i}
            className="h-8 animate-pulse rounded-pill bg-neutral-200"
            style={{ width: w }}
          />
        ))}
      </div>
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="overflow-hidden rounded-card border border-border bg-card">
            <div className="aspect-[16/9] w-full animate-pulse bg-neutral-200" />
            <div className="flex flex-col gap-2 p-4">
              <div className="h-3 w-40 animate-pulse rounded-pill bg-neutral-200" />
              <div className="h-4 w-full animate-pulse rounded-pill bg-neutral-200" />
              <div className="h-3 w-4/5 animate-pulse rounded-pill bg-neutral-200" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
