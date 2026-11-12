// DIG-27 — «Зачётная книжка» (/grades/gradebook): аккордеон семестров,
// итоги семестров и мгновенная выписка PDF (аналог — отдельный внешний
// сервис зачётки, откуда выписка заказывалась заявкой).
//
// Данные — одним серверным агрегатом getGradebook(dataDb, ctx); контекст
// строится из живой сессии (requireDataCtx) — id не приходит из URL, чужие
// данные недостижимы по построению. Карточка дисциплины — вложенный
// маршрут /grades/<disciplineId> ([disciplineId]/page.tsx).
import Link from 'next/link';
import { Download, GraduationCap } from 'lucide-react';

import { GradebookList } from '@/components/gradebook/gradebook-list';
import { EmptyState } from '@/components/ui/empty-state';
import { buttonVariants } from '@/components/ui/button';
import { dataDb } from '@/server/data/db';
import { getGradebook, requireDataCtx } from '@/server/data';

export const metadata = { title: 'Зачётная книжка — Цифровой деканат' };

// DIG-26: ?discipline=CODE из карточек главной — раскрываем семестр,
// в котором читается эта дисциплина (карточка ссылается сюда по спеке).
export default async function GradebookPage({
  searchParams,
}: {
  searchParams?: Promise<{ discipline?: string }>;
}) {
  const { discipline: disciplineParam } = (await searchParams) ?? {};
  const ctx = await requireDataCtx('/grades/gradebook');
  const data = await getGradebook(dataDb, ctx);
  // Код дисциплины → семестр с этой дисциплиной (для начального details open)
  const focusSemester = disciplineParam
    ? data.semesters.find((sem) =>
        sem.disciplines.some((d) => d.disciplineCode === disciplineParam),
      )?.key
    : undefined;

  // Сотруднику деканата студенческая зачётка не показывается (его кабинет —
  // отдельная задача DIG-48); слой данных отвечает пустым агрегатом + аудит.
  if (ctx.role === 'STAFF') {
    return (
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 md:py-8">
        <h1 className="text-xl font-bold sm:text-2xl">Зачётная книжка</h1>
        <div className="rounded-card border border-dashed border-border bg-card p-8 text-center">
          <p className="text-sm font-medium text-foreground">Доступно студентам</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Зачётная книжка показывает оценки студента — у сотрудника деканата этот раздел пуст.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 md:py-8">
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-extrabold tracking-heading sm:text-2xl">Зачётная книжка</h1>
            {data.student ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {data.student.fullName} · {data.student.groupName} · №{' '}
                {data.student.gradebookNumber}
              </p>
            ) : null}
          </div>
          <Link
            href="/api/grades/transcript"
            download
            data-testid="transcript-download"
            prefetch={false}
            className={buttonVariants({ variant: 'primary', size: 'sm' })}
          >
            <Download aria-hidden="true" className="size-4" />
            Скачать выписку PDF
          </Link>
        </div>
        <p className="text-sm text-muted-foreground">
          Оценки по семестрам с итогами. Выписка скачивается сразу — без заявки и очереди.
        </p>
      </header>

      {data.hasGrades ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-card border border-border bg-card p-4 shadow-soft">
              <p className="text-xs text-muted-foreground">Средний балл за всё время</p>
              <p className="mt-1 text-xl font-extrabold tracking-heading text-foreground">
                {data.overallAverage === null
                  ? '—'
                  : data.overallAverage.toFixed(2).replace('.', ',')}
              </p>
            </div>
            <div className="rounded-card border border-border bg-card p-4 shadow-soft">
              <p className="text-xs text-muted-foreground">Кредиты набрано</p>
              <p className="mt-1 text-xl font-extrabold tracking-heading text-foreground">
                {`${data.creditsEarned} из ${data.creditsRequired}`}
              </p>
            </div>
          </div>
          <GradebookList focusSemesterKey={focusSemester} data={data} />
        </>
      ) : (
        <EmptyState
          icon={GraduationCap}
          title="Оценок пока нет"
          description="Как только деканат выставит первые оценки, они появятся здесь по семестрам. Выписку можно скачать уже сейчас — она будет пустой."
          action={
            <Link
              href="/api/grades/transcript"
              download
              data-testid="transcript-download"
              prefetch={false}
              className="inline-flex select-none items-center justify-center gap-2 rounded-button border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground shadow-soft transition-colors hover:bg-muted"
            >
              <Download aria-hidden="true" className="size-4" />
              Скачать выписку PDF
            </Link>
          }
        />
      )}
    </section>
  );
}
