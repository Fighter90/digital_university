// DIG-22 — «Расписание: неделя» (Figma «03 · Расписание — неделя»).
//
// Данные: resolveWeekPage (чистая вью-логика) валидирует ?week=2026-W46,
// клампит страницу по границам семестра (pageMoscowWeek) и даёт соседние
// недели для стрелок ‹ ›; getSchedule отдаёт пары группы студента за
// полуинтервал недели. Контекст — requireDataCtx (живая сессия), id из URL
// не влияет на скоуп — IDOR невозможен по построению (сотрудник получает
// явную заглушку). Время везде Europe/Moscow.
//
// Сериализуемые модели блоков собирает toScheduleEventViews (понятные
// aria-label, «было: ауд. 214 / 11:10»); раскладку пересечений и фильтры
// делает клиентский WeekView. Мобильный вид (< 768 px) — отдельная задача.
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { WeekView, type WeekDayColumnData } from '@/components/schedule/week-view';
import {
  FILTER_KIND_ORDER,
  isoWeekKeyOf,
  miniCalendarCells,
  resolveWeekPage,
  toScheduleEventViews,
  WEEKDAY_SHORT,
} from '@/lib/schedule-view';
import { moscowDateKey, moscowParts, moscowWeekdayIndex } from '@/lib/schedule-time';
import { dataDb } from '@/server/data/db';
import { getSchedule, requireDataCtx } from '@/server/data';

export const metadata = { title: 'Расписание — Цифровой деканат' };

interface SchedulePageProps {
  /** Next 15 передаёт промис; рендер без пропсов (юнит-прендер) тоже валиден. */
  searchParams?: Promise<{ week?: string }>;
}

async function ScheduleContent({ week }: { week?: string }) {
  const ctx = await requireDataCtx('/schedule');

  // Сотрудник деканата без группы: студенческое расписание ему не положено
  // (getSchedule зафиксирует ROLE_MISMATCH в аудите) — явная заглушка.
  if (ctx.role === 'STAFF') {
    return (
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-6 py-6 md:py-8">
        <h1 className="text-xl font-bold tracking-heading sm:text-2xl">Расписание</h1>
        <EmptyState
          title="Расписание доступно студентам"
          description="Учебные пары показываются по учебной группе. Кабинет сотрудника с управлением расписанием — отдельная задача."
        />
      </section>
    );
  }

  const now = new Date();
  const page = resolveWeekPage(week, now);
  if (!page) {
    return (
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-6 py-6 md:py-8">
        <h1 className="text-xl font-bold tracking-heading sm:text-2xl">Расписание</h1>
        <EmptyState
          title="Сейчас вне семестра"
          description="Учебный календарь прототипа не задаёт пары за пределами семестра — расписание появится к его началу."
        />
      </section>
    );
  }

  let rows;
  try {
    rows = await getSchedule(dataDb, ctx, { from: page.from, to: page.to });
  } catch (error) {
    // не глотаем: без лога «Расписание не загрузилось» недиагностируемо (ревью раунд 2)
    console.error('[schedule] getSchedule failed', error);
    return (
      <section className="mx-auto flex w-full max-w-3xl flex-col py-6 md:py-8">
        <ErrorState
          title="Расписание не загрузилось"
          description="Обновите страницу — если ошибка повторится, сообщите в деканат."
        />
      </section>
    );
  }

  const views = toScheduleEventViews(rows);
  const todayKey = moscowDateKey(now);
  const days: WeekDayColumnData[] = page.days.map((day) => ({
    dateKey: moscowDateKey(day),
    weekdayShort: WEEKDAY_SHORT[moscowWeekdayIndex(day)],
    dayNumber: moscowParts(day).day,
    isToday: moscowDateKey(day) === todayKey,
    events: views.filter((view) => view.dateKey === moscowDateKey(day)),
  }));
  const kindCounts = FILTER_KIND_ORDER.map((kind) => ({
    kind,
    count: views.filter((view) => view.kind === kind).length,
  }));
  const teachers = [...new Set(views.map((view) => view.teacher))].sort((a, b) =>
    a.localeCompare(b, 'ru'),
  );

  return (
    <section className="mx-auto flex w-full max-w-[1200px] flex-col">
      <h1 className="sr-only">Расписание</h1>
      <WeekView
        weekKey={page.weekKey}
        weekLabel={page.weekLabel}
        semesterLabel={page.semesterLabel}
        prevWeekKey={page.prevWeekKey}
        nextWeekKey={page.nextWeekKey}
        todayWeekKey={isoWeekKeyOf(now)}
        todayKey={todayKey}
        days={days}
        mini={miniCalendarCells(page.from)}
        kindCounts={kindCounts}
        teachers={teachers}
      />
    </section>
  );
}

export default async function SchedulePage({ searchParams }: SchedulePageProps) {
  const params = searchParams ? await searchParams : {};
  return <ScheduleContent week={params.week} />;
}
