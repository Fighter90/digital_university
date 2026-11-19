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
import type { Metadata } from 'next';
import { Sparkles } from 'lucide-react';

import { requireDataCtx, getSession, getOrCreateCalendarSubscription } from '@/server/data';
import { dataDb } from '@/server/data/db';
import type { SessionData } from '@/server/data/session';
import { t, type Locale } from '@/lib/i18n';
import { getLocale } from '@/lib/i18n/server';

import { buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { ConsultationList } from '@/components/session/consultation-list';
import { SectionTitle } from '@/components/shell/section-title';
import { ExamTimeline } from '@/components/session/exam-timeline';
import { RetakeList } from '@/components/session/retake-list';
import { CalendarSubscribeCard } from '@/components/session/calendar-subscribe-card';

/** DIG-89 — <title> страницы по локали. */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: t(locale, 'meta.session') };
}

export default function SessionPage() {
  return <SessionContent />;
}

async function SessionContent() {
  const ctx = await requireDataCtx('/grades/session');
  const locale = await getLocale();

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
          title={t(locale, 'session.staffOnly.title')}
          description={t(locale, 'session.staffOnly.desc')}
        />
      </section>
    );
  }

  let data: SessionData;
  try {
    // DIG-93 — агрегат локализует вью по locale (шапка, статусы, имена).
    data = await getSession(dataDb, ctx, new Date(), locale);
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
          title={t(locale, 'session.error.title')}
          description={t(locale, 'session.error.desc')}
        />
        <div className="flex justify-center">
          <Link
            href="/grades/session"
            className={buttonVariants({ variant: 'secondary', size: 'sm' })}
          >
            {t(locale, 'btn.retry')}
          </Link>
        </div>
      </section>
    );
  }

  return <SessionView data={data} feedUrl={await resolveFeedUrl(ctx)} locale={locale} />;
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

function SessionView({
  data,
  feedUrl,
  locale,
}: {
  data: SessionData;
  feedUrl: string | null;
  locale: Locale;
}) {
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
          title={t(locale, 'session.empty.title')}
          description={t(locale, 'session.empty.desc')}
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
            title={t(locale, 'session.countdown.title')}
          >
            {data.countdown.label}
          </Badge>
        ) : null}
      </header>

      {/* ── Живая подписка на календарь (DIG-63) ─────────────────────────── */}
      {feedUrl ? <CalendarSubscribeCard url={feedUrl} locale={locale} /> : null}

      {/* ── Подсказка AI: подготовка к ближайшему несданному экзамену ────── */}
      {hint ? (
        <div
          data-testid="ai-hint-card"
          className="animate-rise rounded-card border border-accent-soft bg-accent-soft/60 p-4 shadow-soft"
          style={{ '--du-rise-delay': '60ms' } as React.CSSProperties}
        >
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles aria-hidden="true" className="size-4 text-accent-ink" />
            {t(locale, 'session.ai.title')}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{t(locale, 'session.ai.desc')}</p>
          <Link
            data-testid="ai-hint"
            href={`/ai-assistant?intent=exam-prep&discipline=${encodeURIComponent(hint.disciplineCode)}`}
            className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-accent-ink hover:underline"
          >
            {t(locale, 'session.ai.cta', { discipline: hint.disciplineName })}
          </Link>
        </div>
      ) : null}

      {/* ── Таймлайн экзаменов и зачётов ─────────────────────────────────── */}
      {data.exams.length > 0 ? (
        <div className="flex flex-col gap-3">
          <h2 className="text-base font-extrabold tracking-heading">
            {t(locale, 'session.exams.title')}
          </h2>
          <ExamTimeline exams={data.exams} locale={locale} />
        </div>
      ) : null}

      {/* ── Пересдачи: запись в один клик ────────────────────────────────── */}
      {data.retakes.length > 0 ? <RetakeList retakes={data.retakes} locale={locale} /> : null}

      {/* ── Консультации перед экзаменами ────────────────────────────────── */}
      {data.consultations.length > 0 ? (
        <ConsultationList consultations={data.consultations} locale={locale} />
      ) : null}
    </section>
  );
}
