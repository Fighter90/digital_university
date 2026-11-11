import { requireUser } from '@/server/auth/session';

// DIG-14: счётчик непрочитанных уведомлений. Временный вымышленный источник —
// DIG-35 подключит реальный запрос Prisma, отфильтрованный по session.user.id.
// DIG-50: гарда — реальная сессия (заглушка requireUser удалена), аноним
// по-прежнему уходит на /login; само значение остаётся демо-константой.
export async function getUnreadCount(): Promise<number> {
  await requireUser();
  return 3;
}
