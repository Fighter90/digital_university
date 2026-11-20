'use client';

// DIG-37 — клиентский справочник людей: поиск и быстрые фильтры пилюлями
// («Мои преподаватели», «Мой деканат», «Все»), фильтрующими совместно.
// DIG-102 — поиск «Найти человека»: одно поле «ФИО, эл. почта или телефон»
// (DIG-111: подпись без кальки «email»; ФИО по словоформам — паттерн
// faq-suggest, email и телефон с нормализацией),
// одногруппники (студенты своей группы) в результатах и вкладка «★ Избранное»
// с категориями «Преподаватели / Сотрудники деканата / Одногруппники».
// Данные уже собраны на сервере (getPeopleDirectory + listFavoritePersons) —
// персональные пометки и избранное приходят готовыми, клиент только фильтрует.
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, Star } from 'lucide-react';

import {
  groupFavoritePersonsByKind,
  matchPersonEntry,
  peopleFilterLabel,
  personEnFields,
  splitHighlight,
  type FavoritePersonKind,
  type PeopleFilter,
} from '@/lib/people-catalog';
import { t, type Locale, type TranslationKey } from '@/lib/i18n';
import type { FavoritePersonEntry, PersonListEntry } from '@/server/data/people';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { FavoritePersonButton } from '@/components/people/favorite-person-button';
import { riseDelayStyle } from '@/lib/motion';
import { enDisciplineName, localizePersonName } from '@/lib/en-demo-content';

export interface PeopleBrowserProps {
  people: PersonListEntry[];
  /** DIG-102 — одногруппники (своя группа, кроме владельца сессии). */
  groupmates: PersonListEntry[];
  /** DIG-102 — избранное владельца сессии (записи уже разрешены сервером). */
  favorites: FavoritePersonEntry[];
  /** Студенту — персональные пометки и избранное; сотруднику — нет. */
  showPersonal: boolean;
  /** DIG-89 — локаль интерфейса (cookie du-locale, дефолт ru). */
  locale?: Locale;
}

const FILTER_ORDER: PeopleFilter[] = ['MY_TEACHERS', 'MY_DEANERY', 'ALL', 'FAVORITES'];

/** Категории избранного в порядке вывода; пустые категории скрываются. */
const FAVORITE_CATEGORY_ORDER: readonly FavoritePersonKind[] = ['TEACHER', 'STAFF', 'GROUPMATE'];

const FAVORITE_CATEGORY_TITLE: Record<FavoritePersonKind, TranslationKey> = {
  TEACHER: 'people.fav.cat.TEACHER',
  STAFF: 'people.fav.cat.STAFF',
  GROUPMATE: 'people.fav.cat.GROUPMATE',
};

/** Избранное в виде карточек списка (телефона у людей избранного нет). */
function favoriteAsListEntry(favorite: FavoritePersonEntry): PersonListEntry {
  return {
    id: favorite.personId,
    kind: favorite.kind,
    fullName: favorite.fullName,
    position: favorite.position,
    department: favorite.department,
    email: favorite.email,
    phone: null,
    disciplines: [],
    isMyTeacher: false,
    isMyDeanery: false,
    isMyManager: false,
    myDisciplines: [],
  };
}

export function PeopleBrowser({
  people,
  groupmates,
  favorites,
  showPersonal,
  locale = 'ru',
}: PeopleBrowserProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<PeopleFilter>('ALL');

  const favoriteIds = useMemo(
    () => new Set(favorites.map((favorite) => favorite.personId)),
    [favorites],
  );
  const favoriteEntries = useMemo(() => favorites.map(favoriteAsListEntry), [favorites]);
  // Поиск ведётся по всему видимому студенту набору: каталог + одногруппники.
  const searchPool = useMemo(() => [...people, ...groupmates], [people, groupmates]);
  const hasQuery = query.trim() !== '';

  const visible = useMemo(() => {
    if (hasQuery) {
      const pool = filter === 'FAVORITES' ? favoriteEntries : searchPool;
      return pool.filter((person) => matchPersonEntry(person, query));
    }
    return people.filter(
      (person) =>
        filter === 'ALL' ||
        (filter === 'MY_TEACHERS' && person.isMyTeacher) ||
        (filter === 'MY_DEANERY' && person.isMyDeanery),
    );
  }, [favoriteEntries, filter, hasQuery, people, query, searchPool]);

  const groupedFavorites = useMemo(
    () => groupFavoritePersonsByKind(favoriteEntries),
    [favoriteEntries],
  );

  return (
    <div data-testid="people-browser">
      <div className="relative">
        <Search
          aria-hidden="true"
          className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <input
          data-testid="people-search"
          type="search"
          aria-label={t(locale, 'people.search.aria')}
          placeholder={t(locale, 'people.search.query.placeholder')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="h-11 w-full rounded-button border border-border bg-card pl-10 pr-3 text-sm text-foreground shadow-soft outline-none transition-colors placeholder:text-muted-foreground focus:border-muted-foreground/40"
        />
      </div>

      <div
        data-testid="people-filters"
        role="group"
        aria-label={t(locale, 'people.filters.aria')}
        className="mt-3 flex gap-2 overflow-x-auto pb-1"
      >
        {FILTER_ORDER.map((key) => (
          <Chip
            key={key}
            active={filter === key}
            onClick={() => setFilter(key)}
            aria-label={peopleFilterLabel(key, locale)}
          >
            {key === 'FAVORITES' ? <Star aria-hidden="true" className="size-3.5" /> : null}
            {peopleFilterLabel(key, locale)}
          </Chip>
        ))}
      </div>

      {hasQuery ? (
        visible.length === 0 ? (
          <div data-testid="people-search-empty">
            <EmptyState
              className="mt-4"
              title={t(locale, 'people.search.empty.title')}
              description={t(locale, 'people.search.empty.desc')}
            />
          </div>
        ) : (
          <PersonList
            people={visible}
            query={query}
            showPersonal={showPersonal}
            favoriteIds={favoriteIds}
            locale={locale}
          />
        )
      ) : filter === 'FAVORITES' ? (
        favorites.length === 0 ? (
          <div data-testid="people-fav-empty">
            <EmptyState
              className="mt-4"
              title={t(locale, 'people.fav.empty.title')}
              description={t(locale, 'people.fav.empty.desc')}
            />
          </div>
        ) : (
          <div data-testid="people-fav-sections" className="mt-5 flex flex-col gap-6">
            {FAVORITE_CATEGORY_ORDER.map((kind) => {
              const categoryFavorites = groupedFavorites[kind];
              if (categoryFavorites.length === 0) return null; // пустые категории скрыты
              return (
                <section key={kind} aria-labelledby={`people-fav-title-${kind}`}>
                  <h3
                    id={`people-fav-title-${kind}`}
                    data-testid={`people-fav-title-${kind}`}
                    className="text-sm font-extrabold tracking-heading text-foreground"
                  >
                    {t(locale, FAVORITE_CATEGORY_TITLE[kind])}
                  </h3>
                  <ul
                    data-testid={`people-fav-list-${kind}`}
                    className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2"
                  >
                    {categoryFavorites.map((person, index) => (
                      <li
                        key={person.id}
                        data-testid={`person-card-${person.id}`}
                        className="animate-rise"
                        style={riseDelayStyle(index)}
                      >
                        <PersonListItem
                          person={person}
                          query=""
                          showPersonal={showPersonal}
                          favoriteIds={favoriteIds}
                          favoriteVariant="labeled"
                          locale={locale}
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )
      ) : visible.length === 0 ? (
        <EmptyState
          className="mt-4"
          title={t(locale, 'people.browser.empty.title')}
          description={t(locale, 'people.browser.empty.desc')}
        />
      ) : (
        <PersonList
          people={visible}
          query={query}
          showPersonal={showPersonal}
          favoriteIds={favoriteIds}
          locale={locale}
        />
      )}
    </div>
  );
}

/** Сетка карточек каталога/поиска (общая для вкладок). */
function PersonList({
  people,
  query,
  showPersonal,
  favoriteIds,
  locale,
}: {
  people: PersonListEntry[];
  query: string;
  showPersonal: boolean;
  favoriteIds: Set<string>;
  locale: Locale;
}) {
  return (
    <ul data-testid="people-list" className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
      {people.map((person, index) => (
        <li
          key={person.id}
          data-testid={`person-card-${person.id}`}
          className="animate-rise"
          style={riseDelayStyle(index)}
        >
          <PersonListItem
            person={person}
            query={query}
            showPersonal={showPersonal}
            favoriteIds={favoriteIds}
            locale={locale}
          />
        </li>
      ))}
    </ul>
  );
}

function PersonListItem({
  person,
  query,
  showPersonal,
  favoriteIds,
  favoriteVariant = 'compact',
  locale = 'ru',
}: {
  person: PersonListEntry;
  query: string;
  showPersonal: boolean;
  favoriteIds: Set<string>;
  /** compact — звезда на карточке каталога; labeled — кнопка «★ В Избранном». */
  favoriteVariant?: 'compact' | 'labeled';
  locale?: Locale;
}) {
  // DIG-89 — EN-рендер: должность/подразделение по id записи справочника.
  const enFields =
    locale === 'en'
      ? personEnFields({
          id: person.id,
          position: person.position,
          department: person.department,
          consultationHours: null,
          program: null,
        } as never)
      : null;
  // DIG-93 — имя демо-персоны по локали (EN — транслит словаря).
  const displayName = localizePersonName(locale, person.fullName);
  const nameChunks = splitHighlight(displayName, query);
  const myDisciplines = showPersonal ? person.myDisciplines : [];
  const isGroupmate = person.kind === 'GROUPMATE';

  return (
    <article className="lift-hover press-scale relative h-full rounded-card border border-border bg-card p-4 shadow-soft transition-colors hover:border-muted-foreground/40">
      <div className="flex items-start gap-3">
        <Avatar name={displayName} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {isGroupmate ? (
              <span className="text-sm font-bold text-foreground">
                {nameChunks.map((chunk, index) =>
                  chunk.hit ? (
                    <mark key={index} className="rounded-sm bg-accent-soft px-0.5 text-accent-ink">
                      {chunk.text}
                    </mark>
                  ) : (
                    <span key={index}>{chunk.text}</span>
                  ),
                )}
              </span>
            ) : (
              <LinkName personId={person.id} chunks={nameChunks} />
            )}
            {showPersonal && person.isMyManager ? (
              <Badge status="accent">{t(locale, 'people.myManager')}</Badge>
            ) : null}
          </div>
          <p className="mt-0.5 text-sm text-neutral-700">
            {isGroupmate
              ? t(locale, 'people.groupmate.subtitle')
              : enFields
                ? enFields.position
                : person.position}
          </p>
          {isGroupmate ? (
            <p className="mt-1 truncate text-xs text-muted-foreground">{person.email}</p>
          ) : (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {enFields ? enFields.department : person.department}
            </p>
          )}
          {myDisciplines.length > 0 ? (
            <p className="mt-2 text-xs text-muted-foreground" data-testid="person-my-disciplines">
              <span className="font-semibold text-foreground">
                {t(locale, 'people.yourDisciplines')}
              </span>{' '}
              {myDisciplines
                .map((discipline) => (locale === 'en' ? enDisciplineName(discipline) : discipline))
                .join(', ')}
            </p>
          ) : null}
        </div>
        {/* Звезда избранного — только студенту (у сотрудника избранного нет). */}
        {showPersonal ? (
          <div className="absolute right-3 top-3">
            <FavoritePersonButton
              personId={person.id}
              personName={displayName}
              isFavorite={favoriteIds.has(person.id)}
              variant={favoriteVariant}
              locale={locale}
            />
          </div>
        ) : null}
      </div>
    </article>
  );
}

/** ФИО целиком — ссылка на карточку; совпадения подсвечиваются <mark>. */
function LinkName({
  personId,
  chunks,
}: {
  personId: string;
  chunks: Array<{ text: string; hit: boolean }>;
}) {
  return (
    <Link
      href={`/people/${personId}`}
      className="text-sm font-bold text-foreground underline-offset-2 hover:text-coral-600 hover:underline"
    >
      {chunks.map((chunk, index) =>
        chunk.hit ? (
          <mark key={index} className="rounded-sm bg-accent-soft px-0.5 text-accent-ink">
            {chunk.text}
          </mark>
        ) : (
          <span key={index}>{chunk.text}</span>
        ),
      )}
    </Link>
  );
}
