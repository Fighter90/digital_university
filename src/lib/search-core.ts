// DIG-45 — чистое ядро поиска по кабинету (без серверных импортов: работает
// и в server-слое, и в клиентской палитре, и в тестах).
//
// Проблемы аудированного поиска, которые решает контракт:
//  - «30 смешанных результатов» → фиксированный порядок групп (GROUP_ORDER)
//    и лимит попаданий на группу; пустые группы не отрисовываются;
//  - «фильтры по типу работают наоборот» → фильтров по типу нет вовсе:
//    группы — это не фильтры, а разрезы одного запроса;
//  - «поиск FAQ пустой» → FAQ-каталог (DIG-38 подготовит экран) участвует
//    в выдаче наравне с остальными источниками.
//
// Нормализация: нижний регистр, схлопнутые пробелы, фолдинг «ё→е» —
// «верёвка» и «Верёвка» находятся одинаково.

import { servicesForRole, type ServiceEntry, type ServiceRole } from './services-catalog';

export type SearchHitKind =
  'action' | 'section' | 'discipline' | 'request' | 'person' | 'faq' | 'news';

export interface SearchHit {
  /** Уникален внутри выдачи (префикс = вид): ключ опции палитры. */
  id: string;
  kind: SearchHitKind;
  title: string;
  subtitle?: string;
  /** Всегда внутренняя ссылка кабинета (/…). */
  href: string;
  /** Дополнительная строка для матчинга (номер заявки, код дисциплины, теги). */
  meta?: string;
}

export interface SearchGroup {
  kind: SearchHitKind;
  label: string;
  hits: SearchHit[];
}

/** Формат ответа GET /api/search (и данных server-поиска). */
export interface SearchResponse {
  query: string;
  groups: SearchGroup[];
}

export const SEARCH_GROUP_ORDER: SearchHitKind[] = [
  'action',
  'section',
  'discipline',
  'request',
  'person',
  'faq',
  'news',
];

export const SEARCH_GROUP_LABELS: Record<SearchHitKind, string> = {
  action: 'Действия',
  section: 'Разделы',
  discipline: 'Дисциплины',
  request: 'Заявки',
  person: 'Люди',
  faq: 'Вопросы и ответы',
  news: 'Новости',
};

/** Компактность палитры: не более шести попаданий на группу. */
export const MAX_HITS_PER_GROUP = 6;

/** Минимальная длина запроса, по которому ходим в поиск. */
export const MIN_QUERY_LENGTH = 2;

/** Ключ недавних запросов в localStorage (массив строк, ≤5). */
export const RECENT_QUERIES_KEY = 'du.search.recent.v1';
export const MAX_RECENT_QUERIES = 5;

/** Нормализация запроса: trim, нижний регистр, пробелы, «ё→е». */
export function normalizeSearchQuery(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ').replaceAll('ё', 'е');
}

/** Совпадение подстрокой без учёта регистра и с ё-фолдингом. */
export function matchesSearchQuery(haystack: string, query: string): boolean {
  const q = normalizeSearchQuery(query);
  return q.length > 0 && normalizeSearchQuery(haystack).includes(q);
}

/**
 * Похоже ли введённое на (частичный) публичный номер заявки SR-YYYY-XXXXX:
 * «SR», «SR-2026», «SR-2026-A1B» — да; «справка», «SRX-2026-A» — нет.
 */
export function isRequestNumberQuery(raw: string): boolean {
  return /^#?sr(-\d{4}(-[a-z0-9]{0,5})?)?$/i.test(raw.trim());
}

/** Совпал ли хит запросом: название, подзаголовок или мета-строка. */
export function hitMatchesSearch(hit: SearchHit, query: string): boolean {
  return (
    matchesSearchQuery(hit.title, query) ||
    (hit.subtitle !== undefined && matchesSearchQuery(hit.subtitle, query)) ||
    (hit.meta !== undefined && matchesSearchQuery(hit.meta, query))
  );
}

/** Ранг внутри группы: 0 — префикс названия, 1 — остальное вхождение. */
function rank(hit: SearchHit, query: string): 0 | 1 {
  return normalizeSearchQuery(hit.title).startsWith(normalizeSearchQuery(query)) ? 0 : 1;
}

/**
 * Группирует хиты в фиксированном порядке групп, отбрасывает пустые,
 * режет лимит и сортирует внутри группы (префикс — раньше).
 */
export function buildGroups(hits: SearchHit[], query: string): SearchGroup[] {
  const groups: SearchGroup[] = [];
  for (const kind of SEARCH_GROUP_ORDER) {
    const ofKind = hits.filter((h) => h.kind === kind);
    if (ofKind.length === 0) continue;
    const ranked = [...ofKind].sort(
      (a, b) => rank(a, query) - rank(b, query) || a.title.localeCompare(b.title, 'ru'),
    );
    groups.push({
      kind,
      label: SEARCH_GROUP_LABELS[kind],
      hits: ranked.slice(0, MAX_HITS_PER_GROUP),
    });
  }
  return groups;
}

export interface HighlightChunk {
  text: string;
  hit: boolean;
}

/**
 * Куски текста для подсветки (`<mark>`): без учёта регистра и с ё-фолдингом;
 * пустой запрос или без совпадений — один кусок.
 */
export function highlightText(text: string, query: string): HighlightChunk[] {
  const q = normalizeSearchQuery(query);
  if (q === '') return [{ text, hit: false }];
  const lower = normalizeSearchQuery(text);
  const chunks: HighlightChunk[] = [];
  let cursor = 0;
  while (true) {
    const at = lower.indexOf(q, cursor);
    if (at === -1) break;
    if (at > cursor) chunks.push({ text: text.slice(cursor, at), hit: false });
    chunks.push({ text: text.slice(at, at + q.length), hit: true });
    cursor = at + q.length;
  }
  if (chunks.length === 0) return [{ text, hit: false }];
  if (cursor < text.length) chunks.push({ text: text.slice(cursor), hit: false });
  return chunks;
}

/**
 * Популярные действия для пустого поля (по роли сессии): стабильная
 * подборка id каталога сервисов, отфильтрованная ролью — студенту не
 * показывается ни одна чужая запись (DIG-29).
 */
const POPULAR_ACTION_IDS = [
  'cert-enrollment',
  'fin-scholarship-cert',
  'transcript-instant',
  'study-schedule',
  'help-deanery',
  // Роль STAFF: единственный каталог-сервис сотрудника (остальные отфильтрует
  // servicesForRole, студенческие записи сотруднику не показываются).
  'staff-schedule-editor',
];

export function popularActions(role: ServiceRole): ServiceEntry[] {
  const catalog = servicesForRole(role);
  const byId = new Map(catalog.map((service) => [service.id, service]));
  return POPULAR_ACTION_IDS.map((id) => byId.get(id)).filter(
    (service): service is ServiceEntry => service !== undefined,
  );
}

/** Читает недавние запросы (безопасно к мусору в localStorage). */
export function readRecentQueries(
  storage: Storage | null = typeof window === 'undefined' ? null : window.localStorage,
): string[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(RECENT_QUERIES_KEY);
    const parsed: unknown = raw === null ? [] : JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .slice(0, MAX_RECENT_QUERIES);
  } catch {
    return [];
  }
}

/** Записывает запрос в недавние: дедупликация, ≤5, новее — раньше. */
export function saveRecentQuery(
  query: string,
  storage: Storage | null = typeof window === 'undefined' ? null : window.localStorage,
): void {
  const q = query.trim();
  if (!storage || q.length === 0) return;
  const next = [q, ...readRecentQueries(storage).filter((item) => item !== q)];
  storage.setItem(RECENT_QUERIES_KEY, JSON.stringify(next.slice(0, MAX_RECENT_QUERIES)));
}

/** Удаляет все недавние запросы. */
export function clearRecentQueries(
  storage: Storage | null = typeof window === 'undefined' ? null : window.localStorage,
): void {
  storage?.removeItem(RECENT_QUERIES_KEY);
}
