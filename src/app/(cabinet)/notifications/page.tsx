// DIG-35 — «Уведомления» (Figma «08»): полный центр уведомлений. Все данные —
// из слоя DIG-12 по сессии владельца (запрет IDOR); сотруднику listNotifications
// возвращает пустую ленту с аудитом отказа, экран честно показывает пустое
// состояние. Клиентская часть (фильтры/группы/отметки) — NotificationsScreen.
import { requireDataCtx, listNotifications } from '@/server/data';
import { dataDb } from '@/server/data/db';
import { toNotificationFeedItem } from '@/lib/notification-view';
import { NotificationsScreen } from '@/components/notifications/notifications-screen';

export default async function NotificationsPage() {
  const ctx = await requireDataCtx('/notifications');
  const rows = await listNotifications(dataDb, ctx);
  const items = [...rows]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map(toNotificationFeedItem);

  return <NotificationsScreen initialItems={items} />;
}
