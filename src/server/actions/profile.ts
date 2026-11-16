// DIG-19 — server actions of the profile & settings screens.
//
// IDOR contract: every action re-resolves the DataCtx from the live session
// (requireDataCtx) and mutates ONLY ctx-owned rows. Server actions are
// public POST endpoints, so every argument is validated (zod / whitelists)
// before it reaches the data layer.
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireDataCtx } from '@/server/data';
import { dataDb } from '@/server/data/db';
import {
  createDataErrorAppeal,
  updateOwnContacts,
  updateOwnNotificationChannel,
  updateOwnTheme,
} from '@/server/data/profile';
import type { NotificationChannel, NotificationType, ThemePreference } from '@/server/data/types';

export type ProfileFormState = { ok: boolean; error?: string } | null;

const contactsSchema = z.object({
  email: z.email('Введите корректный email').max(200),
  phone: z
    .string()
    .trim()
    .max(40, 'Слишком длинный номер')
    .regex(/^\+?[0-9 ()\-]*$/, 'Телефон: только цифры, пробелы и + ( ) -'),
});

export async function saveContactsAction(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const ctx = await requireDataCtx('/profile');
  if (ctx.role !== 'STUDENT') {
    return { ok: false, error: 'Раздел доступен студентам' };
  }

  const parsed = contactsSchema.safeParse({
    email: String(formData.get('email') ?? '').trim(),
    phone: String(formData.get('phone') ?? '').trim(),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Проверьте поля формы' };
  }

  await updateOwnContacts(dataDb, ctx, {
    email: parsed.data.email,
    phone: parsed.data.phone === '' ? null : parsed.data.phone,
    emailVisibleToStaff: formData.get('emailVisibleToStaff') === 'on',
    phoneVisibleToStaff: formData.get('phoneVisibleToStaff') === 'on',
  });

  revalidatePath('/profile');
  return { ok: true };
}

export async function reportDataErrorAction(
  _prev: ProfileFormState,
  _formData: FormData,
): Promise<ProfileFormState> {
  void _prev; // useActionState fixes the (state, payload) signature; unused here
  void _formData;
  const ctx = await requireDataCtx('/profile');
  if (ctx.role !== 'STUDENT') {
    return { ok: false, error: 'Раздел доступен студентам' };
  }

  const appeal = await createDataErrorAppeal(dataDb, ctx, { now: new Date() });
  if (!appeal) {
    return { ok: false, error: 'Не удалось создать обращение. Попробуйте ещё раз.' };
  }

  revalidatePath('/profile');
  return { ok: true };
}

const CHANNEL_TYPES: NotificationType[] = [
  'SCHEDULE',
  'DEADLINE',
  'REQUEST',
  'GRADE',
  'NEWS',
  'SYSTEM',
];
const CHANNELS: NotificationChannel[] = ['PUSH', 'EMAIL', 'TELEGRAM'];
const THEMES: ThemePreference[] = ['LIGHT', 'SYSTEM', 'DARK'];

/** Toggles one cell of the notification matrix (Telegram is ignored — «скоро»). */
export async function saveNotificationChannelAction(input: {
  type: string;
  channel: string;
  enabled: boolean;
}): Promise<boolean> {
  const ctx = await requireDataCtx('/settings');
  if (ctx.role !== 'STUDENT') return false;

  const type = CHANNEL_TYPES.find((t) => t === input.type);
  const channel = CHANNELS.find((c) => c === input.channel);
  if (!type || !channel || typeof input.enabled !== 'boolean') return false;

  await updateOwnNotificationChannel(dataDb, ctx, type, channel, input.enabled);
  revalidatePath('/settings');
  return true;
}

export async function saveThemeAction(theme: string): Promise<boolean> {
  const ctx = await requireDataCtx('/settings');
  if (ctx.role !== 'STUDENT') return false;

  const next = THEMES.find((t) => t === theme);
  if (!next) return false;

  await updateOwnTheme(dataDb, ctx, next);
  // DIG-44: тема применяется ко всему кабинету — перевалидируем layout,
  // чтобы класс на <html> обновился сразу после сохранения.
  revalidatePath('/', 'layout');
  return true;
}
