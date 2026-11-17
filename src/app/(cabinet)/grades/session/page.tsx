// DIG-28 — экран «Сессия» (Figma «05 · Успеваемость — сессия», 1440 + 360 px).
//
// Данные приходят ОДНИМ серверным агрегатом getSession(dataDb, ctx):
// контекст строится из живой сессии (requireDataCtx), контрольные и
// консультации скоуплены ctx.groupName, персональные статусы — ctx.studentId;
// из URL скоуп не приходит (IDOR невозможен по построению).
//
// Состав экрана: шапка с сезоном и диапазоном (выводятся из дат сессии,
// без хардкода), обратный отсчёт до первого экзамена, живая ICS-подписка
// календаря (DIG-63: расписание + дедлайны по персональной подписанной
// ссылке), таймлайн экзаменов/зачётов со статусами допуска,
// блок пересдач с записью (заявка + уведомление), консультации из
// расписания и подсказка AI по ближайшему несданному экзамену.
import Link from 'next/link';
import { headers } from 'next/headers';
import { Sparkles } from 'lucide-react';

import { requireDataCtx, getSession, getOrCreateCalendarSubscription } from '@/server/data';
import { dataDb } from '@/server/data/db';
import type { SessionData } from '@/server/data/session';

import { buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { ConsultationList } from '@/components/session/consultation-list';
import { SectionTitle } from '@/components/shell/section-title';
import { ExamTimeline } from '@/components/session/exam-timeline';
import { RetakeList } from '@/components/session/retake-list';
import { CalendarSubscribeCard } from '@/components/session/calendar-subscribe-card';

export const metadata = { title: 'Сессия — Цифровой деканат' };

export default function SessionPage() {
  return <SessionContent />;
}

async function SessionContent() {
  const ctx = await requireDataCtx('/grades/session');

  // Сотрудник деканата без studentId: сессия студента ему не показывается —
  // явная заглушка (тот же контракт, что на «Успеваемости»).
  if (ctx.role === 'STAFF') {
    return (
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 md:py-8">
        <SectionTitle
          href="/grades/session"
          className="text-xl font-bold tracking-heading sm:text-2xl"
        />
        <EmptyState
          title="Экран доступен студентам"
          description="Расписание сессии, допуски и пересдачи показываются по учебной группе студента. Кабинет сотрудника с ведомостями — отдельная задача."
        />
      </section>
    );
  }

  let data: SessionData;
  try {
    data = await getSession(dataDb, ctx);
  } catch (error) {
    // не глотаем: без лога «Сессия не загрузилась» недиагностируемо
    console.error('[session] render failed', error);
    return (
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6 md:py-8">
        <SectionTitle
          href="/grades/session"
          className="text-xl font-bold tracking-heading sm:text-2xl"
        />
        <ErrorState
          title="Сессия не загрузилась"
          description="Обновите страницу — если ошибка повторится, сообщите в деканат."
        />
        <div className="flex justify-center">
          <Link
            href="/grades/session"
            className={buttonVariants({ variant: 'secondary', size: 'sm' })}
          >
            Повторить
          </Link>
        </div>
      </section>
    );
  }

  return <SessionView data={data} feedUrl={await resolveFeedUrl(ctx)} />;
}

/**
 * DIG-63 — абсолютный URL живой ICS-подписки студента. Подписка одна
 * (стабильна между визитами), ссылка подписана HMAC-секретом сервера;
 * origin собирается из заголовков прокси (Caddy ставит x-forwarded-proto).
 * null — подписка не выдана (нет секрета) — карточка просто не рисуется.
 */
async function resolveFeedUrl(
  ctx: Awaited<ReturnType<typeof requireDataCtx>>,
): Promise<string | null> {
  let subscription: Awaited<ReturnType<typeof getOrCreateCalendarSubscription>>;
  try {
    subscription = await getOrCreateCalendarSubscription(dataDb, ctx);
  } catch (error) {
    // Подписка не критична экрану: сбой не должен ронять «Сессию».
    console.error('[session] calendar subscription failed', error);
    return null;
  }
  if (!subscription) return null;
  const headerList = await headers();
  const host = headerList.get('host');
  if (!host) return null;
  const proto =
    headerList.get('x-forwarded-proto') ??
    (/^(localhost|127\.0\.0\.1|\[::1\])(:|$)/.test(host) ? 'http' : 'https');
  return `${proto}://${host}/api/calendar/ics?token=${encodeURIComponent(subscription.token)}`;
}

/** Ближайший несданный экзамен — дисциплина для подсказки AI. */
function aiHintDiscipline(data: SessionData): SessionData['exams'][number] | null {
  return data.exams.find((exam) => exam.status !== 'PASSED') ?? data.exams[0] ?? null;
}

function SessionView({ data, feedUrl }: { data: SessionData; feedUrl: string | null }) {
  const hint = aiHintDiscipline(data);
  const isEmpty =
    data.exams.length === 0 && data.retakes.length === 0 && data.consultations.length === 0;

  if (isEmpty) {
    return (
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 md:py-8">
        <SectionTitle
          href="/grades/session"
          className="text-xl font-bold tracking-heading sm:text-2xl"
        />
        <EmptyState
          title="Сессия не запланирована"
          description="Экзамены, зачёты и консультации появятся здесь, когда деканат опубликует расписание сессии."
        />
      </section>
    );
  }

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 md:py-8">
      {/* ── Шапка: сезон · диапазон, отсчёт ───────────────────────────────── */}
      <header className="flex animate-rise flex-col gap-2">
        <SectionTitle
          href="/grades/session"
          className="text-xl font-bold tracking-heading sm:text-2xl"
        />
        <p
          data-testid="session-title"
          className="flex flex-wrap items-baseline gap-x-2 text-sm text-muted-foreground"
        >
          <span className="font-semibold text-foreground">{data.seasonTitle}</span>
          {data.rangeLabel ? <span>· {data.rangeLabel}</span> : null}
        </p>
        {data.countdown ? (
          <Badge
            data-testid="session-countdown"
            status="accent"
            title="Сколько осталось до первой контрольной сессии"
          >
            {data.countdown.label}
          </Badge>
        ) : null}
      </header>

      {/* ── Живая подписка на календарь (DIG-63) ─────────────────────────── */}
      {feedUrl ? <CalendarSubscribeCard url={feedUrl} /> : null}

      {/* ── Подсказка AI: подготовка к ближайшему несданному экзамену ────── */}
      {hint ? (
        <div
          data-testid="ai-hint-card"
          className="animate-rise rounded-card border border-accent-soft bg-accent-soft/60 p-4 shadow-soft"
          style={{ '--du-rise-delay': '60ms' } as React.CSSProperties}
        >
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles aria-hidden="true" className="size-4 text-accent-ink" />
            AI-ассистент
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Составьте план подготовки заранее — ассистент соберёт темы, формулы и материалы по
            дисциплине.
          </p>
          <Link
            data-testid="ai-hint"
            href={`/ai-assistant?intent=exam-prep&discipline=${encodeURIComponent(hint.disciplineCode)}`}
            className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-accent-ink hover:underline"
          >
            Подготовиться к экзамену по «{hint.disciplineName}»
          </Link>
        </div>
      ) : null}

      {/* ── Таймлайн экзаменов и зачётов ─────────────────────────────────── */}
      {data.exams.length > 0 ? (
        <div className="flex flex-col gap-3">
          <h2 className="text-base font-extrabold tracking-heading">Экзамены и зачёты</h2>
          <ExamTimeline exams={data.exams} />
        </div>
      ) : null}

      {/* ── Пересдачи: запись в один клик ────────────────────────────────── */}
      {data.retakes.length > 0 ? <RetakeList retakes={data.retakes} /> : null}

      {/* ── Консультации перед экзаменами ────────────────────────────────── */}
      {data.consultations.length > 0 ? (
        <ConsultationList consultations={data.consultations} />
      ) : null}
    </section>
  );
}
