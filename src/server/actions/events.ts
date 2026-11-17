// DIG-43 — server actions экрана «Мероприятия»: переключение записи
// («Записаться» / «Вы записаны ✓» на карточке и странице события).
//
// IDOR-контракт (как у всех actions): контекст заново строится из живой
// сессии (requireDataCtx) — скоуп мутации это ctx.studentId, никогда
// ввод; роль и существование мероприятия перепроверяет слой данных
// (events.ts): сотруднику — отказ с аудитом ROLE_MISMATCH, запись —
// только на СУЩЕСТВУЮЩЕЕ мероприятие (несуществующее — отказ с аудитом
// NOT_FOUND), при заполненной вместимости — отказ «Мест нет». Форма
// работает и без JS (прогрессивное улучшение, как кнопка голоса в МСП).
//
// NOTE (прототип): записанное мероприятие НЕ добавляется в /schedule —
// афиша событий и расписание пар живут в концепте раздельно; синхронизация
// «запись → слот расписания» — задумка для версии после конкурса.
'use server';

import { revalidatePath } from 'next/cache';

import { requireDataCtx, toggleEventRegistrationForStudent } from '@/server/data';
import { dataDb } from '@/server/data/db';

/** Кнопка «Записаться»: запись → повторный клик отменяет запись. */
export async function toggleEventRegistrationAction(formData: FormData): Promise<void> {
  const eventId = String(formData.get('eventId') ?? '').trim();
  const ctx = await requireDataCtx('/events');
  const result = await toggleEventRegistrationForStudent(dataDb, ctx, eventId);
  if (!result.ok) return; // отказ уже в аудите/валидации; лента просто не меняется
  revalidatePath('/events');
  revalidatePath(`/events/${result.slug}`);
}
