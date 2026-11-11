// DIG-19 — «Профиль студента». Read-only данные ведёт деканат; редактируются
// только контакты (и настройки — на /settings). Все данные приходят из
// изолированного слоя, скоупленного requireDataCtx() → session.user.id:
// чужой профиль с этой страницы получить невозможно по построению.
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { MaskedStudentBadge } from '@/components/profile/masked-badge';
import { ContactsForm } from '@/components/profile/contacts-form';
import { DataErrorReport } from '@/components/profile/data-error-report';
import { requireDataCtx, getOwnProfile, getOwnSettings } from '@/server/data';
import { dataDb } from '@/server/data/db';
import { currentAcademicPeriod } from '@/lib/profile-format';

export default async function ProfilePage() {
  const ctx = await requireDataCtx('/profile');

  if (ctx.role !== 'STUDENT') {
    return (
      <section className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-1 text-xl font-bold sm:text-2xl">Профиль</h1>
        <EmptyState
          title="Раздел доступен студентам"
          description="Профиль сотрудника ведётся в системе деканата."
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
        <h1 className="mb-1 text-xl font-bold sm:text-2xl">Профиль</h1>
        <EmptyState
          title="Профиль временно недоступен"
          description="Попробуйте обновить страницу позже."
        />
      </section>
    );
  }

  const period = currentAcademicPeriod(new Date());
  const direction = profile.programCode
    ? `${profile.programCode} · ${profile.program}`
    : profile.program;

  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">Профиль</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Основные данные ведёт деканат — их можно только проверить. Контакты вы редактируете сами.
        </p>
      </div>

      {/* Карточка профиля */}
      <Card>
        <CardHeader className="flex-row items-center gap-4 space-y-0 pb-0">
          <Avatar name={profile.fullName} size="lg" />
          <div className="min-w-0">
            <CardTitle className="text-lg sm:text-xl">{profile.fullName}</CardTitle>
            <CardDescription className="truncate">
              {profile.faculty} · {profile.groupName}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="mt-4">
          <dl className="flex flex-col divide-y divide-neutral-100 text-sm">
            <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
              <dt className="text-neutral-500">Факультет</dt>
              <dd className="font-medium text-neutral-900">{profile.faculty}</dd>
            </div>
            <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
              <dt className="text-neutral-500">Направление</dt>
              <dd className="font-medium text-neutral-900">{direction}</dd>
            </div>
            <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
              <dt className="text-neutral-500">Курс</dt>
              <dd className="font-medium text-neutral-900">{profile.course}</dd>
            </div>
            <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
              <dt className="text-neutral-500">Группа</dt>
              <dd className="font-medium text-neutral-900">{profile.groupName}</dd>
            </div>
            <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
              <dt className="text-neutral-500">Форма обучения</dt>
              <dd className="font-medium text-neutral-900">
                {[profile.studyForm, profile.funding].filter(Boolean).join(', ')}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
              <dt className="text-neutral-500">Учебный год</dt>
              <dd className="font-medium text-neutral-900">
                {period.year} · {period.term}
              </dd>
            </div>
            <div className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
              <dt className="shrink-0 text-neutral-500">Студенческий билет</dt>
              <dd>
                <MaskedStudentBadge value={profile.gradebookNumber} />
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Контакты */}
      <Card>
        <CardHeader>
          <CardTitle>Контакты</CardTitle>
          <CardDescription>
            Переключатели решают, увидят ли преподаватели ваши контакты в кабинете.
          </CardDescription>
        </CardHeader>
        <CardContent className="mt-3">
          <ContactsForm
            email={profile.email}
            phone={settings.phone}
            emailVisibleToStaff={settings.emailVisibleToStaff}
            phoneVisibleToStaff={settings.phoneVisibleToStaff}
          />
        </CardContent>
      </Card>

      {/* Нашли ошибку в данных? — одна точка входа */}
      <Card>
        <CardHeader>
          <CardTitle>Данные неточны?</CardTitle>
        </CardHeader>
        <CardContent className="mt-3">
          <DataErrorReport />
        </CardContent>
      </Card>
    </section>
  );
}
