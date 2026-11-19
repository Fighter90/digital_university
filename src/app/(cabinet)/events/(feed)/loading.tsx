import { Skeleton } from '@/components/ui/skeleton';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';

// DIG-43 — скелетон загрузки ленты «Мероприятия». Живёт в route-group
// (feed): соседний сегмент [slug] остаётся без Suspense-границы — контракт
// единого 404 не ломается (см. msp/(feed)/loading.tsx).
export default async function EventsLoading() {
  const locale = await getLocale();
  return (
    <section
      className="mx-auto w-full max-w-3xl px-4 py-6 md:py-8"
      aria-busy="true"
      aria-label={t(locale, 'loading.events')}
    >
      <Skeleton className="h-7 w-56" />
      <Skeleton className="mt-2 h-4 w-96" />

      <div className="mt-4 flex gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-9 w-32 rounded-pill" />
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-4">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-64 rounded-card" />
        ))}
      </div>
    </section>
  );
}
