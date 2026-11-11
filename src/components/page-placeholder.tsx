// DIG-14: общая заглушка раздела каркаса кабинета. Конкретные экраны
// подключаются собственными задачами (DIG-18+) и заменят содержимое.
export function PagePlaceholder({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm md:p-6">
      <h1 className="text-lg font-bold text-neutral-900 md:text-xl">{title}</h1>
      <p className="mt-1 max-w-prose text-sm text-neutral-600">{description}</p>
      {children}
    </section>
  );
}
