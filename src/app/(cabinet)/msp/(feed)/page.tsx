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

export default async function MspPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const { sort: rawSort } = await searchParams;
  const sort = parseMspSort(rawSort);
  const ctx = await requireDataCtx('/msp');
  const page = await getMspPage(dataDb, ctx, sort);
  const canVote = ctx.role === 'STUDENT';

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-6 md:py-8">
      <header>
        <h1 className="text-xl font-bold tracking-heading sm:text-2xl">
          МСП — каталог студенческих стартапов
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Малое и среднее предпринимательство: запуски студенческих проектов — голосуйте за идеи,
          обсуждайте и публикуйте свои. Все проекты вымышленные.
        </p>
      </header>

      <div className="mt-6 flex flex-col gap-6">
        {/* «Запуск дня» — max голосов, при равенстве самый свежий (не random). */}
        <MspLaunchOfDay view={page.launchOfDay} canVote={canVote} />

        {/* Лента слева, композер запуска — правая панель на десктопе. */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold">Каталог проектов</h2>
              <MspSortTabs sort={page.sort} />
            </div>

            {page.items.length === 0 ? (
              <EmptyState
                icon={Rocket}
                title="Каталог пока пуст"
                description="Станьте первым: расскажите о своём студенческом проекте с кнопки «Запустить проект»."
              />
            ) : (
              <ul className="flex flex-col gap-3" data-testid="msp-feed">
                {page.items.map((view) => (
                  <li key={view.project.id}>
                    <MspProjectCard view={view} canVote={canVote} />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-3">
            <MspLaunchComposer />
            <p className="text-xs text-muted-foreground">
              Голос — один на проект: повторный клик по «▲» снимает его. Комментарии и голоса
              доступны студентам, чтение каталога — всем вошедшим.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
