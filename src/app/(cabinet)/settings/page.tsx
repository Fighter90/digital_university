// DIG-44 — «Настройки»: вкладки «Главная», «Уведомления», «Безопасность», «Вид»
// (макет Figma «02 · Профиль — настройки»).
//
// Все мутации — через server actions, скоупленные сессией (requireDataCtx):
// студент может менять только свои строки. Активная вкладка — параметр ?tab=
// (обычные ссылки, работают без JS); неизвестное значение откатывается на
// «Главную». Настройки применяются сразу: каждая мутация перевалидирует
// страницы, вид/тема — и root layout (классы на <html>).
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { NotificationSettings } from '@/components/profile/notification-settings';
import { ThemePicker } from '@/components/profile/theme-picker';
import { SettingsTabs } from '@/components/settings/settings-tabs';
import { WidgetsSettings } from '@/components/settings/widgets-settings';
import { QuietHoursSettings } from '@/components/settings/quiet-hours-settings';
import { PasswordForm } from '@/components/settings/password-form';
import { SessionsList } from '@/components/settings/sessions-list';
import { AppearanceSettings } from '@/components/settings/appearance-settings';
import { getAuthSession, listActiveUserSessions } from '@/server/auth/session';
import { normalizeSettings } from '@/server/data/profile';
import { getOwnSettings, requireDataCtx } from '@/server/data';
import { dataDb } from '@/server/data/db';
import { resolveSettingsTab } from '@/lib/settings-tabs';

export const metadata = { title: 'Настройки — Цифровой деканат' };

export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireDataCtx('/settings');

  if (ctx.role !== 'STUDENT') {
    return (
      <section className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-1 text-xl font-bold sm:text-2xl">Настройки</h1>
        <EmptyState
          title="Раздел доступен студентам"
          description="Настройки кабинета сотрудника настраиваются в системе деканата."
        />
      </section>
    );
  }

  const params = (await searchParams) ?? {};
  const rawTab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const tab = resolveSettingsTab(rawTab);

  const settings = normalizeSettings(await getOwnSettings(dataDb, ctx));
  const auth = await getAuthSession();
  const sessions = tab === 'security' && auth ? await listActiveUserSessions(auth.user.id) : [];
  const currentSessionId = auth?.session.id ?? null;

  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Настройки</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Виджеты главной, уведомления, безопасность и вид кабинета. Изменения сохраняются и
            применяются сразу.
          </p>
        </div>
        <SettingsTabs active={tab} />
      </div>

      {tab === 'home' && (
        <Card>
          <CardHeader>
            <CardTitle>Виджеты главной</CardTitle>
            <CardDescription>
              Выберите, какие блоки показывать на главной и в каком порядке. Порядок меняется
              перетаскиванием или кнопками «вверх/вниз».
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-3">
            {settings && <WidgetsSettings initial={settings.widgets} />}
          </CardContent>
        </Card>
      )}

      {tab === 'notifications' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Каналы уведомлений</CardTitle>
              <CardDescription>
                Матрица «категория × канал»: выключенный канал «в кабинете» убирает тип из ленты
                уведомлений.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-3">
              {settings && <NotificationSettings settings={settings} />}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Тихие часы</CardTitle>
            </CardHeader>
            <CardContent className="mt-3">
              {settings && <QuietHoursSettings initial={settings.quietHours} />}
            </CardContent>
          </Card>
        </>
      )}

      {tab === 'security' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Смена пароля</CardTitle>
              <CardDescription>
                Пароль хранится только в виде argon2id-хэша. После смены вход со старым паролем
                перестанет работать.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-3">
              <PasswordForm />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Активные сеансы</CardTitle>
              <CardDescription>
                Устройства, с которых вы входили в кабинет. «Завершить» закрывает выбранный сеанс;
                «Выйти на всех устройствах» — все, включая текущий.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-3">
              <SessionsList sessions={sessions} currentSessionId={currentSessionId} />
            </CardContent>
          </Card>
        </>
      )}

      {tab === 'appearance' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Тема</CardTitle>
            </CardHeader>
            <CardContent className="mt-3">
              {settings && <ThemePicker initial={settings.theme} />}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Язык, шрифт и анимация</CardTitle>
            </CardHeader>
            <CardContent className="mt-3">
              {settings && (
                <AppearanceSettings
                  language={settings.language}
                  fontSize={settings.fontSize}
                  reduceMotion={settings.reduceMotion}
                />
              )}
            </CardContent>
          </Card>
        </>
      )}
    </section>
  );
}
