import Link from 'next/link';

import { cn } from '@/lib/utils';
import { formatScoreDate } from '@/lib/gradebook';
import { pluralRu } from '@/lib/dashboard-format';
import type { GradebookData, GradebookSemesterView } from '@/server/data';

// DIG-27 — список зачётной книжки: аккордеон семестров (<details>), внутри
// — десктопная таблица (md+) и мобильные карточки (до md): на 360 px
// таблица превращается в карточки (приёмка задачи). Строки ведут в
// карточку дисциплины /grades/<disciplineId>.

const CREDIT_FORMS = ['кредит', 'кредита', 'кредитов'] as const;

/** «81,22» — точность до сотой (правила хранения — docs/grading.md). */
export function formatAverage2(average: number | null): string {
  return average === null ? '—' : average.toFixed(2).replace('.', ',');
}

const semesterTestId = (semester: GradebookSemesterView): string =>
  `semester-accordion-${semester.key.startYear}-${semester.key.term.toLowerCase()}`;

function GradeBadge({ grade }: { grade: number | null }) {
  if (grade === null) {
    return (
      <span className="text-sm font-medium text-foreground-muted" title="Итог ещё не выставлен">
        —
      </span>
    );
  }
  const tone =
    grade >= 85
      ? 'bg-success-soft text-success-ink'
      : grade >= 60
        ? 'bg-warning-soft text-warning-ink'
        : 'bg-error-soft text-error-ink';
  return (
    <span className={cn('inline-flex rounded-pill px-2.5 py-0.5 text-sm font-bold', tone)}>
      {grade}
    </span>
  );
}

function fillTone(earned: number): string {
  if (earned >= 85) return 'bg-success';
  if (earned >= 60) return 'bg-warning';
  return 'bg-error';
}

export function GradebookList({ data }: { data: GradebookData }) {
  return (
    <div className="flex flex-col gap-4">
      {data.semesters.map((semester, index) => {
        const testId = semesterTestId(semester);
        const hasGrades = semester.disciplines.some(
          (d) => d.finalGrade !== null || d.accumulated !== null,
        );
        return (
          <details
            key={testId}
            data-testid={testId}
            open={index === 0}
            className="group rounded-card border border-border bg-card shadow-soft"
          >
            {/* Итог семестра — в шапке аккордеона: средний балл и кредиты */}
            <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-4 py-3.5 hover:bg-neutral-50 sm:px-5">
              <span className="flex min-w-0 items-center gap-2.5">
                {/* стрелка-шеврон: раскрыта в открытом семестре */}
                <svg
                  aria-hidden="true"
                  viewBox="0 0 16 16"
                  className="size-4 shrink-0 text-neutral-500 transition-transform group-open:rotate-90"
                >
                  <path
                    d="M6 3l5 5-5 5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="truncate text-[15px] font-extrabold tracking-heading text-neutral-900">
                  {semester.label}
                </span>
              </span>
              <span className="flex shrink-0 flex-wrap items-center gap-2 text-xs">
                <span
                  data-testid={`${testId}-average`}
                  className="rounded-pill bg-muted px-2.5 py-1 font-semibold text-neutral-800"
                >
                  Средний балл: {formatAverage2(semester.average)}
                </span>
                <span
                  data-testid={`${testId}-credits`}
                  className="rounded-pill bg-accent-soft px-2.5 py-1 font-semibold text-accent-ink"
                >
                  Кредиты: {semester.creditsEarned} из {semester.creditsTotal}
                </span>
              </span>
            </summary>

            <div className="border-t border-border px-4 py-3 sm:px-5">
              {/* ── Десктоп: таблица ─────────────────────────────────────── */}
              <div className="hidden md:block" data-testid={`gradebook-table-${testId.replace('semester-accordion-', '')}`}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase text-neutral-500">
                      <th scope="col" className="pb-2 pr-3 font-semibold">
                        Дисциплина
                      </th>
                      <th scope="col" className="pb-2 pr-3 font-semibold">
                        Контроль
                      </th>
                      <th scope="col" className="pb-2 pr-3 text-right font-semibold">
                        Кредиты
                      </th>
                      <th scope="col" className="pb-2 pr-3 text-right font-semibold">
                        Итог
                      </th>
                      <th scope="col" className="pb-2 text-right font-semibold">
                        Дата
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {semester.disciplines.map((discipline) => (
                      <tr
                        key={discipline.disciplineCode}
                        data-testid={`gradebook-row-${discipline.disciplineCode}`}
                        className="border-t border-border"
                      >
                        <td className="py-2.5 pr-3">
                          <Link
                            href={`/grades/${discipline.disciplineCode}`}
                            className="font-semibold text-neutral-900 underline-offset-2 hover:text-coral-600 hover:underline"
                          >
                            {discipline.disciplineName}
                          </Link>
                        </td>
                        <td className="py-2.5 pr-3 text-neutral-700">
                          {discipline.controlTypeLabel}
                        </td>
                        <td className="py-2.5 pr-3 text-right text-neutral-700">
                          {discipline.credits}
                        </td>
                        <td className="py-2.5 pr-3 text-right">
                          <GradeBadge grade={discipline.finalGrade} />
                        </td>
                        <td className="py-2.5 text-right font-mono text-xs text-neutral-600">
                          {discipline.completedAt ? formatScoreDate(discipline.completedAt) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ── Мобильный: карточки (360 px) ─────────────────────────── */}
              <ul
                className="flex flex-col gap-2.5 md:hidden"
                data-testid={`gradebook-cards-${testId.replace('semester-accordion-', '')}`}
              >
                {semester.disciplines.map((discipline) => (
                  <li key={discipline.disciplineCode}>
                    <Link
                      href={`/grades/${discipline.disciplineCode}`}
                      data-testid={`gradebook-card-${discipline.disciplineCode}`}
                      className="lift-hover flex items-center justify-between gap-3 rounded-card border border-border bg-background p-3.5 transition-colors hover:border-coral-200 hover:bg-coral-50"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-neutral-900">
                          {discipline.disciplineName}
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-600">
                          <span className="rounded-pill bg-muted px-2 py-0.5 font-medium">
                            {discipline.controlTypeLabel}
                          </span>
                          <span>
                            {discipline.credits}{' '}
                            {pluralRu(discipline.credits, CREDIT_FORMS)}
                          </span>
                          <span className="font-mono text-[11px] text-neutral-500">
                            {discipline.completedAt ? formatScoreDate(discipline.completedAt) : '—'}
                          </span>
                        </span>
                      </span>
                      <GradeBadge grade={discipline.finalGrade} />
                    </Link>
                  </li>
                ))}
              </ul>

              {hasGrades ? null : (
                <p className="mt-3 text-xs text-neutral-500">
                  Оценок в семестре ещё нет — итог появится, когда деканат выставит оценки.
                </p>
              )}
            </div>
          </details>
        );
      })}
    </div>
  );
}
