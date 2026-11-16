// DIG-34 — server action «Отметить выполненной» (ручные задачи экрана
// «Задачи»).
//
// IDOR-контракт (как у всех actions, DIG-19): контекст заново строится из
// живой сессии (requireDataCtx), владелец проверяется в слое данных
// (markTaskDone → probeStudentTaskById + скоуп studentId). Аргумент taskId
// валидируется по белому списку формата идентификатора до вызова слоя.
// Чужой/несуществующий taskId отвечают одинаково (ошибка формы), причина —
// только в AuditLog. Отметка идемпотентна (повтор — без ошибки).
'use server';

import { revalidatePath } from 'next/cache';

import { requireDataCtx, markTaskDone } from '@/server/data';
import { dataDb } from '@/server/data/db';

export type MarkTaskDoneState = { ok: true; taskId: string } | { ok: false; error: string } | null;

/** Идентификаторы задач в прототипе: латиница/цифры и дефис (сиды). */
const TASK_ID = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;

export async function markTaskDoneAction(
  _prev: MarkTaskDoneState,
  formData: FormData,
): Promise<MarkTaskDoneState> {
  void _prev; // useActionState fixes the (state, payload) signature
  const ctx = await requireDataCtx('/tasks');
  if (ctx.role !== 'STUDENT') {
    return { ok: false, error: 'Раздел доступен студентам' };
  }

  const taskId = String(formData.get('taskId') ?? '').trim();
  if (!TASK_ID.test(taskId)) {
    return { ok: false, error: 'Некорректный идентификатор задачи' };
  }

  let marked: Awaited<ReturnType<typeof markTaskDone>>;
  try {
    marked = await markTaskDone(dataDb, ctx, taskId);
  } catch (error) {
    console.error('[tasks] mark done failed', error);
    return { ok: false, error: 'Не удалось отметить задачу. Попробуйте ещё раз.' };
  }

  if (!marked) {
    // Чужая задача и сбой хранения отвечают одинаково (нет оракула).
    return { ok: false, error: 'Не удалось отметить задачу. Попробуйте ещё раз.' };
  }

  revalidatePath('/tasks');
  revalidatePath('/dashboard');
  return { ok: true, taskId };
}
