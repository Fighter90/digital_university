// DIG-40 — server action канала «Обратная связь руководству»: создание
// обращения (предложение / жалоба / благодарность) с выбором адресата,
// вложениями и переключателем «Анонимно».
//
// IDOR-контракт (как у всех actions): контекст заново строится из живой
// сессии (requireDataCtx), роль проверяется здесь и в слое данных
// (createFeedback): сотруднику — отказ, студенту — его собственная строка.
// АНОНИМНОСТЬ (приёмка DIG-40): при включённом переключателе обращение
// сохраняется без связи с пользователем — на клиент после редиректа не
// попадает никаких пользовательских полей (страница подтверждения строится
// из минимального представления слоя данных, см. getFeedbackSentView).
//
// Вложения прототип хранит только именами файлов (байты не сохраняются):
// до 3 файлов, каждый до 5 МБ, имя до 80 символов. Форма работает и без
// JS (прогрессивное улучшение, как в обращениях DIG-39).
// Успех → redirect: подписанное обращение — в карточку /feedback/<номер>
// (номер и срок ответа видны сразу), анонимное — на подтверждение
// /feedback/sent/<номер>.
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import {
  MAX_FEEDBACK_ATTACHMENTS,
  MAX_FEEDBACK_ATTACHMENT_BYTES,
  MAX_FEEDBACK_ATTACHMENT_NAME_LENGTH,
  MAX_FEEDBACK_TEXT_LENGTH,
  MIN_FEEDBACK_TEXT_LENGTH,
} from '@/lib/feedback';
import { createFeedback, requireDataCtx } from '@/server/data';
import type { FeedbackKind, FeedbackTarget } from '@/server/data/types';
import { dataDb } from '@/server/data/db';

export type FeedbackActionState = { ok: boolean; error?: string } | null;

const readText = (formData: FormData, key: string): string =>
  String(formData.get(key) ?? '').trim();

/**
 * Вложения формы: пустые input'ы (File без имени и размера) отбрасываются,
 * затем лимиты — количество (3), размер (5 МБ) и длина имени (80 символов).
 */
function readAttachments(formData: FormData): string[] | string {
  const files = formData
    .getAll('attachments')
    .filter((entry): entry is File => entry instanceof File);
  const named = files.filter((file) => file.name.length > 0 && file.size > 0);
  if (named.length > MAX_FEEDBACK_ATTACHMENTS) {
    return `Можно приложить не более ${MAX_FEEDBACK_ATTACHMENTS} файлов`;
  }
  for (const file of named) {
    if (file.size > MAX_FEEDBACK_ATTACHMENT_BYTES) {
      return `Файл «${file.name}» больше 5 МБ`;
    }
    if (file.name.length > MAX_FEEDBACK_ATTACHMENT_NAME_LENGTH) {
      return `Имя файла длиннее ${MAX_FEEDBACK_ATTACHMENT_NAME_LENGTH} символов`;
    }
  }
  return named.map((file) => file.name);
}

/** Создание обращения из композера на /feedback. */
export async function createFeedbackAction(
  _prev: FeedbackActionState,
  formData: FormData,
): Promise<FeedbackActionState> {
  void _prev; // useActionState fixes the (state, payload) signature
  const ctx = await requireDataCtx('/feedback');
  if (ctx.role !== 'STUDENT') {
    return { ok: false, error: 'Раздел доступен студентам' };
  }

  const kind = readText(formData, 'kind') as FeedbackKind;
  const target = readText(formData, 'target') as FeedbackTarget;
  const text = readText(formData, 'text');
  if (text.length < MIN_FEEDBACK_TEXT_LENGTH) {
    return { ok: false, error: 'Напишите текст обращения' };
  }
  if (text.length > MAX_FEEDBACK_TEXT_LENGTH) {
    return { ok: false, error: `Текст длиннее ${MAX_FEEDBACK_TEXT_LENGTH} символов` };
  }
  const attachments = readAttachments(formData);
  if (typeof attachments === 'string') return { ok: false, error: attachments };

  // Переключатель «Анонимно»: чекбокс формы (работает и без JS).
  const isAnonymous = formData.get('anonymous') === 'on';

  const result = await createFeedback(dataDb, ctx, {
    kind,
    target,
    text,
    attachments,
    isAnonymous,
  });
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath('/feedback');
  if (result.feedback.isAnonymous) {
    // Анонимное: только подтверждение по номеру — карточка недоступна всем.
    redirect(`/feedback/sent/${result.feedback.number}`);
  }
  // Подписанное: карточка обращения — номер и срок ответа сразу.
  redirect(`/feedback/${result.feedback.number}`);
}
