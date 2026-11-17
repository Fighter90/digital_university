// DIG-46 — скелетон загрузки экрана /ai-assistant (пока строится контекст
// сессии на сервере). Повторяет каркас экрана: шапка, диалог, подсказки.
export default function AiAssistantLoading() {
  return (
    <section
      aria-hidden="true"
      aria-busy="true"
      className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4"
    >
      <div className="flex items-start gap-3">
        <div className="size-10 animate-pulse animate-shimmer rounded-card bg-neutral-200/70" />
        <div className="flex-1 pt-1">
          <div className="h-6 w-48 animate-pulse animate-shimmer rounded-button bg-neutral-200/70" />
          <div className="mt-2 h-4 w-72 max-w-full animate-pulse animate-shimmer rounded-button bg-neutral-200/70" />
        </div>
      </div>
      <div className="flex gap-2">
        <div className="h-8 w-32 animate-pulse animate-shimmer rounded-button bg-neutral-200/70" />
        <div className="h-8 w-24 animate-pulse animate-shimmer rounded-button bg-neutral-200/70" />
      </div>
      <div className="h-20 animate-pulse animate-shimmer rounded-card bg-neutral-200/70" />
      <div className="flex flex-col gap-2">
        <div className="h-12 animate-pulse animate-shimmer rounded-card bg-neutral-200/70" />
        <div className="h-12 animate-pulse animate-shimmer rounded-card bg-neutral-200/70" />
        <div className="h-12 animate-pulse animate-shimmer rounded-card bg-neutral-200/70" />
        <div className="h-12 animate-pulse animate-shimmer rounded-card bg-neutral-200/70" />
      </div>
    </section>
  );
}
