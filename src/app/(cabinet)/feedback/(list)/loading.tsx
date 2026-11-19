import { Skeleton } from '@/components/ui/skeleton';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';

// DIG-40 — скелетон загрузки экрана «Обратная связь». Живёт в route-group
// (list): сегменты [number] и sent/[number] соседние, Suspense над
// notFound() не создаётся — контракт единого 404 не ломается
// (см. requests/[number]/page.tsx и deanery/(list)/loading.tsx).
export default async function FeedbackLoading() {
  const locale = await getLocale();
  return (
    <section
      className="mx-auto w-full max-w-5xl px-4 py-6 md:py-8"
      aria-busy="true"
      aria-label={t(locale, 'loading.feedback')}
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
