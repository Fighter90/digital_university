// DIG-27 — карточка дисциплины: URL /grades/<disciplineId>
// (disciplineId = disciplineCode, как в ссылках зачётки и «Успеваемости»).
//
// requireDataCtx() → getDisciplineCard() скоупит выборку по сессии: чужая
// группа и несуществующий код отвечают одинаковым null → notFound() —
// единый 404 без оракула существования, попытка пишется в AuditLog.
//
// NOTE: НЕ добавлять loading.tsx в этот сегмент — Suspense заставит Next
// стримить оболочку с HTTP 200 до срабатывания notFound() (контракт
// единого 404, см. requests/[number]/page.tsx).
//
// Калькулятор «Что нужно на экзамене» встраивается в слот id="calculator"
// отдельной задачей; «Ошибка в оценке?» — server action с предзаполненной
// дисциплиной. Вёрстка по макету Figma «05 · Успеваемость — дисциплина»
// и токенам DIG-13 (Inter/Onest, Shell из (cabinet)).
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowLeft, ArrowUpRight, BookMarked, Calculator, Info } from 'lucide-react';

import { personHrefByFullName } from '@/lib/people-catalog';
import { GradeAppealForm } from '@/components/gradebook/grade-appeal-form';
import { GradeFormula, GradeRows } from '@/components/gradebook/grade-formula';
import { Badge } from '@/components/ui/badge';
import { creditWord } from '@/lib/performance-format';
import { t } from '@/lib/i18n';
import { getLocale } from '@/lib/i18n/server';
import { dataDb } from '@/server/data/db';
import { getDisciplineCard, requireDataCtx } from '@/server/data';
import { enDisciplineName, localizePersonName } from '@/lib/en-demo-content';

/** DIG-89 — <title> страницы по локали. */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: t(locale, 'meta.discipline') };
}

export default async function DisciplineCardPage({
  params,
}: {
  params: Promise<{ disciplineId: string }>;
}) {
  const { disciplineId: rawCode } = await params;
  // Next уже декодирует сегмент маршрута; повторный decodeURIComponent при
  // «сыром» % даёт URIError → 500. Ловим и отвечаем единым 404 (контракт).
  let disciplineCode: string;
  try {
    disciplineCode = decodeURIComponent(rawCode);
  } catch {
    notFound();
  }
  const [ctx, locale] = await Promise.all([requireDataCtx(`/grades/${rawCode}`), getLocale()]);

  // DIG-93 — карточка дисциплины: подписи агрегата по локали (семестр),
  // имена дисциплины/преподавателя — на дисплее ниже (канон нужен для href).
  const card = await getDisciplineCard(dataDb, ctx, disciplineCode, new Date(), locale);
  if (!card) notFound();

  // DIG-37: href карточки преподавателя — по каноническому имени (сшивка со
  // справочником); на EN отображаем транслит, ссылку строим по канону.
  const teacherHref = card.teacherName ? personHrefByFullName(card.teacherName) : null;
  const disciplineLabel =
    locale === 'en'
      ? enDisciplineName({ code: card.disciplineCode, name: card.disciplineName })
      : card.disciplineName;
  const teacherLabel =
    card.teacherName === null ? null : localizePersonName(locale, card.teacherName);

  // «86,5» (RU, канон) / «86.5» (EN) — одна десятичная с разделителем локали.
  const oneDecimal = (value: number): string =>
    locale === 'en' ? value.toFixed(1) : value.toFixed(1).replace('.', ',');

  const accumulatedLabel = card.accumulated === null ? '—' : oneDecimal(card.accumulated);

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 md:py-8">
      <Link
        href="/grades/gradebook"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t(locale, 'discipline.backGradebook')}
      </Link>

      {/* ── Шапка: название, преподаватель, кредиты, накопленная крупно ── */}
      <header className="rounded-block border border-border bg-card p-5 shadow-soft md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-extrabold tracking-heading text-foreground sm:text-2xl">
              {disciplineLabel}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {teacherLabel ? (
                teacherLabel
              ) : (
                <span className="text-muted-foreground">{t(locale, 'discipline.noTeacher')}</span>
              )}
            </p>
            {teacherHref ? (
              <Link
                href={teacherHref}
                data-testid="discipline-teacher-link"
                className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-coral-600 transition-colors hover:text-coral-500"
              >
                {t(locale, 'discipline.personProfile')}
                <ArrowUpRight aria-hidden="true" className="size-3.5" />
              </Link>
            ) : card.teacherName ? (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t(locale, 'discipline.personStub')}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge status="neutral">
                {card.credits} {creditWord(card.credits, locale)}
              </Badge>
              {card.semesterLabel ? (
                <span className="rounded-pill bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                  {card.semesterLabel}
                </span>
              ) : null}
              {card.isComplete ? (
                card.creditEarned ? (
                  <Badge status="success">{t(locale, 'discipline.creditEarned')}</Badge>
                ) : (
                  <Badge status="error">{t(locale, 'discipline.creditLost')}</Badge>
                )
              ) : (
                <span className="rounded-pill bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent-ink">
                  {t(locale, 'discipline.inProgress')}
                </span>
              )}
            </div>
          </div>

          {/* Накопленная оценка крупно (итог — у завершённой дисциплины) */}
          <div className="flex shrink-0 flex-col items-end">
            {card.isComplete && card.finalGrade !== null ? (
              <>
                <p className="text-xs uppercase text-muted-foreground">
                  {t(locale, 'discipline.finalLabel')}
                </p>
                <p
                  data-testid="final-grade"
                  className="text-5xl font-extrabold leading-none tracking-heading text-foreground"
                >
                  {card.finalGrade}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t(locale, 'discipline.of100')}
                </p>
              </>
            ) : (
              <>
                <p className="text-xs uppercase text-muted-foreground">
                  {t(locale, 'discipline.accumulatedLabel')}
                </p>
                <p
                  data-testid="accumulated-grade"
                  className="text-5xl font-extrabold leading-none tracking-heading text-foreground"
                >
                  {accumulatedLabel}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t(locale, 'discipline.of100')}
                  {card.maxPossible !== null && !card.isComplete
                    ? t(locale, 'discipline.maxSuffix', { score: oneDecimal(card.maxPossible) })
                    : ''}
                </p>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Формула оценки полосами ─────────────────────────────────────── */}
      <section aria-labelledby="card-formula-title">
        <h2 id="card-formula-title" className="text-lg font-extrabold tracking-heading">
          {t(locale, 'discipline.formula.title')}
        </h2>
        <div className="mt-3 rounded-card border border-border bg-card p-5 shadow-soft">
          <GradeFormula parts={card.parts} locale={locale} />
        </div>
      </section>

      {/* ── Отдельные оценки ────────────────────────────────────────────── */}
      <section aria-labelledby="card-grades-title">
        <h2 id="card-grades-title" className="text-lg font-extrabold tracking-heading">
          {t(locale, 'discipline.grades.title')}
        </h2>
        <div className="mt-3">
          <GradeRows grades={card.grades} locale={locale} />
        </div>
      </section>

      {/* ── Слот калькулятора «Что нужно на экзамене» ─────────────────────
          Калькулятор — отдельная задача; встраивается сюда без изменений
          страницы. Данные экзамена плана уже приходят в card.exam. */}
      <section aria-labelledby="card-calculator-title" id="calculator">
        <h2 id="card-calculator-title" className="text-lg font-extrabold tracking-heading">
          {t(locale, 'discipline.exam.title')}
        </h2>
        <div
          data-testid="calculator-slot"
          className="mt-3 rounded-card border border-dashed border-border bg-card p-5 shadow-soft"
        >
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="flex size-9 shrink-0 items-center justify-center rounded-pill bg-accent-soft text-accent-ink"
            >
              <Calculator className="size-4" />
            </span>
            <div className="min-w-0 text-sm text-muted-foreground">
              {card.exam ? (
                <p>
                  <span className="font-semibold text-foreground">{card.exam.elementName}</span>{' '}
                  {t(locale, 'discipline.exam.weight', {
                    weight: card.exam.weightPercent,
                    max: card.exam.maxScore,
                  })}
                  {card.exam.graded ? t(locale, 'discipline.exam.graded') : ''}
                </p>
              ) : (
                <p>{t(locale, 'discipline.exam.none')}</p>
              )}
              <p className="mt-1.5">{t(locale, 'discipline.exam.stub')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Ошибка в оценке? → обращение в деканат ──────────────────────── */}
      <section aria-labelledby="card-appeal-title">
        <h2 id="card-appeal-title" className="text-lg font-extrabold tracking-heading">
          {t(locale, 'discipline.appeal.title')}
        </h2>
        <div className="mt-3 rounded-card border border-border bg-card p-5 shadow-soft">
          <GradeAppealForm disciplineCode={card.disciplineCode} locale={locale} />
        </div>
      </section>

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
        <span>
          <BookMarked aria-hidden="true" className="mr-1 inline size-3.5" />
          {t(locale, 'discipline.formula.note')}
        </span>
      </p>
    </section>
  );
}
