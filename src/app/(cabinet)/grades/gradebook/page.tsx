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
import { SectionTitle } from '@/components/shell/section-title';
import { EmptyState } from '@/components/ui/empty-state';
import { buttonVariants } from '@/components/ui/button';
import { t } from '@/lib/i18n';
import { getLocale } from '@/lib/i18n/server';
import { dataDb } from '@/server/data/db';
import { getGradebook, requireDataCtx } from '@/server/data';
import { localizePersonName, localizedGroup } from '@/lib/en-demo-content';
import type { Metadata } from 'next';

/** DIG-89 — <title> страницы по локали. */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: t(locale, 'meta.gradebook') };
}

// DIG-26: ?discipline=CODE из карточек главной — раскрываем семестр,
// в котором читается эта дисциплина (карточка ссылается сюда по спеке).
export default async function GradebookPage({
  searchParams,
}: {
  searchParams?: Promise<{ discipline?: string }>;
}) {
  const { discipline: disciplineParam } = (await searchParams) ?? {};
  const [ctx, locale] = await Promise.all([requireDataCtx('/grades/gradebook'), getLocale()]);
  // DIG-93 — подписи семестров агрегата по локали.
  const data = await getGradebook(dataDb, ctx, new Date(), locale);
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
        <SectionTitle href="/grades/gradebook" className="text-xl font-bold sm:text-2xl" />
        <div className="rounded-card border border-dashed border-border bg-card p-8 text-center">
          <p className="text-sm font-medium text-foreground">{t(locale, 'empty.staffOnlyTitle')}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(locale, 'gradebook.studentsOnlyDesc')}
          </p>
        </div>
      </section>
    );
  }

  const transcriptCta = (className: string) => (
    <Link
      href="/api/grades/transcript"
      download
      data-testid="transcript-download"
      prefetch={false}
      className={className}
    >
      <Download aria-hidden="true" className="size-4" />
      {t(locale, 'gradebook.downloadTranscript')}
    </Link>
  );

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 md:py-8">
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <SectionTitle
              href="/grades/gradebook"
              className="text-xl font-extrabold tracking-heading sm:text-2xl"
            />
            {data.student ? (
              // DIG-93 — шапка владельца по локали (имя — транслит, группа —
              // EN-словарь сида); канонические значения в данных не меняются.
              <p className="mt-1 text-sm text-muted-foreground">
                {localizePersonName(locale, data.student.fullName)} ·{' '}
                {localizedGroup(locale, data.student.groupName)} · №{' '}
                {data.student.gradebookNumber}
              </p>
            ) : null}
          </div>
          {transcriptCta(buttonVariants({ variant: 'primary', size: 'sm' }))}
        </div>
        <p className="text-sm text-muted-foreground">{t(locale, 'gradebook.subtitle')}</p>
      </header>

      {data.hasGrades ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-card border border-border bg-card p-4 shadow-soft">
              <p className="text-xs text-muted-foreground">
                {t(locale, 'gradebook.overallAverage')}
              </p>
              <p className="mt-1 text-xl font-extrabold tracking-heading text-foreground">
                {data.overallAverage === null
                  ? '—'
                  : data.overallAverage.toFixed(2).replace('.', ',')}
              </p>
            </div>
            <div className="rounded-card border border-border bg-card p-4 shadow-soft">
              <p className="text-xs text-muted-foreground">
                {t(locale, 'gradebook.creditsEarned')}
              </p>
              <p className="mt-1 text-xl font-extrabold tracking-heading text-foreground">
                {t(locale, 'gradebook.creditsOf', {
                  earned: data.creditsEarned,
                  required: data.creditsRequired,
                })}
              </p>
            </div>
          </div>
          <GradebookList focusSemesterKey={focusSemester} data={data} locale={locale} />
        </>
      ) : (
        <EmptyState
          icon={GraduationCap}
          title={t(locale, 'gradebook.emptyTitle')}
          description={t(locale, 'gradebook.emptyDesc')}
          action={transcriptCta(
            'inline-flex select-none items-center justify-center gap-2 rounded-button border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground shadow-soft transition-colors hover:bg-muted',
          )}
        />
      )}
    </section>
  );
}
