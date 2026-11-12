// DIG-27 — server action «Ошибка в оценке?»: обращение в деканат с
// предзаполненной дисциплиной.
//
// IDOR-контракт (как у всех actions, DIG-19): контекст заново строится из
// живой сессии (requireDataCtx), владелец проверяется в слое данных
// (createGradeAppeal → getDisciplineCard): чужая/несуществующая дисциплина
// не создаёт обращение и пишет отказ в аудит. Аргумент валидируется
// по белому списку формата кода дисциплины до вызова слоя.
'use server';

import { revalidatePath } from 'next/cache';

import { requireDataCtx, createGradeAppeal } from '@/server/data';
import { dataDb } from '@/server/data/db';

export type GradeAppealState = { ok: boolean; error?: string } | null;

/** Коды дисциплин в прототипе: латиница, цифры и дефис (PI21-ALG, EK11-MATH). */
const DISCIPLINE_CODE = /^[A-Za-z0-9][A-Za-z0-9-]{0,63}$/;

export async function createGradeAppealAction(
  _prev: GradeAppealState,
  formData: FormData,
): Promise<GradeAppealState> {
  void _prev; // useActionState fixes the (state, payload) signature
  const ctx = await requireDataCtx('/grades');
  if (ctx.role !== 'STUDENT') {
    return { ok: false, error: 'Раздел доступен студентам' };
  }

  const disciplineCode = String(formData.get('disciplineCode') ?? '').trim();
  if (!DISCIPLINE_CODE.test(disciplineCode)) {
    return { ok: false, error: 'Некорректный код дисциплины' };
  }

  const appeal = await createGradeAppeal(dataDb, ctx, disciplineCode);
  if (!appeal) {
    // Чужая дисциплина и сбой хранения отвечают одинаково (нет оракула).
    return { ok: false, error: 'Не удалось создать обращение. Попробуйте ещё раз.' };
  }

  revalidatePath('/grades');
  return { ok: true };
}
