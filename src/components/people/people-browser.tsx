'use client';

// DIG-37 — клиентский справочник людей: поиск (ФИО / дисциплина /
// подразделение) и быстрые фильтры пилюлями («Мои преподаватели»,
// «Мой деканат», «Все»), фильтрующими совместно. Данные уже собраны
// на сервере (getPeopleDirectory) — персональные пометки приходят
// готовыми, клиент только фильтрует и ищет по ним.
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';

import {
  matchPerson,
  PEOPLE_FILTER_LABELS,
  splitHighlight,
  type PeopleFilter,
} from '@/lib/people-catalog';
import type { PersonListEntry } from '@/server/data/people';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { riseDelayStyle } from '@/lib/motion';

export interface PeopleBrowserProps {
  people: PersonListEntry[];
  /** Студенту — персональные пометки; сотруднику — нет. */
  showPersonal: boolean;
}

const FILTER_ORDER: PeopleFilter[] = ['MY_TEACHERS', 'MY_DEANERY', 'ALL'];

export function PeopleBrowser({ people, showPersonal }: PeopleBrowserProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<PeopleFilter>('ALL');

  const visible = useMemo(
    () =>
      people.filter(
        (person) =>
          matchPerson(person, query) &&
          (filter === 'ALL' ||
            (filter === 'MY_TEACHERS' && person.isMyTeacher) ||
            (filter === 'MY_DEANERY' && person.isMyDeanery)),
      ),
    [people, query, filter],
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
          aria-label="Поиск по справочнику"
          placeholder="ФИО, дисциплина или подразделение…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="h-11 w-full rounded-button border border-border bg-card pl-10 pr-3 text-sm text-foreground shadow-soft outline-none transition-colors placeholder:text-muted-foreground focus:border-muted-foreground/40"
        />
      </div>

      <div
        data-testid="people-filters"
        role="group"
        aria-label="Быстрые фильтры справочника"
        className="mt-3 flex gap-2 overflow-x-auto pb-1"
      >
        {FILTER_ORDER.map((key) => (
          <Chip
            key={key}
            active={filter === key}
            onClick={() => setFilter(key)}
            aria-label={PEOPLE_FILTER_LABELS[key]}
          >
            {PEOPLE_FILTER_LABELS[key]}
          </Chip>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          className="mt-4"
          title="Никого не нашлось"
          description="Попробуйте другое имя, дисциплину или сбросьте фильтр."
        />
      ) : (
        <ul data-testid="people-list" className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {visible.map((person, index) => (
            <li
              key={person.id}
              data-testid={`person-card-${person.id}`}
              className="animate-rise"
              style={riseDelayStyle(index)}
            >
              <PersonListItem person={person} query={query} showPersonal={showPersonal} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PersonListItem({
  person,
  query,
  showPersonal,
}: {
  person: PersonListEntry;
  query: string;
  showPersonal: boolean;
}) {
  const nameChunks = splitHighlight(person.fullName, query);
  const myDisciplines = showPersonal ? person.myDisciplines : [];

  return (
    <article className="lift-hover press-scale h-full rounded-card border border-border bg-card p-4 shadow-soft transition-colors hover:border-muted-foreground/40">
      <div className="flex items-start gap-3">
        <Avatar name={person.fullName} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <LinkName personId={person.id} chunks={nameChunks} />
            {showPersonal && person.isMyManager ? (
              <Badge status="accent">Ваш менеджер</Badge>
            ) : null}
          </div>
          <p className="mt-0.5 text-sm text-neutral-700">{person.position}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{person.department}</p>
          {myDisciplines.length > 0 ? (
            <p className="mt-2 text-xs text-muted-foreground" data-testid="person-my-disciplines">
              <span className="font-semibold text-foreground">Ваши дисциплины:</span>{' '}
              {myDisciplines.join(', ')}
            </p>
          ) : null}
        </div>
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
