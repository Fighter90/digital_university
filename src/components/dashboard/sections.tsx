import Link from 'next/link';
import {
  ArrowRight,
  CalendarClock,
  CalendarDays,
  FileText,
  MessagesSquare,
  Newspaper,
  PartyPopper,
  PenLine,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { t, type Locale } from '@/lib/i18n';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { ProgressRing } from '@/components/ui/progress-ring';
import { TaskRow } from '@/components/tasks/task-row';
import {
  debtLabel,
  daysLeftLabel,
  formatAverage,
  formatDelta,
  formatLongDate,
  formatTime,
  pairWord,
  requestsInWorkLabel,
  requestsReadyLabel,
  type DisciplineLevel,
} from '@/lib/dashboard-format';
import type {
  DashboardSection,
  DeadlineView,
  ProgressView,
  RequestsView,
  TasksSummary,
  TodayView,
} from '@/server/data';
import type { ScheduleKind } from '@/server/data';

// DIG-20 — блоки главной «Ваша неделя». Каждый блок получает свою секцию
// агрегата (DashboardSection): сбой источника не роняет страницу — блок
// рисует собственное состояние ошибки (role="alert"), остальные живы.
//
// DIG-87 — EN-локализация часть 1: все строки интерфейса виджетов берутся
// из словаря t(locale, key); локаль приходит с страницы (cookie du-locale,
// дефолт 'ru' — прежние RU-строки байт-в-байт). ДЕМО-КОНТЕНТ (дисциплины,
// имена, новости) не переводится.

/** Состояние ошибки блока: заголовок с названием блока + причина для отладки. */
export function SectionFailure({
  title,
  error,
  locale = 'ru',
}: {
  title: string;
  error: string;
  /** DIG-87 — локаль интерфейса. */
  locale?: Locale;
}) {
  return (
    <ErrorState
      title={t(locale, 'dashboard.failure.title', { title })}
      description={t(locale, 'dashboard.failure.desc', { error })}
    />
  );
}

/** Пилюля типа занятия на цветах дизайн-токенов типов занятий. */
const KIND_PILL: Record<ScheduleKind, string> = {
  LECTURE: 'bg-lesson-lecture-soft text-lesson-lecture-ink',
  SEMINAR: 'bg-lesson-seminar-soft text-lesson-seminar-ink',
  LAB: 'bg-lesson-lab-soft text-lesson-lab-ink',
  CONSULTATION: 'bg-lesson-exam-soft text-lesson-exam-ink',
  PRACTICE: 'bg-accent-soft text-accent-ink',
};

export function Hero({
  firstName,
  greeting,
  headingDate,
  summary,
  progress,
  requests,
  locale = 'ru',
}: {
  firstName: string | null;
  greeting: string;
  headingDate: string;
  summary: string | null;
  progress: DashboardSection<ProgressView>;
  requests: DashboardSection<RequestsView>;
  /** DIG-87 — локаль интерфейса (cookie du-locale, дефолт ru). */
  locale?: Locale;
}) {
  const average = progress.ok ? progress.value.average : null;
  const delta = progress.ok ? progress.value.averageDelta : null;
  const credits = progress.ok ? progress.value.credits : null;
  const creditsTotal = progress.ok ? progress.value.creditsTotal : 240;
  const debts = progress.ok ? progress.value.debts.length : null;
  const inWork = requests.ok ? requests.value.inWork : null;

  const tiles = [
    {
      href: '/grades',
      label: t(locale, 'dashboard.tile.average'),
      value: formatAverage(average, locale),
      hint:
        delta === null || average === null ? null : (
          <span className={delta >= 0 ? 'text-emerald-400' : 'text-red-400'}>
            {t(locale, 'dashboard.tile.deltaToPrev', { delta: formatDelta(delta, locale) })}
          </span>
        ),
    },
    {
      href: '/profile',
      label: t(locale, 'dashboard.tile.credits'),
      value: credits === null ? '—' : credits,
      hint: <>{t(locale, 'dashboard.tile.creditsOf', { total: creditsTotal })}</>,
    },
    {
      href: '/schedule',
      label: t(locale, 'dashboard.tile.debts'),
      value: debts === null ? '—' : debts,
      hint:
        debts === null ? null : debts > 0 ? (
          <>{t(locale, 'dashboard.tile.debtsRetake')}</>
        ) : (
          <>{t(locale, 'dashboard.tile.debtsDone')}</>
        ),
    },
    {
      href: '/requests',
      label: t(locale, 'dashboard.tile.requestsInWork'),
      value: inWork === null ? '—' : inWork,
      hint: (
        <>
          {t(locale, 'dashboard.tile.requestsTotal', {
            total: requests.ok ? requests.value.total : '—',
          })}
        </>
      ),
    },
  ];

  return (
    <div className="relative overflow-hidden rounded-block bg-neutral-900 p-6 text-neutral-50 shadow-soft md:p-8">
      {/* коралловое свечение — единственный тёмный блок экрана */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-coral-500/30 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-28 -left-24 size-80 rounded-full bg-coral-400/20 blur-3xl"
      />

      <div className="relative">
        <h1 className="text-xl font-extrabold tracking-heading text-white md:text-2xl">
          {`${t(locale, 'dashboard.hero.title')} · ${headingDate}`}
        </h1>
        <p className="mt-1 text-sm text-neutral-300">
          {`${greeting}${firstName ? `, ${firstName}` : ''}!`}
        </p>
        {summary ? (
          <p
            data-testid="dashboard-summary"
            className="mt-2 text-sm leading-relaxed text-neutral-100 md:text-base"
          >
            {summary}
          </p>
        ) : null}

        <div data-testid="hero-tiles" className="mt-5 grid grid-cols-2 gap-3">
          {tiles.map((tile) => (
            <Link
              key={tile.label}
              href={tile.href}
              className="lift-hover rounded-card border border-white/15 bg-white/10 p-3 backdrop-blur-sm transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral-200 md:p-4"
            >
              <p className="text-xs text-neutral-300">{tile.label}</p>
              <p className="mt-1 text-xl font-extrabold tracking-heading text-white md:text-2xl">
                {tile.value}
              </p>
              {tile.hint ? (
                <p className="mt-0.5 text-[11px] text-neutral-400">{tile.hint}</p>
              ) : null}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TodaySection({
  today,
  locale = 'ru',
}: {
  today: DashboardSection<TodayView>;
  /** DIG-87 — локаль интерфейса (cookie du-locale, дефолт ru). */
  locale?: Locale;
}) {
  if (!today.ok)
    return (
      <SectionFailure
        title={t(locale, 'dashboard.section.today')}
        error={today.error}
        locale={locale}
      />
    );
  const { lessons, nearestStudyDay } = today.value;

  return (
    <section aria-labelledby="dashboard-today-title">
      <h2 id="dashboard-today-title" className="text-lg font-extrabold tracking-heading">
        {t(locale, 'dashboard.widget.today')}
      </h2>
      {lessons.length === 0 ? (
        <EmptyState
          className="mt-3"
          icon={CalendarClock}
          illustration="no-classes"
          title={t(locale, 'dashboard.today.empty.title')}
          description={
            nearestStudyDay
              ? t(locale, 'dashboard.today.empty.nearest', {
                  label: nearestStudyDay.label,
                  count: nearestStudyDay.count,
                  pairs: pairWord(nearestStudyDay.count, locale),
                })
              : t(locale, 'dashboard.today.empty.desc')
          }
        />
      ) : (
        <ol className="mt-3 flex flex-col gap-2">
          {lessons.map((lesson) => (
            <li
              key={lesson.id}
              data-cancelled={lesson.isCancelled ? 'true' : undefined}
              className={cn(
                'rounded-card border border-border bg-card p-3.5 shadow-soft',
                lesson.isRescheduled && 'hatch-rescheduled border-warning bg-warning-soft',
                lesson.isCancelled && 'opacity-70',
              )}
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {/* Начало пары — жирным, конец — мелкой строкой под ним */}
                <span className="flex w-14 shrink-0 flex-col">
                  <span className="font-mono text-sm font-bold text-neutral-900">
                    {formatTime(lesson.startsAt)}
                  </span>
                  <span className="font-mono text-[11px] text-neutral-500">
                    {t(locale, 'schedule.untilPrefix')} {formatTime(lesson.endsAt)}
                  </span>
                </span>
                <span
                  className={cn(
                    'rounded-pill px-2.5 py-0.5 text-xs font-semibold',
                    KIND_PILL[lesson.kind],
                  )}
                >
                  {lesson.kindLabel}
                </span>
                <span
                  className={cn(
                    'text-sm font-semibold text-neutral-900',
                    lesson.isCancelled && 'line-through',
                  )}
                >
                  {lesson.disciplineName}
                </span>
                {lesson.isOnline ? (
                  <Link
                    href="/schedule"
                    className="rounded-pill border border-info-soft bg-info-soft px-2.5 py-0.5 text-xs font-semibold text-info-ink hover:bg-info/10"
                  >
                    {t(locale, 'dashboard.online')}
                  </Link>
                ) : (
                  <span className="text-xs text-neutral-600">
                    {t(locale, 'schedule.room.label', { room: lesson.room })}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-neutral-600">{lesson.teacherName}</p>
              {lesson.transferNote ? (
                <p className="mt-1.5 text-xs font-semibold text-warning-ink">
                  {lesson.transferNote}
                </p>
              ) : null}
              {lesson.isCancelled && lesson.note ? (
                <p className="mt-1.5 text-xs text-error-ink">{lesson.note}</p>
              ) : null}
              {!lesson.isCancelled && lesson.note && !lesson.transferNote ? (
                <p className="mt-1.5 text-xs text-neutral-500">{lesson.note}</p>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function DeadlinesSection({
  deadlines,
  locale = 'ru',
}: {
  deadlines: DashboardSection<DeadlineView[]>;
  /** DIG-87 — локаль интерфейса (cookie du-locale, дефолт ru). */
  locale?: Locale;
}) {
  if (!deadlines.ok)
    return (
      <SectionFailure
        title={t(locale, 'dashboard.section.deadlines')}
        error={deadlines.error}
        locale={locale}
      />
    );
  const items = deadlines.value;

  return (
    <section aria-labelledby="dashboard-deadlines-title">
      <h2 id="dashboard-deadlines-title" className="text-lg font-extrabold tracking-heading">
        {t(locale, 'dashboard.widget.deadlines')}
      </h2>
      {items.length === 0 ? (
        <EmptyState
          className="mt-3"
          icon={CalendarClock}
          title={t(locale, 'dashboard.deadlines.empty.title')}
          description={t(locale, 'dashboard.deadlines.empty.desc')}
        />
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {items.map((item) => {
            const urgent = item.daysLeft <= 3;
            return (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-card border border-border bg-card p-3.5 shadow-soft"
              >
                {/* Дата-бейдж */}
                <span className="flex w-14 shrink-0 flex-col items-center rounded-card-sm bg-muted px-2 py-1.5">
                  <span className="text-lg leading-none font-extrabold text-neutral-900">
                    {item.dayBadge}
                  </span>
                  <span className="mt-0.5 text-[11px] uppercase text-neutral-600">
                    {item.monthBadge}
                  </span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-neutral-900">{item.disciplineName}</p>
                  <p className="mt-0.5 text-xs text-neutral-600">
                    {item.kindLabel} ·{' '}
                    <span
                      data-urgent={urgent ? 'true' : undefined}
                      className={cn(
                        'font-semibold',
                        urgent && 'rounded-pill bg-error-soft px-1.5 py-0.5 text-error-ink',
                      )}
                    >
                      {daysLeftLabel(item.daysLeft, locale)}
                    </span>
                  </p>
                </div>
                <Link
                  href="/schedule"
                  className="shrink-0 rounded-pill border border-border px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
                >
                  {t(locale, 'dashboard.details')}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

const LEVEL_FILL: Record<DisciplineLevel, string> = {
  good: 'bg-success',
  medium: 'bg-warning',
  risk: 'bg-error',
};

export function ProgressSection({
  progress,
  locale = 'ru',
}: {
  progress: DashboardSection<ProgressView>;
  /** DIG-87 — локаль интерфейса (cookie du-locale, дефолт ru). */
  locale?: Locale;
}) {
  if (!progress.ok)
    return (
      <SectionFailure
        title={t(locale, 'dashboard.section.progress')}
        error={progress.error}
        locale={locale}
      />
    );
  const { average, credits, creditsTotal, debts, disciplines } = progress.value;
  const nearestDebt = debts[0] ?? null;

  return (
    <section aria-labelledby="dashboard-progress-title">
      <h2 id="dashboard-progress-title" className="text-lg font-extrabold tracking-heading">
        {t(locale, 'dashboard.widget.progress')}
      </h2>
      <div className="mt-3 rounded-card border border-border bg-card p-5 shadow-soft">
        <div className="flex flex-wrap items-center gap-4">
          <ProgressRing
            value={average ?? 0}
            label={t(locale, 'dashboard.tile.average')}
            size={88}
            stroke={8}
          >
            <span className="text-lg">{formatAverage(average, locale)}</span>
          </ProgressRing>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-neutral-600">
              {t(locale, 'dashboard.progress.creditsLine', { credits, total: creditsTotal })}
            </p>
            <div className="mt-2">
              {debts.length > 0 && nearestDebt ? (
                <Badge status="error" data-urgent="true">
                  {debts.length === 1
                    ? t(locale, 'dashboard.progress.debtOne', {
                        debts: debtLabel(debts.length, locale),
                        date: nearestDebt.dateLabel,
                      })
                    : t(locale, 'dashboard.progress.debtMany', {
                        debts: debtLabel(debts.length, locale),
                        date: nearestDebt.dateLabel,
                      })}
                </Badge>
              ) : (
                <Badge status="success">{t(locale, 'dashboard.progress.noDebts')}</Badge>
              )}
            </div>
          </div>
        </div>

        {disciplines.length > 0 ? (
          <ul className="mt-4 flex flex-col gap-2.5 border-t border-border pt-4">
            {disciplines.map((d) => (
              <li key={d.code} data-level={d.level}>
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="truncate font-medium text-neutral-800">{d.disciplineName}</span>
                  <span className="shrink-0 text-neutral-600">
                    {formatAverage(d.average, locale)}
                  </span>
                </div>
                <div className="mt-1 h-2 rounded-pill bg-muted">
                  <div
                    className={cn('h-full rounded-pill', LEVEL_FILL[d.level])}
                    style={{ width: `${Math.min(100, Math.max(0, d.average))}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 border-t border-border pt-4 text-sm text-neutral-600">
            {t(locale, 'dashboard.progress.emptyDisciplines')}
          </p>
        )}
      </div>
    </section>
  );
}

export function QuickActionsSection({ locale = 'ru' }: { locale?: Locale }) {
  const actions = [
    { href: '/requests', label: t(locale, 'dashboard.action.orderCertificate'), icon: FileText },
    { href: '/requests', label: t(locale, 'dashboard.action.submitStatement'), icon: PenLine },
    { href: '/deanery', label: t(locale, 'dashboard.action.writeDeanery'), icon: MessagesSquare },
    { href: '/ai-assistant', label: t(locale, 'dashboard.action.askAi'), icon: Sparkles },
  ] as const;

  return (
    <section aria-labelledby="dashboard-actions-title">
      <h2 id="dashboard-actions-title" className="text-lg font-extrabold tracking-heading">
        {t(locale, 'dashboard.widget.quickActions')}
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {actions.map(({ href, label, icon: Icon }) => (
          <Link
            key={label}
            href={href}
            className="lift-hover flex items-center gap-3 rounded-card border border-border bg-card p-4 text-sm font-semibold text-neutral-900 shadow-soft hover:border-coral-200 hover:bg-coral-50"
          >
            <span
              aria-hidden="true"
              className="flex size-9 shrink-0 items-center justify-center rounded-pill bg-accent-soft text-accent-ink"
            >
              <Icon className="size-4" />
            </span>
            {label}
          </Link>
        ))}
      </div>
    </section>
  );
}

export function NewsSection({
  news,
  locale = 'ru',
}: {
  news: Array<{ id: string; title: string; excerpt: string; publishedAt: Date }>;
  /** DIG-87 — локаль интерфейса (cookie du-locale, дефолт ru). */
  locale?: Locale;
}) {
  return (
    <section aria-labelledby="dashboard-news-title">
      <h2 id="dashboard-news-title" className="text-lg font-extrabold tracking-heading">
        {t(locale, 'dashboard.widget.news')}
      </h2>
      {news.length === 0 ? (
        <EmptyState
          className="mt-3"
          icon={Newspaper}
          title={t(locale, 'dashboard.news.empty.title')}
          description={t(locale, 'dashboard.news.empty.desc')}
        />
      ) : (
        <ul className="mt-3 flex snap-x gap-3 overflow-x-auto pb-1">
          {news.map((item) => (
            <li key={item.id} className="min-w-0 shrink-0 snap-start">
              {/* DIG-36: карточки ведут на свои страницы новостей /news/<id>. */}
              <Link
                href={`/news/${item.id}`}
                className="lift-hover flex h-full w-64 flex-col rounded-card border border-border bg-card p-4 shadow-soft"
              >
                <span className="text-[11px] uppercase text-neutral-500">
                  {formatLongDate(item.publishedAt, locale)}
                </span>
                <span className="mt-1 line-clamp-2 text-sm font-semibold text-neutral-900">
                  {item.title}
                </span>
                <span className="mt-1 line-clamp-3 text-xs text-neutral-600">{item.excerpt}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {/* DIG-36: вход в полную ленту новостей и объявлений. */}
      <Link
        href="/news"
        data-testid="dashboard-news-all"
        className="mt-3 inline-flex items-center gap-1.5 rounded-button px-1 text-sm font-semibold text-coral-600 transition-colors hover:text-coral-500 focus-visible:outline-2 focus-visible:outline-coral-600"
      >
        {t(locale, 'dashboard.news.all')}
        <ArrowRight aria-hidden="true" className="size-4" />
      </Link>
    </section>
  );
}

// ── DIG-44 — виджеты «Заявки» и «Мероприятия» ───────────────────────────────

export function RequestsSection({
  requests,
  locale = 'ru',
}: {
  requests: DashboardSection<RequestsView>;
  /** DIG-87 — локаль интерфейса (cookie du-locale, дефолт ru). */
  locale?: Locale;
}) {
  if (!requests.ok)
    return (
      <SectionFailure
        title={t(locale, 'dashboard.section.requests')}
        error={requests.error}
        locale={locale}
      />
    );
  const { inWork, total } = requests.value;
  const ready = Math.max(0, total - inWork);

  return (
    <section aria-labelledby="dashboard-requests-title">
      <h2 id="dashboard-requests-title" className="text-lg font-extrabold tracking-heading">
        {t(locale, 'dashboard.widget.requests')}
      </h2>
      <div className="lift-hover mt-3 rounded-card border border-border bg-card p-5 shadow-soft">
        <p className="text-sm text-neutral-600">{t(locale, 'dashboard.requests.subtitle')}</p>
        <div className="mt-3 flex flex-wrap items-end gap-6">
          <p className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-heading text-neutral-900">
              {inWork}
            </span>
            <span className="text-sm text-neutral-600">{requestsInWorkLabel(inWork, locale)}</span>
          </p>
          <p className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-heading text-neutral-900">
              {ready}
            </span>
            <span className="text-sm text-neutral-600">{requestsReadyLabel(ready, locale)}</span>
          </p>
          <Link
            href="/requests"
            className="ml-auto rounded-pill border border-border px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            {t(locale, 'dashboard.requests.all')}
          </Link>
        </div>
      </div>
    </section>
  );
}

export function EventsSection({ locale = 'ru' }: { locale?: Locale }) {
  return (
    <section aria-labelledby="dashboard-events-title">
      <h2 id="dashboard-events-title" className="text-lg font-extrabold tracking-heading">
        {t(locale, 'dashboard.widget.events')}
      </h2>
      <EmptyState
        className="mt-3"
        icon={CalendarDays}
        title={t(locale, 'dashboard.events.empty.title')}
        description={t(locale, 'dashboard.events.empty.desc')}
      />
    </section>
  );
}

// DIG-34 — виджет «Что от меня ждут»: счётчик открытых задач и до трёх самых
// срочных. Строки реюзают экран /tasks; ссылка ведёт в полный список.
export function TasksSection({
  tasks,
  locale = 'ru',
}: {
  tasks: DashboardSection<TasksSummary>;
  /** DIG-87 — локаль интерфейса (cookie du-locale, дефолт ru). */
  locale?: Locale;
}) {
  if (!tasks.ok)
    return (
      <SectionFailure
        title={t(locale, 'dashboard.section.tasks')}
        error={tasks.error}
        locale={locale}
      />
    );
  const { openCount, top } = tasks.value;

  return (
    <section aria-labelledby="dashboard-tasks-title" data-testid="dashboard-tasks">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="dashboard-tasks-title" className="text-lg font-extrabold tracking-heading">
          {t(locale, 'dashboard.widget.tasks')}
        </h2>
        {openCount > 0 ? (
          <span
            data-testid="dashboard-tasks-count"
            title={t(locale, 'dashboard.tasks.countTitle')}
            className="rounded-pill bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent-ink"
          >
            {openCount}
          </span>
        ) : null}
      </div>

      {openCount === 0 ? (
        <EmptyState
          className="mt-3"
          icon={PartyPopper}
          title={t(locale, 'dashboard.tasks.empty.title')}
          description={t(locale, 'dashboard.tasks.empty.desc')}
        />
      ) : (
        <>
          <ol className="mt-3 flex flex-col gap-2">
            {top.map((task) => (
              <TaskRow key={task.id} task={task} locale={locale} />
            ))}
          </ol>
          <Link
            data-testid="dashboard-tasks-all"
            href="/tasks"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-coral-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral-600"
          >
            {t(locale, 'dashboard.tasks.all')}
            <span aria-hidden="true">→</span>
          </Link>
        </>
      )}
    </section>
  );
}
