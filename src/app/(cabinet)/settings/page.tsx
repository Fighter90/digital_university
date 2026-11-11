// DIG-19 — «Настройки»: каналы уведомлений по типам, тема и активные сессии.
// Все мутации — через server actions, скоупленные сессией (requireDataCtx):
// студент может менять только свои строки. Telegram и тёмная тема отключены
// («скоро»), сессии читаются из auth-слоя только своего пользователя.
import { MonitorSmartphone } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { NotificationSettings } from '@/components/profile/notification-settings';
import { ThemePicker } from '@/components/profile/theme-picker';
import { getAuthSession, listActiveUserSessions } from '@/server/auth/session';
import { signOutAction, signOutAllDevicesAction } from '@/server/actions/auth';
import { requireDataCtx, getOwnSettings } from '@/server/data';
import { dataDb } from '@/server/data/db';
import { formatSessionTime, sessionDeviceLabel } from '@/lib/profile-format';
import type { AuthSessionRow } from '@/server/auth/types';

export default async function SettingsPage() {
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

  const settings = await getOwnSettings(dataDb, ctx);
  const auth = await getAuthSession();
  const sessions: AuthSessionRow[] = auth ? await listActiveUserSessions(auth.user.id) : [];
  const currentSessionId = auth?.session.id ?? null;

  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">Настройки</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Уведомления, тема оформления и активные сессии. Изменения сохраняются сразу.
        </p>
      </div>

      {/* Каналы уведомлений */}
      <Card>
        <CardHeader>
          <CardTitle>Каналы уведомлений</CardTitle>
          <CardDescription>
            Выберите, о чём и куда писать: выключенный push-канал убирает тип из ленты уведомлений.
          </CardDescription>
        </CardHeader>
        <CardContent className="mt-3">
          {settings && <NotificationSettings settings={settings} />}
        </CardContent>
      </Card>

      {/* Тема */}
      <Card>
        <CardHeader>
          <CardTitle>Тема</CardTitle>
        </CardHeader>
        <CardContent className="mt-3">
          {settings && <ThemePicker initial={settings.theme} />}
        </CardContent>
      </Card>

      {/* Активные сессии */}
      <Card>
        <CardHeader>
          <CardTitle>Активные сессии</CardTitle>
          <CardDescription>
            Устройства, с которых вы входили в кабинет. «Выйти везде» закрывает все сессии,
            включая текущую.
          </CardDescription>
        </CardHeader>
        <CardContent className="mt-3">
          {sessions.length === 0 ? (
            <EmptyState
              title="Нет активных сессий"
              description="После входа в кабинет здесь появится устройство."
            />
          ) : (
            <ul className="flex flex-col divide-y divide-neutral-100">
              {sessions.map((session) => (
                <li
                  key={session.id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <MonitorSmartphone className="size-5 shrink-0 text-neutral-400" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-neutral-900">
                        {sessionDeviceLabel(session.userAgent)}
                        {session.id === currentSessionId && (
                          <Badge status="accent">Это устройство</Badge>
                        )}
                      </p>
                      <p className="text-xs text-neutral-500">
                        Вход: {formatSessionTime(session.createdAt ?? null)}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <form action={signOutAction}>
              <Button type="submit" variant="secondary" size="sm">
                Выйти на этом устройстве
              </Button>
            </form>
            <form action={signOutAllDevicesAction}>
              <Button type="submit" variant="danger" size="sm">
                Выйти везде
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
