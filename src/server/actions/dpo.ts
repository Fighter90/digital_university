// DIG-42 — server action записи на программу ДПО (кнопка «Записаться» на
// карточке каталога /dpo).
//
// IDOR-контракт (как у всех actions): контекст заново строится из живой
// сессии (requireDataCtx) — скоуп мутации это ctx.studentId, никогда ввод;
// роль и существование программы перепроверяет слой данных (dpo.ts):
// сотруднику — мягкий отказ без аудита (раздел только в студенческом меню),
// несуществующая программа — отказ с аудитом NOT_FOUND, повторная запись —
// отказ без мутации (UNIQUE пара программа+студент). Форма — обычный
// form action: работает и без JS (прогрессивное улучшение, как в МСП).
'use server';

import { revalidatePath } from 'next/cache';

import { enrollDpoProgram, requireDataCtx } from '@/server/data';
import { dataDb } from '@/server/data/db';

const readText = (formData: FormData, key: string): string =>
  String(formData.get(key) ?? '').trim();

/** Кнопка «Записаться» на карточке программы каталога /dpo. */
export async function enrollDpoAction(formData: FormData): Promise<void> {
  const programId = readText(formData, 'programId');
  const ctx = await requireDataCtx('/dpo');
  const result = await enrollDpoProgram(dataDb, ctx, programId);
  if (!result.ok) return; // отказ уже обработан слоем (аудит/текст); лента не меняется
  revalidatePath('/dpo');
}
