// DIG-19 — «Профиль студента». Read-only данные ведёт деканат; редактируются
// только контакты (и настройки — на /settings). Все данные приходят из
// изолированного слоя, скоупленного requireDataCtx() → session.user.id:
// чужой профиль с этой страницы получить невозможно по построению.
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getLocale } from '@/lib/i18n/server';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionTitle } from '@/components/shell/section-title';
import { MaskedStudentBadge } from '@/components/profile/masked-badge';
import { ContactsForm } from '@/components/profile/contacts-form';
import { DataErrorReport } from '@/components/profile/data-error-report';
import { requireDataCtx, getOwnProfile, getOwnSettings } from '@/server/data';
import { dataDb } from '@/server/data/db';
import { currentAcademicPeriod } from '@/lib/profile-format';
import { t } from '@/lib/i18n';
import { localizedFaculty, localizedGroup, enDisciplineName, enProgramName, enStudyFormLabel, enFundingLabel } from '@/lib/en-demo-content';

export default async function ProfilePage() {
  const [ctx, locale] = await Promise.all([requireDataCtx('/profile'), getLocale()]);

  if (ctx.role !== 'STUDENT') {
    return (
      <section className="mx-auto max-w-3xl px-4 py-8">
        <SectionTitle href="/profile" className="mb-1 text-xl font-bold sm:text-2xl" />
        <EmptyState
          title={t(locale, 'profile.staffOnly.title')}
          description={t(locale, 'profile.staffOnly.desc')}
        />
      </section>
    );
  }

  const profile = await getOwnProfile(dataDb, ctx);
  const settings = await getOwnSettings(dataDb, ctx);
  if (!profile || !settings) {
    // requireDataCtx уже гарантирует студенческий профиль; эта ветка —
    // fail-closed на случай рассинхрона хранилищ (не должно происходить).
    return (
      <section className="mx-auto max-w-3xl px-4 py-8">
        <SectionTitle href="/profile" className="mb-1 text-xl font-bold sm:text-2xl" />
        <EmptyState
          title={t(locale, 'profile.unavailable.title')}
          description={t(locale, 'profile.unavailable.desc')}
        />
      </section>
    );
  }

  const period = currentAcademicPeriod(new Date());
  // DIG-89 — EN-рендер демо-данных профиля: факультет/группа/программа/формы.
  const facultyLabel = localizedFaculty(locale, profile.faculty);
  const groupLabel = localizedGroup(locale, profile.groupName);
  const programLabel =
    locale === 'en' ? enProgramName(profile.program) : profile.program;
  const direction = profile.programCode
    ? `${profile.programCode} · ${programLabel}`
    : programLabel;

  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
      <div>
        <SectionTitle href="/profile" className="text-xl font-bold sm:text-2xl" />
        <p className="mt-1 text-sm text-neutral-600">
          {t(locale, 'profile.mainDesc')}
        </p>
      </div>

      {/* Карточка профиля */}
      <Card>
        <CardHeader className="flex-row items-center gap-4 space-y-0 pb-0">
          <Avatar name={profile.fullName} size="lg" />
          <div className="min-w-0">
            <CardTitle className="text-lg sm:text-xl">{profile.fullName}</CardTitle>
            <CardDescription className="truncate">
              {facultyLabel} · {groupLabel}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="mt-4">
          <dl className="flex flex-col divide-y divide-neutral-100 text-sm">
            <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
              <dt className="text-neutral-500">{t(locale, 'profile.field.faculty')}</dt>
              <dd className="font-medium text-neutral-900">{facultyLabel}</dd>
            </div>
            <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
              <dt className="text-neutral-500">{t(locale, 'profile.field.program')}</dt>
              <dd className="font-medium text-neutral-900">{direction}</dd>
            </div>
            <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
              <dt className="text-neutral-500">{t(locale, 'profile.field.course')}</dt>
              <dd className="font-medium text-neutral-900">{profile.course}</dd>
            </div>
            <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
              <dt className="text-neutral-500">{t(locale, 'profile.field.group')}</dt>
              <dd className="font-medium text-neutral-900">{groupLabel}</dd>
            </div>
            <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
              <dt className="text-neutral-500">{t(locale, 'profile.field.studyForm')}</dt>
              <dd className="font-medium text-neutral-900">
                {[profile.studyForm, profile.funding]
                  .filter(Boolean)
                  .map((value) =>
                    locale === 'en'
                      ? enStudyFormLabel(value) !== value
                        ? enStudyFormLabel(value)
                        : enFundingLabel(value)
                      : value,
                  )
                  .join(', ')}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
              <dt className="text-neutral-500">{t(locale, 'profile.field.studyYear')}</dt>
              <dd className="font-medium text-neutral-900">
                {period.year} · {period.term}
              </dd>
            </div>
            <div className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
              <dt className="shrink-0 text-neutral-500">{t(locale, 'profile.field.studentId')}</dt>
              <dd>
                <MaskedStudentBadge value={profile.gradebookNumber} locale={locale} />
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Контакты */}
      <Card>
        <CardHeader>
          <CardTitle>{t(locale, 'profile.contacts.title')}</CardTitle>
          <CardDescription>
            {t(locale, 'profile.contacts.desc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="mt-3">
          <ContactsForm
            email={profile.email}
            phone={settings.phone}
            emailVisibleToStaff={settings.emailVisibleToStaff}
            phoneVisibleToStaff={settings.phoneVisibleToStaff}
            locale={locale}
          />
        </CardContent>
      </Card>

      {/* Нашли ошибку в данных? — одна точка входа */}
      <Card>
        <CardHeader>
          <CardTitle>{t(locale, 'profile.error.title')}</CardTitle>
        </CardHeader>
        <CardContent className="mt-3">
          <DataErrorReport locale={locale} />
        </CardContent>
      </Card>
    </section>
  );
}
