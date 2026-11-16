// DIG-46 — server actions AI-ассистента: отправка предзаполненной заявки
// (только по явному подтверждению пользователя) и отчёт о неверном ответе.
//
// IDOR-контракт (как у всех actions, DIG-19): контекст заново строится из
// живой сессии (requireDataCtx), serviceId валидируется белым списком
// формата + слоем данных (createAssistantRequest: каталог + аудитория
// STUDENT + идемпотентность по заголовку). Ассистент сам ничего не
// отправляет — action вызывается только кнопкой «Подтвердить и отправить».
'use server';

import { revalidatePath } from 'next/cache';

import { createAssistantRequest, reportAssistantAnswer, requireDataCtx } from '@/server/data';
import { dataDb } from '@/server/data/db';

export type AssistantRequestState =
  | { ok: true; serviceId: string; requestNumber: string; created: boolean }
  | { ok: false; error: string }
  | null;

export type AssistantReportState = { ok: true } | { ok: false; error: string } | null;

/** Ид сервисов каталога: kebab-case (как в actions/services.ts). */
const SERVICE_ID = /^[a-z][a-z0-9-]{1,63}$/;

/** Лимиты текста отчёта (второй рубеж после слоя данных). */
const QUESTION_LIMIT = 500;
const EXCERPT_LIMIT = 500;

export async function submitAssistantRequestAction(
  _prev: AssistantRequestState,
  formData: FormData,
): Promise<AssistantRequestState> {
  void _prev; // useActionState fixes the (state, payload) signature
  const ctx = await requireDataCtx('/ai-assistant');
  if (ctx.role !== 'STUDENT') {
    return { ok: false, error: 'Заявки через ассистента доступны студентам' };
  }

  const serviceId = String(formData.get('serviceId') ?? '').trim();
  if (!SERVICE_ID.test(serviceId)) {
    return { ok: false, error: 'Некорректная услуга' };
  }

  let result: Awaited<ReturnType<typeof createAssistantRequest>>;
  try {
    result = await createAssistantRequest(dataDb, ctx, serviceId);
  } catch (error) {
    console.error('[assistant] request submit failed', error);
    return { ok: false, error: 'Не удалось отправить заявку. Попробуйте ещё раз.' };
  }

  if (!result) {
    // Чужая услуга и сбой хранения отвечают одинаково (нет оракула).
    return { ok: false, error: 'Не удалось отправить заявку. Попробуйте ещё раз.' };
  }

  revalidatePath('/requests');
  return {
    ok: true,
    serviceId,
    requestNumber: result.request.number,
    created: result.created,
  };
}

export async function reportAssistantAnswerAction(
  _prev: AssistantReportState,
  formData: FormData,
): Promise<AssistantReportState> {
  void _prev; // useActionState fixes the (state, payload) signature
  const ctx = await requireDataCtx('/ai-assistant');
  if (ctx.role !== 'STUDENT') {
    return { ok: false, error: 'Раздел доступен студентам' };
  }

  const question = String(formData.get('question') ?? '').trim();
  const answerExcerpt = String(formData.get('answerExcerpt') ?? '').trim();
  if (question.length === 0 || question.length > QUESTION_LIMIT) {
    return { ok: false, error: 'Некорректный текст вопроса' };
  }

  try {
    const appeal = await reportAssistantAnswer(dataDb, ctx, {
      question,
      answerExcerpt: answerExcerpt.slice(0, EXCERPT_LIMIT),
    });
    if (!appeal) {
      return { ok: false, error: 'Не удалось создать обращение. Попробуйте ещё раз.' };
    }
  } catch (error) {
    console.error('[assistant] report failed', error);
    return { ok: false, error: 'Не удалось создать обращение. Попробуйте ещё раз.' };
  }

  // «Связь с деканатом» (DIG-39+) читает обращения — обновим кэш маршрута.
  revalidatePath('/deanery');
  return { ok: true };
}
