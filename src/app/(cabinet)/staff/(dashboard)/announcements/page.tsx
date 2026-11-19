// DIG-48 — «Объявления» (/staff/announcements): создание для факультета или
// группы (группа проверяется на принадлежность факультету), живой
// предпросмотр и список опубликованных. Скоуп — staff-workflow.
// DIG-89 — интерфейс по локали (cookie du-locale): RU — байт-в-байт прежний.
import { listFacultyGroups, listStaffAnnouncements, requireDataCtx } from '@/server/data';
import { dataDb } from '@/server/data/db';
import { formatRequestDate } from '@/lib/request-labels';
import {
  localizedFaculty,
  localizedGroup,
  localizeAnnouncement,
  localizePersonName,
} from '@/lib/en-demo-content';
import { t } from '@/lib/i18n';
import { getLocale } from '@/lib/i18n/server';
import { AnnouncementForm } from '@/components/staff/announcement-form';
import { SectionTitle } from '@/components/shell/section-title';

/** DIG-89 — <title> страницы по локали. */
export async function generateMetadata() {
  return { title: t(await getLocale(), 'title.staffAnnouncements') };
}

export default async function StaffAnnouncementsPage() {
  const [ctx, locale] = await Promise.all([requireDataCtx('/staff/announcements'), getLocale()]);
  const [groups, announcements] = await Promise.all([
    listFacultyGroups(dataDb, ctx),
    listStaffAnnouncements(dataDb, ctx),
  ]);

  return (
    <div>
      <SectionTitle
        href="/staff/announcements"
        className="text-xl font-bold text-neutral-900 sm:text-2xl"
      />
      <p className="mb-6 mt-1 text-sm text-neutral-600">
        {t(locale, 'staff.announcement.hint', { faculty: localizedFaculty(locale, ctx.faculty) })}
      </p>

      <AnnouncementForm groups={groups} faculty={ctx.faculty ?? ''} locale={locale} />

      <h2 className="mb-3 mt-8 text-base font-semibold text-neutral-900">
        {t(locale, 'staff.announcement.published')}
      </h2>
      {announcements.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 p-8 text-center">
          <p className="text-sm font-medium text-neutral-900">
            {t(locale, 'staff.announcement.empty.title')}
          </p>
          <p className="mt-1 text-sm text-neutral-600">
            {t(locale, 'staff.announcement.empty.desc')}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="staff-announcements-list">
          {announcements.map((announcement) => {
            const content = localizeAnnouncement(locale, announcement);
            return (
              <li
                key={announcement.id}
                className="rounded-2xl border border-neutral-200 bg-card p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center rounded-pill bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-700">
                    {announcement.groupName
                      ? t(locale, 'staff.announcement.audienceGroup', {
                          group: localizedGroup(locale, announcement.groupName),
                        })
                      : t(locale, 'staff.announcement.audienceFaculty', {
                          faculty: localizedFaculty(locale, announcement.faculty),
                        })}
                  </span>
                  <span className="text-xs text-neutral-500">
                    {formatRequestDate(announcement.createdAt, locale)}
                  </span>
                </div>
                <p className="mt-1 text-sm font-bold text-neutral-900">{content.title}</p>
                <p className="mt-1 whitespace-pre-line text-sm text-neutral-700">{content.body}</p>
                <p className="mt-2 text-xs text-neutral-500">
                  {t(locale, 'staff.announcement.author', {
                    name: localizePersonName(locale, announcement.authorName),
                  })}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
