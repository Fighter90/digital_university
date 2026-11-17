// DIG-34 — экран «Задачи»: единый список действий, которые ждут от студента.
//
// Данные приходят ОДНИМ серверным агрегатом getTasks(dataDb, ctx): контекст
// строится из живой сессии (requireDataCtx) — скоуп по studentId/groupName,
// из URL ничего не приходит (IDOR невозможен по построению). Каждая задача
// ведёт ровно туда, где её выполнить; ручные задачи закрываются отметкой
// прямо на экране; пустой список — «Все дела сделаны 🎉».
import Link from 'next/link';

import { requireDataCtx, getTasks } from '@/server/data';
import { dataDb } from '@/server/data/db';
import type { TasksData } from '@/server/data/tasks';

import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { TasksView } from '@/components/tasks/tasks-view';
import { SectionTitle } from '@/components/shell/section-title';

export const metadata = { title: 'Задачи — Цифровой деканат' };

export default function TasksPage() {
  return <TasksContent />;
}

async function TasksContent() {
  const ctx = await requireDataCtx('/tasks');

  // Сотруднику деканата студенческие задачи не показываются — явная
  // заглушка (тот же контракт, что на «Сессии»).
  if (ctx.role === 'STAFF') {
    return (
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 md:py-8">
        <SectionTitle href="/tasks" className="text-xl font-bold tracking-heading sm:text-2xl" />
        <EmptyState
          title="Экран доступен студентам"
          description="Задачи собираются по учебной группе и личным данным студента. Кабинет сотрудника с очередью заявок — отдельная задача."
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
          title="Задачи не загрузились"
          description="Обновите страницу — если ошибка повторится, сообщите в деканат."
        />
        <div className="flex justify-center">
          <Link href="/tasks" className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
            Повторить
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 md:py-8">
      <header className="flex animate-rise flex-col gap-2">
        <SectionTitle href="/tasks" className="text-xl font-bold tracking-heading sm:text-2xl" />
        <p className="max-w-prose text-sm text-muted-foreground">
          Единый список дел из всех разделов: заявки на доработке, дедлайны курсов, допуски и
          пересдачи, письма деканата. Заявка остаётся объектом в «Заявках» — здесь только действия.
        </p>
        {data.openCount > 0 ? (
          <p data-testid="tasks-header-count" className="text-sm text-muted-foreground">
            Открытых задач: <span className="font-semibold text-foreground">{data.openCount}</span>
          </p>
        ) : null}
      </header>

      <TasksView data={data} />
    </section>
  );
}
