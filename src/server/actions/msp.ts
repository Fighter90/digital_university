// DIG-68 — server actions каталога «МСП»: переключение голоса («▲» на
// карточке), публикация запуска и комментарий к проекту.
//
// IDOR-контракт (как у всех actions): контекст заново строится из живой
// сессии (requireDataCtx) — скоуп мутации это ctx.studentId, никогда ввод;
// роль перепроверяет слой данных (msp.ts): сотруднику — отказ с аудитом
// ROLE_MISMATCH, голос/комментарий только к СУЩЕСТВУЮЩЕМУ проекту
// (несуществующий — отказ с аудитом NOT_FOUND). Формы работают и без JS
// (прогрессивное улучшение, как в обращениях DIG-39): кнопка голоса —
// обычный form action, композер запуска и комментарий — useActionState.
// Успех запуска → redirect на карточку /msp/<slug>.
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import {
  addMspCommentToProject,
  launchMspProject,
  requireDataCtx,
  toggleMspVoteForProject,
  MAX_MSP_COMMENT_LENGTH,
  MAX_MSP_DESCRIPTION_LENGTH,
  MAX_MSP_TAGLINE_LENGTH,
  MAX_MSP_TITLE_LENGTH,
  MIN_MSP_COMMENT_LENGTH,
  MIN_MSP_DESCRIPTION_LENGTH,
  MIN_MSP_TAGLINE_LENGTH,
  MIN_MSP_TITLE_LENGTH,
} from '@/server/data';
import { dataDb } from '@/server/data/db';

export type MspActionState = { ok: boolean; error?: string } | null;

const readText = (formData: FormData, key: string): string =>
  String(formData.get(key) ?? '').trim();

/** Кнопка «▲» на карточке проекта: голос → повторный клик снимает. */
export async function toggleMspVoteAction(formData: FormData): Promise<void> {
  const projectId = readText(formData, 'projectId');
  const ctx = await requireDataCtx('/msp');
  const result = await toggleMspVoteForProject(dataDb, ctx, projectId);
  if (!result.ok) return; // отказ уже в аудите; лента просто не меняется
  revalidatePath('/msp');
  revalidatePath(`/msp/${result.slug}`);
}

/** Публикация запуска из композера на /msp. Успех → карточка проекта. */
export async function createMspProjectAction(
  _prev: MspActionState,
  formData: FormData,
): Promise<MspActionState> {
  void _prev; // useActionState fixes the (state, payload) signature
  const ctx = await requireDataCtx('/msp');
  if (ctx.role !== 'STUDENT') {
    return { ok: false, error: 'Запускать проекты могут только студенты' };
  }

  const title = readText(formData, 'title');
  const tagline = readText(formData, 'tagline');
  const description = readText(formData, 'description');
  const tags = readText(formData, 'tags');
  // Предварительная проверка границ (полный контракт — в слое данных):
  // короткий early-return даёт форму понятную ошибку до похода в слой.
  if (title.length < MIN_MSP_TITLE_LENGTH) {
    return { ok: false, error: `Название от ${MIN_MSP_TITLE_LENGTH} символов` };
  }
  if (title.length > MAX_MSP_TITLE_LENGTH) {
    return { ok: false, error: `Название длиннее ${MAX_MSP_TITLE_LENGTH} символов` };
  }
  if (tagline.length < MIN_MSP_TAGLINE_LENGTH) {
    return { ok: false, error: `Краткое описание от ${MIN_MSP_TAGLINE_LENGTH} символов` };
  }
  if (tagline.length > MAX_MSP_TAGLINE_LENGTH) {
    return { ok: false, error: `Краткое описание длиннее ${MAX_MSP_TAGLINE_LENGTH} символов` };
  }
  if (description.length < MIN_MSP_DESCRIPTION_LENGTH) {
    return {
      ok: false,
      error: `Расскажите о проекте подробнее (от ${MIN_MSP_DESCRIPTION_LENGTH} символов)`,
    };
  }
  if (description.length > MAX_MSP_DESCRIPTION_LENGTH) {
    return { ok: false, error: `Описание длиннее ${MAX_MSP_DESCRIPTION_LENGTH} символов` };
  }

  const result = await launchMspProject(dataDb, ctx, { title, tagline, description, tags });
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath('/msp');
  redirect(`/msp/${result.project.slug}`);
}

/** Комментарий к проекту на карточке /msp/<slug>. */
export async function addMspCommentAction(
  _prev: MspActionState,
  formData: FormData,
): Promise<MspActionState> {
  void _prev; // useActionState fixes the (state, payload) signature
  const ctx = await requireDataCtx('/msp');
  if (ctx.role !== 'STUDENT') {
    return { ok: false, error: 'Комментировать могут только студенты' };
  }

  const projectId = readText(formData, 'projectId');
  const body = readText(formData, 'body');
  if (body.length < MIN_MSP_COMMENT_LENGTH) {
    return { ok: false, error: 'Напишите текст комментария' };
  }
  if (body.length > MAX_MSP_COMMENT_LENGTH) {
    return { ok: false, error: `Комментарий длиннее ${MAX_MSP_COMMENT_LENGTH} символов` };
  }

  const result = await addMspCommentToProject(dataDb, ctx, projectId, { body });
  if (!result.ok) return { ok: false, error: result.error };

  // Redirect на якорь комментариев сбрасывает форму и показывает ответ.
  revalidatePath('/msp');
  redirect(`/msp/${result.slug}#msp-comments`);
}
