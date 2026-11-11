// DIG-18 — экран-заглушка «Забыли пароль?» (публичный маршрут, см.
// route-guard): в концепте восстановление выполняет деканат — интеграции с
// реальными системами вуза нет. Объясняем это жюри честно и возвращаем ко входу.
import { ArrowLeft, MessagesSquare } from 'lucide-react';

export const metadata = { title: 'Восстановление пароля — Цифровой деканат' };

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-card border border-border bg-card p-6 shadow-soft sm:p-8">
        <span className="inline-flex size-11 items-center justify-center rounded-card bg-accent-soft text-accent-ink">
          <MessagesSquare size={22} aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-2xl leading-tight">Восстановление пароля</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Это концепт для конкурса, поэтому автоматическое восстановление не подключено: в прототипе
          пароль восстанавливается через деканат. Обратитесь к сотруднику деканата — он проверит
          вашу зачётку и выдаст временный пароль для входа.
        </p>
        <p className="mt-3 rounded-card-sm border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
          В настоящем вузе здесь был бы запрос на служебную почту; в демо используйте тестовые
          аккаунты со страницы входа.
        </p>
        <a
          href="/login"
          className="lift-hover mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-button border border-border bg-card px-5 text-[15px] font-semibold text-foreground shadow-soft"
        >
          <ArrowLeft size={18} aria-hidden="true" />
          Вернуться ко входу
        </a>
      </div>
    </main>
  );
}
