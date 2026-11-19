// DIG-102 — server actions избранного справочника людей (/people).
//
// IDOR-контракт (как у всех actions): контекст заново строится из живой
// сессии (requireDataCtx), personId валидируется белым списком слоя данных
// (каталог людей или одногруппник СВОЕЙ группы), скоуп владельца — в
// toggleFavoritePerson/listFavoritePersons. Форма работает и без JS
// (прогрессивное улучшение, как у каталога сервисов DIG-29).
'use server';

import { revalidatePath } from 'next/cache';

import {
  listFavoritePersons as listFavoritePersonsData,
  requireDataCtx,
  toggleFavoritePerson,
} from '@/server/data';
import { dataDb } from '@/server/data/db';

export type FavoritePersonState = { ok: boolean; error?: string } | null;

/** Ключ человека в избранном: id каталога или «groupmate:<Student.id>». */
const PERSON_ID_MAX_LENGTH = 128;

export async function toggleFavoritePersonAction(
  _prev: FavoritePersonState,
  formData: FormData,
): Promise<FavoritePersonState> {
  void _prev; // useActionState fixes the (state, payload) signature
  const ctx = await requireDataCtx('/people');

  const personId = String(formData.get('personId') ?? '').trim();
  if (personId === '' || personId.length > PERSON_ID_MAX_LENGTH) {
    return { ok: false, error: 'Некорректный человек' };
  }
  const on = String(formData.get('on') ?? '1') === '1';

  const result = await toggleFavoritePerson(dataDb, ctx, personId, on);
  if (result.ok) {
    // Обновляем весь сегмент /people: список, вкладку «★ Избранное» и
    // карточку /people/<id> (звезда синхронна между ними).
    revalidatePath('/people', 'layout');
  }
  return result;
}

/** Избранное владельца сессии (страница /people и её вкладки). */
export async function listFavoritePersons() {
  const ctx = await requireDataCtx('/people');
  return listFavoritePersonsData(dataDb, ctx);
}
