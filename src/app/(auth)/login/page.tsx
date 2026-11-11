// DIG-18 — экран входа по макету Figma «02 · Вход»: на десктопе (≥768)
// разделённый экран — слева мягкий коралловый градиент с «парящими» карточками
// (пара, оценка, статус справки), справа форма. На 360 px иллюстрация скрыта,
// форма на весь экран. Безопасный `?next=` и редирект залогиненных — DIG-11.
import type { CSSProperties } from 'react';
import { redirect } from 'next/navigation';
import { BookOpen, CheckCircle2, FileText, GraduationCap } from 'lucide-react';
import { LoginForm } from '@/components/auth/login-form';
import { getAuthSession } from '@/server/auth/session';
import { ensureAppData } from '@/server/data';
import { safeNextPath } from '@/lib/route-guard';

export const metadata = { title: 'Вход — Цифровой деканат' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const auth = await getAuthSession();
  if (auth) redirect('/dashboard');

  // DIG-18: экран входа — первый экран жюри, и он должен работать на свежем
  // старте сервера. Демо-пользователи (anna/ilya/maria) заливаются в
  // in-memory authStore лениво; без этого вызова первый вход после загрузки
  // давал «Неверный логин или пароль», пока кто-нибудь не откроет кабинет.
  await ensureAppData();

  const params = await searchParams;
  const next = safeNextPath(params.next) ?? undefined;

  return (
    <main className="flex min-h-screen flex-1 flex-col md:flex-row">
      {/*
        Декоративная иллюстрация: только ≥768 px, скрыта от скринридеров —
        всю информацию дублирует текст формы.
      */}
      <section
        aria-hidden="true"
        data-testid="login-hero"
        className="relative hidden overflow-hidden bg-gradient-to-br from-coral-50 via-coral-100 to-coral-200 md:flex md:w-1/2 md:flex-col md:justify-between md:p-10 xl:w-[55%] xl:p-14"
      >
        {/* мягкие световые пятна */}
        <div className="pointer-events-none absolute -top-24 -left-24 size-96 rounded-full bg-coral-400/25 blur-3xl" />
        <div className="pointer-events-none absolute -right-32 bottom-24 size-[28rem] rounded-full bg-coral-200/60 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <span className="gradient-brand flex size-10 items-center justify-center rounded-card text-white shadow-soft">
            <GraduationCap size={22} />
          </span>
          <span className="text-lg font-extrabold tracking-heading">Цифровой деканат</span>
        </div>

        <div className="relative max-w-md">
          <h2 className="text-3xl leading-tight text-foreground xl:text-4xl">
            Всё университетское —<br />в одном окне
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-foreground/70 xl:text-base">
            Расписание, оценки, заявки на справки и переписка с деканатом — в личном кабинете,
            одинаково удобном на телефоне и на компьютере.
          </p>
        </div>

        {/* «парящие» карточки: пара / оценка / статус справки */}
        <div className="relative h-44">
          <div
            className="animate-float absolute top-0 left-2 w-64 rounded-card border border-white/60 bg-card/90 p-4 shadow-hover backdrop-blur-sm xl:left-10"
            style={{ '--du-float-rotate': '-3deg', animationDelay: '0s' } as CSSProperties}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <BookOpen size={16} className="text-accent-ink" />
                Математический анализ
              </span>
              <span className="rounded-pill bg-lesson-lecture-soft px-2.5 py-0.5 text-xs font-medium text-lesson-lecture-ink">
                Лекция
              </span>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">Сегодня · 10:40–12:10 · ауд. 312</p>
          </div>

          <div
            className="animate-float absolute top-14 right-4 w-48 rounded-card border border-white/60 bg-card/90 p-4 shadow-hover backdrop-blur-sm xl:right-14"
            style={{ '--du-float-rotate': '2deg', animationDelay: '1.2s' } as CSSProperties}
          >
            <p className="text-xs text-muted-foreground">Оценка за тест</p>
            <p className="mt-0.5 text-xl font-extrabold text-success-ink">92 / 100</p>
            <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-success-ink">
              <CheckCircle2 size={14} />
              Отлично
            </p>
          </div>

          <div
            className="animate-float absolute bottom-0 left-16 w-60 rounded-card border border-white/60 bg-card/90 p-4 shadow-hover backdrop-blur-sm xl:left-32"
            style={{ '--du-float-rotate': '-1.5deg', animationDelay: '2.1s' } as CSSProperties}
          >
            <div className="flex items-center gap-2 text-sm font-semibold">
              <FileText size={16} className="text-accent-ink" />
              Справка об обучении
            </div>
            <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-success-ink">
              <CheckCircle2 size={14} />
              Готова · можно забрать
            </p>
          </div>
        </div>
      </section>

      {/* Форма: на мобильном — весь экран, поля 48 px внутри LoginForm. */}
      <section className="flex flex-1 items-center justify-center bg-card px-4 py-10 sm:px-8 md:py-14">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 md:hidden">
            <span className="gradient-brand flex size-10 items-center justify-center rounded-card text-white shadow-soft">
              <GraduationCap size={22} aria-hidden="true" />
            </span>
            <span className="text-lg font-extrabold tracking-heading">Цифровой деканат</span>
          </div>
          <LoginForm next={next} />
        </div>
      </section>
    </main>
  );
}
