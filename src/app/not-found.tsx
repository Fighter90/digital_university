// DIG-12 — app-wide 404.
//
// ONE page for every denied lookup: a foreign object (someone else's request
// number / cuid) and a missing object render EXACTLY this screen, so the
// answer never reveals whether the object exists at all.
import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col items-center px-4 py-16 text-center">
      <p className="mb-2 text-5xl font-bold text-neutral-900">404</p>
      <h1 className="mb-2 text-xl font-bold sm:text-2xl">Страница не найдена</h1>
      <p className="mb-6 max-w-md text-sm text-neutral-600">
        Возможно, страницы не существует или у вас нет к ней доступа. Если вы искали свою заявку —
        откройте список своих заявок.
      </p>
      <Link
        href="/requests"
        className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-100"
      >
        Мои заявки
      </Link>
    </main>
  );
}
