export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form className="w-full max-w-sm rounded-2xl border border-neutral-200 p-6 shadow-sm">
        <h1 className="mb-1 text-xl font-bold">Вход в кабинет</h1>
        <p className="mb-6 text-sm text-neutral-600">
          Логин и пароль из задачи DIG-18. Пока — макет формы.
        </p>
        <label className="mb-1 block text-sm font-medium" htmlFor="login">
          Логин
        </label>
        <input
          id="login"
          name="login"
          autoComplete="username"
          className="mb-4 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <label className="mb-1 block text-sm font-medium" htmlFor="password">
          Пароль
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          className="mb-6 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled
          className="w-full rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          Войти
        </button>
      </form>
    </main>
  );
}
