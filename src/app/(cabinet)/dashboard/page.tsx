// DIG-20 — «Ваша неделя», главная кабинета (Figma «02 Главная + M2»).
//
// Данные приходит ОДНИМ серверным агрегатом getDashboard(dataDb, ctx):
// все источники читаются параллельно внутри него (Promise.all), водопада
// запросов нет. Контекст строится из живой сессии (requireDataCtx) — id
// никогда не берётся из URL, чужие данные недостижимы по построению.
// Пока агрегат грузится, Suspense показывает скелетон; блок с упавшим
// источником рисует собственное состояние ошибки (см. sections.tsx),
// остальные блоки продолжают работать.
//
// DIG-44 — порядок и видимость виджетов берутся из настроек студента
// (Настройки → Главная): секции рендерятся в сохранённом порядке,
// выключенные не рендерятся вовсе. Настройки читаются тем же
// IDOR-безопасным слоем; недоступные настройки → канонический порядок.
import { Suspense } from 'react';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import {
  DeadlinesSection,
  EventsSection,
  Hero,
  NewsSection,
  ProgressSection,
  QuickActionsSection,
  RequestsSection,
  TodaySection,
} from '@/components/dashboard/sections';
import {
  enabledWidgetIds,
  normalizeWidgets,
  type DashboardWidgetId,
} from '@/lib/dashboard-widgets';
import { dataDb } from '@/server/data/db';
import { getDashboard, getOwnSettings, listDeaneryNews, requireDataCtx } from '@/server/data';
import type { DataCtx } from '@/server/data/types';

export const metadata = { title: 'Главная — Цифровой деканат' };

/** Настройки не должны ронять главную: любая ошибка → порядок по умолчанию. */
async function getOwnSettingsSafe(ctx: DataCtx) {
  try {
    return ctx.studentId ? await getOwnSettings(dataDb, ctx) : null;
  } catch {
    return null;
  }
}

async function DashboardContent() {
  const ctx = await requireDataCtx('/dashboard');
  // Сотруднику деканата студенческая главная не показывается — его кабинет
  // отдельный (DIG-48, вне скоупа DIG-20); здесь — явное пустое состояние.
  if (ctx.role === 'STAFF') {
    return (
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 md:py-8">
        <h1 className="text-xl font-bold sm:text-2xl">Кабинет сотрудника</h1>
        <p className="text-sm text-muted-foreground">
          Экран сотрудника деканата (очередь заявок, обращения) — отдельная задача DIG-48. Сейчас
          отображается заглушка.
        </p>
      </section>
    );
  }
  const [data, settings] = await Promise.all([getDashboard(dataDb, ctx), getOwnSettingsSafe(ctx)]);
  const news = listDeaneryNews();

  // DIG-44 — порядок виджетов из настроек (включённые, в сохранённом порядке).
  const widgetOrder = enabledWidgetIds(normalizeWidgets(settings?.widgets));

  const widgetSections: Record<DashboardWidgetId, React.ReactNode> = {
    today: <TodaySection today={data.today} />,
    deadlines: <DeadlinesSection deadlines={data.deadlines} />,
    performance: <ProgressSection progress={data.progress} />,
    requests: <RequestsSection requests={data.requests} />,
    news: <NewsSection news={news} />,
    events: <EventsSection />,
  };

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
      <QuickActionsSection />
      {widgetOrder.map((id) => (
        <div key={id}>{widgetSections[id]}</div>
      ))}
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
