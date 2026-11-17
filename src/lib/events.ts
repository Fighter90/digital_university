// DIG-43 — клиентский словарь экрана «Мероприятия» (/events): тип события,
// подписи-бейджи, фильтры ленты и палитра обложек-заглушек. Файл без
// серверных импортов: его импортируют и компоненты экрана, и слой данных
// (server/data/events.ts) — единственный источник правды для обеих сторон.
// Тот же приём, что у каталога «МСП» (lib/msp) и машины заявок
// (lib/request-machine, чей тип импортирует слой типов данных).

/** Тип мероприятия вуза в афише /events. */
export type CampusEventKind = 'LECTURE' | 'HACKATHON' | 'CAREER' | 'CULTURE';

/** Подпись типа для бейджа карточки (единый словарь UI). */
export const EVENT_KIND_LABELS: Record<CampusEventKind, string> = {
  LECTURE: 'Лекция',
  HACKATHON: 'Хакатон',
  CAREER: 'Карьера',
  CULTURE: 'Культура',
};

/** Фильтры ленты /events (query-параметр ?filter=, состояние в URL). */
export type EventsFilter = 'all' | 'week' | 'faculty' | 'career' | 'online';

/** Подписи чипов фильтров (единый словарь UI). */
export const EVENTS_FILTER_LABELS: Record<EventsFilter, string> = {
  all: 'Все',
  week: 'На этой неделе',
  faculty: 'Мой факультет',
  career: 'Карьера',
  online: 'Онлайн',
};

/** FNV-1a (32 бита) — стабильный хэш без зависимостей; >>> 0 — без знака. */
function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Палитра обложек-заглушек (внешних картинок нет — прототип без сети).
 * Классы — литералы в коде, чтобы Tailwind их собрал.
 */
const COVER_GRADIENTS: Array<{ cover: string; ink: string }> = [
  { cover: 'from-sky-100 to-indigo-200', ink: 'text-indigo-700' },
  { cover: 'from-amber-100 to-orange-200', ink: 'text-orange-700' },
  { cover: 'from-emerald-100 to-teal-200', ink: 'text-teal-700' },
  { cover: 'from-rose-100 to-pink-200', ink: 'text-rose-700' },
  { cover: 'from-violet-100 to-purple-200', ink: 'text-purple-700' },
  { cover: 'from-cyan-100 to-sky-200', ink: 'text-sky-700' },
];

/**
 * Обложка-заглушка: детерминированный градиент по хэшу названия — одинаковое
 * название даёт одинаковую обложку между сборками и тестами (никакого
 * random), как суффикс slug'а в msp-slug.ts.
 */
export function eventCoverOf(title: string): { cover: string; ink: string } {
  const index = fnv1a(title.trim().toLowerCase()) % COVER_GRADIENTS.length;
  return COVER_GRADIENTS[index]!;
}

/** Свободные места: capacity − занято, не уходит в минус. */
export function eventSpotsLeft(capacity: number, taken: number): number {
  return Math.max(0, capacity - taken);
}

/** Русская плюрализация слова «место»: 1 место, 2 места, 5 мест. */
export function placesNoun(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'место';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'места';
  return 'мест';
}

/**
 * Метка мест на карточке: «Осталось N мест» (с плюрализацией) или
 * «Мест нет» при нулях.
 */
export function eventSpotsLabel(capacity: number, taken: number): string {
  const left = eventSpotsLeft(capacity, taken);
  return left === 0 ? 'Мест нет' : `Осталось ${left} ${placesNoun(left)}`;
}
