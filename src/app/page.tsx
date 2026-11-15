// DIG-57 — публичный лендинг на «/»: hero «Всё университетское — в одном окне»,
// 5 карточек преимуществ, финальный CTA и футер. Открывается без авторизации,
// все CTA ведут на /login (демо-аккаунты подсказаны чипами на экране входа).
// Дизайн-токены DIG-13 (Inter, палитра, радиусы, тени, градиент бренда),
// анимации — Reveal (IntersectionObserver) + animate-float, без внешних
// зависимостей. Плашка «Концепт для конкурса» — из корневого layout.
import type { CSSProperties } from 'react';
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import {
  ArrowRight,
  Award,
  Bot,
  CalendarDays,
  CheckCircle2,
  FileText,
  GraduationCap,
  QrCode,
  Sparkles,
} from 'lucide-react';
import { Reveal } from '@/components/landing/reveal';

export const metadata = {
  title: 'Цифровой деканат — всё университетское в одном окне',
};

const FEATURES: Array<{
  icon: LucideIcon;
  title: string;
  description: string;
}> = [
  {
    icon: CalendarDays,
    title: 'Расписание',
    description:
      'Неделя и день, типы пар и переносы — актуальное расписание всегда под рукой, с телефона и с компьютера.',
  },
  {
    icon: Award,
    title: 'Оценки',
    description:
      'Текущие баллы, успеваемость и электронная зачётка: видно, что сдано, а что ещё впереди.',
  },
  {
    icon: FileText,
    title: 'Заявки',
    description:
      'Заявки в деканат онлайн с прозрачным статусом: подано, в работе, готово — без очередей и бумажек.',
  },
  {
    icon: QrCode,
    title: 'Справки с QR',
    description: 'Справка об обучении в PDF с QR-кодом — проверить подлинность можно за секунды.',
  },
  {
    icon: Bot,
    title: 'AI-ассистент',
    description:
      'Отвечает на вопросы по учёбе и подсказывает нужный сервис, если непонятно, с чего начать.',
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-background">
      {/* Шапка лендинга: логотип-грейд и один вход «Вход» */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="gradient-brand flex size-10 items-center justify-center rounded-card text-white shadow-soft">
            <GraduationCap size={22} aria-hidden="true" />
          </span>
          <span className="text-base font-extrabold tracking-heading sm:text-lg">
            Цифровой деканат
          </span>
        </div>
        <Link
          href="/login"
          className="rounded-button border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground shadow-soft lift-hover"
        >
          Вход
        </Link>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          {/* мягкие световые пятна (декор) */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-32 left-1/2 size-[32rem] -translate-x-1/2 rounded-full bg-accent-soft blur-3xl sm:size-[40rem]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-40 -right-40 size-96 rounded-full bg-coral-100 blur-3xl"
          />

          <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 px-4 pt-10 pb-16 sm:px-6 sm:pt-16 sm:pb-24 lg:grid-cols-[1.1fr_0.9fr]">
            <Reveal className="text-center lg:text-left">
              <p className="mb-4 inline-flex items-center gap-2 rounded-pill bg-accent-soft px-4 py-1.5 text-xs font-semibold text-accent-ink">
                <Sparkles aria-hidden="true" size={14} />
                Личный кабинет студента — концепт для конкурса
              </p>
              <h1 className="text-3xl leading-tight sm:text-5xl sm:leading-tight">
                <span className="block text-accent-ink">Цифровой деканат</span>
                <span className="block">Всё университетское — в одном окне</span>
              </h1>
              <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base lg:mx-0">
                Расписание и оценки, заявки и справки с QR, AI-ассистент — один кабинет вместо
                десятка окон и кабинетов. Одинаково удобный на телефоне и на компьютере.
              </p>
              <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row lg:justify-start">
                <Link
                  href="/login"
                  className="gradient-brand inline-flex items-center justify-center gap-2 rounded-button px-7 py-3 text-sm font-semibold text-white shadow-soft lift-hover"
                >
                  Войти
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 rounded-button border border-border bg-card px-7 py-3 text-sm font-semibold text-foreground shadow-soft lift-hover"
                >
                  Демо-доступ
                </Link>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Демо-доступ открывает кабинет с вымышленными данными — логины и пароли подсказаны на
                экране входа.
              </p>
            </Reveal>

            {/* «Парящие» карточки-миниатюры: пара, оценка, справка (декор, ≥lg) */}
            <div aria-hidden="true" className="relative hidden h-72 lg:block">
              <div
                className="animate-float absolute top-0 left-4 w-72 rounded-card border border-white/60 bg-card/90 p-4 shadow-hover backdrop-blur-sm"
                style={{ '--du-float-rotate': '-3deg', animationDelay: '0s' } as CSSProperties}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <CalendarDays size={16} className="text-accent-ink" />
                    Математический анализ
                  </span>
                  <span className="rounded-pill bg-lesson-lecture-soft px-2.5 py-0.5 text-xs font-medium text-lesson-lecture-ink">
                    Лекция
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Сегодня · 10:40–12:10 · ауд. 312
                </p>
              </div>

              <div
                className="animate-float absolute top-24 right-2 w-52 rounded-card border border-white/60 bg-card/90 p-4 shadow-hover backdrop-blur-sm"
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
                className="animate-float absolute bottom-2 left-16 w-64 rounded-card border border-white/60 bg-card/90 p-4 shadow-hover backdrop-blur-sm"
                style={{ '--du-float-rotate': '-1.5deg', animationDelay: '2.1s' } as CSSProperties}
              >
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <QrCode size={16} className="text-accent-ink" />
                  Справка об обучении
                </div>
                <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-success-ink">
                  <CheckCircle2 size={14} />
                  Готова · QR для проверки
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Преимущества: 5 карточек с иконками */}
        <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl sm:text-3xl">Что появится в кабинете</h2>
            <p className="mt-3 text-sm text-muted-foreground sm:text-base">
              Пять экранов, которые закрывают большинство студенческих походов в деканат — от «какая
              пара следующая» до «нужна справка с QR».
            </p>
          </Reveal>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 sm:gap-5">
            {FEATURES.map((feature, index) => (
              <Reveal key={feature.title} delay={(index % 3) * 90}>
                <article
                  data-testid="landing-feature"
                  className="h-full rounded-card border border-border bg-card p-6 shadow-soft lift-hover"
                >
                  <span className="mb-4 flex size-11 items-center justify-center rounded-card bg-accent-soft text-accent-ink">
                    <feature.icon size={22} aria-hidden="true" />
                  </span>
                  <h3 className="text-base font-bold">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {feature.description}
                  </p>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Финальный CTA */}
        <section className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6 sm:pb-24">
          <Reveal>
            <div className="gradient-brand overflow-hidden rounded-block px-6 py-12 text-center text-white sm:px-12 sm:py-16">
              <h2 className="text-2xl sm:text-3xl">Загляните в кабинет прямо сейчас</h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-white/85 sm:text-base">
                Демо-доступ открывает личный кабинет студента с вымышленными данными: расписание,
                оценки, заявки и справки с QR — всё как в настоящем деканате, только без очередей.
              </p>
              <Link
                href="/login"
                className="mt-8 inline-flex items-center justify-center gap-2 rounded-button bg-white px-7 py-3 text-sm font-semibold text-accent-ink shadow-soft lift-hover"
              >
                Попробовать демо
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        <p>Цифровой деканат — концепт для конкурса. Все данные вымышленные. © 2026</p>
      </footer>
    </div>
  );
}
