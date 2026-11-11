// DIG-11 — the dashboard is now a protected screen: requireUser() gates it,
// and logout / logout-all are wired to the auth server actions.
import { requireUser } from '@/server/auth/session';
import { signOutAction, signOutAllDevicesAction } from '@/server/actions/auth';

export default async function DashboardPage() {
  const user = await requireUser('/dashboard');

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-neutral-600">
          Вы вошли как <span className="font-medium text-neutral-900">{user.login}</span> (
          {user.role === 'STAFF' ? 'сотрудник' : 'студент'}).
        </p>
        <div className="flex flex-wrap gap-2">
          <form action={signOutAction}>
            <button
              type="submit"
              className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-100"
            >
              Выйти
            </button>
          </form>
          <form action={signOutAllDevicesAction}>
            <button
              type="submit"
              className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-100"
            >
              Выйти со всех устройств
            </button>
          </form>
        </div>
      </div>
      <h1 className="mb-2 text-xl font-bold sm:text-2xl">Кабинет студента</h1>
      <p className="text-sm text-neutral-600">
        Защищённые экраны (расписание, успеваемость, заявки, уведомления) подключаются в задачах
        DIG-21…DIG-36. Здесь — общий каркас маршрута (cabinet) с будущим Shell-лэйаутом.
      </p>
    </main>
  );
}
