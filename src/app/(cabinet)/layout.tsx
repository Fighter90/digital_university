import { requireUser } from '@/server/auth/session';
import { resolveShellUser } from '@/server/data';
import { dataDb } from '@/server/data/db';
import { getUnreadCount } from '@/server/notifications';
import { Shell } from '@/components/shell/shell';

// DIG-14: защищённый каркас кабинета. Любой экран внутри (cabinet) получает
// проверенную сессию через requireUser() (DIG-11; с DIG-50 — без заглушки,
// реальная сессия) — данные отдаются только владельцу, что является
// обязательным правилом IDOR-защиты. Личность в шапке резолвится fail-soft:
// пользователь без строки профиля в слое данных не выбрасывается на /login.
export default async function CabinetLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUser();
  const [shellUser, unreadCount] = await Promise.all([
    resolveShellUser(dataDb, user),
    getUnreadCount(),
  ]);

  return (
    <Shell user={shellUser} unreadCount={unreadCount}>
      {children}
    </Shell>
  );
}
