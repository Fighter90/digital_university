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
  TasksSection,
  TodaySection,
} from '@/components/dashboard/sections';
import {
  enabledWidgetIds,
  normalizeWidgets,
  type DashboardWidgetId,
} from '@/lib/dashboard-widgets';
import { t } from '@/lib/i18n';
import { getLocale } from '@/lib/i18n/server';
import { dataDb } from '@/server/data/db';
import {
  getDashboard,
  getDashboardEvents,
  getOwnSettings,
  listDeaneryNews,
  requireDataCtx,
} from '@/server/data';
import type { DashboardSection, EventsSummary } from '@/server/data';
import type { DataCtx } from '@/server/data/types';

// DIG-87 — EN-локализация часть 1: строки страницы (включая заглушку
// «Кабинет сотрудника» для сотрудников) идут из словаря по локали cookie
// du-locale; RU — байт-в-байт прежние строки.

export async function generateMetadata() {
  const locale = await getLocale();
  return { title: `${t(locale, 'title.dashboard')} — ${t(locale, 'shell.brandName')}` };
}

/** Настройки не должны ронять главную: любая ошибка → порядок по умолчанию. */
async function getOwnSettingsSafe(ctx: DataCtx) {
  try {
    return ctx.studentId ? await getOwnSettings(dataDb, ctx) : null;
  } catch {
    return null;
  }
}

// DIG-76 — виджет «Мероприятия» не должен ронять главную: сбой источника
// оседает в секцию ошибки самого блока (тот же контракт, что блоки агрегата).
async function getEventsSectionSafe(ctx: DataCtx): Promise<DashboardSection<EventsSummary>> {
  try {
    return { ok: true, value: await getDashboardEvents(dataDb, ctx) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function DashboardContent() {
  const [ctx, locale] = await Promise.all([requireDataCtx('/dashboard'), getLocale()] as const);
  // Сотруднику деканата студенческая главная не показывается — его кабинет
  // отдельный (DIG-48, вне скоупа DIG-20); здесь — явное пустое состояние
  // («Кабинет сотрудника», словарь dashboard.staff.*).
  if (ctx.role === 'STAFF') {
    return (
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 md:py-8">
        <h1 className="text-xl font-bold sm:text-2xl">{t(locale, 'dashboard.staff.title')}</h1>
        <p className="text-sm text-muted-foreground">{t(locale, 'dashboard.staff.desc')}</p>
      </section>
    );
  }
  const [data, settings, events] = await Promise.all([
    getDashboard(dataDb, ctx, new Date(), locale),
    getOwnSettingsSafe(ctx),
    // DIG-76 — ближайшие события для виджета «Мероприятия» (параллельно
    // агрегату; изоляция сбоя — getEventsSectionSafe выше).
    getEventsSectionSafe(ctx),
  ]);
  const news = listDeaneryNews();

  // DIG-44 — порядок виджетов из настроек (включённые, в сохранённом порядке).
  const widgetOrder = enabledWidgetIds(normalizeWidgets(settings?.widgets));

  const widgetSections: Record<DashboardWidgetId, React.ReactNode> = {
    today: <TodaySection today={data.today} locale={locale} />,
    deadlines: <DeadlinesSection deadlines={data.deadlines} locale={locale} />,
    tasks: <TasksSection tasks={data.tasks} locale={locale} />,
    performance: <ProgressSection progress={data.progress} locale={locale} />,
    requests: <RequestsSection requests={data.requests} locale={locale} />,
    news: <NewsSection news={news} locale={locale} />,
    events: <EventsSection events={events} locale={locale} />,
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
        locale={locale}
      />
      <QuickActionsSection locale={locale} />
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
