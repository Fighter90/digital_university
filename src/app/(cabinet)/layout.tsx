import { requireUser } from '@/server/auth/session';
import { resolveShellUser } from '@/server/data';
import { dataDb } from '@/server/data/db';
import { getNotificationFeed } from '@/server/notifications';
import { Shell } from '@/components/shell/shell';

// DIG-14: защищённый каркас кабинета. Любой экран внутри (cabinet) получает
// проверенную сессию через requireUser() (DIG-11; с DIG-50 — без заглушки,
// реальная сессия) — данные отдаются только владельцу, что является
// обязательным правилом IDOR-защиты. Личность в шапке резолвится fail-soft:
// пользователь без строки профиля в слое данных не выбрасывается на /login.
// DIG-35: шапка получает реальный счётчик непрочитанных и последние 5
// уведомлений для панели колокольчика (getNotificationFeed — fail-soft).
export default async function CabinetLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUser();
  const [shellUser, feed] = await Promise.all([
    resolveShellUser(dataDb, user),
    getNotificationFeed(),
  ]);

  return (
    <Shell user={shellUser} unreadCount={feed.count} recentNotifications={feed.items}>
      {children}
    </Shell>
  );
}
