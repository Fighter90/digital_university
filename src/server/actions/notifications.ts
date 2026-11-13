// DIG-35 — server actions центра уведомлений.
//
// IDOR-контракт (как у всех actions, DIG-19): контекст заново строится из
// живой сессии (requireDataCtx), скоуп владельца — в слое данных
// (markNotificationRead / markAllNotificationsRead): чужой id возвращает
// false и попадает в аудит, «отметить все» затрагивает только свои строки.
'use server';

import { revalidatePath } from 'next/cache';

import { markAllNotificationsRead, markNotificationRead, requireDataCtx } from '@/server/data';
import { dataDb } from '@/server/data/db';

export type NotificationActionState = { ok: boolean; error?: string };

/** Технический id строки слоя данных (ntf-…): короткая безопасная строка. */
const NOTIFICATION_ID = /^[A-Za-z0-9_-]{1,100}$/;

/** Отмечает ОДНО уведомление владельца прочитанным. Чужой id — просто false. */
export async function markNotificationReadAction(id: string): Promise<NotificationActionState> {
  const ctx = await requireDataCtx('/notifications');
  if (!NOTIFICATION_ID.test(id)) return { ok: false, error: 'Некорректное уведомление' };

  const ok = await markNotificationRead(dataDb, ctx, id);
  if (ok) revalidatePath('/notifications');
  return { ok };
}

/** «Отметить все прочитанными»: только свои строки; возвращает число изменённых. */
export async function markAllNotificationsReadAction(): Promise<
  NotificationActionState & { marked: number }
> {
  const ctx = await requireDataCtx('/notifications');
  const marked = await markAllNotificationsRead(dataDb, ctx);
  revalidatePath('/notifications');
  return { ok: true, marked };
}
