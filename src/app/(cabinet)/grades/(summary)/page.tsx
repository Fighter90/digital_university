// DIG-26 — экран «Успеваемость: сводка» (Figma «05», 1440 + 360 px).
//
// Данные приходят ОДНИМ серверным агрегатом getPerformance(dataDb, ctx):
// контекст строится из живой сессии (requireDataCtx), studentId в ctx —
// единственный ключ выборки, из URL он не приходит (IDOR невозможен по
// построению). Параметр ?semester= влияет только на то, какой срез уже
// своих данных показан; мусор откатывается к дефолту.
//
// Дефолтный семестр — текущий, а если в нём ещё нет оценок — ближайший
// семестр с оценками (в начало семестра экран честно показывает пустое
// состояние с подсказкой о первой контрольной, а не пустоту).
import Link from 'next/link';
import { BookOpen, CalendarClock, ExternalLink } from 'lucide-react';

import {
  activeDebts,
  admissionBadgeStatus,
  buildSemesterPills,
  creditsHint,
  creditsShortHint,
  debtBadge,
  debtDatePhrase,
  disciplinesForSemester,
  emptySemesterNote,
  formatScore,
  gpaHint,
  levelBarClass,
  levelTextClass,
  nextAssessment,
  parseSemesterParam,
  percentileHint,
  semesterDelta,
  semesterGpaOf,
  toDisciplineCards,
  trafficBadgeStatus,
  trafficLight,
  type DisciplineCard,
} from '@/lib/performance-format';
import type { Metadata } from 'next';
import { bestPercentLabel } from '@/lib/performance-math';
import { t, type Locale } from '@/lib/i18n';
import { getLocale } from '@/lib/i18n/server';
import { localizePerformanceData } from '@/lib/en-demo-content';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { ProgressRing } from '@/components/ui/progress-ring';
import { Tooltip } from '@/components/ui/tooltip';
import { GradeInsightCard } from '@/components/performance/grade-insight-card';
import { SectionTitle } from '@/components/shell/section-title';
import { dataDb } from '@/server/data/db';
import { getGradeInsight, getPerformance, listExams, requireDataCtx } from '@/server/data';
import type { GradeInsight } from '@/lib/grade-insight';
import type { PerformanceData } from '@/server/data/performance';
import type { SemesterKey } from '@/lib/performance-math';

/** DIG-89 — <title> страницы по локали. */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: t(locale, 'meta.grades') };
}

/** Дельта со знаком для человека: −54,1 / +3,2 (EN — с точкой). */
function formatDelta(value: number, locale: Locale): string {
  const sign = value < 0 ? '−' : '+';
  return `${sign}${formatScore(Math.abs(value), locale)}`;
}

interface GradesPageProps {
  /** Next 15 передаёт промис; рендер без пропсов (юнит-прендер) тоже валиден. */
  searchParams?: Promise<{ semester?: string }>;
}

async function GradesContent({ semesterParam: semesterRaw }: { semesterParam?: string }) {
  const [ctx, locale] = await Promise.all([requireDataCtx('/grades'), getLocale()]);

  // Сотрудник деканата без studentId: студенческая успеваемость ему не
  // показывается (чтение групповых данных попало бы в аудит) — явная заглушка.
  if (ctx.role === 'STAFF') {
    return (
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 md:py-8">
        <SectionTitle href="/grades" className="text-xl font-bold tracking-heading sm:text-2xl" />
        <EmptyState
          title={t(locale, 'empty.tasksStaffTitle')}
          description={t(locale, 'empty.tasksStaffDesc')}
        />
      </section>
    );
  }

  let data: PerformanceData;
  let exams: Awaited<ReturnType<typeof listExams>>;
  let insight: GradeInsight | null = null;
  {
    // Один fetch-цикл: агрегат успеваемости + сессии группы (подсказка
    // «первая контрольная» для пустого семестра) + AI-инсайт динамики
    // (DIG-66). ctx.studentId — единственный ключ выборки, из URL не
    // приходит (IDOR невозможен по построению).
    //
    // Ревью r2: основа экрана (успеваемость + сессии) и вспомогательный
    // инсайт разделены — падение расчёта карточки не роняет сводку.
    const [perfResult, examResult, insightResult] = await Promise.allSettled([
      getPerformance(dataDb, ctx),
      listExams(dataDb, ctx),
      getGradeInsight(dataDb, ctx, new Date(), locale),
    ]);
    if (perfResult.status === 'rejected' || examResult.status === 'rejected') {
      const error =
        perfResult.status === 'rejected'
          ? perfResult.reason
          : examResult.status === 'rejected'
            ? examResult.reason
            : null;
      // не глотаем: без лога «Успеваемость не загрузилась» недиагностируемо
      console.error('[grades] render failed', error);
      return (
        <section className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6 md:py-8">
          <SectionTitle href="/grades" className="text-xl font-bold tracking-heading sm:text-2xl" />
          <ErrorState
            title={t(locale, 'grades.errorTitle')}
            description={t(locale, 'grades.errorDesc')}
          />
          <div className="flex justify-center">
            <Link href="/grades" className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
              {t(locale, 'btn.retry')}
            </Link>
          </div>
        </section>
      );
    }
    if (insightResult.status === 'fulfilled') {
      insight = insightResult.value;
    } else {
      // Деградация без ErrorState: карточка не рендерится, экран жив
      // (спека: карточка — необязательный блок «Что изменилось»).
      console.error('[grades] grade insight skipped', insightResult.reason);
    }
    data = perfResult.value;
    exams = examResult.value;
  }
  return (
    <GradesView
      data={data}
      exams={exams}
      insight={insight}
      semesterRaw={semesterRaw}
      locale={locale}
    />
  );
}

/** Какой семестр открыт по умолчанию (без валидного ?semester=). */
function defaultSemesterKey(data: PerformanceData): SemesterKey {
  // Динамический fallback: текущий год (не хардкод 2026 — устареет в 2027)
  const fallback = { startYear: new Date().getFullYear(), term: 'FALL' as const };
  const current = data.gpa?.currentSemesterKey ?? fallback;
  const currentView = disciplinesForSemester(data.disciplines, current, current);
  if (currentView.some((d) => d.accumulated !== null || d.finalGrade !== null)) {
    return current;
  }
  // Текущий семестр пуст: ближайший семестр с оценками (пилюли по убыванию).
  const pills = buildSemesterPills(data.disciplines, current);
  const withGrades = pills.find((pill) =>
    disciplinesForSemester(data.disciplines, pill.semester, current).some(
      (d) => d.accumulated !== null || d.finalGrade !== null,
    ),
  );
  return withGrades?.semester ?? current;
}

function GradesView({
  data,
  exams,
  insight,
  semesterRaw,
  locale,
}: {
  data: PerformanceData;
  exams: Awaited<ReturnType<typeof listExams>>;
  insight: GradeInsight | null;
  semesterRaw?: string;
  locale: Locale;
}) {
  // DIG-93 — EN-имена дисциплин/преподавателей/долгов агрегата (карточки,
  // светофор и список долгов рендерят уже локализованные значения).
  const localizedData = localizePerformanceData(locale, data);
  const now = new Date();
  const current = localizedData.gpa?.currentSemesterKey ?? {
    startYear: now.getFullYear(),
    term: 'FALL' as const,
  };
  const parsed = parseSemesterParam(semesterRaw);
  const selected = parsed ?? defaultSemesterKey(localizedData);
  const isCurrentSemester =
    selected.startYear === current.startYear && selected.term === current.term;

  const pills = buildSemesterPills(localizedData.disciplines, current, locale);
  const semesterDisciplines = disciplinesForSemester(localizedData.disciplines, selected, current);
  const hasGrades = semesterDisciplines.some(
    (d) => d.accumulated !== null || d.finalGrade !== null,
  );

  const semesterGpa = semesterGpaOf(semesterDisciplines);
  // Дельта — к прошлому семестру имеет смысл только у ИДУЩЕГО семестра:
  // у завершённого «предыдущий» — ещё не закрытый семестр, сравнение
  // обманчиво (рендер-контракт: у весны 25/26 дельты нет).
  const delta =
    hasGrades && isCurrentSemester
      ? semesterDelta(localizedData.disciplines, selected, locale)
      : null;
  const selectedPill = pills.find(
    (p) => p.semester.startYear === selected.startYear && p.semester.term === selected.term,
  );

  const light = trafficLight(semesterDisciplines, activeDebts(localizedData.debts), locale);
  const cards = toDisciplineCards(semesterDisciplines, locale);
  const note = emptySemesterNote(nextAssessment(exams, now, locale), isCurrentSemester, locale);
  const credits = localizedData.credits;
  const creditsPercent =
    credits.required > 0 ? Math.min(100, (credits.earned / credits.required) * 100) : 0;

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 md:py-8">
      <header className="flex animate-rise flex-col gap-3">
        <SectionTitle href="/grades" className="text-xl font-bold tracking-heading sm:text-2xl" />
        <nav aria-label={t(locale, 'grades.semestersAria')} className="flex flex-wrap gap-2">
          {pills.map((pill) => {
            const active =
              pill.semester.startYear === selected.startYear &&
              pill.semester.term === selected.term;
            return (
              <Link
                key={pill.key}
                href={`/grades?semester=${pill.key}`}
                aria-current={active ? 'page' : undefined}
                title={pill.label}
                className={
                  active
                    ? 'rounded-pill border border-accent bg-accent-soft px-3.5 py-1.5 text-sm font-semibold text-accent-ink transition-colors duration-200'
                    : 'rounded-pill border border-border bg-card px-3.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors duration-200 hover:border-accent-soft hover:text-foreground'
                }
              >
                {pill.short}
              </Link>
            );
          })}
        </nav>
      </header>

      {/* ── Сводка «как у меня дела» ──────────────────────────────────────── */}
      <div
        className="animate-rise rounded-card border border-border bg-card p-5 shadow-soft"
        style={{ '--du-rise-delay': '60ms' } as React.CSSProperties}
      >
        <div className="flex items-center gap-5">
          <ProgressRing
            value={semesterGpa ?? 0}
            label={t(locale, 'grades.gpaRingLabel')}
            size={80}
            stroke={7}
          >
            <span data-testid="gpa-ring-value" className="text-base font-extrabold">
              {semesterGpa === null ? '—' : formatScore(semesterGpa, locale)}
            </span>
          </ProgressRing>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 text-sm font-semibold">
              {t(locale, 'grades.gpaTitle')}
              <Tooltip content={gpaHint(locale)}>GPA</Tooltip>
            </p>
            {delta ? (
              <p className="mt-0.5 text-xs text-muted-foreground">
                <span data-testid="gpa-delta" className="font-semibold text-foreground">
                  {formatDelta(delta.value, locale)}
                </span>{' '}
                {t(locale, 'grades.deltaTo', { semester: delta.prevLabel })}
              </p>
            ) : (
              <p className="mt-0.5 text-xs text-muted-foreground">{selectedPill?.label}</p>
            )}
            {data.gpa?.overall != null ? (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t(locale, 'grades.overallPrefix')}{' '}
                <span className="font-semibold text-foreground">
                  {formatScore(data.gpa.overall, locale)}
                </span>
              </p>
            ) : null}
          </div>
        </div>

        {/* Кредиты: заработано из 240 */}
        <div className="mt-5 border-t border-border pt-4">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="font-medium text-muted-foreground">
              {t(locale, 'grades.credits')}
              <Tooltip content={creditsHint(locale)}>?</Tooltip>
            </span>
            <span className="text-muted-foreground">
              <span className="font-bold text-foreground">{credits.earned}</span>{' '}
              {t(locale, 'grades.creditsSuffix', { required: credits.required })}
            </span>
          </div>
          <div
            role="progressbar"
            aria-label={t(locale, 'grades.credits')}
            aria-valuemin={0}
            aria-valuemax={credits.required}
            aria-valuenow={credits.earned}
            className="mt-2 h-2.5 overflow-hidden rounded-pill bg-muted"
          >
            <div
              className="h-full rounded-pill bg-accent transition-[width]"
              style={{ width: `${creditsPercent}%` }}
            />
          </div>
        </div>

        {/* Рейтинг в группе */}
        {data.rating ? (
          <div className="mt-5 border-t border-border pt-4">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="font-medium text-muted-foreground">
                {t(locale, 'grades.groupRating')}
              </span>
              <span className="font-bold text-foreground">
                {t(locale, 'grades.rankOf', {
                  rank: data.rating.rank,
                  total: data.rating.groupSize,
                })}
              </span>
            </div>
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              {bestPercentLabel(data.rating.rank, data.rating.groupSize, locale)}
              <Tooltip content={percentileHint(locale)}>
                {t(locale, 'grades.howCalculated')}
              </Tooltip>
            </p>
            {/* DIG-103 — полный рейтинг группы: отдельная страница (/grades/rating). */}
            <Link
              href="/grades/rating"
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-accent-ink hover:underline"
            >
              {t(locale, 'grades.rating.link')}
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </Link>
          </div>
        ) : null}
      </div>

      {/* ── AI-инсайт «Что изменилось» (DIG-66): динамика среднего + график ── */}
      {insight ? <GradeInsightCard insight={insight} locale={locale} /> : null}

      {/* ── Светофор состояния ────────────────────────────────────────────── */}
      <div
        data-testid="traffic-light"
        data-tone={light.tone}
        className="animate-rise flex flex-col gap-2 rounded-card border border-border bg-card p-4 shadow-soft sm:flex-row sm:items-center sm:justify-between"
        style={{ '--du-rise-delay': '120ms' } as React.CSSProperties}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Badge status={trafficBadgeStatus(light.tone)}>{light.title}</Badge>
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">{light.phrase}</p>
        </div>
        {light.actionHref && light.actionLabel ? (
          <Link
            href={light.actionHref}
            className={buttonVariants({ variant: 'secondary', size: 'sm' }) + ' shrink-0'}
          >
            {light.actionLabel}
          </Link>
        ) : null}
      </div>

      {/* ── Дисциплины семестра ───────────────────────────────────────────── */}
      {hasGrades ? (
        <ul className="flex flex-col gap-3">
          {cards.map((card, cardIndex) => (
            <DisciplineCardItem
              key={card.disciplineCode}
              card={card}
              index={cardIndex}
              locale={locale}
            />
          ))}
        </ul>
      ) : (
        <EmptyState title={t(locale, 'grades.emptyTitle')} description={note} icon={BookOpen} />
      )}

      {/* ── Долги ─────────────────────────────────────────────────────────── */}
      {activeDebts(localizedData.debts).length > 0 ? (
        <div id="debts" className="rounded-card border border-border bg-card p-5 shadow-soft">
          <h2 className="text-base font-extrabold tracking-heading">
            {t(locale, 'grades.debtsTitle')}
          </h2>
          <ul className="mt-3 flex flex-col divide-y divide-border">
            {activeDebts(localizedData.debts).map((debt) => {
              const badge = debtBadge(debt.status, locale);
              return (
                <li
                  key={`${debt.disciplineCode}-${debt.retakeDate.getTime()}`}
                  className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{debt.disciplineName}</span>
                    <Badge status={badge.badge}>{badge.label}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{debtDatePhrase(debt, locale)}</p>
                  <Link
                    href="/deanery"
                    className="inline-flex items-center gap-1 text-sm font-semibold text-accent-ink hover:underline"
                  >
                    <CalendarClock className="size-4" aria-hidden="true" />
                    {t(locale, 'grades.retakeSignup')}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {/* ── Нижние ссылки ─────────────────────────────────────────────────── */}
      <footer className="flex flex-col gap-2 border-t border-border pt-4 text-sm">
        <Link href="/grades/session" className="font-semibold text-accent-ink hover:underline">
          {t(locale, 'grades.sessionLink')}
        </Link>
        <Link
          href="/deanery"
          className="inline-flex items-center gap-1 text-muted-foreground hover:underline"
        >
          {t(locale, 'grades.appealLink')}
          <ExternalLink className="size-3.5" aria-hidden="true" />
        </Link>
      </footer>
    </section>
  );
}

/** Карточка дисциплины: крупная оценка, уровень, допуск, ссылка в зачётку. */
function DisciplineCardItem({
  card,
  index,
  locale,
}: {
  card: DisciplineCard;
  index: number;
  locale: Locale;
}) {
  return (
    <li>
      <Link
        href={card.href}
        data-testid="discipline-card"
        data-level={card.level ?? undefined}
        style={{ '--du-rise-delay': `${180 + index * 60}ms` } as React.CSSProperties}
        className="animate-rise block rounded-card border border-border bg-card p-5 shadow-soft lift-hover focus-visible:outline-2"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-semibold">{card.disciplineName}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {card.teacher ? (
                <span className="truncate">{card.teacher}</span>
              ) : (
                t(locale, 'grades.noTeacher')
              )}
              <span aria-hidden="true"> · </span>
              <span title={creditsShortHint(locale)}>{card.creditsLabel}</span>
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p
              className={`text-2xl font-extrabold leading-none tracking-heading ${card.level ? levelTextClass(card.level) : ''}`}
            >
              {card.scoreLabel}
            </p>
            {card.maxPossibleLabel ? (
              <p className="mt-0.5 text-[11px] text-muted-foreground">{card.maxPossibleLabel}</p>
            ) : null}
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          {card.level ? (
            <div className="h-2 flex-1 overflow-hidden rounded-pill bg-muted">
              <div
                className={`h-full rounded-pill ${levelBarClass(card.level)}`}
                style={{ width: `${card.progress ?? 0}%` }}
              />
            </div>
          ) : null}
          <span
            className={`shrink-0 text-xs font-semibold ${card.level ? levelTextClass(card.level) : 'text-muted-foreground'}`}
          >
            {card.levelWord}
          </span>
        </div>

        {card.admission && card.admissionLabel ? (
          <div className="mt-3">
            <Badge status={admissionBadgeStatus(card.admission)}>{card.admissionLabel}</Badge>
          </div>
        ) : null}
      </Link>
    </li>
  );
}

export default async function GradesPage({ searchParams }: GradesPageProps) {
  const params = searchParams ? await searchParams : {};
  return <GradesContent semesterParam={params.semester} />;
}
