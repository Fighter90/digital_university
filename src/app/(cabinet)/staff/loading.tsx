// DIG-48 — скелетон загрузки разделов деканата (мгновенный отклик каркаса).
export default function StaffLoading() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-4">
      <div className="h-7 w-56 animate-pulse rounded-lg bg-neutral-200" />
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-neutral-200" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-2xl bg-neutral-200" />
    </div>
  );
}
