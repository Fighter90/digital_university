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
import { ArrowLeft, BookMarked, Calculator, Info } from 'lucide-react';

import { GradeAppealForm } from '@/components/gradebook/grade-appeal-form';
import { GradeFormula, GradeRows } from '@/components/gradebook/grade-formula';
import { Badge } from '@/components/ui/badge';
import { pluralRu } from '@/lib/dashboard-format';
import { dataDb } from '@/server/data/db';
import { getDisciplineCard, requireDataCtx } from '@/server/data';

export const metadata = { title: 'Дисциплина — Цифровой деканат' };

const CREDIT_FORMS = ['кредит', 'кредита', 'кредитов'] as const;

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
  const ctx = await requireDataCtx(`/grades/${rawCode}`);

  const card = await getDisciplineCard(dataDb, ctx, disciplineCode);
  if (!card) notFound();

  const accumulatedLabel =
    card.accumulated === null ? '—' : card.accumulated.toFixed(1).replace('.', ',');

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 md:py-8">
      <Link
        href="/grades/gradebook"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Зачётная книжка
      </Link>

      {/* ── Шапка: название, преподаватель, кредиты, накопленная крупно ── */}
      <header className="rounded-block border border-border bg-card p-5 shadow-soft md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-extrabold tracking-heading text-foreground sm:text-2xl">
              {card.disciplineName}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {card.teacherName ? (
                card.teacherName
              ) : (
                <span className="text-muted-foreground">Преподаватель не указан</span>
              )}
            </p>
            {card.teacherName ? (
              <p className="mt-0.5 text-xs text-muted-foreground">
                Профиль преподавателя появится в справочнике (раздел в разработке)
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge status="neutral">
                {card.credits} {pluralRu(card.credits, CREDIT_FORMS)}
              </Badge>
              {card.semesterLabel ? (
                <span className="rounded-pill bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                  {card.semesterLabel}
                </span>
              ) : null}
              {card.isComplete ? (
                card.creditEarned ? (
                  <Badge status="success">Кредит зачтён</Badge>
                ) : (
                  <Badge status="error">Кредит не зачтён</Badge>
                )
              ) : (
                <span className="rounded-pill bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent-ink">
                  в процессе
                </span>
              )}
            </div>
          </div>

          {/* Накопленная оценка крупно (итог — у завершённой дисциплины) */}
          <div className="flex shrink-0 flex-col items-end">
            {card.isComplete && card.finalGrade !== null ? (
              <>
                <p className="text-xs uppercase text-muted-foreground">Итог дисциплины</p>
                <p
                  data-testid="final-grade"
                  className="text-5xl font-extrabold leading-none tracking-heading text-foreground"
                >
                  {card.finalGrade}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">из 100</p>
              </>
            ) : (
              <>
                <p className="text-xs uppercase text-muted-foreground">Накопленная оценка</p>
                <p
                  data-testid="accumulated-grade"
                  className="text-5xl font-extrabold leading-none tracking-heading text-foreground"
                >
                  {accumulatedLabel}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  из 100
                  {card.maxPossible !== null && !card.isComplete
                    ? ` · максимум ${card.maxPossible.toFixed(1).replace('.', ',')}`
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
          Из чего складывается оценка
        </h2>
        <div className="mt-3 rounded-card border border-border bg-card p-5 shadow-soft">
          <GradeFormula parts={card.parts} />
        </div>
      </section>

      {/* ── Отдельные оценки ────────────────────────────────────────────── */}
      <section aria-labelledby="card-grades-title">
        <h2 id="card-grades-title" className="text-lg font-extrabold tracking-heading">
          Отдельные оценки
        </h2>
        <div className="mt-3">
          <GradeRows grades={card.grades} />
        </div>
      </section>

      {/* ── Слот калькулятора «Что нужно на экзамене» ─────────────────────
          Калькулятор — отдельная задача; встраивается сюда без изменений
          страницы. Данные экзамена плана уже приходят в card.exam. */}
      <section aria-labelledby="card-calculator-title" id="calculator">
        <h2 id="card-calculator-title" className="text-lg font-extrabold tracking-heading">
          Что нужно на экзамене
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
                  · {card.exam.weightPercent}% итога · максимум {card.exam.maxScore}
                  {card.exam.graded ? ' · уже сдан' : ''}
                </p>
              ) : (
                <p>В плане дисциплины нет экзаменационного элемента.</p>
              )}
              <p className="mt-1.5">
                Калькулятор подскажет балл, который нужен на экзамене ради целевой оценки, — он
                встроится в этот блок в ближайшем обновлении кабинета.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Ошибка в оценке? → обращение в деканат ──────────────────────── */}
      <section aria-labelledby="card-appeal-title">
        <h2 id="card-appeal-title" className="text-lg font-extrabold tracking-heading">
          Нашли ошибку в оценке?
        </h2>
        <div className="mt-3 rounded-card border border-border bg-card p-5 shadow-soft">
          <GradeAppealForm disciplineCode={card.disciplineCode} />
        </div>
      </section>

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
        <span>
          <BookMarked aria-hidden="true" className="mr-1 inline size-3.5" />
          Накопленная оценка — вклад сданных работ в итог по правилам docs/grading.md: пересдача
          не удваивает счёт, учитывается последняя попытка.
        </span>
      </p>
    </section>
  );
}
