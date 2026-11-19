// DIG-74 — содержимое лендинга: locale передаёт async-обёртка страницы
// (route-файл не может экспортировать лишние сущности — контракт App Router).
// DIG-90 — меню (Личный кабинет/Справка), переключатель «Русский/English»,
// новые секции (статистика, как это работает, сотруднику, ИИ-агенты, FAQ),
// параллакс-орбы и анимированные счётчики (гейт на reduced-motion и a11y).
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
  Languages,
  QrCode,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Stamp,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { Reveal } from '@/components/landing/reveal';
import { ParallaxOrbs } from '@/components/landing/parallax';
import { AnimatedCounter } from '@/components/landing/stats';
import { LocaleSwitch } from '@/components/shell/locale-switch';
import type { Locale } from '@/lib/i18n';

type LandingCopy = Record<string, string | number>;

const COPY: Record<Locale, LandingCopy> = {
  ru: {
    metaTitle: '',
    brand: 'Цифровой деканат',
    signIn: 'Вход',
    // DIG-90 — меню шапки
    menuFeatures: 'Возможности',
    menuHow: 'Как это работает',
    menuStaff: 'Сотруднику',
    menuHelp: 'Справка',
    menuCabinet: 'Личный кабинет',
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
    gradeOk: 'Отлично',
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
    // DIG-90 — статистика
    statsTitle: 'Кабинет в цифрах',
    stat1v: 22,
    stat1l: 'разделов кабинета',
    stat2v: 5,
    stat2l: 'видов заявок и справок',
    stat3v: 2,
    stat3l: 'языка интерфейса',
    stat4v: 24,
    stat4s: '/7',
    stat4l: 'доступ к расписанию',
    // DIG-90 — как это работает
    howTitle: 'Как это работает',
    howSub: 'Четыре шага от входа до готовой справки с кодом проверки.',
    how1t: 'Войдите по демо-доступу',
    how1d:
      'Логины и пароли демо-аккаунтов подсказаны прямо на экране входа — регистрация не нужна.',
    how2t: 'Смотрите неделю',
    how2d:
      'Расписание, дедлайны и уведомления об изменениях — на одном экране, в часовом поясе МСК.',
    how3t: 'Подайте заявку онлайн',
    how3d:
      'Мастер заявки ведёт по шагам: форма, адресат, статус — видно, кто взял и когда будет готово.',
    how4t: 'Проверьте подлинность',
    how4d: 'Готовая справка — PDF с QR-кодом: сканируете и попадаете на страницу проверки /verify.',
    // DIG-90 — сотруднику
    staffTitle: 'И отдельный кабинет — сотруднику деканата',
    staffText:
      'У менеджеров деканата свой вход: очередь заявок с контролем сроков, чат со студентом по каждой заявке, шаблоны ответов и объявления факультету — в том же окне, что и студенческий кабинет.',
    staff1: 'Очередь заявок с подсветкой просроченных',
    staff2: 'Чат по заявке и шаблоны быстрых ответов',
    staff3: 'Объявления факультету в один клик',
    staffCta: 'Войти как сотрудник',
    // DIG-90 — ИИ-агенты
    aiTitle: 'Собрано роем ИИ-агентов',
    aiSub:
      'Прототип построен агентным конвейером: спецификации, код, тесты, ревью и проверка безопасности — всё выполняют связанные ИИ-агенты под контролем оператора.',
    ai1t: 'Спека прежде кода',
    ai1d: 'Каждая задача — change-папка OpenSpec: proposal, задачи и delta-спецификация с WHEN/THEN.',
    ai2t: 'Автогейты на каждый PR',
    ai2d: 'Lint, typecheck, юнит-тесты и сборка прогоняются автоматически — красный PR не доходит до ревью.',
    ai3t: 'Ревью и security-гейт',
    ai3d: 'Отдельные агенты-ревьюеры проверяют код и безопасность: IDOR, секреты, заголовки, rate-limit.',
    ai4t: 'Два языка из коробки',
    ai4d: 'Русский и английский интерфейсы с паритетом ключей словаря — расхождение ловит компиляция и тесты.',
    // DIG-90 — FAQ-тизер
    faqTitle: 'Частые вопросы',
    faq1q: 'Нужна ли регистрация?',
    faq1a: 'Нет. Демо-доступ открывается логином с экрана входа — данные кабинета вымышленные.',
    faq2q: 'Как проверить справку?',
    faq2a:
      'В PDF справки есть QR-код и код проверки: отсканируйте или откройте /verify и введите код.',
    faq3q: 'Работает с телефона?',
    faq3a: 'Да, кабинет спроектирован mobile-first: от 360 px по ширине, до 1440 px на десктопе.',
    faqMore: 'Открыть базу знаний',
  },
  en: {
    metaTitle: '',
    brand: 'Digital Deanery',
    signIn: 'Sign in',
    menuFeatures: 'Features',
    menuHow: 'How it works',
    menuStaff: 'For staff',
    menuHelp: 'Help',
    menuCabinet: 'Student portal',
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
    gradeOk: 'Excellent',
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
    statsTitle: 'The portal in numbers',
    stat1v: 22,
    stat1l: 'portal sections',
    stat2v: 5,
    stat2l: 'request and certificate types',
    stat3v: 2,
    stat3l: 'interface languages',
    stat4v: 24,
    stat4s: '/7',
    stat4l: 'access to the schedule',
    howTitle: 'How it works',
    howSub: 'Four steps from sign-in to a verifiable certificate.',
    how1t: 'Sign in with demo access',
    how1d:
      'Demo logins and passwords are shown right on the sign-in screen — no registration needed.',
    how2t: 'See your week',
    how2d: 'Schedule, deadlines and change notifications — on one screen, in the Moscow time zone.',
    how3t: 'Submit a request online',
    how3d:
      'The request wizard walks you through the steps: form, recipient, status — see who took it and when it will be ready.',
    how4t: 'Verify authenticity',
    how4d:
      'The finished certificate is a PDF with a QR code: scan it and land on the /verify page.',
    staffTitle: 'Plus a separate cabinet for the deanery staff',
    staffText:
      'Deanery managers get their own entrance: a request queue with SLA tracking, a chat with the student on every request, reply templates and faculty announcements — in the same window as the student portal.',
    staff1: 'Request queue with overdue highlighting',
    staff2: 'Per-request chat and quick reply templates',
    staff3: 'Faculty announcements in one click',
    staffCta: 'Sign in as staff',
    aiTitle: 'Built by a swarm of AI agents',
    aiSub:
      'This prototype was built by an agent pipeline: specifications, code, tests, review and security checks — all done by linked AI agents under operator supervision.',
    ai1t: 'Spec before code',
    ai1d: 'Every task is an OpenSpec change folder: proposal, tasks and a delta specification with WHEN/THEN.',
    ai2t: 'Automatic gates on every PR',
    ai2d: 'Lint, typecheck, unit tests and build run automatically — a red PR never reaches review.',
    ai3t: 'Review and security gate',
    ai3d: 'Dedicated reviewer agents check code and security: IDOR, secrets, headers, rate limits.',
    ai4t: 'Two languages out of the box',
    ai4d: 'Russian and English interfaces with dictionary key parity — mismatches are caught by the compiler and tests.',
    faqTitle: 'Frequent questions',
    faq1q: 'Do I need to register?',
    faq1a:
      'No. Demo access opens with a login from the sign-in screen — the portal data is fictional.',
    faq2q: 'How do I verify a certificate?',
    faq2a:
      'The certificate PDF has a QR code and a verification code: scan it or open /verify and enter the code.',
    faq3q: 'Does it work on a phone?',
    faq3a: 'Yes, the portal is mobile-first: from 360 px wide up to 1440 px on desktop.',
    faqMore: 'Open the knowledge base',
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

const HOW: Array<{ icon: LucideIcon; tKey: string; dKey: string }> = [
  { icon: UserRound, tKey: 'how1t', dKey: 'how1d' },
  { icon: CalendarDays, tKey: 'how2t', dKey: 'how2d' },
  { icon: FileText, tKey: 'how3t', dKey: 'how3d' },
  { icon: ScanLine, tKey: 'how4t', dKey: 'how4d' },
];

const AI_CARDS: Array<{ icon: LucideIcon; tKey: string; dKey: string }> = [
  { icon: FileText, tKey: 'ai1t', dKey: 'ai1d' },
  { icon: ShieldCheck, tKey: 'ai2t', dKey: 'ai2d' },
  { icon: Stamp, tKey: 'ai3t', dKey: 'ai3d' },
  { icon: Languages, tKey: 'ai4t', dKey: 'ai4d' },
];

const FAQ: Array<{ qKey: string; aKey: string }> = [
  { qKey: 'faq1q', aKey: 'faq1a' },
  { qKey: 'faq2q', aKey: 'faq2a' },
  { qKey: 'faq3q', aKey: 'faq3a' },
];

export function LandingContent({ locale }: { locale: Locale }) {
  const c = COPY[locale];
  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-background">
      {/* Шапка лендинга (DIG-90: sticky, blur): меню + переключатель языка + вход */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="gradient-brand flex size-10 items-center justify-center rounded-card text-white shadow-soft">
              <GraduationCap size={22} aria-hidden="true" />
            </span>
            <span className="text-base font-extrabold tracking-heading sm:text-lg">{c.brand}</span>
          </div>
          {/* меню: видимо от md — на 360 px остаётся лого + язык + вход */}
          <nav
            aria-label={String(c.menuFeatures)}
            className="hidden items-center gap-5 text-sm font-medium text-muted-foreground lg:flex"
          >
            <a href="#features" className="transition-colors hover:text-foreground">
              {c.menuFeatures}
            </a>
            <a href="#how" className="transition-colors hover:text-foreground">
              {c.menuHow}
            </a>
            <a href="#staff" className="transition-colors hover:text-foreground">
              {c.menuStaff}
            </a>
            <Link href="/help" className="transition-colors hover:text-foreground">
              {c.menuHelp}
            </Link>
            <Link
              href="/dashboard"
              data-testid="landing-menu-cabinet"
              className="inline-flex items-center gap-1 font-semibold text-accent-ink transition-colors hover:opacity-80"
            >
              {c.menuCabinet}
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <LocaleSwitch locale={locale} variant="full" />
            <Link
              href="/login"
              className="rounded-button border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground shadow-soft lift-hover"
            >
              {c.signIn}
            </Link>
          </div>
        </div>
        {/* компактная строка меню для средних экранов */}
        <nav
          aria-label={String(c.menuCabinet)}
          className="border-t border-border/60 bg-background/60 px-4 py-2 text-xs font-medium text-muted-foreground md:flex lg:hidden md:justify-center md:gap-6 hidden"
        >
          <a href="#features" className="hover:text-foreground">
            {c.menuFeatures}
          </a>
          <a href="#how" className="hover:text-foreground">
            {c.menuHow}
          </a>
          <a href="#staff" className="hover:text-foreground">
            {c.menuStaff}
          </a>
          <Link href="/help" className="hover:text-foreground">
            {c.menuHelp}
          </Link>
          <Link
            href="/dashboard"
            data-testid="landing-menu-cabinet-md"
            className="font-semibold text-accent-ink"
          >
            {c.menuCabinet}
          </Link>
        </nav>
      </header>

      <main className="flex-1">
        {/* Hero с параллакс-орбами */}
        <section className="relative overflow-hidden">
          <ParallaxOrbs />

          <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 px-4 pt-10 pb-16 sm:px-6 sm:pt-16 sm:pb-24 lg:grid-cols-[1.1fr_0.9fr]">
            <Reveal className="text-center lg:text-left">
              <p className="mb-4 inline-flex items-center gap-2 rounded-pill bg-accent-soft px-4 py-1.5 text-xs font-semibold text-accent-ink">
                <Sparkles aria-hidden="true" size={14} />
                {c.badge}
              </p>
              <h1 className="text-3xl leading-tight sm:text-5xl sm:leading-tight">
                <span className="block text-accent-ink">{c.h1a}</span>
                <span className="gradient-brand bg-clip-text text-transparent block">{c.h1b}</span>
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
                  {c.gradeOk}
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

        {/* Статистика: анимированные счётчики (DIG-90) */}
        <section aria-label={String(c.statsTitle)} className="border-y border-border/60 bg-card/50">
          <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-6 px-4 py-10 sm:px-6 lg:grid-cols-4">
            {[
              { v: c.stat1v, s: '+', l: c.stat1l },
              { v: c.stat2v, s: '', l: c.stat2l },
              { v: c.stat3v, s: '', l: c.stat3l },
              { v: c.stat4v, s: c.stat4s, l: c.stat4l },
            ].map((st, i) => (
              <Reveal key={st.l} delay={i * 80} className="text-center">
                <p className="text-3xl font-extrabold tracking-heading text-accent-ink sm:text-4xl">
                  <AnimatedCounter value={Number(st.v)} suffix={String(st.s)} />
                </p>
                <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{st.l}</p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Преимущества: 5 карточек с иконками */}
        <section
          id="features"
          className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6 sm:py-20"
        >
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

        {/* Как это работает: 4 шага (DIG-90) */}
        <section id="how" className="scroll-mt-20 border-y border-border/60 bg-card/50">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <Reveal className="mx-auto max-w-2xl text-center">
              <h2 className="text-2xl sm:text-3xl">{c.howTitle}</h2>
              <p className="mt-3 text-sm text-muted-foreground sm:text-base">{c.howSub}</p>
            </Reveal>
            <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 sm:gap-5">
              {HOW.map((step, index) => (
                <Reveal key={step.tKey} delay={index * 90}>
                  <li className="relative h-full rounded-card border border-border bg-card p-6 shadow-soft lift-hover">
                    <span className="absolute -top-3 left-5 rounded-pill gradient-brand px-2.5 py-0.5 text-xs font-bold text-white shadow-soft">
                      {index + 1}
                    </span>
                    <span className="mb-4 flex size-11 items-center justify-center rounded-card bg-accent-soft text-accent-ink">
                      <step.icon size={22} aria-hidden="true" />
                    </span>
                    <h3 className="text-base font-bold">{COPY[locale][step.tKey]}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {COPY[locale][step.dKey]}
                    </p>
                  </li>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        {/* Кабинет сотрудника (DIG-90) */}
        <section
          id="staff"
          className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6 sm:py-20"
        >
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <Reveal>
              <span className="mb-4 inline-flex items-center gap-2 rounded-pill bg-coral-100 px-4 py-1.5 text-xs font-semibold text-coral-600">
                <UsersRound aria-hidden="true" size={14} />
                {c.menuStaff}
              </span>
              <h2 className="text-2xl sm:text-3xl">{c.staffTitle}</h2>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
                {c.staffText}
              </p>
              <ul className="mt-6 space-y-2.5">
                {['staff1', 'staff2', 'staff3'].map((key) => (
                  <li key={key} className="flex items-start gap-2 text-sm">
                    <CheckCircle2
                      size={16}
                      className="mt-0.5 shrink-0 text-success-ink"
                      aria-hidden="true"
                    />
                    {COPY[locale][key]}
                  </li>
                ))}
              </ul>
              <Link
                href="/login"
                className="mt-8 inline-flex items-center justify-center gap-2 rounded-button border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground shadow-soft lift-hover"
              >
                {c.staffCta}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </Reveal>
            {/* мини-макет очереди заявок (декор) */}
            <Reveal delay={120}>
              <div
                aria-hidden="true"
                className="rounded-block border border-border bg-card p-5 shadow-soft"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold">{COPY[locale].f3t}</p>
                  <span className="rounded-pill bg-success-soft px-2.5 py-0.5 text-[11px] font-semibold text-success-ink">
                    SLA
                  </span>
                </div>
                <div className="mt-4 space-y-2.5">
                  {[
                    {
                      t: COPY[locale].certLabel,
                      st: COPY[locale].certOk,
                      cls: 'bg-success-soft text-success-ink',
                      icon: Stamp,
                    },
                    {
                      t: COPY[locale].f3t,
                      st: COPY[locale].pairKind,
                      cls: 'bg-accent-soft text-accent-ink',
                      icon: FileText,
                    },
                    {
                      t: COPY[locale].gradeLabel,
                      st: COPY[locale].gradeOk,
                      cls: 'bg-coral-100 text-coral-600',
                      icon: Award,
                    },
                  ].map((row, i) => (
                    <div
                      key={i}
                      className="animate-float flex items-center justify-between gap-3 rounded-card border border-border bg-background px-4 py-3"
                      style={
                        {
                          '--du-float-rotate': '0deg',
                          animationDelay: `${i * 0.9}s`,
                        } as CSSProperties
                      }
                    >
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <row.icon size={15} className="text-accent-ink" />
                        {row.t}
                      </span>
                      <span
                        className={`rounded-pill px-2.5 py-0.5 text-[11px] font-semibold ${row.cls}`}
                      >
                        {row.st}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ИИ-агенты (DIG-90) */}
        <section className="border-y border-border/60 bg-card/50">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <Reveal className="mx-auto max-w-2xl text-center">
              <span className="mb-4 inline-flex items-center gap-2 rounded-pill bg-accent-soft px-4 py-1.5 text-xs font-semibold text-accent-ink">
                <Bot aria-hidden="true" size={14} />
                {c.aiTitle}
              </span>
              <h2 className="text-2xl sm:text-3xl">{c.aiTitle}</h2>
              <p className="mt-3 text-sm text-muted-foreground sm:text-base">{c.aiSub}</p>
            </Reveal>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 sm:gap-5">
              {AI_CARDS.map((card, index) => (
                <Reveal key={card.tKey} delay={index * 90}>
                  <article className="h-full rounded-card border border-border bg-card p-6 shadow-soft lift-hover">
                    <span className="mb-4 flex size-11 items-center justify-center rounded-card bg-accent-soft text-accent-ink">
                      <card.icon size={22} aria-hidden="true" />
                    </span>
                    <h3 className="text-base font-bold">{COPY[locale][card.tKey]}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {COPY[locale][card.dKey]}
                    </p>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ-тизер (DIG-90) */}
        <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl sm:text-3xl">{c.faqTitle}</h2>
          </Reveal>
          <div className="mx-auto mt-10 grid max-w-3xl gap-4">
            {FAQ.map((item, index) => (
              <Reveal key={item.qKey} delay={index * 80}>
                <details className="group rounded-card border border-border bg-card px-5 py-4 shadow-soft lift-hover">
                  <summary className="cursor-pointer list-none text-sm font-bold marker:hidden sm:text-base">
                    <span className="flex items-center justify-between gap-3">
                      {COPY[locale][item.qKey]}
                      <span
                        className="text-muted-foreground transition-transform group-open:rotate-45"
                        aria-hidden="true"
                      >
                        +
                      </span>
                    </span>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {COPY[locale][item.aKey]}
                  </p>
                </details>
              </Reveal>
            ))}
          </div>
          <Reveal className="mt-6 text-center">
            <Link
              href="/help"
              className="inline-flex items-center gap-1 text-sm font-semibold text-accent-ink lift-hover"
            >
              {c.faqMore}
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </Reveal>
        </section>

        {/* Финальный CTA */}
        <section className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6 sm:pb-24">
          <Reveal>
            <div className="gradient-brand overflow-hidden rounded-block px-6 py-12 text-center text-white sm:px-12 sm:py-16">
              <h2 className="text-2xl sm:text-3xl">{c.ctaTitle}</h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-white/85 sm:text-base">
                {c.ctaText}
              </p>
              <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row">
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 rounded-button bg-white px-7 py-3 text-sm font-semibold text-accent-ink shadow-soft lift-hover"
                >
                  {c.ctaTry}
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
                <Link
                  href="/dashboard"
                  className="inline-flex items-center justify-center gap-2 rounded-button border border-white/50 px-7 py-3 text-sm font-semibold text-white lift-hover"
                >
                  {c.menuCabinet}
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </div>
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
