// DIG-48 — скелетон загрузки разделов деканата (мгновенный отклик каркаса).
//
// ВАЖНО (раунд 2, ревью): этот loading живёт внутри route group
// (dashboard) — сводка, очереди, список обращений, объявления. Карточки
// `requests/[number]` и `appeals/[id]` вынесены в ОТДЕЛЬНУЮ группу
// (cards) без loading.tsx на всём пути от корня: Suspense-boundary над
// сегментом карточки отдаёт браузеру 200-скелетон раньше, чем notFound()
// выставит статус 404 (чужой/несуществующий объект должны быть
// неразличимы — контракт e2e staff-cabinet и data-isolation).
export default function StaffLoading() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-4">
      <div className="h-7 w-56 animate-pulse animate-shimmer rounded-lg bg-neutral-200" />
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse animate-shimmer rounded-2xl bg-neutral-200" />
        ))}
      </div>
      <div className="h-64 animate-pulse animate-shimmer rounded-2xl bg-neutral-200" />
    </div>
  );
}
