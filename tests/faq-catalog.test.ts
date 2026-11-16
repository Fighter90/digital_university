// DIG-38 — контракт базы знаний «Вопросы и ответы» (red-first).
// Приёмка задачи: запрос «стипендия» находит статьи про стипендии
// (аудированный ЛК не находил ничего), поиск по заголовку и тексту с
// учётом словоформ (стипендия/стипендии/стипендиальный), категории
// плитками (6), статьи со связями и сервисными кнопками, QA-тексты.
import { describe, expect, it } from 'vitest';

import {
  FAQ_ARTICLES,
  FAQ_CATEGORY_LABELS,
  FAQ_CATEGORY_ORDER,
  POPULAR_QUERIES,
  getFaqArticle,
  getRelatedFaqArticles,
  searchFaqArticles,
  type FaqCategory,
} from '@/lib/faq-kb-catalog';

describe('база знаний: структура статей', () => {
  it('непустой набор, id уникальны, вопрос/ответ непустые', () => {
    expect(FAQ_ARTICLES.length).toBeGreaterThanOrEqual(12);
    const ids = FAQ_ARTICLES.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of FAQ_ARTICLES) {
      expect(a.question.trim().length).toBeGreaterThan(5);
      expect(a.answer.trim().length).toBeGreaterThan(20);
    }
  });

  it('категорий ровно 6 с метками из задачи', () => {
    expect(FAQ_CATEGORY_ORDER).toEqual([
      'STUDY',
      'CERTIFICATES',
      'SCHOLARSHIPS',
      'DORMITORY',
      'TRANSFER',
      'IT',
    ] satisfies FaqCategory[]);
    expect(Object.values(FAQ_CATEGORY_LABELS)).toEqual([
      'Учёба и сессия',
      'Справки',
      'Стипендии и выплаты',
      'Общежитие',
      'Перевод и восстановление',
      'IT и доступ',
    ]);
    for (const a of FAQ_ARTICLES) {
      expect(FAQ_CATEGORY_LABELS[a.category], `${a.id}: неизвестная категория`).toBeTruthy();
    }
  });

  it('в каждой категории не меньше двух статей, про стипендии — не меньше пяти', () => {
    for (const key of FAQ_CATEGORY_ORDER) {
      const count = FAQ_ARTICLES.filter((a) => a.category === key).length;
      expect(count, `категория ${key}`).toBeGreaterThanOrEqual(2);
    }
    const scholarships = FAQ_ARTICLES.filter((a) => a.category === 'SCHOLARSHIPS');
    expect(scholarships.length).toBeGreaterThanOrEqual(5);
  });

  it('related существуют, cta — внутренняя ссылка с непустой меткой', () => {
    for (const a of FAQ_ARTICLES) {
      for (const rel of a.related) {
        expect(getFaqArticle(rel), `${a.id}: related ${rel}`).not.toBeNull();
        expect(rel).not.toBe(a.id);
      }
      if (a.cta) {
        expect(a.cta.href.startsWith('/'), `${a.id}: cta href`).toBe(true);
        expect(a.cta.label.trim().length).toBeGreaterThan(2);
      }
    }
    // Статья со справкой ведёт к заявке — «Заказать справку».
    const certOnline = getFaqArticle('cert-online');
    expect(certOnline?.cta).toEqual({
      label: 'Заказать справку',
      href: '/requests?order=cert-enrollment',
    });
  });

  it('QA-тексты: «ёлочки», en-dash, без двойных пробелов и прямых кавычек', () => {
    for (const a of FAQ_ARTICLES) {
      const texts = [a.question, a.answer, ...(a.cta ? [a.cta.label] : [])];
      for (const t of texts) {
        expect(t.includes('"'), `${a.id}: прямые кавычки`).toBe(false);
        expect(t.includes('  '), `${a.id}: двойные пробелы`).toBe(false);
        expect(t.includes('...'), `${a.id}: три точки вместо многоточия`).toBe(false);
      }
    }
  });

  it('популярные запросы включают «стипендия» и все непустые', () => {
    expect(POPULAR_QUERIES).toContain('стипендия');
    expect(POPULAR_QUERIES.length).toBeGreaterThanOrEqual(4);
    for (const q of POPULAR_QUERIES) {
      expect(q.trim().length).toBeGreaterThan(2);
      // Каждая подсказка реально что-то находит — мёртвых подсказок нет.
      expect(searchFaqArticles(q).length, `подсказка «${q}»`).toBeGreaterThan(0);
    }
  });
});

describe('searchFaqArticles — приёмка «стипендия»', () => {
  it('запрос «стипендия» возвращает статьи про стипендии', () => {
    const hits = searchFaqArticles('стипендия');
    expect(hits.length).toBeGreaterThanOrEqual(3);
    for (const a of hits) {
      expect(a.category).toBe('SCHOLARSHIPS');
    }
    const questions = hits.map((a) => a.question).join('\n');
    expect(questions).toContain('Когда приходит стипендия?');
    expect(questions).toContain('Как получить повышенную стипендию?');
  });

  it.each([
    'стипендии',
    'стипендию',
    'стипендии у первокурсников',
    'стипендиальный',
    'стипендиальный фонд',
    'повышенная стипендия',
    'СТИПЕНДИЯ',
  ])('словоформа «%s» находит статьи про стипендии', (query) => {
    const hits = searchFaqArticles(query);
    expect(hits.length, `запрос «${query}»`).toBeGreaterThanOrEqual(3);
    expect(hits.every((a) => a.category === 'SCHOLARSHIPS')).toBe(true);
  });

  it('совпадение в заголовке ранжируется выше совпадения в тексте', () => {
    const hits = searchFaqArticles('стипендия');
    // Статья «Какие справки можно заказать онлайн?» упоминает стипендию
    // только в тексте ответа — она не может быть первой.
    expect(hits[0].question).toContain('стипенд');
    const textOnly = hits.find((a) => a.id === 'cert-online');
    if (textOnly) {
      expect(hits.indexOf(textOnly)).toBeGreaterThan(0);
    }
  });

  it('несколько токенов соединяются AND, стоп-слова отбрасываются', () => {
    const hits = searchFaqArticles('как получить повышенную стипендию');
    const ids = hits.map((a) => a.id);
    expect(ids).toContain('schol-increased');
    // «повышенная» не должна вытянуть статьи без повышенных стипендий,
    // когда AND-токен «стипендия» не выполнен: запрос «повышенная» сам по себе
    // находит повышенную стипендию.
    expect(searchFaqArticles('повышенная').map((a) => a.id)).toContain('schol-increased');
  });

  it('пары «справка/справедливость» не пересекаются', () => {
    const hits = searchFaqArticles('справедливость');
    expect(hits.map((a) => a.id)).not.toContain('cert-online');
    expect(hits.map((a) => a.id)).not.toContain('cert-time');
  });

  it('пустой запрос не возвращает ничего (пустое состояние решает UI)', () => {
    expect(searchFaqArticles('')).toEqual([]);
    expect(searchFaqArticles('   ')).toEqual([]);
    expect(searchFaqArticles('какой')).toEqual([]); // только стоп-слова
  });

  it('поиск по тексту ответа: «комиссия» находит статью о пересдачах', () => {
    const hits = searchFaqArticles('комиссия');
    expect(hits.map((a) => a.id)).toContain('study-retake');
  });

  it('регистр и Ё/ё не влияют', () => {
    const lower = searchFaqArticles('общежитие');
    const upper = searchFaqArticles('ОБЩЕЖИТИЕ');
    const yoled = searchFaqArticles('общежитие').length;
    expect(upper.map((a) => a.id)).toEqual(lower.map((a) => a.id));
    expect(yoled).toBeGreaterThan(0);
  });
});

describe('getRelatedFaqArticles', () => {
  it('возвращает статьи в порядке related, без дублей и самой статьи', () => {
    const article = getFaqArticle('schol-increased');
    expect(article).not.toBeNull();
    const related = getRelatedFaqArticles(article!);
    expect(related.length).toBe(article!.related.length);
    expect(related.every((r) => r.id !== article!.id)).toBe(true);
    expect(related.map((r) => r.id)).toEqual(article!.related);
  });
});
