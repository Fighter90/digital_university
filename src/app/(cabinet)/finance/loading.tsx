import { Skeleton } from '@/components/ui/skeleton';

// DIG-41 — скелетон загрузки экрана «Финансы»: сводка, договор, документы,
// выплаты. Живёт рядом с page.tsx — Suspense вокруг страницы отрисовывает
// его, пока агрегат getFinancePage читает данные.
export default function FinanceLoading() {
  return (
    <section
      className="mx-auto w-full max-w-3xl px-4 py-6 md:py-8"
      aria-busy="true"
      aria-label="Загрузка финансов"
    >
      <Skeleton className="h-7 w-48" />
      <Skeleton className="mt-2 h-4 w-80" />

      <Skeleton className="mt-6 h-44 rounded-card" />
      <Skeleton className="mt-6 h-64 rounded-card" />

      <div className="mt-8 flex flex-col gap-2">
        <Skeleton className="h-5 w-32" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16 rounded-card" />
        ))}
      </div>
    </section>
  );
}
