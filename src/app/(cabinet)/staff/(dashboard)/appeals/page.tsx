// DIG-48 — «Обращения студентов» (/staff/appeals): входящие обращения
// студентов факультета, новые сверху, с профилем владельца и активностью.
import Link from 'next/link';
import { getStaffAppeals, requireDataCtx } from '@/server/data';
import { dataDb } from '@/server/data/db';
import { formatRequestDate } from '@/lib/request-labels';
import { APPEAL_STATUS_BADGES } from '@/lib/appeal-status';
import { SectionTitle } from '@/components/shell/section-title';

export default async function StaffAppealsPage() {
  const ctx = await requireDataCtx('/staff/appeals');
  const items = await getStaffAppeals(dataDb, ctx);

  return (
    <div>
      <SectionTitle
        href="/staff/appeals"
        className="text-xl font-bold text-neutral-900 sm:text-2xl"
      />
      <p className="mb-6 mt-1 text-sm text-neutral-600">
        Факультет {ctx.faculty ?? '—'} · новые обращения сверху. Ответ виден студенту сразу.
      </p>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 p-8 text-center">
          <p className="text-sm font-medium text-neutral-900">Обращений нет</p>
          <p className="mt-1 text-sm text-neutral-600">
            Обращения студентов вашего факультета появятся здесь.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="staff-appeals-list">
          {items.map(({ appeal, student, lastAt }) => {
            const badge = APPEAL_STATUS_BADGES[appeal.status];
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
                      активность {formatRequestDate(lastAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-neutral-900">{appeal.subject}</p>
                  <p className="mt-0.5 text-xs text-neutral-600">
                    {student.fullName} · {student.groupName} · поступило{' '}
                    {formatRequestDate(appeal.createdAt)}
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
