import { Skeleton } from '@/components/ui/skeleton';

// DIG-35 — скелетон загрузки центра уведомлений: шапка, фильтры и лента строк.
export default function NotificationsLoading() {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-8" aria-busy="true">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Skeleton className="h-7 w-52" />
          <Skeleton className="mt-2 h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-7 w-44 shrink-0 rounded-button" />
      </div>

      <div className="flex gap-2 overflow-hidden">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-8 w-28 shrink-0 rounded-pill" />
        ))}
      </div>

      <Skeleton className="h-4 w-20" />
      <div className="flex flex-col gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-card" />
        ))}
      </div>
    </section>
  );
}
