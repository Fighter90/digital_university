// DIG-36 — вымышленный каталог новостей и объявлений (конкурсный прототип).
//
// Чистый модуль без серверных импортов (конвенция DIG-12/DIG-29): лента
// /news и страница /news/<id> читают его через слой данных, отметки
// «Прочитано» живут отдельно и owner-scoped (src/server/data/news.ts).
// Все вузы, имена, группы, даты и документы — вымышленные (AGENTS.md);
// даты фиксированные (ноябрь 2026), чтобы карточки не «прыгали» между
// перезапусками прототипа (конвенция DIG-20).

export type NewsTopic = 'study' | 'events' | 'scholarship' | 'dormitory';

export type NewsScope = 'group' | 'faculty' | 'university';

export type NewsTopicFilter = NewsTopic | 'all';

/** Метки тем фильтра (пилюли) — точно по задаче DIG-36. */
// DIG-89 — подписи тем/вкладок из словаря: RU байт-в-байт прежние литералы.
export const NEWS_TOPIC_LABELS: Record<NewsTopic, string> = {
  study: t('ru', 'news.topic.study'),
  events: t('ru', 'news.topic.events'),
  scholarship: t('ru', 'news.topic.scholarship'),
  dormitory: t('ru', 'news.topic.dormitory'),
};

/** Метки вкладок скоупа — точно по задаче DIG-36. */
export const NEWS_SCOPE_LABELS: Record<NewsScope, string> = {
  group: t('ru', 'news.scope.group'),
  faculty: t('ru', 'news.scope.faculty'),
  university: t('ru', 'news.scope.university'),
};

// DIG-89 — EN-подписи по локали (RU — канон байт-в-байт).
import { t, type Locale } from '@/lib/i18n';
import { NEWS as NEWS_CATALOG_RU } from '@/lib/news-catalog-ru';

/** Метка темы новостей: «Учёба» / «Studies». */
export function newsTopicLabel(topic: NewsTopic | 'all', locale: Locale = 'ru'): string {
  return t(locale, `news.topic.${topic}` as const);
}

/** Метка вкладки скоупа: «Моя группа» / «My group». */
export function newsScopeLabel(scope: NewsScope, locale: Locale = 'ru'): string {
  if (locale === 'en') return t('en', `news.scope.${scope}` as const);
  return NEWS_SCOPE_LABELS[scope];
}

/** Тема по умолчанию (без фильтра). */
export const DEFAULT_TOPIC_FILTER: NewsTopicFilter = 'all';

/** URL-парсеры: некорректные значения из searchParams безопасно дают null. */
export function parseNewsScope(raw: string | undefined | null): NewsScope | null {
  return raw === 'group' || raw === 'faculty' || raw === 'university' ? raw : null;
}

export function parseNewsTopic(raw: string | undefined | null): NewsTopicFilter | null {
  if (raw === 'all') return 'all';
  return raw === 'study' || raw === 'events' || raw === 'scholarship' || raw === 'dormitory'
    ? raw
    : null;
}

export interface NewsAttachment {
  name: string;
  /** Статичный вымышленный файл внутри кабинета (/news/files/…). */
  href: string;
  /** Подпись размера для карточки вложения: «TXT · 2 КБ». */
  sizeLabel: string;
}

export interface NewsEntry {
  /** kebab-case id — он же URL: /news/<id>. */
  id: string;
  title: string;
  /** 1–2 предложения для карточки ленты (обрезается line-clamp-2). */
  excerpt: string;
  /** Полный текст статьи абзацами. */
  body: string[];
  topic: NewsTopic;
  scope: NewsScope;
  /** scope=group → группа (например, «ПИ-21»), иначе null. */
  group: string | null;
  /** scope=faculty → факультет (например, «ИТ»), иначе null. */
  faculty: string | null;
  source: string;
  authorName: string;
  publishedAt: Date;
  /** Объявление деканата — попадает в полосу «Важно» сверху ленты. */
  important?: boolean;
  attachments?: NewsAttachment[];
}

export interface NewsCover {
  src: string;
  /** Ключ словаря alt-подписи (DIG-89): RU байт-в-байт прежние литералы. */
  altKey: 'news.cover.study' | 'news.cover.events' | 'news.cover.scholarship' | 'news.cover.dormitory';
  /** Каноническая RU-подпись (совместимость с прежним полем). */
  alt: string;
}

/** Alt обложки по локали (скринридеры). */
export function newsCoverAlt(cover: NewsCover, locale: Locale = 'ru'): string {
  return t(locale, cover.altKey);
}

/**
 * Обложки-иллюстрации: по одной статичной SVG на тему (палитра токенов
 * DIG-13). Alt — человеческий, описывает иллюстрацию для скринридера.
 */
export const NEWS_COVERS: Record<NewsTopic, NewsCover> = {
  study: {
    src: '/news/covers/study.svg',
    altKey: 'news.cover.study',
    alt: t('ru', 'news.cover.study'),
  },
  events: {
    src: '/news/covers/events.svg',
    altKey: 'news.cover.events',
    alt: t('ru', 'news.cover.events'),
  },
  scholarship: {
    src: '/news/covers/scholarship.svg',
    altKey: 'news.cover.scholarship',
    alt: t('ru', 'news.cover.scholarship'),
  },
  dormitory: {
    src: '/news/covers/dormitory.svg',
    altKey: 'news.cover.dormitory',
    alt: t('ru', 'news.cover.dormitory'),
  },
};

/** Свежие сверху — детерминированный порядок во всех выборках. */
function byNewest(a: NewsEntry, b: NewsEntry): number {
  return b.publishedAt.getTime() - a.publishedAt.getTime();
}

export interface NewsStudentScope {
  /** У студента — группа; у сотрудника — null (вкладка группы недоступна). */
  groupName: string | null;
  /** Факультет контекста (студент — свой, сотрудник — свой факультет). */
  faculty: string | null;
}

export function findNews(id: string): NewsEntry | null {
  return NEWS_CATALOG_RU.find((n) => n.id === id) ?? null;
}

/**
 * Выборка скоупа: группа — только новости группы студента, факультет —
 * только его факультета, вуз — общий поток. Сортировка свежие сверху.
 */
export function newsForScope(scope: NewsScope, student: NewsStudentScope): NewsEntry[] {
  return NEWS_CATALOG_RU.filter((n) => {
    if (scope === 'group')
      return n.scope === 'group' && n.group !== null && n.group === student.groupName;
    if (scope === 'faculty') {
      return n.scope === 'faculty' && n.faculty !== null && n.faculty === student.faculty;
    }
    return n.scope === 'university';
  }).sort(byNewest);
}

/** Наложение темы фильтра на выборку скоупа («all» возвращает как есть). */
export function newsForTopic(items: NewsEntry[], topic: NewsTopicFilter): NewsEntry[] {
  if (topic === 'all') return items;
  return items.filter((n) => n.topic === topic);
}

/** Важные объявления выборки (полоса «Важно»), порядок свежие сверху. */
export function importantOf(items: NewsEntry[]): NewsEntry[] {
  return items.filter((n) => n.important === true);
}

/** Дата карточки/статьи: «12 ноября 2026» (детерминированный формат). */
export function formatNewsDate(value: Date, locale: Locale = 'ru'): string {
  if (locale === 'en') {
    return `${new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'long' }).format(value)} ${value.getFullYear()}`;
  }
  // ru-RU с year:numeric добавляет « г.» — собираем вручную для точного вида.
  const dayMonth = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
  }).format(value);
  return `${dayMonth} ${value.getFullYear()}`;
}

/** Текущий каталог (для демо-блока главной и тестов). */
export function listAllNews(): NewsEntry[] {
  return [...NEWS_CATALOG_RU].sort(byNewest);
}

/** Полный каталог как есть (контракт данных; порядок массива не значим). */
export const NEWS_ITEMS: readonly NewsEntry[] = NEWS_CATALOG_RU;
