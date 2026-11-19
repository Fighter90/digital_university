import { Skeleton } from '@/components/ui/skeleton';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';

// DIG-68 — скелетон загрузки ленты «МСП». Живёт в route-group (feed):
// соседний сегмент [slug] остаётся без Suspense-границы — контракт единого
// 404 не ломается (см. feedback/(list)/loading.tsx и deanery/(list)/loading.tsx).
export default async function MspLoading() {
  const locale = await getLocale();
  return (
    <section
      className="mx-auto w-full max-w-5xl px-4 py-6 md:py-8"
      aria-busy="true"
      aria-label={t(locale, 'loading.msp')}
    >
      <Skeleton className="h-7 w-72" />
      <Skeleton className="mt-2 h-4 w-96" />

      <Skeleton className="mt-6 h-36 rounded-card" />

      <div className="mt-6 flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-36 rounded-card" />
        ))}
      </div>
    </section>
  );
}
