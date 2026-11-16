// DIG-48 — «Объявления» (/staff/announcements): создание для факультета или
// группы (группа проверяется на принадлежность факультету), живой
// предпросмотр и список опубликованных. Скоуп — staff-workflow.
import { listFacultyGroups, listStaffAnnouncements, requireDataCtx } from '@/server/data';
import { dataDb } from '@/server/data/db';
import { formatRequestDate } from '@/lib/request-labels';
import { AnnouncementForm } from '@/components/staff/announcement-form';

export default async function StaffAnnouncementsPage() {
  const ctx = await requireDataCtx('/staff/announcements');
  const [groups, announcements] = await Promise.all([
    listFacultyGroups(dataDb, ctx),
    listStaffAnnouncements(dataDb, ctx),
  ]);

  return (
    <div>
      <h1 className="text-xl font-bold text-neutral-900 sm:text-2xl">Объявления</h1>
      <p className="mb-6 mt-1 text-sm text-neutral-600">
        Объявление уйдёт студентам факультета {ctx.faculty ?? '—'} или выбранной группы.
      </p>

      <AnnouncementForm groups={groups} faculty={ctx.faculty ?? ''} />

      <h2 className="mb-3 mt-8 text-base font-semibold text-neutral-900">Опубликованные</h2>
      {announcements.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 p-8 text-center">
          <p className="text-sm font-medium text-neutral-900">Объявлений пока нет</p>
          <p className="mt-1 text-sm text-neutral-600">
            Опубликуйте первое объявление — оно появится в списке.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="staff-announcements-list">
          {announcements.map((announcement) => (
            <li key={announcement.id} className="rounded-2xl border border-neutral-200 bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center rounded-pill bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-700">
                  {announcement.groupName
                    ? `группа ${announcement.groupName}`
                    : `факультет ${announcement.faculty}`}
                </span>
                <span className="text-xs text-neutral-500">
                  {formatRequestDate(announcement.createdAt)}
                </span>
              </div>
              <p className="mt-1 text-sm font-bold text-neutral-900">{announcement.title}</p>
              <p className="mt-1 whitespace-pre-line text-sm text-neutral-700">
                {announcement.body}
              </p>
              <p className="mt-2 text-xs text-neutral-500">Автор: {announcement.authorName}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
