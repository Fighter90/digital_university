// DIG-23 — страница «Расписание»: виды «День», «Неделя» (заглушка до merge
// недельной сетки DIG-22), «Месяц» и мобильный вид с лентой дат (< 768 px,
// Figma «04 · Расписание — день / месяц» + вариант 360 px).
//
// Данные читает только сервер: контекст из живой сессии (requireDataCtx),
// id из URL не влияет на скоуп (пары всегда группы студента) — IDOR
// невозможен по построению. ?view / ?date / ?month разбираются в
// src/lib/schedule-cards.ts: мусор откатывается к «день / сегодня / текущий
// месяц», листание клампится по границам семестра.
//
// Мобильный блок получает серийализуемое окно ±2 недели (MobileDayView[]) —
// свайп и выбор дня в ленте не ходят в сеть.
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { DayView, type NextStudyDayInfo } from '@/components/schedule/day-view';
import { MonthView } from '@/components/schedule/month-view';
import { MobileSchedule, type MobileDayView } from '@/components/schedule/mobile-schedule';
import { ViewSwitcher } from '@/components/schedule/view-switcher';
import {
  formatDayShort,
  formatDayTitle,
  formatMonthKey,
  formatMonthTitle,
  groupCardsByDate,
  monthCellViews,
  monthVisible,
  neighborDay,
  parseDateKey,
  resolveScheduleView,
  resolveSelectedDate,
  resolveSelectedMonth,
  shiftMonth,
  toScheduleEventCards,
  weekWindow,
  WEEKDAY_SHORT,
} from '@/lib/schedule-cards';
import { moscowDateKey, moscowWeekdayIndex, semesterBounds } from '@/lib/schedule-time';
import { dataDb } from '@/server/data/db';
import { getMonth, getNextStudyDay, getSchedule, requireDataCtx } from '@/server/data';
import type { DataCtx } from '@/server/data';

export const metadata = { title: 'Расписание — Цифровой деканат' };

interface SchedulePageProps {
  /** Next 15 передаёт промис; рендер без пропсов (юнит-прендер) тоже валиден. */
  searchParams?: Promise<{ view?: string; date?: string; month?: string }>;
}

async function ScheduleContent({
  view,
  date,
  month,
}: {
  view?: string;
  date?: string;
  month?: string;
}) {
  const ctx = await requireDataCtx('/schedule');

  // Сотрудник деканата без группы: студенческое расписание ему не положено
  // (чтение групповых данных попадает в аудит) — явная заглушка.
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
  const bounds = semesterBounds(now);
  const todayKey = moscowDateKey(now);
  const activeView = resolveScheduleView(view);
  const selectedDate = resolveSelectedDate(date, now);
  const selectedKey = moscowDateKey(selectedDate);

  try {
    if (activeView === 'month') {
      return await MonthContent({ ctx, now, bounds, todayKey, monthParam: month, selectedKey });
    }
    return await DayOrWeekContent({
      ctx,
      activeView,
      bounds,
      todayKey,
      selectedDate,
      selectedKey,
    });
  } catch {
    return (
      <section className="mx-auto flex w-full max-w-3xl flex-col py-6 md:py-8">
        <ErrorState
          title="Расписание не загрузилось"
          description="Обновите страницу — если ошибка повторится, сообщите в деканат."
        />
      </section>
    );
  }
}

// ── Виды «День» и «Неделя» ────────────────────────────────────────────────────

interface DayOrWeekProps {
  ctx: DataCtx;
  activeView: 'day' | 'week';
  bounds: ReturnType<typeof semesterBounds>;
  todayKey: string;
  selectedDate: Date;
  selectedKey: string;
}

async function DayOrWeekContent({
  ctx,
  activeView,
  bounds,
  todayKey,
  selectedDate,
  selectedKey,
}: DayOrWeekProps) {
  // Окно ±2 недели вокруг выбранного дня: лента и свайп мобильного вида
  // листают его без запросов. Кламп по семестру — за границей пар нет.
  const win = weekWindow(selectedDate, 2);
  const from = win.from.getTime() < bounds.start.getTime() ? bounds.start : win.from;
  const to = win.to.getTime() > bounds.end.getTime() ? bounds.end : win.to;
  const rows = from.getTime() >= to.getTime() ? [] : await getSchedule(dataDb, ctx, { from, to });
  const byDate = groupCardsByDate(toScheduleEventCards(rows));

  const days: MobileDayView[] = win.dateKeys.map((dateKey) => {
    const dayDate = parseDateKey(dateKey);
    return {
      dateKey,
      weekdayShort: dayDate ? WEEKDAY_SHORT[weekdayOf(dayDate)] : '',
      dayNumber: Number(dateKey.slice(8, 10)),
      listLabel: dayDate ? formatDayShort(dayDate) : dateKey,
      isToday: dateKey === todayKey,
      events: byDate.get(dateKey) ?? [],
    };
  });

  const selectedEvents = byDate.get(selectedKey) ?? [];
  let nextStudy: NextStudyDayInfo | null = null;
  if (selectedEvents.length === 0) {
    const next = await getNextStudyDay(dataDb, ctx, selectedDate);
    nextStudy = next ? { dateKey: next.dateKey, label: formatDayShort(next.date) } : null;
  }

  const prev = neighborDay(selectedDate, -1, bounds);
  const next = neighborDay(selectedDate, 1, bounds);
  const dayHref = (key: string) => `/schedule?view=day&date=${key}`;

  return (
    <section data-view={activeView} className="mx-auto flex w-full max-w-[1200px] flex-col gap-4">
      <h1 className="sr-only">Расписание</h1>
      <div className="hidden justify-end md:flex">
        <ViewSwitcher platform="desktop" view={activeView} dateKey={selectedKey} />
      </div>
      <div className="md:hidden">
        <ViewSwitcher platform="mobile" view={activeView} dateKey={selectedKey} />
      </div>

      {/* Десктоп */}
      <div className="hidden md:block">
        {activeView === 'day' ? (
          <DayView
            title={formatDayTitle(selectedDate)}
            isToday={selectedKey === todayKey}
            events={selectedEvents}
            prevHref={prev ? dayHref(moscowDateKey(prev)) : null}
            nextHref={next ? dayHref(moscowDateKey(next)) : null}
            todayHref="/schedule?view=day"
            nextStudy={nextStudy}
          />
        ) : (
          <EmptyState
            title="Вид «Неделя» готовится"
            description={`Недельная сетка расписания появится в ближайшем обновлении концепта — пока доступны виды «День» и «Месяц». ${bounds.label}`}
          />
        )}
      </div>

      {/* Мобильный: лента дат + выбранный день / компактная неделя */}
      <div className="md:hidden">
        <MobileSchedule
          mode={activeView === 'week' ? 'week' : 'day'}
          days={days}
          initialDateKey={selectedKey}
          nextStudy={nextStudy}
        />
      </div>
    </section>
  );
}

// ── Вид «Месяц» ───────────────────────────────────────────────────────────────

interface MonthProps {
  ctx: DataCtx;
  now: Date;
  bounds: ReturnType<typeof semesterBounds>;
  todayKey: string;
  monthParam?: string;
  selectedKey: string;
}

async function MonthContent({ ctx, now, bounds, todayKey, monthParam, selectedKey }: MonthProps) {
  const ym = resolveSelectedMonth(monthParam, now);
  const visible = monthVisible(ym, bounds);
  const prevMonth = shiftMonth(ym, -1);
  const nextMonth = shiftMonth(ym, 1);

  let cells: ReturnType<typeof monthCellViews> = [];
  if (visible) {
    const rows = await getMonth(dataDb, ctx, { year: ym.year, month: ym.month }, now);
    cells = monthCellViews(ym, groupCardsByDate(toScheduleEventCards(rows)), todayKey);
  }

  return (
    <section data-view="month" className="mx-auto flex w-full max-w-[1200px] flex-col gap-4">
      <h1 className="sr-only">Расписание</h1>
      <div className="hidden justify-end md:flex">
        <ViewSwitcher platform="desktop" view="month" dateKey={selectedKey} />
      </div>
      <div className="md:hidden">
        <ViewSwitcher platform="mobile" view="month" dateKey={selectedKey} />
      </div>

      {visible ? (
        // Одна сетка на оба брейкпоинта: 7 колонок сжимаются до 360 px.
        <MonthView
          monthLabel={formatMonthTitle(ym.year, ym.month)}
          semesterLabel={bounds.label}
          prevHref={
            monthVisible(prevMonth, bounds)
              ? `/schedule?view=month&month=${formatMonthKey(prevMonth)}`
              : null
          }
          nextHref={
            monthVisible(nextMonth, bounds)
              ? `/schedule?view=month&month=${formatMonthKey(nextMonth)}`
              : null
          }
          cells={cells}
        />
      ) : (
        <EmptyState
          title="Сейчас вне семестра"
          description="Учебный календарь прототипа не задаёт пары за пределами семестра — расписание появится к его началу."
        />
      )}
    </section>
  );
}

// ── helpers ───────────────────────────────────────────────────────────────────

/** Индекс дня недели (0 = пн) по московской дате. */
function weekdayOf(date: Date): number {
  return moscowWeekdayIndex(date);
}

export default async function SchedulePage({ searchParams }: SchedulePageProps) {
  const params = searchParams ? await searchParams : {};
  return <ScheduleContent view={params.view} date={params.date} month={params.month} />;
}
