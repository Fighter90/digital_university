// DIG-48 — «Сводка деканата» (/staff): заявок сегодня, среднее время ответа,
// просрочено по SLA, счётчики открытых статусов и открытых обращений.
// Данные — заявки и обращения студентов ФАКУЛЬТЕТА сессии (staff-workflow),
// агрегаты — чистая функция staff-summary.
// DIG-89 — интерфейс по локали (cookie du-locale): RU — байт-в-байт прежний.
import Link from 'next/link';
import { AlertTriangle, Clock, Inbox, FileInput } from 'lucide-react';

import { getStaffSummaryData, requireDataCtx } from '@/server/data';
import { dataDb } from '@/server/data/db';
import { computeStaffSummary, type StaffSummary } from '@/lib/staff-summary';
import { localizedFaculty } from '@/lib/en-demo-content';
import { SectionTitle } from '@/components/shell/section-title';
import { t, type Locale } from '@/lib/i18n';
import { getLocale } from '@/lib/i18n/server';

/** DIG-89 — <title> страницы по локали. */
export async function generateMetadata() {
  return { title: t(await getLocale(), 'title.staffDashboard') };
}

function formatAvgHours(hours: number | null, locale: Locale): string {
  if (hours === null) return '—';
  if (hours < 1) return t(locale, 'staff.home.lessThanHour');
  return t(locale, 'staff.home.hours', { hours: Math.round(hours) });
}

function MetricCard({
  testId,
  label,
  value,
  hint,
  href,
  tone,
  icon: Icon,
}: {
  testId: string;
  label: string;
  value: string;
  hint: string;
  href?: string;
  tone: string;
  icon: typeof Clock;
}) {
  const body = (
    <>
      <span className={`flex size-9 items-center justify-center rounded-xl ${tone}`}>
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-xs text-neutral-500">{label}</span>
        <span className="block text-2xl font-bold text-neutral-900">{value}</span>
        <span className="mt-0.5 block text-xs text-neutral-500">{hint}</span>
      </span>
    </>
  );
  const cls =
    'flex items-center gap-3 rounded-2xl border border-neutral-200 bg-card p-4 shadow-soft transition-colors';
  return href ? (
    <Link
      href={href}
      data-testid={testId}
      className={`${cls} hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-coral-600`}
    >
      {body}
    </Link>
  ) : (
    <div data-testid={testId} className={cls}>
      {body}
    </div>
  );
}

export default async function StaffSummaryPage() {
  const [ctx, locale] = await Promise.all([requireDataCtx('/staff'), getLocale()]);
  const { now, ...data } = await getStaffSummaryData(dataDb, ctx);
  const summary: StaffSummary = computeStaffSummary({ ...data, now });

  return (
    <div>
      <SectionTitle href="/staff" className="text-xl font-bold text-neutral-900 sm:text-2xl" />
      <p className="mb-6 mt-1 text-sm text-neutral-600">
        {t(locale, 'staff.home.subtitle', {
          faculty: localizedFaculty(locale, ctx.faculty),
        })}
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          testId="staff-metric-today"
          label={t(locale, 'staff.home.todayRequests')}
          value={String(summary.todayCount)}
          hint={t(locale, 'staff.home.todayHint')}
          href="/staff/requests"
          tone="bg-coral-50 text-coral-700"
          icon={FileInput}
        />
        <MetricCard
          testId="staff-metric-avg"
          label={t(locale, 'staff.home.avgResponse')}
          value={formatAvgHours(summary.avgResponseHours, locale)}
          hint={t(locale, 'staff.home.avgHint')}
          tone="bg-blue-50 text-blue-700"
          icon={Clock}
        />
        <MetricCard
          testId="staff-metric-overdue"
          label={t(locale, 'staff.home.overdue')}
          value={String(summary.overdueCount)}
          hint={t(locale, 'staff.home.overdueHint')}
          href="/staff/requests?due=overdue"
          tone="bg-red-50 text-red-700"
          icon={AlertTriangle}
        />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-neutral-200 bg-card p-4">
          <h2 className="text-sm font-bold text-neutral-900">
            {t(locale, 'staff.home.requests.title')}
          </h2>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-neutral-600">
            <li className="flex justify-between">
              <span>{t(locale, 'staff.home.requests.submitted')}</span>
              <span className="font-semibold text-neutral-900">
                <Link href="/staff/requests" className="hover:text-coral-700">
                  {summary.submittedCount}
                </Link>
              </span>
            </li>
            <li className="flex justify-between">
              <span>{t(locale, 'staff.home.requests.inProgress')}</span>
              <span className="font-semibold text-neutral-900">
                <Link href="/staff/requests" className="hover:text-coral-700">
                  {summary.inProgressCount}
                </Link>
              </span>
            </li>
            <li className="flex justify-between">
              <span>{t(locale, 'staff.home.requests.needsRevision')}</span>
              <span className="font-semibold text-neutral-900">
                <Link href="/staff/requests" className="hover:text-coral-700">
                  {summary.needsRevisionCount}
                </Link>
              </span>
            </li>
            <li className="flex justify-between border-t border-neutral-100 pt-1">
              <span>{t(locale, 'staff.home.requests.total')}</span>
              <span className="font-semibold text-neutral-900">{summary.totalOpenCount}</span>
            </li>
          </ul>
        </div>

        <Link
          href="/staff/appeals"
          data-testid="staff-appeals-card"
          className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-card p-4 shadow-soft transition-colors hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-coral-600"
        >
          <span className="flex size-9 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
            <Inbox className="size-5" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-neutral-900">
              {t(locale, 'staff.home.appeals.title')}
            </span>
            <span className="block text-2xl font-bold text-neutral-900">
              {summary.openAppealsCount}
            </span>
            <span className="block text-xs text-neutral-500">
              {t(locale, 'staff.home.appeals.subtitle')}
            </span>
          </span>
        </Link>
      </div>

      {summary.totalOpenCount === 0 && (
        <div className="mt-6 rounded-2xl border border-dashed border-neutral-300 p-8 text-center">
          <p className="text-sm font-medium text-neutral-900">
            {t(locale, 'staff.home.queue.empty.title')}
          </p>
          <p className="mt-1 text-sm text-neutral-600">{t(locale, 'staff.home.queue.empty.desc')}</p>
        </div>
      )}
    </div>
  );
}
