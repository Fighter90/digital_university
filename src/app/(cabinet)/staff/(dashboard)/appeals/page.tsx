// DIG-48 — «Обращения студентов» (/staff/appeals): входящие обращения
// студентов факультета, новые сверху, с профилем владельца и активностью.
// DIG-89 — интерфейс по локали (cookie du-locale): RU — байт-в-байт прежний.
import Link from 'next/link';
import { getStaffAppeals, requireDataCtx } from '@/server/data';
import { dataDb } from '@/server/data/db';
import { formatRequestDate } from '@/lib/request-labels';
import { appealStatusBadge } from '@/lib/appeal-status';
import {
  localizedFaculty,
  localizedGroup,
  localizeAppealSubject,
  localizePersonName,
} from '@/lib/en-demo-content';
import { t } from '@/lib/i18n';
import { getLocale } from '@/lib/i18n/server';
import { SectionTitle } from '@/components/shell/section-title';

/** DIG-89 — <title> страницы по локали. */
export async function generateMetadata() {
  return { title: t(await getLocale(), 'title.staffAppeals') };
}

export default async function StaffAppealsPage() {
  const [ctx, locale] = await Promise.all([requireDataCtx('/staff/appeals'), getLocale()]);
  const items = await getStaffAppeals(dataDb, ctx);

  return (
    <div>
      <SectionTitle
        href="/staff/appeals"
        className="text-xl font-bold text-neutral-900 sm:text-2xl"
      />
      <p className="mb-6 mt-1 text-sm text-neutral-600">
        {t(locale, 'staff.appeals.subtitle', { faculty: localizedFaculty(locale, ctx.faculty) })}
      </p>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 p-8 text-center">
          <p className="text-sm font-medium text-neutral-900">
            {t(locale, 'staff.appeals.empty.title')}
          </p>
          <p className="mt-1 text-sm text-neutral-600">{t(locale, 'staff.appeals.empty.desc')}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="staff-appeals-list">
          {items.map(({ appeal, student, lastAt }) => {
            const badge = appealStatusBadge(locale, appeal.status);
            return (
              <li key={appeal.id}>
                <Link
                  href={`/staff/appeals/${appeal.id}`}
                  className="block rounded-2xl border border-neutral-200 bg-card p-4 transition-colors hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-coral-600"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center rounded-pill border px-2 py-0.5 text-[11px] font-semibold ${badge.cls}`}
                    >
                      {badge.label}
                    </span>
                    <span className="text-xs text-neutral-500">
                      {t(locale, 'staff.appeals.lastActivity', {
                        date: formatRequestDate(lastAt, locale),
                      })}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-neutral-900">
                    {localizeAppealSubject(locale, appeal)}
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-600">
                    {localizePersonName(locale, student.fullName)} ·{' '}
                    {localizedGroup(locale, student.groupName)} ·{' '}
                    {t(locale, 'staff.appeals.received')}{' '}
                    {formatRequestDate(appeal.createdAt, locale)}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
