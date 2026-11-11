import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-10 text-center">
      <h1 className="text-2xl font-bold sm:text-4xl">Цифровой деканат — личный кабинет студента</h1>
      <p className="max-w-xl text-sm text-neutral-600 sm:text-base">
        Расписание, успеваемость, заявки и справки, уведомления — всё в одном месте, с телефона и с
        компьютера. Прототип: данные вымышленные, вход появится в следующих задачах.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/login"
          className="rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-700"
        >
          Вход в кабинет
        </Link>
        <Link
          href="/dashboard"
          className="rounded-lg border border-neutral-300 px-5 py-2.5 text-sm font-medium hover:bg-neutral-100"
        >
          Демо-кабинет
        </Link>
      </div>
    </main>
  );
}
