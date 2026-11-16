// DIG-47/33 — публичная страница проверки подлинности /verify (БЕЗ кода
// в адресе): объяснение, поле ввода кода → переход на /verify/<код>.
// Путь добавлен в точные публичные роуты гварда (тот же уровень доверия,
// что и /verify/<код>: страница не читает персональные данные).
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';

import { VerifyCodeForm } from '@/components/verify/verify-code-form';

export const metadata = {
  title: 'Проверка подлинности документа — Цифровой деканат',
};

export default function VerifyLandingPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center px-4 py-10">
      <div className="rounded-card border border-border bg-card p-6 shadow-soft">
        <span
          aria-hidden="true"
          className="mb-3 flex size-10 items-center justify-center rounded-button bg-accent-soft text-accent-ink"
        >
          <ShieldCheck className="size-5" />
        </span>
        <h1 className="text-xl font-bold sm:text-2xl">Проверка подлинности документа</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Введите код проверки из документа (группы по 4 символа, например «ABCD-EFGH-…»). Страница
          ответит, действителен ли документ, — без входа в кабинет, для банка, военкомата или
          работодателя.
        </p>

        <div className="mt-4">
          <VerifyCodeForm />
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Страница проверки публична и не показывает персональные данные: только тип документа, дату
          выдачи и инициалы держателя.
        </p>
      </div>

      <p className="mt-6 text-center">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← На главную
        </Link>
      </p>

      <div className="mt-6 text-center">
        <span className="inline-block rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
          Концепт для конкурса
        </span>
      </div>
    </main>
  );
}
