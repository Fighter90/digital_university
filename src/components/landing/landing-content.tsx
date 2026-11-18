// DIG-74 — содержимое лендинга: locale передаёт async-обёртка страницы
// (route-файл не может экспортировать лишние сущности — контракт App Router).
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
import { LocaleSwitch } from '@/components/shell/locale-switch';
import type { Locale } from '@/lib/i18n';

type LandingCopy = Record<string, string>;

const COPY: Record<Locale, LandingCopy> = {
  ru: {
    metaTitle: '',
    brand: 'Цифровой деканат',
    signIn: 'Вход',
    badge: 'Личный кабинет студента — концепт для конкурса',
    h1a: 'Цифровой деканат',
    h1b: 'Всё университетское — в одном окне',
    hero: 'Расписание и оценки, заявки и справки с проверкой подлинности, AI-ассистент — один кабинет вместо десятка окон и кабинетов. Одинаково удобный на телефоне и на компьютере.',
    ctaSignIn: 'Войти',
    ctaDemo: 'Демо-доступ',
    demoHint:
      'Демо-доступ открывает кабинет с вымышленными данными — логины и пароли подсказаны на экране входа.',
    pairLesson: 'Математический анализ',
    pairKind: 'Лекция',
    pairTime: 'Сегодня · 10:40–12:10 · ауд. 312',
    gradeLabel: 'Оценка за тест',
    certLabel: 'Справка об обучении',
    certOk: 'Готова · проверка подлинности',
    featuresTitle: 'Что появится в кабинете',
    featuresSub:
      'Пять экранов, которые закрывают большинство студенческих походов в деканат — от «какая пара следующая» до «нужна справка с проверкой подлинности».',
    ctaTitle: 'Загляните в кабинет прямо сейчас',
    ctaText:
      'Демо-доступ открывает личный кабинет студента с вымышленными данными: расписание, оценки, заявки и справки с проверкой подлинности — всё как в настоящем деканате, только без очередей.',
    ctaTry: 'Попробовать демо',
    footer: 'Цифровой деканат — концепт для конкурса. Все данные вымышленные. © 2026',
    f1t: 'Расписание',
    f1d: 'Неделя и день, типы пар и переносы — актуальное расписание всегда под рукой, с телефона и с компьютера.',
    f2t: 'Оценки',
    f2d: 'Текущие баллы, успеваемость и электронная зачётка: видно, что сдано, а что ещё впереди.',
    f3t: 'Заявки',
    f3d: 'Заявки в деканат онлайн с прозрачным статусом: подано, в работе, готово — без очередей и бумажек.',
    f4t: 'Справки с проверкой подлинности',
    f4d: 'Справка об обучении в PDF с кодом проверки — проверить подлинность можно за секунды на /verify.',
    f5t: 'AI-ассистент',
    f5d: 'Отвечает на вопросы по учёбе и подсказывает нужный сервис, если непонятно, с чего начать.',
  },
  en: {
    metaTitle: '',
    brand: 'Digital Deanery',
    signIn: 'Sign in',
    badge: 'Student portal — a hackathon concept',
    h1a: 'Digital Deanery',
    h1b: 'Everything university-related — in one window',
    hero: 'Schedule and grades, requests with authenticity verification, AI assistant — one portal instead of a dozen windows. Equally convenient on phone and desktop.',
    ctaSignIn: 'Sign in',
    ctaDemo: 'Demo access',
    demoHint:
      'Demo access opens the portal with fictional data — logins and passwords are shown on the sign-in screen.',
    pairLesson: 'Mathematical analysis',
    pairKind: 'Lecture',
    pairTime: 'Today · 10:40–12:10 · room 312',
    gradeLabel: 'Test grade',
    certLabel: 'Enrollment certificate',
    certOk: 'Ready · authenticity check',
    featuresTitle: 'What you get in the portal',
    featuresSub:
      'Five screens that cover most student trips to the deanery — from «what is my next class» to «I need a verifiable certificate».',
    ctaTitle: 'Take a look at the portal right now',
    ctaText:
      'Demo access opens the student portal with fictional data: schedule, grades, requests with authenticity verification — just like a real deanery, without the queues.',
    ctaTry: 'Try the demo',
    footer: 'Digital Deanery — a competition concept. All data is fictional. © 2026',
    f1t: 'Schedule',
    f1d: 'Week and day views, class types and changes — the up-to-date schedule always at hand, on phone and desktop.',
    f2t: 'Grades',
    f2d: 'Current scores, performance and a digital gradebook: see what is done and what is ahead.',
    f3t: 'Requests',
    f3d: 'Online requests to the deanery with a transparent status: submitted, in progress, ready — no queues or paperwork.',
    f4t: 'Certificates with verification',
    f4d: 'An enrollment certificate in PDF with a verification code — verify authenticity in seconds at /verify.',
    f5t: 'AI assistant',
    f5d: 'Answers study questions and points you to the right service when it is unclear where to start.',
  },
};

type FeatureDef = { icon: LucideIcon; titleKey: string; descKey: string };

const FEATURES: FeatureDef[] = [
  { icon: CalendarDays, titleKey: 'f1t', descKey: 'f1d' },
  { icon: Award, titleKey: 'f2t', descKey: 'f2d' },
  { icon: FileText, titleKey: 'f3t', descKey: 'f3d' },
  { icon: QrCode, titleKey: 'f4t', descKey: 'f4d' },
  { icon: Bot, titleKey: 'f5t', descKey: 'f5d' },
];

export function LandingContent({ locale }: { locale: Locale }) {
  const c = COPY[locale];
  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-background">
      {/* Шапка лендинга: логотип-грейд, переключатель языка и один вход «Вход» */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-5 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="gradient-brand flex size-10 items-center justify-center rounded-card text-white shadow-soft">
            <GraduationCap size={22} aria-hidden="true" />
          </span>
          <span className="text-base font-extrabold tracking-heading sm:text-lg">{c.brand}</span>
        </div>
        <div className="flex items-center gap-2">
          <LocaleSwitch locale={locale} />
          <Link
            href="/login"
            className="rounded-button border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground shadow-soft lift-hover"
          >
            {c.signIn}
          </Link>
        </div>
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
                {c.badge}
              </p>
              <h1 className="text-3xl leading-tight sm:text-5xl sm:leading-tight">
                <span className="block text-accent-ink">{c.h1a}</span>
                <span className="block">{c.h1b}</span>
              </h1>
              <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base lg:mx-0">
                {c.hero}
              </p>
              <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row lg:justify-start">
                <Link
                  href="/login"
                  className="gradient-brand inline-flex items-center justify-center gap-2 rounded-button px-7 py-3 text-sm font-semibold text-white shadow-soft lift-hover"
                >
                  {c.ctaSignIn}
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 rounded-button border border-border bg-card px-7 py-3 text-sm font-semibold text-foreground shadow-soft lift-hover"
                >
                  {c.ctaDemo}
                </Link>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">{c.demoHint}</p>
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
                    {c.pairLesson}
                  </span>
                  <span className="rounded-pill bg-lesson-lecture-soft px-2.5 py-0.5 text-xs font-medium text-lesson-lecture-ink">
                    {c.pairKind}
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">{c.pairTime}</p>
              </div>

              <div
                className="animate-float absolute top-24 right-2 w-52 rounded-card border border-white/60 bg-card/90 p-4 shadow-hover backdrop-blur-sm"
                style={{ '--du-float-rotate': '2deg', animationDelay: '1.2s' } as CSSProperties}
              >
                <p className="text-xs text-muted-foreground">{c.gradeLabel}</p>
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
                  {c.certLabel}
                </div>
                <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-success-ink">
                  <CheckCircle2 size={14} />
                  {c.certOk}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Преимущества: 5 карточек с иконками */}
        <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl sm:text-3xl">{c.featuresTitle}</h2>
            <p className="mt-3 text-sm text-muted-foreground sm:text-base">{c.featuresSub}</p>
          </Reveal>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 sm:gap-5">
            {FEATURES.map((feature, index) => (
              <Reveal key={feature.titleKey} delay={(index % 3) * 90}>
                <article
                  data-testid="landing-feature"
                  className="h-full rounded-card border border-border bg-card p-6 shadow-soft lift-hover"
                >
                  <span className="mb-4 flex size-11 items-center justify-center rounded-card bg-accent-soft text-accent-ink">
                    <feature.icon size={22} aria-hidden="true" />
                  </span>
                  <h3 className="text-base font-bold">{COPY[locale][feature.titleKey]}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {COPY[locale][feature.descKey]}
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
              <h2 className="text-2xl sm:text-3xl">{c.ctaTitle}</h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-white/85 sm:text-base">
                {c.ctaText}
              </p>
              <Link
                href="/login"
                className="mt-8 inline-flex items-center justify-center gap-2 rounded-button bg-white px-7 py-3 text-sm font-semibold text-accent-ink shadow-soft lift-hover"
              >
                {c.ctaTry}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        <p>{c.footer}</p>
      </footer>
    </div>
  );
}
