// DIG-29 — server action звёздочки избранного в каталоге сервисов.
//
// IDOR-контракт (как у всех actions, DIG-19): контекст заново строится из
// живой сессии (requireDataCtx), id сервиса валидируется белым списком
// каталога, лимит и скоуп владельца — в слое данных (toggleFavoriteService).
// Форма работает и без JS (прогрессивное улучшение, как у GradeAppealForm).
'use server';

import { revalidatePath } from 'next/cache';

import { requireDataCtx, toggleFavoriteService } from '@/server/data';
import { dataDb } from '@/server/data/db';

export type FavoriteState = { ok: boolean; error?: string } | null;

/** Ид сервисов каталога: kebab-case (cert-enrollment, transcript-instant…). */
const SERVICE_ID = /^[a-z][a-z0-9-]{1,63}$/;

export async function toggleFavoriteAction(
  _prev: FavoriteState,
  formData: FormData,
): Promise<FavoriteState> {
  void _prev; // useActionState fixes the (state, payload) signature
  const ctx = await requireDataCtx('/services');

  const serviceId = String(formData.get('serviceId') ?? '').trim();
  if (!SERVICE_ID.test(serviceId)) {
    return { ok: false, error: 'Некорректный сервис' };
  }
  const on = String(formData.get('on') ?? '1') === '1';

  const result = await toggleFavoriteService(dataDb, ctx, serviceId, on);
  if (result.ok) {
    revalidatePath('/services');
  }
  return result;
}
