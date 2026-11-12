// DIG-28 — скелетон экрана «Сессия» на время загрузки RSC-данных:
// зеркалит структуру экрана (шапка, подсказка AI, таймлайн, блоки),
// скрыт от скринридеров вместе с заглушками.
import { Skeleton } from '@/components/ui/skeleton';

export function SessionSkeleton() {
  return (
    <section
      aria-busy="true"
      aria-label="Сессия загружается"
      className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 md:py-8"
      data-testid="session-skeleton"
    >
      {/* Шапка: заголовок + сезон, отсчёт, кнопка календаря */}
      <div className="flex flex-col gap-3">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-64" />
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-6 w-48 rounded-pill" />
          <Skeleton className="h-9 w-56 rounded-button" />
        </div>
      </div>

      {/* Подсказка AI */}
      <Skeleton className="h-16 w-full rounded-card" />

      {/* Таймлайн: три карточки */}
      <div className="flex flex-col gap-3">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-24 w-full rounded-card" />
        <Skeleton className="h-24 w-full rounded-card" />
        <Skeleton className="h-24 w-full rounded-card" />
      </div>

      {/* Блоки пересдач и консультаций */}
      <Skeleton className="h-40 w-full rounded-card" />
      <Skeleton className="h-32 w-full rounded-card" />
    </section>
  );
}
