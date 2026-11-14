// DIG-45 — чистое ядро поиска по кабинету (без серверных импортов).
// Пиним контракт приёмки: фиксированный порядок и состав групп, лимит
// попаданий, нормализация запроса (регистр, «ё→е», пробелы), распознавание
// номера заявки (в т.ч. частичного), подсветка совпадений.
import { describe, expect, it } from 'vitest';
import {
  MAX_HITS_PER_GROUP,
  SEARCH_GROUP_LABELS,
  SEARCH_GROUP_ORDER,
  buildGroups,
  highlightText,
  isRequestNumberQuery,
  matchesSearchQuery,
  normalizeSearchQuery,
  popularActions,
  type SearchHit,
} from '@/lib/search-core';

const hit = (kind: SearchHit['kind'], title: string, id = title): SearchHit => ({
  id,
  kind,
  title,
  href: `/x/${id}`,
});

describe('нормализация запроса', () => {
  it('нижний регистр, схлопнутые пробелы, ё→е', () => {
    expect(normalizeSearchQuery('  Справка   об  обучении ')).toBe('справка об обучении');
    expect(normalizeSearchQuery('ЁЛКА')).toBe('елка');
  });
});

describe('matchesSearchQuery', () => {
  it('без учёта регистра и с ё-фолдингом в обе стороны', () => {
    expect(matchesSearchQuery('Справка об обучении', 'СПРАВКА')).toBe(true);
    expect(matchesSearchQuery('Верёвка', 'веревка')).toBe(true);
    expect(matchesSearchQuery('Веревка', 'верёвка')).toBe(true);
    expect(matchesSearchQuery('Базы данных', 'матан')).toBe(false);
  });
});

describe('isRequestNumberQuery', () => {
  it('полный и частичный номер, с решёткой, в любом регистре', () => {
    expect(isRequestNumberQuery('SR-2026-A1B2C')).toBe(true);
    expect(isRequestNumberQuery('#sr-2026-ab')).toBe(true);
    expect(isRequestNumberQuery('SR-2026')).toBe(true);
    expect(isRequestNumberQuery('SR')).toBe(true);
  });
  it('обычные слова и обрывки номера не номер', () => {
    expect(isRequestNumberQuery('справка')).toBe(false);
    expect(isRequestNumberQuery('SRX-2026-A')).toBe(false);
    expect(isRequestNumberQuery('SR-2026-ABCDEF')).toBe(false);
  });
});

describe('buildGroups: порядок, пустые группы, лимит, рейтинг', () => {
  it('группы идут в фиксированном порядке с русскими заголовками', () => {
    expect(SEARCH_GROUP_ORDER).toEqual([
      'action',
      'section',
      'discipline',
      'request',
      'person',
      'faq',
      'news',
    ]);
    expect(SEARCH_GROUP_LABELS.faq).toBe('Вопросы и ответы');
    expect(SEARCH_GROUP_LABELS.action).toBe('Действия');
    expect(SEARCH_GROUP_LABELS.request).toBe('Заявки');
    expect(SEARCH_GROUP_LABELS.person).toBe('Люди');
    expect(SEARCH_GROUP_LABELS.news).toBe('Новости');
  });

  it('пустые группы не попадают в ответ, порядок сохранён', () => {
    const groups = buildGroups(
      [
        hit('news', 'Новость'),
        hit('action', 'Справка об обучении'),
        hit('faq', 'Как заказать справку'),
      ],
      'справка',
    );
    expect(groups.map((g) => g.kind)).toEqual(['action', 'faq', 'news']);
    expect(groups.map((g) => g.label)).toEqual(['Действия', 'Вопросы и ответы', 'Новости']);
  });

  it('в группе не более MAX_HITS_PER_GROUP попаданий', () => {
    const hits = Array.from({ length: 10 }, (_, i) => hit('action', `Справка ${i}`));
    const groups = buildGroups(hits, 'справка');
    expect(groups).toHaveLength(1);
    expect(groups[0].hits).toHaveLength(MAX_HITS_PER_GROUP);
  });

  it('совпадение по префиксу названия ранжируется выше вхождения', () => {
    const groups = buildGroups(
      [hit('discipline', 'Основы программирования'), hit('discipline', 'Программирование')],
      'программирование',
    );
    expect(groups[0].hits[0].title).toBe('Программирование');
  });

  it('ищет и в подзаголовке/мета (номер заявки находится по мета)', () => {
    const groups = buildGroups(
      [
        {
          id: 'r1',
          kind: 'request',
          title: 'Заявление на место в общежитии',
          href: '/requests/SR-2026-A1B2C',
          meta: 'SR-2026-A1B2C',
        },
      ],
      'SR-2026-A1B2C',
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].hits[0].href).toBe('/requests/SR-2026-A1B2C');
  });
});

describe('highlightText', () => {
  it('разбивает текст на куски с подсветкой вхождений', () => {
    expect(highlightText('Справка об обучении', 'справка')).toEqual([
      { text: 'Справка', hit: true },
      { text: ' об обучении', hit: false },
    ]);
  });
  it('без совпадения — один кусок', () => {
    expect(highlightText('Базы данных', 'справка')).toEqual([{ text: 'Базы данных', hit: false }]);
  });
});

describe('popularActions (пустое поле: популярные действия по роли)', () => {
  it('студенту — действия роли STUDENT, включая «Заказать справку»', () => {
    const popular = popularActions('STUDENT');
    expect(popular.length).toBeGreaterThan(0);
    expect(popular.some((s) => s.id === 'cert-enrollment')).toBe(true);
    // чужих ролей быть не должно
    expect(popular.every((s) => s.audiences.includes('STUDENT'))).toBe(true);
  });
  it('сотруднику — только действия роли STAFF', () => {
    const popular = popularActions('STAFF');
    expect(popular.every((s) => s.audiences.includes('STAFF'))).toBe(true);
    expect(popular.some((s) => s.id === 'staff-schedule-editor')).toBe(true);
  });
});
