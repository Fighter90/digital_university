// DIG-34 — экран «Задачи»: единый список действий, которые ждут от студента.
//
// Данные приходят ОДНИМ серверным агрегатом getTasks(dataDb, ctx): контекст
// строится из живой сессии (requireDataCtx) — скоуп по studentId/groupName,
// из URL ничего не приходит (IDOR невозможен по построению). Каждая задача
// ведёт ровно туда, где её выполнить; ручные задачи закрываются отметкой
// прямо на экране; пустой список — «Все дела сделаны 🎉».
import type { Metadata } from 'next';
import Link from 'next/link';
import { t } from '@/lib/i18n';
import { getLocale } from '@/lib/i18n/server';

import { requireDataCtx, getTasks } from '@/server/data';
import { dataDb } from '@/server/data/db';
import type { TasksData } from '@/server/data/tasks';

import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { TasksView } from '@/components/tasks/tasks-view';
import { SectionTitle } from '@/components/shell/section-title';

/** DIG-89 — <title> страницы по локали. */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: t(locale, 'meta.tasks') };
}

export default function TasksPage() {
  return <TasksContent />;
}

async function TasksContent() {
  const [ctx, locale] = await Promise.all([requireDataCtx('/tasks'), getLocale()]);

  // Сотруднику деканата студенческие задачи не показываются — явная
  // заглушка (тот же контракт, что на «Сессии»).
  if (ctx.role === 'STAFF') {
    return (
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 md:py-8">
        <SectionTitle href="/tasks" className="text-xl font-bold tracking-heading sm:text-2xl" />
        <EmptyState
          title={t(locale, 'empty.tasksStaffTitle')}
          description={t(locale, 'empty.tasksStaffDesc')}
        />
      </section>
    );
  }

  let data: TasksData;
  try {
    data = await getTasks(dataDb, ctx);
  } catch (error) {
    // не глотаем: без лога «Задачи не загрузились» недиагностируемо
    console.error('[tasks] render failed', error);
    return (
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6 md:py-8">
        <SectionTitle href="/tasks" className="text-xl font-bold tracking-heading sm:text-2xl" />
        <ErrorState
          title={t(locale, 'tasks.errorTitle')}
          description={t(locale, 'tasks.errorDesc')}
        />
        <div className="flex justify-center">
          <Link href="/tasks" className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
            {t(locale, 'btn.retry')}
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 md:py-8">
      <header className="flex animate-rise flex-col gap-2">
        <SectionTitle href="/tasks" className="text-xl font-bold tracking-heading sm:text-2xl" />
        <p className="max-w-prose text-sm text-muted-foreground">{t(locale, 'tasks.subtitle')}</p>
        {data.openCount > 0 ? (
          <p data-testid="tasks-header-count" className="text-sm text-muted-foreground">
            {t(locale, 'tasks.openCount', { count: data.openCount })}
          </p>
        ) : null}
      </header>

      <TasksView data={data} locale={locale} />
    </section>
  );
}
