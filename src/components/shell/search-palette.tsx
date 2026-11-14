'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  CircleHelp,
  Compass,
  FileText,
  Loader2,
  Newspaper,
  Search,
  Sparkles,
  User,
  X,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ShellUserRole } from '@/lib/user';
import {
  MIN_QUERY_LENGTH,
  MAX_CACHED_QUERIES,
  clearRecentQueries,
  highlightText,
  popularActions,
  readRecentQueries,
  saveRecentQuery,
  type SearchGroup,
  type SearchHit,
  type SearchHitKind,
  type SearchResponse,
} from '@/lib/search-core';

type SearchPaletteProps = {
  open: boolean;
  onClose: () => void;
  /** Кнопка поиска в TopBar — при закрытии диалога фокус возвращается на неё. */
  returnFocusRef?: React.RefObject<HTMLButtonElement | null>;
  /** Роль сессии: популярные действия и выдача соответствуют роли. */
  role: ShellUserRole;
};

/** Плоский элемент навигации: попадание из группы или AI-подвал. */
type FlatItem = { type: 'hit'; hit: SearchHit; groupKind: SearchHitKind } | { type: 'ai' };

const HIT_ICONS: Record<SearchHitKind, typeof Zap> = {
  action: Zap,
  section: Compass,
  discipline: BookOpen,
  request: FileText,
  person: User,
  faq: CircleHelp,
  news: Newspaper,
};

const DEBOUNCE_MS = 120;

/** Подсветка совпадения в тексте результата. */
function Highlighted({ text, query }: { text: string; query: string }) {
  return (
    <>
      {highlightText(text, query).map((chunk, index) =>
        chunk.hit ? (
          <mark key={index} className="rounded-sm bg-accent-soft px-0.5 text-accent-ink">
            {chunk.text}
          </mark>
        ) : (
          <span key={index}>{chunk.text}</span>
        ),
      )}
    </>
  );
}

// DIG-45: командная палитра «Поиск по кабинету» (Figma «24 · Поиск ⌘K»).
// Каркас диалога — контракты DIG-14 (⌘K, Escape, возврат фокуса на кнопку
// поиска). Поведение: debounce-запрос в /api/search (скоуп по сессии на
// сервере), группы результатов в фиксированном порядке, ↑/↓ — общий список,
// Tab/Shift+Tab — переход между группами, Enter — открыть, пустое поле —
// недавние запросы + популярные действия, подвал «Спросить AI». На <768 px
// поиск открывается на весь экран.
//
// Замечание по React: сброс при открытии выполнен паттерном «adjust state
// when a prop changes» (setState во время рендера), а планирование поиска —
// из обработчиков ввода: синхронный setState в теле эффектов запрещён
// (react-hooks/set-state-in-effect) и вызывает каскадные рендеры.
export function SearchPalette({ open, onClose, returnFocusRef, role }: SearchPaletteProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seqRef = useRef(0);
  const cacheRef = useRef(new Map<string, SearchResponse>());
  // Был ли диалог открыт раньше — чтобы не красть фокус при первом рендере.
  const wasOpenRef = useRef(false);

  const [query, setQuery] = useState('');
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  // Недавние — лениво при монтировании и заново при каждом открытии.
  const [recents, setRecents] = useState<string[]>(() => readRecentQueries());

  const trimmed = query.trim();
  const searching = trimmed.length >= MIN_QUERY_LENGTH;

  const popular = useMemo(() => popularActions(role), [role]);

  // Плоский список навигации: все попадания по группам + AI-подвал.
  const flat = useMemo<FlatItem[]>(() => {
    const items: FlatItem[] = [];
    for (const group of groups) {
      for (const hit of group.hits) items.push({ type: 'hit', hit, groupKind: group.kind });
    }
    if (searching) items.push({ type: 'ai' });
    return items;
  }, [groups, searching]);

  const activeItem = activeIndex >= 0 ? flat[activeIndex] : undefined;
  const activeId = activeItem ? `search-opt-${activeIndex}` : undefined;

  // Открытие палитры — свежее состояние и недавние запросы из localStorage
  // (setState при изменении пропа — во время рендера, а не в эффекте).
  const [renderedOpen, setRenderedOpen] = useState(open);
  if (open !== renderedOpen) {
    setRenderedOpen(open);
    if (open) {
      setQuery('');
      setGroups([]);
      setError(false);
      setLoading(false);
      setActiveIndex(-1);
      setRecents(readRecentQueries());
    }
  }

  const applyResult = useCallback((data: SearchResponse) => {
    setGroups(data.groups);
    setError(false);
    setLoading(false);
    setActiveIndex(data.groups.some((g) => g.hits.length > 0) ? 0 : -1);
  }, []);

  // Сам поиск: ≥2 символов, отмена устаревших, мгновенный кеш повторов.
  const runSearch = useCallback(
    async (term: string) => {
      if (term.length < MIN_QUERY_LENGTH) {
        seqRef.current += 1;
        abortRef.current?.abort();
        abortRef.current = null;
        setGroups([]);
        setError(false);
        setLoading(false);
        setActiveIndex(-1);
        return;
      }
      const cached = cacheRef.current.get(term);
      if (cached) {
        applyResult(cached);
        return;
      }
      const seq = ++seqRef.current;
      const controller = new AbortController();
      abortRef.current?.abort();
      abortRef.current = controller;
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
        });
        if (seq !== seqRef.current) return;
        if (!response.ok) throw new Error(`status ${response.status}`);
        const data = (await response.json()) as SearchResponse;
        if (seq !== seqRef.current) return;
        cacheRef.current.set(term, data);
        // Кеш не бездонный: вытесняем самый старый запрос (DIG-45 р2).
        if (cacheRef.current.size > MAX_CACHED_QUERIES) {
          const oldest = cacheRef.current.keys().next().value;
          if (oldest !== undefined) cacheRef.current.delete(oldest);
        }
        applyResult(data);
      } catch (cause) {
        if (seq !== seqRef.current || (cause as Error).name === 'AbortError') return;
        setGroups([]);
        setError(true);
        setLoading(false);
        setActiveIndex(-1);
      }
    },
    [applyResult],
  );

  // Планирование из обработчиков ввода: debounce 120 мс, чтобы палитра не
  // мигала на каждый символ (приёмка: ответ < 200 мс, без дребезга).
  const scheduleSearch = useCallback(
    (value: string) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        void runSearch(value.trim());
      }, DEBOUNCE_MS);
    },
    [runSearch],
  );

  const changeQuery = useCallback(
    (value: string) => {
      setQuery(value);
      if (value.trim().length >= MIN_QUERY_LENGTH) setLoading(true);
      scheduleSearch(value);
    },
    [scheduleSearch],
  );

  // Разборка: снимаем таймер и запрос при размонтировании (без setState).
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      abortRef.current?.abort();
    },
    [],
  );

  // Escape закрывает с любого места диалога (контракт DIG-14).
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  // Управление фокусом: при открытии — в поле ввода, при закрытии — на
  // кнопку поиска, чтобы фокус не падал в <body> (контракт DIG-14).
  useEffect(() => {
    if (open) {
      wasOpenRef.current = true;
      inputRef.current?.focus();
      return;
    }
    if (!wasOpenRef.current) return;
    wasOpenRef.current = false;
    returnFocusRef?.current?.focus();
  }, [open, returnFocusRef]);

  const activate = useCallback(
    (item: FlatItem) => {
      if (trimmed.length === 0) return;
      saveRecentQuery(trimmed);
      router.push(
        item.type === 'ai' ? `/ai-assistant?q=${encodeURIComponent(trimmed)}` : item.hit.href,
      );
      onClose();
    },
    [trimmed, router, onClose],
  );

  // Tab: первая строка следующей/предыдущей группы; ↑/↓: общий список
  // с закольцовкой; Enter открывает активное (aria-activedescendant).
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (flat.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % flat.length);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => (index <= 0 ? flat.length - 1 : index - 1));
      return;
    }
    if (event.key === 'Tab') {
      const groupStarts = groups
        .map((group) =>
          flat.findIndex((item) => item.type === 'hit' && item.groupKind === group.kind),
        )
        .filter((index) => index >= 0);
      if (groupStarts.length === 0) return;
      event.preventDefault();
      const currentKind = activeItem?.type === 'hit' ? activeItem.groupKind : null;
      const position = groups.findIndex((group) => group.kind === currentKind);
      const target = event.shiftKey
        ? position <= 0
          ? groupStarts[groupStarts.length - 1]
          : groupStarts[position - 1]
        : groupStarts[(position + 1) % groupStarts.length];
      setActiveIndex(target);
      return;
    }
    if (event.key === 'Enter' && activeItem) {
      event.preventDefault();
      activate(activeItem);
    }
  };

  if (!open) return null;

  return (
    <div
      data-testid="search-overlay"
      className="fixed inset-0 z-50 bg-white md:bg-neutral-950/40 md:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Поиск по кабинету"
        onClick={(event) => event.stopPropagation()}
        className="mx-auto flex h-full w-full flex-col bg-white md:mt-[12vh] md:h-auto md:max-h-[72vh] md:w-full md:max-w-xl md:overflow-hidden md:rounded-2xl md:border md:border-neutral-200 md:shadow-xl"
      >
        {/* Поле ввода (мобильный: закреплено сверху, полноэкранный режим) */}
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-neutral-100 px-3 md:h-12 md:px-4">
          <Search className="size-4 shrink-0 text-neutral-400" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={flat.length > 0}
            aria-controls="search-listbox"
            aria-activedescendant={activeId}
            aria-autocomplete="list"
            aria-label="Поиск по кабинету"
            placeholder="Найти пару, преподавателя, справку…"
            value={query}
            onChange={(event) => changeQuery(event.target.value)}
            onKeyDown={onKeyDown}
            className="h-full min-w-0 flex-1 bg-transparent text-sm text-neutral-900 outline-none placeholder:text-neutral-400 md:text-base"
          />
          {loading ? (
            <Loader2 className="size-4 shrink-0 animate-spin text-neutral-400" aria-hidden="true" />
          ) : null}
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть поиск"
            className="grid size-8 shrink-0 place-items-center rounded-full text-neutral-500 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-coral-600"
          >
            <X className="size-4" aria-hidden="true" />
            <span className="sr-only md:hidden">Закрыть</span>
          </button>
          <kbd className="hidden shrink-0 rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 font-sans text-[11px] text-neutral-500 md:inline">
            Esc
          </kbd>
        </div>

        {/* Результаты / пустое состояние */}
        <div className="min-h-0 flex-1 overflow-y-auto" data-testid="search-results">
          {searching && error ? (
            <p className="px-4 py-6 text-center text-sm text-neutral-500">
              Поиск временно недоступен. Попробуйте ещё раз.
            </p>
          ) : searching ? (
            <div role="listbox" id="search-listbox" aria-label="Результаты поиска" className="pb-2">
              {groups.map((group) => (
                <div
                  key={group.kind}
                  role="group"
                  aria-labelledby={`search-group-${group.kind}`}
                  className="border-b border-neutral-100 py-1 last:border-b-0"
                >
                  <h3
                    id={`search-group-${group.kind}`}
                    className="px-4 pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500"
                  >
                    {group.label}
                  </h3>
                  {group.hits.map((hit) => {
                    const index = flat.findIndex(
                      (item) => item.type === 'hit' && item.hit.id === hit.id,
                    );
                    const Icon = HIT_ICONS[hit.kind];
                    return (
                      <div
                        key={hit.id}
                        id={`search-opt-${index}`}
                        role="option"
                        aria-selected={index === activeIndex}
                        aria-label={`${hit.title}. ${group.label}`}
                        data-group={group.kind}
                        data-testid="search-option"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => activate({ type: 'hit', hit, groupKind: group.kind })}
                        className={cn(
                          'flex cursor-pointer items-center gap-3 px-4 py-2.5',
                          index === activeIndex ? 'bg-accent-soft/60' : 'hover:bg-neutral-50',
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className="grid size-8 shrink-0 place-items-center rounded-full bg-neutral-100 text-neutral-600"
                        >
                          <Icon className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-neutral-900">
                            <Highlighted text={hit.title} query={trimmed} />
                          </span>
                          {hit.subtitle ? (
                            <span className="mt-0.5 block truncate text-xs text-neutral-500">
                              <Highlighted text={hit.subtitle} query={trimmed} />
                            </span>
                          ) : null}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}

              {/* AI-подвал: «Спросить AI: „<запрос>“» — часть навигации */}
              {(() => {
                const index = flat.findIndex((item) => item.type === 'ai');
                return (
                  <div
                    id={`search-opt-${index}`}
                    role="option"
                    aria-selected={index === activeIndex}
                    data-kind="ai"
                    data-group="ai"
                    aria-label={`Спросить AI: ${trimmed}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => activate({ type: 'ai' })}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 border-t border-neutral-100 px-4 py-3',
                      index === activeIndex ? 'bg-accent-soft/60' : 'hover:bg-neutral-50',
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-coral-500 to-amber-400 text-white"
                    >
                      <Sparkles className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-neutral-700">
                      Спросить AI:{' '}
                      <span className="font-semibold text-neutral-900">«{trimmed}»</span>
                    </span>
                  </div>
                );
              })()}

              {groups.length === 0 && !loading ? (
                <p className="px-4 py-6 text-center text-sm text-neutral-500">
                  Ничего не найдено. Попробуйте спросить AI ниже.
                </p>
              ) : null}
            </div>
          ) : (
            /* Пустое поле: недавние запросы + популярные действия */
            <div className="py-2">
              {recents.length > 0 ? (
                <section aria-label="Недавние запросы" className="border-b border-neutral-100 pb-2">
                  <div className="flex items-center justify-between px-4 pb-1 pt-2">
                    <h3 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                      Недавние запросы
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        clearRecentQueries();
                        setRecents([]);
                      }}
                      className="rounded-lg px-2 py-0.5 text-xs text-neutral-500 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-coral-600"
                    >
                      Очистить
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 px-4 pb-1">
                    {recents.map((recent) => (
                      <button
                        key={recent}
                        type="button"
                        onClick={() => changeQuery(recent)}
                        className="max-w-full truncate rounded-pill bg-neutral-100 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-200 focus-visible:outline-2 focus-visible:outline-coral-600"
                      >
                        {recent}
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}

              <section aria-label="Популярные действия" className="py-1">
                <h3 className="px-4 pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                  Популярные действия
                </h3>
                {popular.map((service) => (
                  <a
                    key={service.id}
                    href={service.href}
                    onClick={() => onClose()}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-coral-600"
                  >
                    <span
                      aria-hidden="true"
                      className="grid size-8 shrink-0 place-items-center rounded-full bg-neutral-100 text-neutral-600"
                    >
                      <Zap className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-neutral-900">
                        {service.title}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-neutral-500">
                        {service.benefit}
                      </span>
                    </span>
                  </a>
                ))}
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
