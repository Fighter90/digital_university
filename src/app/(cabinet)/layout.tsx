import { requireUser } from '@/server/auth/session';
import type { AuthUser } from '@/server/auth/types';
import { ensureAppData } from '@/server/data/bootstrap';
import { getTasks, resolveShellUser, toDataCtx } from '@/server/data';
import { dataDb } from '@/server/data/db';
import { getNotificationFeed } from '@/server/notifications';
import { getLocale } from '@/lib/i18n/server';
import { Shell } from '@/components/shell/shell';

// DIG-34: счётчик открытых задач для меню — fail-soft: сбой слоя данных не
// должен ломать каркас кабинета (пилюля просто скрывается). Скоуп строится
// из живой сессии (пользователь уже получен каркасом), URL-параметров нет —
// IDOR невозможен по построению.
async function openTasksCount(user: AuthUser): Promise<number> {
  try {
    await ensureAppData();
    const ctx = await toDataCtx(user, dataDb);
    // Сотруднику студенческие задачи не принадлежат: 0 без вызова агрегата
    // (и без аудита ROLE_MISMATCH на каждый рендер каркаса).
    if (!ctx || ctx.role !== 'STUDENT') return 0;
    return (await getTasks(dataDb, ctx)).openCount;
  } catch (error) {
    console.error('[cabinet] tasks count failed', error);
    return 0;
  }
}

// DIG-14: защищённый каркас кабинета. Любой экран внутри (cabinet) получает
// проверенную сессию через requireUser() (DIG-11; с DIG-50 — без заглушки,
// реальная сессия) — данные отдаются только владельцу, что является
// обязательным правилом IDOR-защиты. Личность в шапке резолвится fail-soft:
// пользователь без строки профиля в слое данных не выбрасывается на /login.
// DIG-35: шапка получает реальный счётчик непрочитанных и последние 5
// уведомлений для панели колокольчика (getNotificationFeed — fail-soft).
export default async function CabinetLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUser();
  const [shellUser, feed, tasksCount, locale] = await Promise.all([
    resolveShellUser(dataDb, user),
    getNotificationFeed(),
    openTasksCount(user),
    getLocale(),
  ]);

  return (
    <Shell
      user={shellUser}
      unreadCount={feed.count}
      recentNotifications={feed.items}
      tasksCount={tasksCount}
      locale={locale}
    >
      {children}
    </Shell>
  );
}
