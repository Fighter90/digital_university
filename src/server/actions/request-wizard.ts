// DIG-31 — server action отправки заявки из мастера заказа.
//
// IDOR-контракт (как у всех actions, DIG-19): контекст заново строится из
// живой сессии (requireDataCtx), владелец и валидность входа перепроверяются
// в слое данных (createWizardRequest → белый список каталога + та же функция
// валидации, что на клиенте — обойти проверку формы невозможно). Файлы
// вложений валидируются по количеству/размеру/имени, содержимое в прототипе
// не сохраняется (только имена — в сводке события заявки).
'use server';

import { revalidatePath } from 'next/cache';

import {
  requireDataCtx,
  createWizardRequest,
  type WizardRequestInput,
} from '@/server/data';
import { dataDb } from '@/server/data/db';
import {
  expectedDateFor,
  validateWizardInput,
  wizardDocFor,
  WIZARD_LIMITS,
  type WizardDelivery,
  type WizardFieldErrors,
  type WizardLanguage,
} from '@/lib/request-wizard';

export type WizardSubmitState =
  | { ok: true; number: string; instant: boolean; expectedDateISO: string }
  | { ok: false; error?: string; fieldErrors?: WizardFieldErrors }
  | null;

export async function submitRequestWizardAction(
  _prev: WizardSubmitState,
  formData: FormData,
): Promise<WizardSubmitState> {
  void _prev; // useActionState fixes the (state, payload) signature
  const ctx = await requireDataCtx('/requests');
  if (ctx.role !== 'STUDENT') {
    return { ok: false, error: 'Раздел доступен студентам' };
  }

  const serviceId = String(formData.get('serviceId') ?? '').trim();
  const doc = wizardDocFor(serviceId);
  if (!doc) {
    return { ok: false, error: 'Такой документ недоступен для заказа' };
  }

  const languageRaw = String(formData.get('language') ?? 'RU');
  const language: WizardLanguage = languageRaw === 'EN' ? 'EN' : 'RU';
  const copiesRaw = String(formData.get('copies') ?? '').trim();
  const copies = /^\d+$/.test(copiesRaw) ? Number.parseInt(copiesRaw, 10) : Number.NaN;
  const delivery = String(formData.get('delivery') ?? '').trim() as WizardDelivery;
  const destination = String(formData.get('destination') ?? '').trim();
  const comment = String(formData.get('comment') ?? '').trim();
  const consent = formData.get('consent') === 'on' || formData.get('consent') === '1';

  // Файлы: пустые заглушки (File без имени/размера) не считаются вложениями.
  const files = formData
    .getAll('attachments')
    .filter((entry): entry is File => entry instanceof File && entry.size > 0 && entry.name.trim() !== '');

  const draft = {
    destination,
    language,
    copies,
    delivery,
    comment,
    consent,
    attachments: files.map((file) => ({ name: file.name, size: file.size })),
  };
  const fieldErrors = validateWizardInput(doc, draft);
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  const input: WizardRequestInput = {
    serviceId,
    destination: destination.slice(0, WIZARD_LIMITS.MAX_DESTINATION_LENGTH),
    language,
    copies: Number.isNaN(copies) ? -1 : copies,
    delivery,
    comment: comment.slice(0, WIZARD_LIMITS.MAX_COMMENT_LENGTH),
    consent,
    attachmentNames: files.map((file) => file.name.slice(0, 200)),
  };

  const created = await createWizardRequest(dataDb, ctx, input);
  if (!created) {
    // Чужая/невалидная отправка и сбой хранения отвечают одинаково.
    return { ok: false, error: 'Не удалось отправить заявку. Попробуйте ещё раз.' };
  }

  revalidatePath('/requests');
  return {
    ok: true,
    number: created.number,
    instant: doc.instant,
    expectedDateISO: expectedDateFor(doc.eta, new Date()).toISOString(),
  };
}
