// DIG-30 — server actions «Заявки и справки»: подача заявки, отмена
// студентом (до IN_PROGRESS), повторная подача после доработки.
//
// IDOR-контракт (как все actions, DIG-19): контекст заново строится из
// живой сессии (requireDataCtx), владение и роль проверяет слой данных
// (canonical-requests.ts). Аргументы валидируются по белым спискам до
// вызова слоя; параметры формы приезжают JSON-строкой и валидируются
// zod'ом по JSON-схеме типа заявки внутри сервиса.
'use server';

import { revalidatePath } from 'next/cache';

import {
  requireDataCtx,
  createCanonicalRequest,
  transitionCanonicalRequest,
  listCanonicalRequestTypes,
} from '@/server/data';
import { dataDb } from '@/server/data/db';

export type RequestActionState =
  | {
      ok: true;
      /** Номер созданной заявки («ЗД-2026-000123»). */
      number?: string;
      /** Повторный заказ за 24 часа: предлагаем скачать готовую. */
      duplicate?: { number: string; title: string };
    }
  | { ok: false; error: string }
  | null;

const TYPE_CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,39}$/;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{4,64}$/;

/**
 * Подача заявки. formData: typeCode + params (JSON-объект полей формы
 * типа в строковом виде). Дубликат за 24 часа не создаётся — ответ
 * несёт номер и название уже готовой заявки для скачивания.
 */
export async function createRequestAction(
  _prev: RequestActionState,
  formData: FormData,
): Promise<RequestActionState> {
  void _prev; // useActionState fixes the (state, payload) signature
  const ctx = await requireDataCtx('/requests');

  const typeCode = String(formData.get('typeCode') ?? '').trim();
  if (!TYPE_CODE_PATTERN.test(typeCode)) {
    return { ok: false, error: 'Выберите тип заявки из списка' };
  }

  let params: Record<string, unknown> = {};
  const rawParams = formData.get('params');
  if (typeof rawParams === 'string' && rawParams.trim() !== '') {
    try {
      const parsed: unknown = JSON.parse(rawParams);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('not an object');
      }
      params = parsed as Record<string, unknown>;
    } catch {
      return { ok: false, error: 'Некорректные параметры формы' };
    }
  }

  // DIG-31 — мета мастера заказа (язык, экземпляры, способ получения,
  // комментарий, метаданные вложений): отдельное поле FormData «wizard»
  // (JSON). Правила проверяет сервис (validateWizardMeta) — те же, что
  // и на клиенте; файлы в прототипе не передаются, только метаданные.
  let wizardMeta: unknown;
  const rawWizard = formData.get('wizard');
  if (typeof rawWizard === 'string' && rawWizard.trim() !== '') {
    try {
      const parsedWizard: unknown = JSON.parse(rawWizard);
      if (!parsedWizard || typeof parsedWizard !== 'object' || Array.isArray(parsedWizard)) {
        throw new Error('not an object');
      }
      wizardMeta = parsedWizard;
    } catch {
      return { ok: false, error: 'Некорректные параметры заказа' };
    }
  }

  const result = await createCanonicalRequest(dataDb, ctx, { typeCode, params, meta: wizardMeta });
  if (result.kind === 'error') {
    return { ok: false, error: result.message };
  }
  if (result.kind === 'duplicate') {
    // Приёмка DIG-30: «повторный заказ за 24 часа предлагает скачать
    // уже готовую» — UI показывает ссылку на документ existing.number.
    return {
      ok: true,
      duplicate: { number: result.existing.number, title: result.title },
    };
  }

  revalidatePath('/requests');
  return { ok: true, number: result.request.number };
}

/** Отмена студентом — только до IN_PROGRESS (проверяет машина состояний). */
export async function cancelRequestAction(
  _prev: RequestActionState,
  formData: FormData,
): Promise<RequestActionState> {
  void _prev;
  const ctx = await requireDataCtx('/requests');

  const requestId = String(formData.get('requestId') ?? '').trim();
  if (!REQUEST_ID_PATTERN.test(requestId)) {
    return { ok: false, error: 'Некорректная заявка' };
  }
  const comment = String(formData.get('comment') ?? '').trim();

  const result = await transitionCanonicalRequest(dataDb, ctx, {
    requestId,
    to: 'CANCELLED',
    comment: comment === '' ? null : comment,
  });
  if (result.kind === 'error') {
    return { ok: false, error: result.message };
  }

  revalidatePath('/requests');
  return { ok: true };
}

/** Повторная подача после доработки (NEEDS_FIX → SUBMITTED). */
export async function resubmitRequestAction(
  _prev: RequestActionState,
  formData: FormData,
): Promise<RequestActionState> {
  void _prev;
  const ctx = await requireDataCtx('/requests');

  const requestId = String(formData.get('requestId') ?? '').trim();
  if (!REQUEST_ID_PATTERN.test(requestId)) {
    return { ok: false, error: 'Некорректная заявка' };
  }
  const comment = String(formData.get('comment') ?? '').trim();

  const result = await transitionCanonicalRequest(dataDb, ctx, {
    requestId,
    to: 'SUBMITTED',
    comment: comment === '' ? null : comment,
  });
  if (result.kind === 'error') {
    return { ok: false, error: result.message };
  }

  revalidatePath('/requests');
  return { ok: true };
}

/**
 * Типы заявок для формы заказа (словарь RequestType): коды, названия,
 * JSON-схемы полей. Чтение публичного словаря — без Owner-проверки,
 * схемы не содержат персональных данных.
 */
export async function listRequestTypesForForm(): Promise<
  Array<{
    code: string;
    name: string;
    etaDays: number | null;
    isInstant: boolean;
    formSchema: unknown;
  }>
> {
  await requireDataCtx('/requests');
  const types = await listCanonicalRequestTypes(dataDb);
  return types.map((type) => ({
    code: type.code,
    name: type.name,
    etaDays: type.etaDays,
    isInstant: type.isInstant,
    formSchema: type.formSchema,
  }));
}
