// DIG-68 — «МСП»: каталог студенческих стартапов (/msp) по образцу
// Product Hunt — лента карточек с голосованием, «Запуск дня» и композер
// запуска. Сортировка «Новые»/«Топ» — query-параметр ?sort= (состояние в
// URL). Чтение — любой вошедший; мутации (голос, запуск) owner-scoped по
// сессии студента (см. server/actions/msp.ts и server/data/msp.ts).
//
// Плашка «Концепт для конкурса» — общий баннер root layout.
import { Rocket } from 'lucide-react';

import { getMspPage, parseMspSort, requireDataCtx } from '@/server/data';
import { dataDb } from '@/server/data/db';
import { MspLaunchOfDay } from '@/components/msp/msp-launch-of-day';
import { MspLaunchComposer } from '@/components/msp/msp-launch-composer';
import { MspProjectCard } from '@/components/msp/msp-project-card';
import { MspSortTabs } from '@/components/msp/msp-sort-tabs';
import { EmptyState } from '@/components/ui/empty-state';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { localizedMspProject } from '@/lib/en-demo-content';

export default async function MspPage({
  searchParams,
}: {
  searchParams?: Promise<{ sort?: string }>;
}) {
  // Next 15 передаёт промис; прямой рендер (юнит-прендер) — тоже валиден.
  const params = (await searchParams) ?? {};
  const sort = parseMspSort(params.sort);
  const [ctx, locale] = await Promise.all([requireDataCtx('/msp'), getLocale()]);
  const page = await getMspPage(dataDb, ctx, sort);
  const canVote = ctx.role === 'STUDENT';

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-6 md:py-8">
      <header>
        <h1 className="text-xl font-bold tracking-heading sm:text-2xl">{t(locale, 'msp.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(locale, 'msp.subtitle')}
        </p>
      </header>

      <div className="mt-6 flex flex-col gap-6">
        {/* «Запуск дня» — max голосов, при равенстве самый свежий (не random). */}
        <MspLaunchOfDay
          view={page.launchOfDay}
          canVote={canVote}
          locale={locale}
        />

        {/* Лента слева, композер запуска — правая панель на десктопе. */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold">{t(locale, 'msp.catalog.title')}</h2>
              <MspSortTabs sort={page.sort} locale={locale} />
            </div>

            {page.items.length === 0 ? (
              <EmptyState
                icon={Rocket}
                title={t(locale, 'msp.catalog.emptyTitle')}
                description={t(locale, 'msp.catalog.emptyDesc')}
              />
            ) : (
              <ul className="flex flex-col gap-3" data-testid="msp-feed">
                {page.items.map((view) => (
                  <li key={view.project.id}>
                    <MspProjectCard view={view} canVote={canVote} locale={locale} />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-3">
            <MspLaunchComposer locale={locale} />
            <p className="text-xs text-muted-foreground">
              {t(locale, 'msp.vote.hint')}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
