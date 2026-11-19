// DIG-36 — «Новости и объявления» (/news, /news/<id>).
//
// Контент новостей — публичный вымышленный каталог (lib/news-catalog,
// как services-catalog у DIG-29): статьи доступны любому авторизованному
// пользователю кабинета, персональных данных в них нет. Персональная
// часть — отметки «Прочитано» полосы «Важно»: owner-scoped по ctx.studentId,
// id новости валидируется белым списком каталога ДО записи; сотруднику
// отметки не пишутся. Скоупинг ленты строится из контекста сессии
// (groupName/faculty) — id студента из URL не существует по построению.

import {
  DEFAULT_TOPIC_FILTER,
  findNews,
  importantOf,
  newsForScope,
  newsForTopic,
  parseNewsScope,
  parseNewsTopic,
  listAllNews,
  type NewsEntry,
  type NewsScope,
  type NewsTopicFilter,
} from '@/lib/news-catalog';

import type { DataDb } from './port';
import type { DataCtx } from './types';

export { parseNewsScope, parseNewsTopic };
export type { NewsScope, NewsTopicFilter };

// ── Блок «Новости деканата» на главной (DIG-20) ────────────────────────────

export interface DeaneryNewsItem {
  id: string;
  title: string;
  excerpt: string;
  publishedAt: Date;
}

/**
 * Свежие первыми — фиксированный порядок, одинаковый для всех студентов.
 * DIG-36: карточки блока ведут на /news/<id>, поэтому источник — каталог
 * новостей (раньше был отдельный статичный фид).
 */
export function listDeaneryNews(limit = 5): DeaneryNewsItem[] {
  return listAllNews()
    .slice(0, limit)
    .map((n) => ({
      id: n.id,
      title: n.title,
      excerpt: n.excerpt,
      publishedAt: n.publishedAt,
    }));
}

// ── Лента /news ────────────────────────────────────────────────────────────

export interface NewsPageInput {
  /** Сырое значение из searchParams (?scope=…); некорректное → дефолт. */
  scope?: string | undefined | null;
  /** Сырое значение из searchParams (?topic=…); некорректное → «all». */
  topic?: string | undefined | null;
}

/** Карточка ленты/полосы: контент каталога + личная отметка «Прочитано». */
export type NewsCardView = NewsEntry & { isRead: boolean };

export interface NewsPageData {
  /** Эффективный скоуп ленты (сотруднику «group» заменяется на «faculty»). */
  scope: NewsScope;
  /** true — запрошенная вкладка «Моя группа» заменена факультетом (сотрудник). */
  scopeDefaulted: boolean;
  /** Эффективная тема фильтра (некорректное значение из URL → «all»). */
  topic: NewsTopicFilter;
  /** Полоса «Важно»: важные объявления текущего скоупа (свежие сверху). */
  announcements: NewsCardView[];
  /** Лента карточек текущего скоупа + темы (свежие сверху). */
  items: NewsCardView[];
}

/** Контент каталога не персонален — скоупить его по владельцу не нужно. */
function withReadState(items: NewsEntry[], readIds: ReadonlySet<string>): NewsCardView[] {
  return items.map((item) => ({ ...item, isRead: readIds.has(item.id) }));
}

export async function getNewsPage(
  db: DataDb,
  ctx: DataCtx,
  input: NewsPageInput = {},
): Promise<NewsPageData> {
  // Сотрудник без группы не может открыть вкладку «Моя группа» — показываем
  // факультет и помечаем подмену, чтобы UI отметил нужную вкладку.
  const requested = parseNewsScope(input.scope) ?? 'group';
  const scopeDefaulted = requested === 'group' && ctx.groupName === null;
  const scope: NewsScope = scopeDefaulted ? 'faculty' : requested;
  const topic = parseNewsTopic(input.topic) ?? DEFAULT_TOPIC_FILTER;

  const studentScope = { groupName: ctx.groupName, faculty: ctx.faculty };
  const scoped = newsForScope(scope, studentScope);

  const readIds =
    ctx.studentId === null
      ? new Set<string>()
      : new Set(await db.listNewsReadIdsByStudent(ctx.studentId));

  const filtered = newsForTopic(scoped, topic);
  return {
    scope,
    scopeDefaulted,
    topic,
    announcements: withReadState(importantOf(scoped), readIds),
    items: withReadState(filtered, readIds),
  };
}

// ── Страница новости /news/<id> ────────────────────────────────────────────

export interface NewsArticleData {
  article: NewsEntry;
  isRead: boolean;
}

/**
 * Статья + отметка «Прочитано» владельца. Контент публичный внутри кабинета:
 * сотрудник читает как студент, но отметок у него нет (нет студенческого
 * скоупа). Неизвестный id → null (страница отвечает униформным 404).
 */
export async function getNewsArticle(
  db: DataDb,
  ctx: DataCtx,
  id: string,
): Promise<NewsArticleData | null> {
  const article = findNews(id);
  if (!article) return null;
  if (ctx.studentId === null) return { article, isRead: false };
  const readIds = new Set(await db.listNewsReadIdsByStudent(ctx.studentId));
  return { article, isRead: readIds.has(id) };
}

/**
 * Отметка «Прочитано»: whitelist каталога ДО записи, owner-scoped по
 * ctx.studentId, идемпотентно. false — id неизвестен каталогу или у
 * контекста нет студенческого скоупа (сотрудник).
 */
export async function markNewsRead(db: DataDb, ctx: DataCtx, id: string): Promise<boolean> {
  if (ctx.studentId === null) return false;
  if (!findNews(id)) return false;
  await db.markNewsReadByStudent(ctx.studentId, id);
  return true;
}

// ── Блок «Новости деканата» на главной (DIG-20): фиктивные записи ──────────
const NEWS: DeaneryNewsItem[] = [
  {
    id: 'news-retake-schedule',
    title: 'Расписание пересдач опубликовано',
    excerpt: 'Пересдача по информатике — 18 ноября, ауд. 305. Начало в 9:00, приходите с зачёткой.',
    publishedAt: new Date(2026, 10, 10, 12, 0),
  },
  {
    id: 'news-practice-intake',
    title: 'Приём заявлений на летнюю практику',
    excerpt: 'Заявления принимаются до 30 ноября — подайте прямо в кабинете, раздел «Заявки».',
    publishedAt: new Date(2026, 10, 8, 12, 0),
  },
  {
    id: 'news-scholarship',
    title: 'Повышенная стипендия: документы',
    excerpt: 'Списки на повышенную стипендию формируются до 25 ноября. Нужна справка об оценках.',
    publishedAt: new Date(2026, 10, 6, 12, 0),
  },
  {
    id: 'news-library-hours',
    title: 'Читальный зал: новый график',
    excerpt: 'С 16 ноября библиотека работает до 21:00 в будние дни. Ночь библиотеки — 20 ноября.',
    publishedAt: new Date(2026, 10, 4, 12, 0),
  },
  {
    id: 'news-deanery-office-hours',
    title: 'Деканат: часы приёма на ноябрь',
    excerpt: 'Специалист деканата принимает по вопросам заявлений ежедневно 10:00–16:00, ауд. 214.',
    publishedAt: new Date(2026, 10, 2, 12, 0),
  },
];
