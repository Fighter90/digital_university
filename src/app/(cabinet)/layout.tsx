import { requireUser } from '@/server/auth';
import { getUnreadCount } from '@/server/notifications';
import { Shell } from '@/components/shell/shell';
import type { ShellUser } from '@/lib/user';

// DIG-14: защищённый каркас кабинета. Любой экран внутри (cabinet) получает
// проверенную сессию через requireUser() (стаб до DIG-18) — данные отдаются
// только владельцу, что является обязательным правилом IDOR-защиты.
export default async function CabinetLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [user, unreadCount] = await Promise.all([requireUser(), getUnreadCount()]);
  const shellUser: ShellUser = { name: user.name, email: user.email, group: user.group };

  return (
    <Shell user={shellUser} unreadCount={unreadCount}>
      {children}
    </Shell>
  );
}
