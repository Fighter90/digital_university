// DIG-68 — «МСП»: каталог студенческих стартапов (/msp) по образцу
// Product Hunt — лента карточек, голоса, комментарии, «Запуск дня».
//
// IDOR-контракт (как у feedback.ts / deanery.ts): контекст строится из
// живой сессии (requireDataCtx). ЧТЕНИЕ ленты и карточки — любой
// вошедший (студент и сотрудник): каталог по определению общий, публичный
// ключ — slug (msp-slug.ts), карточка не содержит ничего сверх самого
// запуска. МУТАЦИИ (голос, комментарий, запуск) — только студент:
// скоуп — ctx.studentId (никогда ввод), сотруднику отказ с аудитом
// ROLE_MISMATCH. Голос и комментарий пишутся только к СУЩЕСТВУЮЩЕМУ
// проекту (несуществующий → отказ NOT_FOUND, единый 404 без оракула
// существования — различие живёт только в AuditLog).
//
// «Запуск дня» детерминирован (НЕ random): проект с максимумом голосов,
// при равенстве — самый свежий (полный детерминизм: ties по slug).

import { denyAccess } from './access';
import type { DataDb } from './port';
import { newMspSlug } from './msp-slug';
import type { DataCtx, MspCommentRow, MspProjectRow } from './types';
// Границы полей живут в lib/msp (клиентский словарь форм) — слой данных
// и клиентские компоненты используют ОДНИ значения.
import {
  MAX_MSP_COMMENT_LENGTH,
  MAX_MSP_DESCRIPTION_LENGTH,
  MAX_MSP_TAGLINE_LENGTH,
  MAX_MSP_TAG_LENGTH,
  MAX_MSP_TAGS,
  MAX_MSP_TITLE_LENGTH,
  MIN_MSP_COMMENT_LENGTH,
  MIN_MSP_DESCRIPTION_LENGTH,
  MIN_MSP_TAGLINE_LENGTH,
  MIN_MSP_TAG_LENGTH,
  MIN_MSP_TITLE_LENGTH,
} from '@/lib/msp';

const RESOURCE = 'msp-project';

export {
  MAX_MSP_COMMENT_LENGTH,
  MAX_MSP_DESCRIPTION_LENGTH,
  MAX_MSP_TAGLINE_LENGTH,
  MAX_MSP_TAG_LENGTH,
  MAX_MSP_TAGS,
  MAX_MSP_TITLE_LENGTH,
  MIN_MSP_COMMENT_LENGTH,
  MIN_MSP_DESCRIPTION_LENGTH,
  MIN_MSP_TAGLINE_LENGTH,
  MIN_MSP_TAG_LENGTH,
  MIN_MSP_TITLE_LENGTH,
};

/** Сортировка ленты: query-параметр ?sort= (по умолчанию «Новые»). */
export type MspSort = 'new' | 'top';

/** Проект в представлении каталога: строка + агрегаты (голоса/комментарии). */
export interface MspProjectView {
  project: MspProjectRow;
  /** Число голосов за проект (агрегат, чужие строки наружу не проходят). */
  votes: number;
  /** Голосовал ли ТЕКУЩИЙ владелец сессии (подсветка кнопки «▲»). */
  votedByMe: boolean;
  /** Число комментариев (агрегат для ленты). */
  comments: number;
}

export interface MspPageData {
  sort: MspSort;
  /** Лента по выбранной сортировке. */
  items: MspProjectView[];
  /** «Запуск дня»: max голосов, при равенстве — самый свежий (не random). */
  launchOfDay: MspProjectView | null;
}

export interface MspProjectDetail {
  project: MspProjectRow;
  votes: number;
  votedByMe: boolean;
  /** Комментарии проекта, старые сверху. */
  comments: MspCommentRow[];
}

export type ToggleMspVoteResult =
  { ok: true; slug: string; voted: boolean; votes: number } | { ok: false; error: string };

export type AddMspCommentResult =
  { ok: true; slug: string; comment: MspCommentRow } | { ok: false; error: string };

export type LaunchMspProjectResult =
  { ok: true; project: MspProjectRow } | { ok: false; error: string };

export interface LaunchMspProjectInput {
  title: string;
  tagline: string;
  description: string;
  /** Строка формы «через запятую»; слой парсит и нормализует теги. */
  tags: string;
  now?: Date;
}

export interface AddMspCommentInput {
  body: string;
  now?: Date;
}

/** Парсинг query-параметра сортировки: всё неизвестное — «Новые». */
export function parseMspSort(raw: string | string[] | undefined): MspSort {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === 'top' ? 'top' : 'new';
}

/** Теги формы «a, b, c» → нормализованный список: trim, без пустых, ≤ 5 × 24. */
export function parseMspTags(raw: string): string[] {
  return raw
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)
    .slice(0, MAX_MSP_TAGS);
}

/** Логотип-буква проекта: первая буква названия (в верхнем регистре). */
export function mspLetterOf(title: string): string {
  const first = title.trim().charAt(0);
  return first.length > 0 ? first.toUpperCase() : '·';
}

/** Счётчик голосов проекта по всем голосам каталога (агрегат). */
function votesFor(allVotes: Array<{ projectId: string }>, projectId: string): number {
  return allVotes.filter((v) => v.projectId === projectId).length;
}

/**
 * «Запуск дня»: максимум голосов, при равенстве — самый свежий createdAt;
 * полный детерминизм (ties по slug) — никакого random.
 */
function launchOfDayOf(items: MspProjectView[]): MspProjectView | null {
  return items.reduce<MspProjectView | null>((best, item) => {
    if (!best) return item;
    if (item.votes !== best.votes) return item.votes > best.votes ? item : best;
    const byTime = item.project.createdAt.getTime() - best.project.createdAt.getTime();
    if (byTime !== 0) return byTime > 0 ? item : best;
    return item.project.slug < best.project.slug ? item : best;
  }, null);
}

/** Сортировка ленты: «Топ» — по голосам, «Новые» — по времени; ties стабильны. */
function sortItems(items: MspProjectView[], sort: MspSort): MspProjectView[] {
  const sorted = [...items];
  sorted.sort((a, b) => {
    if (sort === 'top' && a.votes !== b.votes) return b.votes - a.votes;
    const byTime = b.project.createdAt.getTime() - a.project.createdAt.getTime();
    if (byTime !== 0) return byTime;
    return a.project.slug < b.project.slug ? -1 : a.project.slug > b.project.slug ? 1 : 0;
  });
  return sorted;
}

/**
 * Экран /msp: лента («Новые»/«Топ») + «Запуск дня». Чтение — любой
 * вошедший; мутации отдельно скоуплены ниже.
 */
export async function getMspPage(db: DataDb, ctx: DataCtx, sort: MspSort): Promise<MspPageData> {
  const projects = await db.listMspProjects();
  const allVotes = await db.listMspVotes();
  const myVotes = ctx.studentId === null ? [] : await db.listMspVotesByStudent(ctx.studentId);
  const myProjectIds = new Set(myVotes.map((v) => v.projectId));

  const counts = new Map<string, { votes: number; comments: number }>();
  for (const vote of allVotes) {
    const entry = counts.get(vote.projectId) ?? { votes: 0, comments: 0 };
    entry.votes += 1;
    counts.set(vote.projectId, entry);
  }
  for (const project of projects) {
    const comments = await db.listMspCommentsByProject(project.id);
    const entry = counts.get(project.id) ?? { votes: 0, comments: 0 };
    entry.comments = comments.length;
    counts.set(project.id, entry);
  }

  const items: MspProjectView[] = projects.map((project) => ({
    project,
    votes: counts.get(project.id)?.votes ?? 0,
    comments: counts.get(project.id)?.comments ?? 0,
    votedByMe: myProjectIds.has(project.id),
  }));

  return {
    sort,
    items: sortItems(items, sort),
    launchOfDay: launchOfDayOf(items),
  };
}

/**
 * Карточка проекта по публичному slug. Чтение — любой вошедший. Чужой slug
 * в каталоге отсутствует по определению (каталог общий), поэтому
 * несуществующий slug — всегда NOT_FOUND (аудит попытки).
 */
export async function openMspProjectView(
  db: DataDb,
  ctx: DataCtx,
  slug: string,
): Promise<MspProjectDetail | null> {
  const projects = await db.listMspProjects();
  const project = projects.find((p) => p.slug === slug) ?? null;
  if (!project) {
    await denyAccess(db, { ctx, resourceType: RESOURCE, resourceRef: slug, reason: 'NOT_FOUND' });
    return null;
  }
  const [allVotes, myVotes, comments] = await Promise.all([
    db.listMspVotes(),
    ctx.studentId === null ? Promise.resolve([]) : db.listMspVotesByStudent(ctx.studentId),
    db.listMspCommentsByProject(project.id),
  ]);
  return {
    project,
    votes: votesFor(allVotes, project.id),
    votedByMe: myVotes.some((v) => v.projectId === project.id),
    comments,
  };
}

/**
 * Переключение голоса владельца сессии за существующий проект. Студенту —
 * его собственный голос; сотруднику — отказ (аудит ROLE_MISMATCH);
 * несуществующий проект — отказ (аудит NOT_FOUND).
 */
export async function toggleMspVoteForProject(
  db: DataDb,
  ctx: DataCtx,
  projectId: string,
): Promise<ToggleMspVoteResult> {
  if (ctx.studentId === null) {
    await denyAccess(db, {
      ctx,
      resourceType: RESOURCE,
      resourceRef: projectId,
      reason: 'ROLE_MISMATCH',
    });
    return { ok: false, error: 'Голосовать могут только студенты' };
  }
  const projects = await db.listMspProjects();
  const project = projects.find((p) => p.id === projectId) ?? null;
  if (!project) {
    await denyAccess(db, {
      ctx,
      resourceType: RESOURCE,
      resourceRef: projectId,
      reason: 'NOT_FOUND',
    });
    return { ok: false, error: 'Проект не найден' };
  }
  const result = await db.toggleMspVote(ctx.studentId, projectId);
  if (!result) return { ok: false, error: 'Проект не найден' };
  return { ok: true, slug: project.slug, ...result };
}

/**
 * Комментарий владельца к существующему проекту (1–1000 символов).
 * Автор — всегда владелец сессии (имя из профиля), сотруднику — отказ.
 */
export async function addMspCommentToProject(
  db: DataDb,
  ctx: DataCtx,
  projectId: string,
  input: AddMspCommentInput,
): Promise<AddMspCommentResult> {
  if (ctx.studentId === null) {
    await denyAccess(db, {
      ctx,
      resourceType: RESOURCE,
      resourceRef: projectId,
      reason: 'ROLE_MISMATCH',
    });
    return { ok: false, error: 'Комментировать могут только студенты' };
  }
  const body = input.body.trim();
  if (body.length < MIN_MSP_COMMENT_LENGTH)
    return { ok: false, error: 'Напишите текст комментария' };
  if (body.length > MAX_MSP_COMMENT_LENGTH) {
    return { ok: false, error: `Комментарий длиннее ${MAX_MSP_COMMENT_LENGTH} символов` };
  }
  const projects = await db.listMspProjects();
  const project = projects.find((p) => p.id === projectId) ?? null;
  if (!project) {
    await denyAccess(db, {
      ctx,
      resourceType: RESOURCE,
      resourceRef: projectId,
      reason: 'NOT_FOUND',
    });
    return { ok: false, error: 'Проект не найден' };
  }
  const author = await db.findStudentById(ctx.studentId);
  const comment = await db.appendMspComment(ctx.studentId, projectId, {
    authorName: author?.fullName ?? ctx.login,
    body,
    createdAt: input.now ?? new Date(),
  });
  if (!comment) return { ok: false, error: 'Проект не найден' };
  return { ok: true, slug: project.slug, comment };
}

function validateLaunchInput(input: LaunchMspProjectInput): string | null {
  const title = input.title.trim();
  if (title.length < MIN_MSP_TITLE_LENGTH) {
    return `Название от ${MIN_MSP_TITLE_LENGTH} символов`;
  }
  if (title.length > MAX_MSP_TITLE_LENGTH) {
    return `Название длиннее ${MAX_MSP_TITLE_LENGTH} символов`;
  }
  const tagline = input.tagline.trim();
  if (tagline.length < MIN_MSP_TAGLINE_LENGTH) {
    return `Краткое описание от ${MIN_MSP_TAGLINE_LENGTH} символов`;
  }
  if (tagline.length > MAX_MSP_TAGLINE_LENGTH) {
    return `Краткое описание длиннее ${MAX_MSP_TAGLINE_LENGTH} символов`;
  }
  const description = input.description.trim();
  if (description.length < MIN_MSP_DESCRIPTION_LENGTH) {
    return `Расскажите о проекте подробнее (от ${MIN_MSP_DESCRIPTION_LENGTH} символов)`;
  }
  if (description.length > MAX_MSP_DESCRIPTION_LENGTH) {
    return `Описание длиннее ${MAX_MSP_DESCRIPTION_LENGTH} символов`;
  }
  const tags = parseMspTags(input.tags);
  if (tags.some((tag) => tag.length < MIN_MSP_TAG_LENGTH || tag.length > MAX_MSP_TAG_LENGTH)) {
    return `Теги от ${MIN_MSP_TAG_LENGTH} до ${MAX_MSP_TAG_LENGTH} символов`;
  }
  return null;
}

/**
 * Публикация запуса владельцем. Slug генерирует слой данных (msp-slug.ts:
 * детерминированный транслит заголовка + суффикс, занятые slug'и каталога
 * учтены), логотип-буква — первая буква названия, автор — владелец сессии.
 */
export async function launchMspProject(
  db: DataDb,
  ctx: DataCtx,
  input: LaunchMspProjectInput,
): Promise<LaunchMspProjectResult> {
  if (ctx.studentId === null) {
    await denyAccess(db, {
      ctx,
      resourceType: RESOURCE,
      resourceRef: input.title.slice(0, 40),
      reason: 'ROLE_MISMATCH',
    });
    return { ok: false, error: 'Запускать проекты могут только студенты' };
  }
  const validationError = validateLaunchInput(input);
  if (validationError) return { ok: false, error: validationError };

  const title = input.title.trim();
  const projects = await db.listMspProjects();
  const slug = newMspSlug(
    title,
    projects.map((p) => p.slug),
  );
  const author = await db.findStudentById(ctx.studentId);
  const row = await db.createMspProject(ctx.studentId, {
    slug,
    title,
    tagline: input.tagline.trim(),
    description: input.description.trim(),
    tags: parseMspTags(input.tags),
    authorName: author?.fullName ?? ctx.login,
    letter: mspLetterOf(title),
    createdAt: input.now ?? new Date(),
  });
  return { ok: true, project: row };
}
