import Link from 'next/link';
import {
  CalendarClock,
  FileText,
  MessagesSquare,
  Newspaper,
  PenLine,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { ProgressRing } from '@/components/ui/progress-ring';
import {
  debtLabel,
  daysLeftLabel,
  formatAverage,
  formatDelta,
  formatLongDate,
  formatTime,
  pluralRu,
  type DisciplineLevel,
} from '@/lib/dashboard-format';
import type {
  DashboardSection,
  DeadlineView,
  ProgressView,
  RequestsView,
  TodayView,
} from '@/server/data';
import type { ScheduleKind } from '@/server/data';

// DIG-20 — блоки главной «Ваша неделя». Каждый блок получает свою секцию
// агрегата (DashboardSection): сбой источника не роняет страницу — блок
// рисует собственное состояние ошибки (role="alert"), остальные живы.

/** Состояние ошибки блока: заголовок с названием блока + причина для отладки. */
export function SectionFailure({ title, error }: { title: string; error: string }) {
  return (
    <ErrorState
      title={`Блок «${title}» не загрузился`}
      description={`${error}. Обновите страницу — остальные разделы работают.`}
    />
  );
}

const PAIR_FORMS = ['пара', 'пары', 'пар'] as const;

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
}: {
  firstName: string | null;
  greeting: string;
  headingDate: string;
  summary: string | null;
  progress: DashboardSection<ProgressView>;
  requests: DashboardSection<RequestsView>;
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
      label: 'Средний балл',
      value: formatAverage(average),
      hint:
        delta === null || average === null ? null : (
          <span className={delta >= 0 ? 'text-emerald-400' : 'text-red-400'}>
            {formatDelta(delta)} к предыдущим работам
          </span>
        ),
    },
    {
      href: '/profile',
      label: 'Кредиты',
      value: credits === null ? '—' : credits,
      hint: <>{`из ${creditsTotal}`}</>,
    },
    {
      href: '/schedule',
      label: 'Долги',
      value: debts === null ? '—' : debts,
      hint: debts === null ? null : debts > 0 ? <>требуется пересдача</> : <>всё сдано</>,
    },
    {
      href: '/requests',
      label: 'Заявки в работе',
      value: inWork === null ? '—' : inWork,
      hint: <>{`всего заявок: ${requests.ok ? requests.value.total : '—'}`}</>,
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
          {`Ваша неделя · ${headingDate}`}
        </h1>
        <p className="mt-1 text-sm text-neutral-300">
          {`${greeting}${firstName ? `, ${firstName}` : ''}!`}
        </p>
        {summary ? (
          <p data-testid="dashboard-summary" className="mt-2 text-sm leading-relaxed text-neutral-100 md:text-base">
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
              {tile.hint ? <p className="mt-0.5 text-[11px] text-neutral-400">{tile.hint}</p> : null}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TodaySection({ today }: { today: DashboardSection<TodayView> }) {
  if (!today.ok) return <SectionFailure title="Сегодня" error={today.error} />;
  const { lessons, nearestStudyDay } = today.value;

  return (
    <section aria-labelledby="dashboard-today-title">
      <h2 id="dashboard-today-title" className="text-lg font-extrabold tracking-heading">
        Сегодня
      </h2>
      {lessons.length === 0 ? (
        <EmptyState
          className="mt-3"
          icon={CalendarClock}
          title="Нет пар сегодня"
          description={
            nearestStudyDay
              ? `Ближайший учебный день — ${nearestStudyDay.label}: ${nearestStudyDay.count} ${pluralRu(nearestStudyDay.count, PAIR_FORMS)}.`
              : 'Расписание пока не заполнено деканатом.'
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
                    до {formatTime(lesson.endsAt)}
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
                    Онлайн
                  </Link>
                ) : (
                  <span className="text-xs text-neutral-600">ауд. {lesson.room}</span>
                )}
              </div>
              <p className="mt-1 text-xs text-neutral-600">{lesson.teacherName}</p>
              {lesson.transferNote ? (
                <p className="mt-1.5 text-xs font-semibold text-warning-ink">{lesson.transferNote}</p>
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

export function DeadlinesSection({ deadlines }: { deadlines: DashboardSection<DeadlineView[]> }) {
  if (!deadlines.ok) return <SectionFailure title="Дедлайны" error={deadlines.error} />;
  const items = deadlines.value;

  return (
    <section aria-labelledby="dashboard-deadlines-title">
      <h2 id="dashboard-deadlines-title" className="text-lg font-extrabold tracking-heading">
        Ближайшие дедлайны
      </h2>
      {items.length === 0 ? (
        <EmptyState
          className="mt-3"
          icon={CalendarClock}
          title="Дедлайнов нет"
          description="Сессия и контрольные точки ещё не запланированы — загляните позже."
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
                      {daysLeftLabel(item.daysLeft)}
                    </span>
                  </p>
                </div>
                <Link
                  href="/schedule"
                  className="shrink-0 rounded-pill border border-border px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
                >
                  Подробнее
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

export function ProgressSection({ progress }: { progress: DashboardSection<ProgressView> }) {
  if (!progress.ok) return <SectionFailure title="Как у меня дела" error={progress.error} />;
  const { average, credits, creditsTotal, debts, disciplines } = progress.value;
  const nearestDebt = debts[0] ?? null;

  return (
    <section aria-labelledby="dashboard-progress-title">
      <h2 id="dashboard-progress-title" className="text-lg font-extrabold tracking-heading">
        Как у меня дела
      </h2>
      <div className="mt-3 rounded-card border border-border bg-card p-5 shadow-soft">
        <div className="flex flex-wrap items-center gap-4">
          <ProgressRing value={average ?? 0} label="Средний балл" size={88} stroke={8}>
            <span className="text-lg">{formatAverage(average)}</span>
          </ProgressRing>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-neutral-600">
              Кредиты: <span className="font-semibold text-neutral-900">{credits}</span> из{' '}
              {creditsTotal}
            </p>
            <div className="mt-2">
              {debts.length > 0 && nearestDebt ? (
                <Badge status="error" data-urgent="true">
                  {debts.length === 1
                    ? `${debtLabel(debts.length)} — пересдача ${nearestDebt.dateLabel}`
                    : `${debtLabel(debts.length)} — ближайшая пересдача ${nearestDebt.dateLabel}`}
                </Badge>
              ) : (
                <Badge status="success">Долгов нет</Badge>
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
                  <span className="shrink-0 text-neutral-600">{formatAverage(d.average)}</span>
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
            Оценок пока нет — здесь появится прогресс по дисциплинам.
          </p>
        )}
      </div>
    </section>
  );
}

const QUICK_ACTIONS = [
  { href: '/requests', label: 'Заказать справку', icon: FileText },
  { href: '/requests', label: 'Подать заявление', icon: PenLine },
  { href: '/deanery', label: 'Написать в деканат', icon: MessagesSquare },
  { href: '/ai-assistant', label: 'Спросить AI', icon: Sparkles },
] as const;

export function QuickActionsSection() {
  return (
    <section aria-labelledby="dashboard-actions-title">
      <h2 id="dashboard-actions-title" className="text-lg font-extrabold tracking-heading">
        Быстрые действия
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {QUICK_ACTIONS.map(({ href, label, icon: Icon }) => (
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
}: {
  news: Array<{ id: string; title: string; excerpt: string; publishedAt: Date }>;
}) {
  return (
    <section aria-labelledby="dashboard-news-title">
      <h2 id="dashboard-news-title" className="text-lg font-extrabold tracking-heading">
        Новости деканата
      </h2>
      {news.length === 0 ? (
        <EmptyState
          className="mt-3"
          icon={Newspaper}
          title="Новостей пока нет"
          description="Объявления деканата появятся здесь."
        />
      ) : (
        <ul className="mt-3 flex snap-x gap-3 overflow-x-auto pb-1">
          {news.map((item) => (
            <li key={item.id} className="min-w-0 shrink-0 snap-start">
              <Link
                href="/notifications"
                className="lift-hover flex h-full w-64 flex-col rounded-card border border-border bg-card p-4 shadow-soft"
              >
                <span className="text-[11px] uppercase text-neutral-500">
                  {formatLongDate(item.publishedAt)}
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
    </section>
  );
}
