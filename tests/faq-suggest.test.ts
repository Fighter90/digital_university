// DIG-39 — контракт подсказок FAQ перед отправкой обращения
// (src/lib/faq-suggest.ts). Приёмка: до трёх статей по ключевым словам
// текста; короткий/мусорный ввод (< 3 значимых символов) → пусто; статьи
// темы обращения приоритетны; без дублей; типографика («ёлочки»).
import { describe, expect, it } from 'vitest';

import { FAQ_ARTICLES, suggestFaqArticles } from '@/lib/faq-suggest';

describe('suggestFaqArticles — подборка по тексту', () => {
  it('подсказка про академический отпуск находится дословным сценарием спеки', () => {
    const hints = suggestFaqArticles('как взять академический отпуск на год?', 'ACADEMIC_LEAVE');
    expect(hints.length).toBeGreaterThan(0);
    expect(hints[0]!.title.toLowerCase()).toContain('академический отпуск');
  });

  it('ввод короче трёх значимых символов → пусто', () => {
    expect(suggestFaqArticles('а?')).toEqual([]);
    expect(suggestFaqArticles('   ')).toEqual([]);
    expect(suggestFaqArticles('')).toEqual([]);
    expect(suggestFaqArticles('???')).toEqual([]);
  });

  it('текст без ключевых слов каталога → пусто', () => {
    expect(suggestFaqArticles('привет менеджер, у меня вопрос')).toEqual([]);
  });

  it('не больше трёх подсказок', () => {
    const hints = suggestFaqArticles(
      'как оформить академический отпуск, перевод и где посмотреть учебный план и оценки',
    );
    expect(hints.length).toBeGreaterThan(0);
    expect(hints.length).toBeLessThanOrEqual(3);
  });

  it('статьи темы обращения приоритетны: тема «Оценки» поднимает статью об оценках', () => {
    const text = 'где посмотреть учебный план и как исправить оценку за экзамен';
    const withSubject = suggestFaqArticles(text, 'GRADES');
    expect(withSubject.length).toBeGreaterThan(0);
    expect(withSubject[0]!.subjects).toContain('GRADES');
  });

  it('без темы порядок стабильный и тоже релевантный (первая статья по совпадению)', () => {
    const a = suggestFaqArticles('где посмотреть учебный план');
    const b = suggestFaqArticles('где посмотреть учебный план');
    expect(a.map((x) => x.id)).toEqual(b.map((x) => x.id));
    expect(a.length).toBeGreaterThan(0);
    expect(a[0]!.keywords.some((k) => 'учебный план'.includes(k) || k.includes('учебный'))).toBe(
      true,
    );
  });

  it('без дублей', () => {
    const hints = suggestFaqArticles(
      'академический отпуск и снова академический отпуск, стипендия',
    );
    const ids = hints.map((h) => h.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('FAQ_ARTICLES — каталог-минимум (до подключения раздела FAQ)', () => {
  it('каталог покрывает все пять тем обращений', () => {
    const subjects = new Set(FAQ_ARTICLES.flatMap((a) => a.subjects));
    for (const subject of ['CURRICULUM', 'GRADES', 'TRANSFER', 'ACADEMIC_LEAVE', 'OTHER']) {
      expect(subjects.has(subject as (typeof FAQ_ARTICLES)[number]['subjects'][number])).toBe(true);
    }
  });

  it('каждая статья несёт ключевые слова (иначе подборка немыслима)', () => {
    for (const article of FAQ_ARTICLES) {
      expect(article.keywords.length).toBeGreaterThan(0);
      expect(article.title.length).toBeGreaterThan(0);
    }
  });

  it('типографика: в заголовках «ёлочки», а не прямые кавычки', () => {
    for (const article of FAQ_ARTICLES) {
      expect(article.title).not.toMatch(/["']/);
    }
    const quoted = FAQ_ARTICLES.find((a) => a.title.includes('«'));
    expect(quoted).toBeTruthy();
  });
});
