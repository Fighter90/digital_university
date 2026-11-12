// DIG-28 — server action «Записаться» на пересдачу (экран «Сессия»).
//
// IDOR-контракт (как у всех actions, DIG-19): контекст заново строится из
// живой сессии (requireDataCtx), владелец проверяется в слое данных
// (createRetakeRequest → probeExamById + скоуп группы). Аргумент examId
// валидируется по белому списку формата идентификатора до вызова слоя.
// Чужой/несуществующий/не-пересдача examId отвечают одинаково (ошибка
// формы), причина — только в AuditLog.
'use server';

import { revalidatePath } from 'next/cache';

import { requireDataCtx, createRetakeRequest } from '@/server/data';
import { dataDb } from '@/server/data/db';

export type RetakeSignupState =
  | { ok: true; examId: string; requestNumber: string; created: boolean }
  | { ok: false; error: string }
  | null;

/** Идентификаторы контрольных в прототипе: латиница/цифры и дефис (cuid и сиды). */
const EXAM_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

export async function signUpForRetakeAction(
  _prev: RetakeSignupState,
  formData: FormData,
): Promise<RetakeSignupState> {
  void _prev; // useActionState fixes the (state, payload) signature
  const ctx = await requireDataCtx('/grades/session');
  if (ctx.role !== 'STUDENT') {
    return { ok: false, error: 'Раздел доступен студентам' };
  }

  const examId = String(formData.get('examId') ?? '').trim();
  if (!EXAM_ID.test(examId)) {
    return { ok: false, error: 'Некорректный идентификатор пересдачи' };
  }

  let result: Awaited<ReturnType<typeof createRetakeRequest>>;
  try {
    result = await createRetakeRequest(dataDb, ctx, examId);
  } catch (error) {
    console.error('[session] retake signup failed', error);
    return { ok: false, error: 'Не удалось записаться. Попробуйте ещё раз.' };
  }

  if (!result) {
    // Чужая пересдача и сбой хранения отвечают одинаково (нет оракула).
    return { ok: false, error: 'Не удалось записаться. Попробуйте ещё раз.' };
  }

  revalidatePath('/grades/session');
  return {
    ok: true,
    examId,
    requestNumber: result.request.number,
    created: result.created,
  };
}
