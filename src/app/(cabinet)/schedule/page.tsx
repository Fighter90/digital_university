// DIG-23 — страница «Расписание»: виды «День», «Неделя» (недельная сетка
// DIG-22), «Месяц» и мобильный вид с лентой дат (< 768 px, Figma «03/04»
// и вариант 360 px).
//
// Данные читает только сервер: контекст из живой сессии (requireDataCtx),
// id из URL не влияет на скоуп (пары всегда группы студента) — IDOR
// невозможен по построению. Параметры ?view / ?date / ?week / ?month
// разбираются в src/lib/schedule-cards.ts и resolveWeekPage: мусор
// откатывается к дефолтам, листание клампится по границам семестра.
//
// Дефолт без ?view= — платформозависимый (data-view="auto"): десктоп
// открывает недельную сетку DIG-22, мобильный — «сегодня» с лентой дат.
// Один запрос getSchedule окном ±2 недели кормит и десктопный вид, и
// мобильную ленту со свайпом (без запросов при листании дней).
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { DayView, type NextStudyDayInfo } from '@/components/schedule/day-view';
import { MonthView } from '@/components/schedule/month-view';
import { MobileSchedule, type MobileDayView } from '@/components/schedule/mobile-schedule';
import { ViewSwitcher } from '@/components/schedule/view-switcher';
import { WeekView, type WeekDayColumnData } from '@/components/schedule/week-view';
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
  type ScheduleView,
} from '@/lib/schedule-cards';
import {
  FILTER_KIND_ORDER,
  isoWeekKeyOf,
  miniCalendarCells,
  resolveWeekPage,
  toScheduleEventViews,
  WEEKDAY_SHORT as WEEKDAY_SHORT_VIEW,
} from '@/lib/schedule-view';
import { moscowDateKey, moscowParts, moscowWeekdayIndex, semesterBounds } from '@/lib/schedule-time';
import { dataDb } from '@/server/data/db';
import { getMonth, getNextStudyDay, getSchedule, requireDataCtx } from '@/server/data';

export const metadata = { title: 'Расписание — Цифровой деканат' };

interface SchedulePageProps {
  /** Next 15 передаёт промис; рендер без пропсов (юнит-прендер) тоже валиден. */
  searchParams?: Promise<{ view?: string; date?: string; week?: string; month?: string }>;
}

type Bounds = ReturnType<typeof semesterBounds>;

async function ScheduleContent({
  view,
  date,
  week,
  month,
}: {
  view?: string;
  date?: string;
  week?: string;
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
  // Дефолт без ?view=: десктоп — неделя (DIG-22), мобильный — «сегодня».
  const desktopView = resolveScheduleView(view, 'week');
  const mobileView = resolveScheduleView(view, 'day');

  try {
    if (desktopView === 'month') {
      return await MonthContent({ ctx, now, bounds, todayKey, monthParam: month });
    }
    return await DayWeekContent({
      ctx,
      now,
      bounds,
      todayKey,
      dateParam: date,
      weekParam: week,
      desktopView,
      mobileView,
    });
  } catch (error) {
    // не глотаем: без лога «Расписание не загрузилось» недиагностируемо
    console.error('[schedule] render failed', error);
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

// ── Виды «День» и «Неделя» + мобильная лента ──────────────────────────────────

interface DayWeekProps {
  ctx: Awaited<ReturnType<typeof requireDataCtx>>;
  now: Date;
  bounds: Bounds;
  todayKey: string;
  dateParam?: string;
  weekParam?: string;
  /** «Месяц» сюда не доходит: его ветка обрабатывается раньше (MonthContent). */
  desktopView: ScheduleView;
  mobileView: ScheduleView;
}

async function DayWeekContent({
  ctx,
  now,
  bounds,
  todayKey,
  dateParam,
  weekParam,
  desktopView,
  mobileView,
}: DayWeekProps) {
  // Страховка типов: ветка «месяца» уже отработала в ScheduleContent.
  const desktopMode: 'day' | 'week' = desktopView === 'week' ? 'week' : 'day';
  const mobileMode: 'day' | 'week' = mobileView === 'week' ? 'week' : 'day';
  // Недельная страница нужна виду «неделя» (десктоп и мобильный компакт).
  const weekPage =
    desktopMode === 'week' || mobileMode === 'week' ? resolveWeekPage(weekParam, now) : null;

  // Фокус дня: ?date, иначе «сегодня»; если открытая неделя не содержит
  // сегодня — её понедельник (лента и неделя остаются согласованы).
  const parsedDate = parseDateKey(dateParam);
  const selectedDate =
    parsedDate ??
    (weekPage && !weekPage.isCurrent ? weekPage.from : resolveSelectedDate(undefined, now));
  const selectedKey = moscowDateKey(selectedDate);

  // Окно ±2 недели вокруг фокуса (+ диапазон недели вида «неделя»):
  // один запрос слоя данных на все части экрана.
  const win = weekWindow(selectedDate, 2);
  let from = win.from.getTime() < bounds.start.getTime() ? bounds.start : win.from;
  let to = win.to.getTime() > bounds.end.getTime() ? bounds.end : win.to;
  if (weekPage) {
    if (weekPage.from.getTime() < from.getTime()) from = weekPage.from;
    if (weekPage.to.getTime() > to.getTime()) to = weekPage.to;
  }
  const rows = from.getTime() >= to.getTime() ? [] : await getSchedule(dataDb, ctx, { from, to });
  const cards = toScheduleEventCards(rows);
  const byDate = groupCardsByDate(cards);
  const views = toScheduleEventViews(rows);

  // Мобильная лента: 35 дней окна, свайп и выбор дня — без сети.
  const mobileDays: MobileDayView[] = win.dateKeys.map((dateKey) => {
    const dayDate = parseDateKey(dateKey);
    return {
      dateKey,
      weekdayShort: dayDate ? WEEKDAY_SHORT[moscowWeekdayIndex(dayDate)] : '',
      dayNumber: Number(dateKey.slice(8, 10)),
      listLabel: dayDate ? formatDayShort(dayDate) : dateKey,
      isToday: dateKey === todayKey,
      events: byDate.get(dateKey) ?? [],
    };
  });

  const selectedEvents = byDate.get(selectedKey) ?? [];
  // «Ближайшие пары: …» нужен только пустому дню вида «день».
  let nextStudy: NextStudyDayInfo | null = null;
  if ((desktopMode === 'day' || mobileMode === 'day') && selectedEvents.length === 0) {
    const next = await getNextStudyDay(dataDb, ctx, selectedDate);
    nextStudy = next ? { dateKey: next.dateKey, label: formatDayShort(next.date) } : null;
  }

  // Колонки недельной сетки DIG-22.
  let weekDays: WeekDayColumnData[] | null = null;
  let kindCounts: Array<{ kind: (typeof FILTER_KIND_ORDER)[number]; count: number }> = [];
  let teachers: string[] = [];
  if (weekPage) {
    weekDays = weekPage.days.map((day) => {
      const dateKey = moscowDateKey(day);
      return {
        dateKey,
        weekdayShort: WEEKDAY_SHORT_VIEW[moscowWeekdayIndex(day)],
        dayNumber: moscowParts(day).day,
        isToday: dateKey === todayKey,
        events: views.filter((item) => item.dateKey === dateKey),
      };
    });
    kindCounts = FILTER_KIND_ORDER.map((kind) => ({
      kind,
      count: views.filter((item) => item.kind === kind).length,
    }));
    teachers = [...new Set(views.map((item) => item.teacher))].sort((a, b) =>
      a.localeCompare(b, 'ru'),
    );
  }

  const prev = neighborDay(selectedDate, -1, bounds);
  const next = neighborDay(selectedDate, 1, bounds);
  const dayHref = (key: string) => `/schedule?view=day&date=${key}`;
  const autoView = desktopView !== mobileView;

  return (
    <section
      data-view={autoView ? 'auto' : desktopView}
      className="mx-auto flex w-full max-w-[1200px] flex-col gap-4"
    >
      <h1 className="sr-only">Расписание</h1>

      {/* ── Десктоп (>= 768 px) ─────────────────────────────────────────── */}
      <div className="hidden md:block">
        {desktopMode === 'week' ? (
          weekPage && weekDays ? (
            <WeekView
              weekKey={weekPage.weekKey}
              weekLabel={weekPage.weekLabel}
              semesterLabel={weekPage.semesterLabel}
              prevWeekKey={weekPage.prevWeekKey}
              nextWeekKey={weekPage.nextWeekKey}
              todayWeekKey={isoWeekKeyOf(now)}
              todayKey={todayKey}
              days={weekDays}
              mini={miniCalendarCells(weekPage.from)}
              kindCounts={kindCounts}
              teachers={teachers}
            />
          ) : (
            <OutOfSemester />
          )
        ) : (
          <>
            <div className="mb-4 flex justify-end">
              <ViewSwitcher view={desktopMode} platform="desktop" />
            </div>
            <DayView
              title={formatDayTitle(selectedDate)}
              isToday={selectedKey === todayKey}
              events={selectedEvents}
              prevHref={prev ? dayHref(moscowDateKey(prev)) : null}
              nextHref={next ? dayHref(moscowDateKey(next)) : null}
              todayHref="/schedule?view=day"
              nextStudy={nextStudy}
            />
          </>
        )}
      </div>

      {/* ── Мобильный (< 768 px): лента дат + выбранный день / компактная неделя ── */}
      <div className="md:hidden">
        <div className="mb-3">
          <ViewSwitcher view={mobileMode} platform="mobile" />
        </div>
        {mobileMode === 'week' && !(weekPage && weekDays) ? (
          <OutOfSemester />
        ) : (
          <MobileSchedule
            mode={mobileMode}
            days={mobileDays}
            initialDateKey={selectedKey}
            nextStudy={nextStudy}
          />
        )}
      </div>
    </section>
  );
}

// ── Вид «Месяц» ───────────────────────────────────────────────────────────────

interface MonthProps {
  ctx: Awaited<ReturnType<typeof requireDataCtx>>;
  now: Date;
  bounds: Bounds;
  todayKey: string;
  monthParam?: string;
}

async function MonthContent({ ctx, now, bounds, todayKey, monthParam }: MonthProps) {
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
        <ViewSwitcher view="month" platform="desktop" />
      </div>
      <div className="mb-1 md:hidden">
        <ViewSwitcher view="month" platform="mobile" />
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
        <OutOfSemester />
      )}
    </section>
  );
}

/** Вне семестра пар нет: учебный календарь прототипа их не задаёт. */
function OutOfSemester() {
  return (
    <EmptyState
      title="Сейчас вне семестра"
      description="Учебный календарь прототипа не задаёт пары за пределами семестра — расписание появится к его началу."
    />
  );
}

export default async function SchedulePage({ searchParams }: SchedulePageProps) {
  const params = searchParams ? await searchParams : {};
  return <ScheduleContent view={params.view} date={params.date} week={params.week} month={params.month} />;
}
