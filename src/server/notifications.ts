import { requireUser } from '@/server/auth';

// DIG-14: счётчик непрочитанных уведомлений. Временный вымышленный источник —
// DIG-35 подключит реальный запрос Prisma, отфильтрованный по session.user.id.
export async function getUnreadCount(): Promise<number> {
  await requireUser();
  return 3;
}
