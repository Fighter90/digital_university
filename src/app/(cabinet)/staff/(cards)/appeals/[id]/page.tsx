// DIG-48 — чат обращения сотрудника (/staff/appeals/[id]): сообщения
// студента и деканата, шаблоны ответов, «Решено». Чужой (другой факультет)
// и несуществующий id — единый 404. Закрытое обращение — только чтение.
//
// NOTE: карточка живёт в route group (cards) — на пути от корня нет ни
// одного loading.tsx, поэтому notFound() успевает выставить статус 404
// (см. (dashboard)/loading.tsx).
// DIG-89 — интерфейс по локали (cookie du-locale): RU — байт-в-байт прежний.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getStaffAppealThread, requireDataCtx } from '@/server/data';
import { dataDb } from '@/server/data/db';
import { formatRequestDate } from '@/lib/request-labels';
import { appealStatusBadge } from '@/lib/appeal-status';
import { t } from '@/lib/i18n';
import { getLocale } from '@/lib/i18n/server';
import { AppealForms } from '@/components/staff/appeal-forms';
import { cn } from '@/lib/utils';

export default async function StaffAppealThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;
  const appealId = decodeURIComponent(rawId).trim();
  const [ctx, locale] = await Promise.all([requireDataCtx(`/staff/appeals/${rawId}`), getLocale()]);

  const thread = await getStaffAppealThread(dataDb, ctx, appealId);
  if (!thread) notFound();
  const { appeal, student, messages } = thread;
  const badge = appealStatusBadge(locale, appeal.status);

  return (
    <div>
      <Link
        href="/staff/appeals"
        className="mb-4 inline-block text-sm text-neutral-600 hover:text-neutral-900"
      >
        {t(locale, 'staff.appealChat.backAll')}
      </Link>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h1 className="text-xl font-bold text-neutral-900 sm:text-2xl">{appeal.subject}</h1>
        <span
          data-testid="appeal-status-badge"
          className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${badge.cls}`}
        >
          {badge.label}
        </span>
      </div>
      <p className="mb-6 text-sm text-neutral-600">
        {student.fullName} · {student.groupName} ·{' '}
        {t(locale, 'staff.appealChat.received', {
          date: formatRequestDate(appeal.createdAt, locale),
        })}
      </p>

      {/* Чат: сообщения студента слева, ответы деканата справа. */}
      <ol
        className="mb-4 flex flex-col gap-2"
        data-testid="appeal-chat"
        aria-label={t(locale, 'staff.appealChat.aria')}
      >
        {messages.map((message) => {
          const isStaff = message.authorRole === 'STAFF';
          return (
            <li
              key={message.id}
              className={cn(
                'max-w-[85%] rounded-2xl border p-3 text-sm sm:max-w-[75%]',
                isStaff
                  ? 'self-end border-coral-200 bg-coral-50 text-neutral-900'
                  : 'self-start border-neutral-200 bg-card text-neutral-800',
              )}
            >
              <div className="mb-1 flex items-center justify-between gap-3 text-[11px] text-neutral-500">
                <span className="font-semibold text-neutral-700">
                  {message.authorName}
                  {isStaff ? t(locale, 'staff.appealChat.deanery') : ''}
                </span>
                <span>{formatRequestDate(message.createdAt, locale)}</span>
              </div>
              <p className="whitespace-pre-line">{message.body}</p>
            </li>
          );
        })}
        {messages.length === 0 && (
          <li className="self-start rounded-2xl border border-dashed border-neutral-300 p-3 text-sm text-neutral-600">
            {t(locale, 'staff.appealChat.empty')}
          </li>
        )}
      </ol>

      {appeal.status === 'CLOSED' ? (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-900">
          {t(locale, 'staff.appealChat.closed')}
        </div>
      ) : (
        <AppealForms appealId={appeal.id} locale={locale} />
      )}
    </div>
  );
}
