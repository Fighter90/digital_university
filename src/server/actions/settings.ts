// DIG-44 — server actions of the tabbed settings screen.
//
// IDOR contract: every action re-resolves the DataCtx from the live session
// (requireDataCtx / getAuthSession) and mutates ONLY ctx-owned rows. Server
// actions are public POST endpoints, so every argument is validated against
// whitelists before it reaches the data or auth layer.
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getAuthSession, changeOwnPassword, revokeUserSessionById } from '@/server/auth/session';
import { requireDataCtx } from '@/server/data';
import { dataDb } from '@/server/data/db';
import {
  updateOwnFontSize,
  updateOwnLanguage,
  updateOwnQuietHours,
  updateOwnReduceMotion,
  updateOwnWidgets,
} from '@/server/data/profile';
import { DASHBOARD_WIDGETS, isDashboardWidgetId, normalizeWidgets } from '@/lib/dashboard-widgets';

/** Revalidates every layout/page of the cabinet — appearance prefs apply at once. */
function revalidateAll(): void {
  revalidatePath('/', 'layout');
}

async function requireStudentCtx() {
  const ctx = await requireDataCtx('/settings');
  return ctx.role === 'STUDENT' ? ctx : null;
}

// ── Вкладка «Главная»: виджеты ──────────────────────────────────────────────

const WIDGET_IDS = DASHBOARD_WIDGETS.map((w) => w.id);

export interface SaveWidgetsInput {
  /** Полный порядок шести id. */
  order: string[];
  /** Выключенные id (подмножество). */
  disabled: string[];
}

/**
 * Сохраняет порядок и видимость виджетов главной. Возвращает true, если
 * список прошёл валидацию (все шесть известных id ровно по одному разу,
 * disabled — подмножество) и записан. Главная и настройки перевалидируются.
 */
export async function saveWidgetsAction(input: SaveWidgetsInput): Promise<boolean> {
  const ctx = await requireStudentCtx();
  if (!ctx) return false;
  if (!Array.isArray(input?.order) || !Array.isArray(input?.disabled)) return false;

  const order = input.order.filter(isDashboardWidgetId);
  const unique = new Set(order);
  if (order.length !== WIDGET_IDS.length || unique.size !== WIDGET_IDS.length) return false;
  if (!input.disabled.every((id) => isDashboardWidgetId(id))) return false;

  const widgets = normalizeWidgets(
    order.map((id) => ({ id, enabled: !input.disabled.includes(id) })),
  );
  const saved = await updateOwnWidgets(dataDb, ctx, widgets);
  if (!saved) return false;

  revalidatePath('/settings');
  revalidatePath('/dashboard');
  return true;
}

// ── Вкладка «Уведомления»: тихие часы ───────────────────────────────────────

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Формат времени — ЧЧ:ММ');

export interface SaveQuietHoursInput {
  enabled: boolean;
  from: string;
  to: string;
}

/** Сохраняет окно тихих часов (отклоняет не-HH:MM и нулевые окна). */
export async function saveQuietHoursAction(input: SaveQuietHoursInput): Promise<boolean> {
  const ctx = await requireStudentCtx();
  if (!ctx) return false;
  if (typeof input?.enabled !== 'boolean') return false;

  const from = timeSchema.safeParse(input.from);
  const to = timeSchema.safeParse(input.to);
  if (!from.success || !to.success || from.data === to.data) return false;

  const saved = await updateOwnQuietHours(dataDb, ctx, {
    enabled: input.enabled,
    from: from.data,
    to: to.data,
  });
  if (!saved) return false;

  revalidatePath('/settings');
  return true;
}

// ── Вкладка «Вид»: язык, шрифт, анимация ────────────────────────────────────

const FONT_SIZES = ['NORMAL', 'LARGE', 'XLARGE'] as const;

/** Размер шрифта интерфейса: NORMAL | LARGE | XLARGE (классы на <html>). */
export async function saveFontSizeAction(value: string): Promise<boolean> {
  const ctx = await requireStudentCtx();
  if (!ctx) return false;
  if (!FONT_SIZES.includes(value as (typeof FONT_SIZES)[number])) return false;
  const saved = await updateOwnFontSize(dataDb, ctx, value as (typeof FONT_SIZES)[number]);
  if (!saved) return false;
  revalidateAll();
  return true;
}

/** «Уменьшить анимацию». */
export async function saveReduceMotionAction(enabled: boolean): Promise<boolean> {
  const ctx = await requireStudentCtx();
  if (!ctx || typeof enabled !== 'boolean') return false;
  const saved = await updateOwnReduceMotion(dataDb, ctx, enabled);
  if (!saved) return false;
  revalidateAll();
  return true;
}

/**
 * Язык интерфейса. EN — заглушка «скоро»: сервер принимает только RU,
 * пока перевод не готов (тот же паттерн, что Telegram-канал).
 */
export async function saveLanguageAction(value: string): Promise<boolean> {
  const ctx = await requireStudentCtx();
  if (!ctx) return false;
  if (value !== 'RU') return false;
  const saved = await updateOwnLanguage(dataDb, ctx, 'RU');
  if (!saved) return false;
  revalidatePath('/settings');
  return true;
}

// ── Вкладка «Безопасность»: пароль и сеансы ─────────────────────────────────

export type PasswordFormState = { ok: boolean; error?: string } | null;

const passwordSchema = z.object({
  current: z.string().min(1, 'Введите текущий пароль').max(200),
  next: z.string().min(8, 'Новый пароль — минимум 8 символов').max(200, 'Слишком длинный пароль'),
  repeat: z.string().min(1).max(200),
});

/** Смена пароля: текущий → новый (≥ 8 символов), повтор нового должен совпасть. */
export async function changePasswordAction(
  _prev: PasswordFormState,
  formData: FormData,
): Promise<PasswordFormState> {
  void _prev;
  const auth = await getAuthSession();
  if (!auth) return { ok: false, error: 'Требуется вход в кабинет' };

  const parsed = passwordSchema.safeParse({
    current: String(formData.get('current') ?? ''),
    next: String(formData.get('next') ?? ''),
    repeat: String(formData.get('repeat') ?? ''),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Проверьте поля формы' };
  }
  if (parsed.data.next !== parsed.data.repeat) {
    return { ok: false, error: 'Новые пароли не совпадают' };
  }
  if (parsed.data.next === parsed.data.current) {
    return { ok: false, error: 'Новый пароль совпадает с текущим' };
  }

  const result = await changeOwnPassword(
    auth.user.id,
    auth.user.login,
    parsed.data.current,
    parsed.data.next,
  );
  if (result === 'wrong-current') {
    return { ok: false, error: 'Неверный текущий пароль' };
  }
  if (result !== 'unknown-user' && result.ok) {
    revalidatePath('/settings');
    return { ok: true };
  }
  return { ok: false, error: 'Не удалось изменить пароль. Попробуйте ещё раз.' };
}

/**
 * «Завершить» для одного активного сеанса. Владение проверяет auth-store
 * (id ищется только среди сессий этого пользователя); свою текущую сессию
 * этой кнопкой завершить нельзя — для неё есть «Выйти на этом устройстве».
 */
export async function revokeSessionAction(formData: FormData): Promise<void> {
  const auth = await getAuthSession();
  if (!auth) return;
  const sessionId = String(formData.get('sessionId') ?? '');
  if (!sessionId || sessionId === auth.session.id) return;
  await revokeUserSessionById(auth.user.id, sessionId);
  revalidatePath('/settings');
}
