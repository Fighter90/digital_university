// DIG-48 — server actions кабинета сотрудника деканата.
//
// IDOR-контракт (как у всех actions): контекст заново строится из живой
// сессии (requireDataCtx), роль STAFF обязательна, скоуп факультета и
// владелец проверяются в слое данных (staff-workflow). Формы работают и без
// JS (прогрессивное улучшение): «Взять в работу» — обычная форма очереди,
// остальные — useActionState с показом ошибки.
'use server';

import { revalidatePath } from 'next/cache';

import {
  answerStaffAppeal,
  changeStaffRequestStatus,
  createStaffAnnouncement,
  normalizeRequestNumber,
  requireDataCtx,
  resolveStaffAppeal,
} from '@/server/data';
import { dataDb } from '@/server/data/db';
import { isReasonValid, requiresReason } from '@/lib/staff-transitions';
import type { RequestStatus } from '@/server/data/types';

export type StaffActionState = { ok: boolean; error?: string } | null;

/** Целевые статусы, доступные сотруднику в карточке/очереди. */
const TARGET_STATUSES: RequestStatus[] = ['IN_PROGRESS', 'NEEDS_REVISION', 'COMPLETED', 'REJECTED'];

const STATUS_CHANGE_ERRORS: Record<string, string> = {
  NOT_FOUND: 'Заявка недоступна (нет или чужой факультет)',
  NOT_ALLOWED: 'Этот переход недоступен для текущего статуса заявки',
  REASON_REQUIRED: 'Укажите причину — без неё вернуть на доработку нельзя',
};

/**
 * «Взять в работу» прямо из очереди: SUBMITTED → IN_PROGRESS. Пустой
 * результат: при ошибке строка просто остаётся в очереди (кнопка видна),
 * причина отказа видна при повторном нажатии в карточке.
 */
export async function takeInProgressAction(formData: FormData): Promise<void> {
  const ctx = await requireDataCtx('/staff/requests');
  if (ctx.role !== 'STAFF') return;
  const number = normalizeRequestNumber(String(formData.get('number') ?? ''));
  if (!number) return;

  const result = await changeStaffRequestStatus(dataDb, ctx, number, {
    to: 'IN_PROGRESS',
    note: null,
    now: new Date(),
  });
  if (result.ok) {
    revalidatePath('/staff/requests');
    revalidatePath(`/staff/requests/${number}`);
    revalidatePath('/staff');
  }
}

/** Смена статуса кнопкой карточки: только разрешённые переходы + причина. */
export async function changeStatusAction(
  _prev: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  void _prev; // useActionState fixes the (state, payload) signature
  const ctx = await requireDataCtx('/staff/requests');
  if (ctx.role !== 'STAFF') {
    return { ok: false, error: 'Раздел доступен только сотрудникам деканата' };
  }

  const number = normalizeRequestNumber(String(formData.get('number') ?? ''));
  const to = String(formData.get('to') ?? '') as RequestStatus;
  const reason = String(formData.get('reason') ?? '');

  if (!number || !TARGET_STATUSES.includes(to)) {
    return { ok: false, error: 'Неизвестное действие' };
  }
  if (requiresReason(to) && !isReasonValid(reason)) {
    return { ok: false, error: 'Укажите причину (не короче 5 символов)' };
  }

  const result = await changeStaffRequestStatus(dataDb, ctx, number, {
    to,
    note: reason.trim().length > 0 ? reason.trim() : null,
    now: new Date(),
  });
  if (!result.ok) {
    return { ok: false, error: STATUS_CHANGE_ERRORS[result.error] ?? 'Не удалось изменить статус' };
  }

  revalidatePath('/staff/requests');
  revalidatePath(`/staff/requests/${number}`);
  revalidatePath('/staff');
  return { ok: true };
}

/** Ответ сотрудника на обращение (текст обязателен). */
export async function replyAppealAction(
  _prev: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  void _prev;
  const ctx = await requireDataCtx('/staff/appeals');
  if (ctx.role !== 'STAFF') {
    return { ok: false, error: 'Раздел доступен только сотрудникам деканата' };
  }
  const appealId = String(formData.get('appealId') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();
  if (!appealId) return { ok: false, error: 'Не указано обращение' };
  if (body.length === 0) return { ok: false, error: 'Введите текст ответа' };

  const answered = await answerStaffAppeal(dataDb, ctx, appealId, { body, now: new Date() });
  if (!answered) return { ok: false, error: 'Обращение недоступно' };

  revalidatePath('/staff/appeals');
  revalidatePath(`/staff/appeals/${appealId}`);
  return { ok: true };
}

/** «Решено»: закрывает обращение, финальная заметка необязательна. */
export async function resolveAppealAction(
  _prev: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  void _prev;
  const ctx = await requireDataCtx('/staff/appeals');
  if (ctx.role !== 'STAFF') {
    return { ok: false, error: 'Раздел доступен только сотрудникам деканата' };
  }
  const appealId = String(formData.get('appealId') ?? '').trim();
  const note = String(formData.get('note') ?? '');
  if (!appealId) return { ok: false, error: 'Не указано обращение' };

  const resolved = await resolveStaffAppeal(dataDb, ctx, appealId, { note, now: new Date() });
  if (!resolved) return { ok: false, error: 'Обращение недоступно' };

  revalidatePath('/staff/appeals');
  revalidatePath(`/staff/appeals/${appealId}`);
  return { ok: true };
}

/** Публикация объявления факультету или группе. */
export async function createAnnouncementAction(
  _prev: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  void _prev;
  const ctx = await requireDataCtx('/staff/announcements');
  if (ctx.role !== 'STAFF') {
    return { ok: false, error: 'Раздел доступен только сотрудникам деканата' };
  }

  const scope = String(formData.get('scope') ?? '');
  if (scope !== 'FACULTY' && scope !== 'GROUP') {
    return { ok: false, error: 'Выберите аудиторию объявления' };
  }
  const title = String(formData.get('title') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();
  if (title.length === 0 || body.length === 0) {
    return { ok: false, error: 'Заполните заголовок и текст объявления' };
  }

  const created = await createStaffAnnouncement(dataDb, ctx, {
    scope,
    groupName: String(formData.get('groupName') ?? '').trim() || null,
    title,
    body,
    now: new Date(),
  });
  if (created === null) return { ok: false, error: 'Не удалось опубликовать объявление' };
  if ('error' in created) return { ok: false, error: 'Группа не относится к вашему факультету' };

  revalidatePath('/staff/announcements');
  revalidatePath('/staff');
  return { ok: true };
}
