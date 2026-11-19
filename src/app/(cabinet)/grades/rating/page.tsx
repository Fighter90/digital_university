// DIG-103 — «Рейтинг группы» (/grades/rating): компактная таблица студентов
// СВОЕЙ группы по среднему баллу (место №, ФИО, средний двумя знаками,
// тонкий прогресс-бар к шкале проекта 0–100 — той же, на которой работает
// агрегат GPA DIG-80).
//
// Данные — одним вызовом getGroupRating(dataDb, ctx): контекст строится из
// живой сессии (requireDataCtx), groupName в ctx — из сессии, из URL не
// приходит (чужую группу получить невозможно по построению). В строках —
// только ФИО и средний балл: чужие оценки по дисциплинам не раскрываются
// (приватность рейтинга). Средний и место совпадают со сводкой /grades —
// единый расчёт gpaOfStudent агрегата DIG-80.
import { Trophy } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { formatAverageScore } from '@/lib/group-rating';
import { t } from '@/lib/i18n';
import { getLocale } from '@/lib/i18n/server';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionTitle } from '@/components/shell/section-title';
import { dataDb } from '@/server/data/db';
import { getGroupRating, requireDataCtx } from '@/server/data';
import type { GroupRatingRow } from '@/lib/group-rating';

/** DIG-89 — <title> страницы по локали. */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: t(locale, 'meta.gradesRating') };
}

export default async function GroupRatingPage() {
  const [ctx, locale] = await Promise.all([requireDataCtx('/grades/rating'), getLocale()]);

  // Сотруднику деканата студенческий рейтинг не показывается (его кабинет —
  // отдельная задача); слой данных отвечает null + аудит (ROLE_MISMATCH).
  if (ctx.role === 'STAFF') {
    return (
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 md:py-8">
        <SectionTitle
          href="/grades/rating"
          className="text-xl font-bold tracking-heading sm:text-2xl"
        />
        <EmptyState
          title={t(locale, 'empty.staffOnlyTitle')}
          description={t(locale, 'gradebook.studentsOnlyDesc')}
        />
      </section>
    );
  }

  const view = await getGroupRating(dataDb, ctx);

  // null возможен только при отказе доступа — студенту не случается;
  // группа без единой оценки — honest empty-state вместо таблицы.
  if (!view || !view.hasAnyGrades) {
    return (
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 md:py-8">
        <SectionTitle
          href="/grades/rating"
          className="text-xl font-bold tracking-heading sm:text-2xl"
        />
        <EmptyState
          icon={Trophy}
          title={t(locale, 'grades.rating.emptyTitle')}
          description={t(locale, 'grades.rating.emptyDesc')}
        />
        <BackToSummary locale={locale} />
      </section>
    );
  }

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 md:py-8">
      <SectionTitle
        href="/grades/rating"
        className="text-xl font-bold tracking-heading sm:text-2xl"
      />

      <div className="animate-rise rounded-card border border-border bg-card p-4 shadow-soft sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 pb-2">
          <p className="text-sm font-extrabold tracking-heading">{view.groupName}</p>
          <p className="text-xs text-muted-foreground">{t(locale, 'grades.rating.caption')}</p>
        </div>
        <table className="w-full text-sm" aria-label={t(locale, 'grades.rating.caption')}>
          <thead>
            <tr className="text-left text-xs uppercase text-muted-foreground">
              <th scope="col" className="w-12 pb-2 pr-3 font-semibold">
                {t(locale, 'grades.rating.place')}
              </th>
              <th scope="col" className="pb-2 pr-3 font-semibold">
                {t(locale, 'grades.rating.student')}
              </th>
              <th scope="col" className="pb-2 text-right font-semibold">
                {t(locale, 'grades.rating.average')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {view.rows.map((row) => (
              <RatingRow key={row.studentId} row={row} locale={locale} />
            ))}
          </tbody>
        </table>
      </div>

      <BackToSummary locale={locale} />
    </section>
  );
}

/** Строка таблицы: место, ФИО (у владельца — «вы»), средний, прогресс-бар. */
function RatingRow({ row, locale }: { row: GroupRatingRow; locale: 'ru' | 'en' }) {
  const ranked = row.average !== null && row.place !== null;
  return (
    <tr
      data-testid="rating-row"
      data-viewer={row.isViewer ? 'true' : undefined}
      className={row.isViewer ? 'bg-accent-soft/50' : undefined}
    >
      <td className="py-2.5 pr-3 font-bold tabular-nums">{ranked ? row.place : '—'}</td>
      <td className="py-2.5 pr-3">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-medium">
          {row.fullName}
          {row.isViewer ? <Badge status="info">{t(locale, 'grades.rating.you')}</Badge> : null}
        </span>
        {ranked ? (
          <div
            role="progressbar"
            aria-label={`${row.fullName} — ${t(locale, 'grades.rating.average')}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(row.average!)}
            className="mt-1.5 h-1.5 overflow-hidden rounded-pill bg-muted"
          >
            <div
              className="h-full rounded-pill bg-accent transition-[width]"
              style={{ width: `${Math.min(100, Math.max(0, row.average!))}%` }}
            />
          </div>
        ) : null}
      </td>
      <td className="py-2.5 text-right font-bold tabular-nums">
        {ranked ? formatAverageScore(row.average!, locale) : '—'}
      </td>
    </tr>
  );
}

function BackToSummary({ locale }: { locale: 'ru' | 'en' }) {
  return (
    <Link href="/grades" className="text-sm font-semibold text-accent-ink hover:underline">
      {t(locale, 'grades.rating.backToSummary')}
    </Link>
  );
}
