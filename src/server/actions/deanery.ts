// DIG-39 — server actions «Обращения в деканат»: создание обращения и ответ
// в чате.
//
// IDOR-контракт (как у всех actions): контекст заново строится из живой
// сессии (requireDataCtx), владелец перепроверяется в слое данных
// (createTicket / replyToTicket): чужой номер тикета, чужая заявка или
// дисциплина другой группы не создают записей и пишут отказ в аудит.
// Вложения прототип хранит только именами файлов (байты не сохраняются):
// до 3 файлов, каждый до 5 МБ, имя до 80 символов — проверяется здесь,
// лимит количества и имён дублируется в слое данных. Формы работают и без
// JS (прогрессивное улучшение, как у GradeAppealForm).
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { MAX_ATTACHMENT_BYTES, MAX_TICKET_ATTACHMENTS, TICKET_SUBJECTS } from '@/lib/tickets';
import {
  createTicket,
  replyToTicket,
  requireDataCtx,
  MAX_ATTACHMENT_NAME_LENGTH,
  MIN_TICKET_BODY_LENGTH,
  MAX_TICKET_BODY_LENGTH,
  TICKET_NUMBER_PATTERN,
  normalizeTicketNumber,
} from '@/server/data';
import { dataDb } from '@/server/data/db';

export type TicketActionState = { ok: boolean; error?: string } | null;

type TicketSubjectValue = (typeof TICKET_SUBJECTS)[number];

const isKnownSubject = (value: string): value is TicketSubjectValue =>
  (TICKET_SUBJECTS as string[]).includes(value);

/**
 * Вложения формы: пустые input'ы (File без имени и размера) отбрасываются,
 * затем лимиты — количество, размер (5 МБ) и длина имени.
 */
function readAttachments(formData: FormData): string[] | string {
  const files = formData
    .getAll('attachments')
    .filter((entry): entry is File => entry instanceof File);
  const named = files.filter((file) => file.name.length > 0 && file.size > 0);
  if (named.length > MAX_TICKET_ATTACHMENTS) {
    return `Можно приложить не более ${MAX_TICKET_ATTACHMENTS} файлов`;
  }
  for (const file of named) {
    if (file.size > MAX_ATTACHMENT_BYTES) {
      return `Файл «${file.name}» больше 5 МБ`;
    }
    if (file.name.length > MAX_ATTACHMENT_NAME_LENGTH) {
      return `Имя файла длиннее ${MAX_ATTACHMENT_NAME_LENGTH} символов`;
    }
  }
  return named.map((file) => file.name);
}

const readText = (formData: FormData, key: string): string =>
  String(formData.get(key) ?? '').trim();

/** Создание обращения из композера на /deanery. Успех → редирект в чат. */
export async function createTicketAction(
  _prev: TicketActionState,
  formData: FormData,
): Promise<TicketActionState> {
  void _prev; // useActionState fixes the (state, payload) signature
  const ctx = await requireDataCtx('/deanery');
  if (ctx.role !== 'STUDENT') {
    return { ok: false, error: 'Раздел доступен студентам' };
  }

  const subject = readText(formData, 'subject');
  if (!isKnownSubject(subject)) {
    return { ok: false, error: 'Выберите тему из списка' };
  }
  const body = readText(formData, 'body');
  if (body.length < MIN_TICKET_BODY_LENGTH) {
    return { ok: false, error: 'Напишите текст обращения' };
  }
  if (body.length > MAX_TICKET_BODY_LENGTH) {
    return { ok: false, error: `Текст длиннее ${MAX_TICKET_BODY_LENGTH} символов` };
  }
  const attachments = readAttachments(formData);
  if (typeof attachments === 'string') return { ok: false, error: attachments };

  const requestNumber = readText(formData, 'requestNumber');
  const disciplineCode = readText(formData, 'disciplineCode');

  const result = await createTicket(dataDb, ctx, {
    subject,
    body,
    attachments,
    requestNumber: requestNumber.length > 0 ? requestNumber : null,
    disciplineCode: disciplineCode.length > 0 ? disciplineCode : null,
  });
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath('/deanery');
  // Новый тикет сразу открыт в чате (список refreshed выше).
  redirect(`/deanery/${result.ticket.number}`);
}

/** Ответ студента в чате своего обращения. */
export async function replyToTicketAction(
  _prev: TicketActionState,
  formData: FormData,
): Promise<TicketActionState> {
  void _prev;
  const ctx = await requireDataCtx('/deanery');
  if (ctx.role !== 'STUDENT') {
    return { ok: false, error: 'Раздел доступен студентам' };
  }

  const ticketNumber = normalizeTicketNumber(readText(formData, 'ticketNumber'));
  if (!TICKET_NUMBER_PATTERN.test(ticketNumber)) {
    return { ok: false, error: 'Некорректный номер обращения' };
  }
  const body = readText(formData, 'body');
  if (body.length < MIN_TICKET_BODY_LENGTH) {
    return { ok: false, error: 'Напишите сообщение' };
  }
  const attachments = readAttachments(formData);
  if (typeof attachments === 'string') return { ok: false, error: attachments };

  const result = await replyToTicket(dataDb, ctx, ticketNumber, { body, attachments });
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath('/deanery');
  revalidatePath(`/deanery/${ticketNumber}`);
  return { ok: true };
}
