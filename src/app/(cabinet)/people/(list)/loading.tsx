import { Skeleton } from '@/components/ui/skeleton';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';

// DIG-37 — скелетон загрузки справочника (агрегат getPeopleDirectory
// появляется после сессии). Единица сетки совпадает с реальной страницей.
export default async function PeopleLoading() {
  const locale = await getLocale();
  return (
    <section
      className="mx-auto w-full max-w-5xl px-4 py-6 md:py-8"
      aria-busy="true"
      aria-label={t(locale, 'loading.people')}
    >
      <Skeleton className="h-7 w-52" />
      <Skeleton className="mt-2 h-4 w-80" />

      <Skeleton className="mt-5 h-11 w-full rounded-button" />
      <div className="mt-3 flex gap-2 overflow-hidden">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-9 w-40 shrink-0 rounded-pill" />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 rounded-card" />
        ))}
      </div>
    </section>
  );
}
