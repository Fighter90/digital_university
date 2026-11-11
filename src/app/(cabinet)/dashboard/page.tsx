// DIG-20 — «Ваша неделя», главная кабинета (Figma «02 Главная + M2»).
//
// Данные приходит ОДНИМ серверным агрегатом getDashboard(dataDb, ctx):
// все источники читаются параллельно внутри него (Promise.all), водопада
// запросов нет. Контекст строится из живой сессии (requireDataCtx) — id
// никогда не берётся из URL, чужие данные недостижимы по построению.
// Пока агрегат грузится, Suspense показывает скелетон; блок с упавшим
// источником рисует собственное состояние ошибки (см. sections.tsx),
// остальные блоки продолжают работать.
import { Suspense } from 'react';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import {
  DeadlinesSection,
  Hero,
  NewsSection,
  ProgressSection,
  QuickActionsSection,
  TodaySection,
} from '@/components/dashboard/sections';
import { dataDb } from '@/server/data/db';
import { getDashboard, listDeaneryNews, requireDataCtx } from '@/server/data';

export const metadata = { title: 'Главная — Цифровой деканат' };

async function DashboardContent() {
  const ctx = await requireDataCtx('/dashboard');
  // Сотруднику деканата студенческая главная не показывается — его кабинет
  // отдельный (DIG-48, вне скоупа DIG-20); здесь — явное пустое состояние.
  if (ctx.role === 'STAFF') {
    return (
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 md:py-8">
        <h1 className="text-xl font-bold sm:text-2xl">Кабинет сотрудника</h1>
        <p className="text-sm text-muted-foreground">
          Экран сотрудника деканата (очередь заявок, обращения) — отдельная задача
          DIG-48. Сейчас отображается заглушка.
        </p>
      </section>
    );
  }
  const data = await getDashboard(dataDb, ctx);
  const news = listDeaneryNews();

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 md:py-8">
      <Hero
        firstName={data.firstName}
        greeting={data.greeting}
        headingDate={data.headingDate}
        summary={data.summary}
        progress={data.progress}
        requests={data.requests}
      />
      <TodaySection today={data.today} />
      <DeadlinesSection deadlines={data.deadlines} />
      <ProgressSection progress={data.progress} />
      <QuickActionsSection />
      <NewsSection news={news} />
    </section>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}
