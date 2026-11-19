import { Skeleton } from '@/components/ui/skeleton';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';

// DIG-34 — скелетон загрузки «Задач» (агрегат getTasks появляется после
// сессии). Зеркалит структуру экрана: заголовок + четыре группы строк.
export default async function TasksLoading() {
  const locale = await getLocale();
  return (
    <section
      aria-busy="true"
      aria-label={t(locale, 'loading.tasks')}
      className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 md:py-8"
    >
      <div>
        <Skeleton className="h-7 w-32" />
        <Skeleton className="mt-2 h-4 w-full max-w-md" />
      </div>

      {['overdue', 'today', 'week', 'later'].map((group) => (
        <div key={group}>
          <Skeleton className="h-5 w-40" />
          <div className="mt-3 flex flex-col gap-2">
            <Skeleton className="h-[72px] rounded-card" />
            <Skeleton className="h-[72px] rounded-card" />
          </div>
        </div>
      ))}
    </section>
  );
}
