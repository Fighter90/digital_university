// DIG-24 — server actions заметки студента к паре (панель «Детали пары»).
//
// IDOR-контракт (как у всех actions): контекст заново строится из живой
// сессии (requireDataCtx), id пары НЕ является ключом доступа — скоуп
// «своей группы» проверяет слой данных (saveEventNote / deleteEventNote,
// DIG-21): чужая пара и несуществующий id дают единый отказ + запись в
// аудите. Лимит 500 символов дублируется слоем данных (MAX_NOTE_LENGTH).
'use server';

import { revalidatePath } from 'next/cache';

import { deleteEventNote, requireDataCtx, saveEventNote } from '@/server/data';
import { dataDb } from '@/server/data/db';

export type EventNoteState = { ok: boolean; error?: string } | null;

/** Слой данных уже отклоняет пустой/длинный текст — здесь только парсинг. */
export async function saveEventNoteAction(
  _prev: EventNoteState,
  formData: FormData,
): Promise<EventNoteState> {
  void _prev; // useActionState fixes the (state, payload) signature
  const ctx = await requireDataCtx('/schedule');

  const eventId = String(formData.get('eventId') ?? '').trim();
  if (eventId.length === 0 || eventId.length > 128) {
    return { ok: false, error: 'Некорректная пара' };
  }
  const text = String(formData.get('text') ?? '');

  const saved = await saveEventNote(dataDb, ctx, eventId, text);
  if (!saved) {
    return { ok: false, error: 'Заметка пустая или длиннее 500 символов' };
  }
  revalidatePath('/schedule');
  return { ok: true };
}

export async function deleteEventNoteAction(
  _prev: EventNoteState,
  formData: FormData,
): Promise<EventNoteState> {
  void _prev;
  const ctx = await requireDataCtx('/schedule');

  const eventId = String(formData.get('eventId') ?? '').trim();
  if (eventId.length === 0 || eventId.length > 128) {
    return { ok: false, error: 'Некорректная пара' };
  }

  const deleted = await deleteEventNote(dataDb, ctx, eventId);
  if (!deleted) {
    return { ok: false, error: 'Заметку удалить не удалось' };
  }
  revalidatePath('/schedule');
  return { ok: true };
}
