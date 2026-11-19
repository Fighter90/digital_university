import { MonitorSmartphone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { formatSessionTime, sessionDeviceLabel } from '@/lib/profile-format';
import { t, type Locale } from '@/lib/i18n';
import { signOutAction, signOutAllDevicesAction } from '@/server/actions/auth';
import { revokeSessionAction } from '@/server/actions/settings';
import type { AuthSessionRow } from '@/server/auth/types';

// DIG-44 — вкладка «Безопасность»: активные сеансы. Каждый чужой сеанс можно
// завершить точечно («Завершить», server action с проверкой владельца внутри
// auth-store); текущий — только через «Выйти на этом устройстве». Город по IP
// в прототипе недоступен — честно показываем «—».
export function SessionsList({
  sessions,
  currentSessionId,
  locale = 'ru',
}: {
  sessions: AuthSessionRow[];
  currentSessionId: string | null;
  /** DIG-89 — локаль интерфейса (cookie du-locale, дефолт ru). */
  locale?: Locale;
}) {
  if (sessions.length === 0) {
    return (
      <EmptyState
        title={t(locale, 'settings.sessions.empty.title')}
        description={t(locale, 'settings.sessions.empty.desc')}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col divide-y divide-neutral-100">
        {sessions.map((session) => {
          const isCurrent = session.id === currentSessionId;
          return (
            <li key={session.id} className="flex items-center justify-between gap-3 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <MonitorSmartphone
                  className="size-5 shrink-0 text-neutral-400"
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-neutral-900">
                    {sessionDeviceLabel(session.userAgent)}
                    {isCurrent && <Badge status="accent">{t(locale, 'settings.sessions.current')}</Badge>}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {t(locale, 'settings.sessions.city')}{' '}
                    <span
                      data-testid="session-city"
                      title={t(locale, 'settings.sessions.cityStub')}
                    >
                      —
                    </span>
                    {' · '}
                    {t(locale, 'settings.sessions.signIn', {
                      date: formatSessionTime(session.createdAt ?? null),
                    })}
                  </p>
                </div>
              </div>
              {!isCurrent && (
                <form action={revokeSessionAction}>
                  <input type="hidden" name="sessionId" value={session.id} />
                  <Button type="submit" variant="secondary" size="sm">
                    {t(locale, 'settings.sessions.terminate')}
                  </Button>
                </form>
              )}
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <form action={signOutAction}>
          <Button type="submit" variant="secondary" size="sm">
            {t(locale, 'settings.sessions.signoutHere')}
          </Button>
        </form>
        <form action={signOutAllDevicesAction}>
          <Button type="submit" variant="danger" size="sm">
            {t(locale, 'settings.sessions.signoutAll')}
          </Button>
        </form>
      </div>
    </div>
  );
}
