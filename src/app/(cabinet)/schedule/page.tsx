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
  weekdayShortLabels,
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
import {
  moscowDateKey,
  moscowParts,
  moscowWeekdayIndex,
  semesterBounds,
} from '@/lib/schedule-time';
import { dataDb } from '@/server/data/db';
import {
  getMonth,
  getNextStudyDay,
  getOwnSettings,
  getSchedule,
  requireDataCtx,
  getEventDetails,
} from '@/server/data';
import { EventDetailsPanel } from '@/components/schedule/event-details-panel';
import { ScheduleExportBlock } from '@/components/schedule/schedule-export-block';
import { SectionTitle } from '@/components/shell/section-title';
import { toEventDetailsView } from '@/lib/event-details';
import { t } from '@/lib/i18n';
import { getLocale } from '@/lib/i18n/server';

// DIG-87 — EN-локализация часть 1: страница /schedule строит вью-модели
// (карточки пар, подписи дат, недели и семестра) по локали cookie du-locale;
// RU — байт-в-байт прежние строки.

export async function generateMetadata() {
  const locale = await getLocale();
  return { title: `${t(locale, 'title.schedule')} — ${t(locale, 'shell.brandName')}` };
}

interface SchedulePageProps {
  /** Next 15 передаёт промис; рендер без пропсов (юнит-прендер) тоже валиден. */
  searchParams?: Promise<{
    view?: string;
    date?: string;
    week?: string;
    month?: string;
    event?: string;
  }>;
}

type Bounds = ReturnType<typeof semesterBounds>;

async function ScheduleContent({
  view,
  date,
  week,
  month,
  event,
}: {
  view?: string;
  date?: string;
  week?: string;
  month?: string;
  event?: string;
}) {
  const [ctx, locale] = await Promise.all([requireDataCtx('/schedule'), getLocale()] as const);

  // Query текущего URL без «?» — контекст для переключателя видов и листания
  // недель. Передаётся пропсами (сервер его уже распарсил): клиентские
  // useSearchParams без Suspense-границы подвешивают soft-навигацию.
  const currentQuery = new URLSearchParams(
    Object.entries({ view, date, week, month }).filter((entry): entry is [string, string] =>
      Boolean(entry[1]),
    ),
  ).toString();

  // Сотрудник деканата без группы: студенческое расписание ему не положено
  // (чтение групповых данных попадает в аудит) — явная заглушка.
  if (ctx.role === 'STAFF') {
    return (
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-6 py-6 md:py-8">
        <SectionTitle href="/schedule" className="text-xl font-bold tracking-heading sm:text-2xl" />
        <EmptyState
          title={t(locale, 'schedule.staff.title')}
          description={t(locale, 'schedule.staff.desc')}
        />
      </section>
    );
  }

  const now = new Date();
  const bounds = semesterBounds(now, locale);
  const todayKey = moscowDateKey(now);
  // Дефолт без ?view=: десктоп — неделя (DIG-22), мобильный — «сегодня».
  const desktopView = resolveScheduleView(view, 'week');
  const mobileView = resolveScheduleView(view, 'day');

  try {
    // DIG-65 — «Озвучка и голосовой ввод» (voiceAssistant) читается только
    // для студента: сотрудник уходит раньше (ветка STAFF), поэтому аудит
    // denyAccess не засоряется. Сбой слоя данных падает в общий catch.
    const settings = ctx.role === 'STUDENT' ? await getOwnSettings(dataDb, ctx) : null;
    const voiceEnabled = settings?.voiceAssistant ?? true;
    if (desktopView === 'month') {
      return await MonthContent({
        ctx,
        now,
        bounds,
        todayKey,
        monthParam: month,
        currentQuery,
        locale,
      });
    }
    return await DayWeekContent({
      ctx,
      now,
      event,
      bounds,
      todayKey,
      viewParam: view,
      dateParam: date,
      weekParam: week,
      desktopView,
      mobileView,
      currentQuery,
      voiceEnabled,
      locale,
    });
  } catch (error) {
    // не глотаем: без лога «Расписание не загрузилось» недиагностируемо
    console.error('[schedule] render failed', error);
    return (
      <section className="mx-auto flex w-full max-w-3xl flex-col py-6 md:py-8">
        <ErrorState
          title={t(locale, 'schedule.error.title')}
          description={t(locale, 'schedule.error.desc')}
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
  /** Сырой ?view= из URL: «week» означает, что листание недель сохраняет вид. */
  viewParam?: string;
  dateParam?: string;
  weekParam?: string;
  /** «Месяц» сюда не доходит: его ветка обрабатывается раньше (MonthContent). */
  desktopView: ScheduleView;
  mobileView: ScheduleView;
  /** Query URL для ViewSwitcher/WeekView (см. ScheduleContent). */
  currentQuery: string;
  /** DIG-24 — ?event=<id> пары, детали которой открываются панелью. */
  event?: string;
  /** DIG-65 — настройка «Озвучка и голосовой ввод» владельца сессии. */
  voiceEnabled: boolean;
  /** DIG-87 — локаль интерфейса (cookie du-locale, дефолт ru). */
  locale: Awaited<ReturnType<typeof getLocale>>;
}

async function DayWeekContent({
  ctx,
  now,
  event,
  bounds,
  todayKey,
  viewParam,
  dateParam,
  weekParam,
  desktopView,
  mobileView,
  currentQuery,
  voiceEnabled,
  locale,
}: DayWeekProps) {
  // Страховка типов: ветка «месяца» уже отработала в ScheduleContent.
  const desktopMode: 'day' | 'week' = desktopView === 'week' ? 'week' : 'day';
  const mobileMode: 'day' | 'week' = mobileView === 'week' ? 'week' : 'day';
  // Недельная страница нужна виду «неделя» (десктоп и мобильный компакт).
  const weekPage =
    desktopMode === 'week' || mobileMode === 'week'
      ? resolveWeekPage(weekParam, now, locale)
      : null;

  // Фокус дня: ?date, иначе «сегодня»; если открытая неделя не содержит
  // сегодня — её понедельник (лента и неделя остаются согласованы).
  const parsedDate = parseDateKey(dateParam);
  const selectedDate =
    parsedDate ??
    (weekPage && !weekPage.isCurrent ? weekPage.from : resolveSelectedDate(undefined, now));
  const selectedKey = moscowDateKey(selectedDate);

  // DIG-24 — детали пары для панели (?event=<id>); чужая группа/сотрудник — null.
  const details =
    ctx.role === 'STUDENT' && event ? await getEventDetails(dataDb, ctx, event) : null;

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
  const cards = toScheduleEventCards(rows, locale);
  const byDate = groupCardsByDate(cards);
  const views = toScheduleEventViews(rows, locale);

  // Мобильная лента: 35 дней окна, свайп и выбор дня — без сети.
  const mobileDays: MobileDayView[] = win.dateKeys.map((dateKey) => {
    const dayDate = parseDateKey(dateKey);
    return {
      dateKey,
      weekdayShort: dayDate ? (weekdayShortLabels(locale)[moscowWeekdayIndex(dayDate)] ?? '') : '',
      dayNumber: Number(dateKey.slice(8, 10)),
      listLabel: dayDate ? formatDayShort(dayDate, locale) : dateKey,
      isToday: dateKey === todayKey,
      events: byDate.get(dateKey) ?? [],
    };
  });

  const selectedEvents = byDate.get(selectedKey) ?? [];
  // «Ближайшие пары: …» нужен только пустому дню вида «день».
  let nextStudy: NextStudyDayInfo | null = null;
  if ((desktopMode === 'day' || mobileMode === 'day') && selectedEvents.length === 0) {
    const next = await getNextStudyDay(dataDb, ctx, selectedDate);
    nextStudy = next ? { dateKey: next.dateKey, label: formatDayShort(next.date, locale) } : null;
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
      <SectionTitle href="/schedule" className="sr-only" />

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
              mini={miniCalendarCells(weekPage.from, locale)}
              kindCounts={kindCounts}
              teachers={teachers}
              currentQuery={currentQuery}
              keepViewParam={viewParam === 'week'}
              locale={locale}
            />
          ) : (
            <OutOfSemester locale={locale} />
          )
        ) : (
          <>
            <div className="mb-4 flex justify-end">
              <ViewSwitcher
                view={desktopMode}
                platform="desktop"
                currentQuery={currentQuery}
                todayKey={todayKey}
                locale={locale}
              />
            </div>
            <DayView
              title={formatDayTitle(selectedDate, locale)}
              isToday={selectedKey === todayKey}
              events={selectedEvents}
              prevHref={prev ? dayHref(moscowDateKey(prev)) : null}
              nextHref={next ? dayHref(moscowDateKey(next)) : null}
              todayHref="/schedule?view=day"
              nextStudy={nextStudy}
              voiceEnabled={voiceEnabled}
              eventQuery={currentQuery}
              locale={locale}
            />
          </>
        )}
      </div>

      {/* ── Мобильный (< 768 px): лента дат + выбранный день / компактная неделя ── */}
      <div className="md:hidden">
        <div className="mb-3">
          <ViewSwitcher
            view={mobileMode}
            platform="mobile"
            currentQuery={currentQuery}
            todayKey={todayKey}
            locale={locale}
          />
        </div>
        {mobileMode === 'week' && !(weekPage && weekDays) ? (
          <OutOfSemester locale={locale} />
        ) : (
          <MobileSchedule
            mode={mobileMode}
            days={mobileDays}
            initialDateKey={selectedKey}
            nextStudy={nextStudy}
            voiceEnabled={voiceEnabled}
            eventQuery={currentQuery}
            locale={locale}
          />
        )}
      </div>

      {/* DIG-101 — «Экспорт» (MD/XLSX/PDF) только для видов день/неделя: файл
          повторяет то, что видно на экране (вид и дата из URL). */}
      <ScheduleExportBlock view={desktopMode} dateKey={selectedKey} locale={locale} />

      {event && details ? (
        <EventDetailsPanel
          view={toEventDetailsView(details.event, locale)}
          note={details.note?.text ?? null}
          closeHref={currentQuery ? `/schedule?${currentQuery}` : '/schedule'}
          locale={locale}
        />
      ) : null}
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
  /** Query URL для ViewSwitcher (см. ScheduleContent). */
  currentQuery: string;
  /** DIG-87 — локаль интерфейса (cookie du-locale, дефолт ru). */
  locale: Awaited<ReturnType<typeof getLocale>>;
}

async function MonthContent({
  ctx,
  now,
  bounds,
  todayKey,
  monthParam,
  currentQuery,
  locale,
}: MonthProps) {
  const ym = resolveSelectedMonth(monthParam, now);
  const visible = monthVisible(ym, bounds);
  const prevMonth = shiftMonth(ym, -1);
  const nextMonth = shiftMonth(ym, 1);

  let cells: ReturnType<typeof monthCellViews> = [];
  if (visible) {
    const rows = await getMonth(dataDb, ctx, { year: ym.year, month: ym.month }, now);
    cells = monthCellViews(ym, groupCardsByDate(toScheduleEventCards(rows, locale)), todayKey);
  }

  return (
    <section data-view="month" className="mx-auto flex w-full max-w-[1200px] flex-col gap-4">
      <SectionTitle href="/schedule" className="sr-only" />
      <div className="hidden justify-end md:flex">
        <ViewSwitcher
          view="month"
          platform="desktop"
          currentQuery={currentQuery}
          todayKey={todayKey}
          locale={locale}
        />
      </div>
      <div className="mb-1 md:hidden">
        <ViewSwitcher
          view="month"
          platform="mobile"
          currentQuery={currentQuery}
          todayKey={todayKey}
          locale={locale}
        />
      </div>

      {visible ? (
        // Одна сетка на оба брейкпоинта: 7 колонок сжимаются до 360 px.
        <MonthView
          monthLabel={formatMonthTitle(ym.year, ym.month, locale)}
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
          locale={locale}
        />
      ) : (
        <OutOfSemester locale={locale} />
      )}
    </section>
  );
}

/** Вне семестра пар нет: учебный календарь прототипа их не задаёт. */
function OutOfSemester({ locale = 'ru' }: { locale?: Awaited<ReturnType<typeof getLocale>> }) {
  return (
    <EmptyState
      title={t(locale, 'schedule.outOfSemester.title')}
      description={t(locale, 'schedule.outOfSemester.desc')}
    />
  );
}

export default async function SchedulePage({ searchParams }: SchedulePageProps) {
  const params = searchParams ? await searchParams : {};
  return (
    <ScheduleContent
      view={params.view}
      date={params.date}
      week={params.week}
      month={params.month}
      event={params.event}
    />
  );
}
