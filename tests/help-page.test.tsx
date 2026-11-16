// DIG-38 — контракт страниц /help и /help/[slug] (SSR, red-first).
// Приёмка: большое поле «Найдите ответ», популярные запросы, 6 плиток
// категорий; статья — вопрос, ответ, «Полезно? Да / Нет», связанные
// статьи, кнопка сервиса; неизвестный slug — notFound.
import { describe, expect, it } from 'vitest';
import { createElement, type ComponentType } from 'react';
import { prerenderToNodeStream } from 'react-dom/static';

import HelpPage from '@/app/(cabinet)/help/page';
import ArticlePage from '@/app/(cabinet)/help/[slug]/page';
import {
  FAQ_ARTICLES,
  FAQ_CATEGORY_LABELS,
  FAQ_CATEGORY_ORDER,
  POPULAR_QUERIES,
} from '@/lib/faq-kb-catalog';

type ArticleComponent = ComponentType<{ params: Promise<{ slug: string }> }>;
const Article = ArticlePage as unknown as ArticleComponent;

async function renderPage(node: React.ReactNode): Promise<string> {
  const { prelude } = await prerenderToNodeStream(node);
  let html = '';
  for await (const chunk of prelude) {
    html += String(chunk);
  }
  return html.replaceAll('<!-- -->', '');
}

describe('/help — экран базы знаний', () => {
  it('заголовок, большое поле «Найдите ответ» и популярные запросы', async () => {
    const Page = HelpPage as unknown as ComponentType;
    const html = await renderPage(createElement(Page));

    expect(html).toContain('Вопросы и ответы');
    expect(html).toContain('data-testid="help-search"');
    expect(html).toMatch(/aria-label="Найдите ответ"/);
    // Подсказки популярных запросов кликабельны.
    for (const q of POPULAR_QUERIES) {
      expect(html).toContain(`data-testid="help-popular-${q}"`);
    }
    expect(html).toContain('Найдите ответ');
  });

  it('категории плитками: ровно 6 с числом статей', async () => {
    const Page = HelpPage as unknown as ComponentType;
    const html = await renderPage(createElement(Page));

    expect(html).toContain('data-testid="help-categories"');
    expect(html).toMatch(/role="group"/);
    for (const key of FAQ_CATEGORY_ORDER) {
      expect(html).toContain(`data-testid="help-category-${key}"`);
      expect(html).toContain(FAQ_CATEGORY_LABELS[key]);
    }
    // Число статей на плитке — по данным каталога (считаем внутри разметки плитки).
    const dormCount = FAQ_ARTICLES.filter((a) => a.category === 'DORMITORY').length;
    const tile = /data-testid="help-category-DORMITORY"[\s\S]*?<\/button>/.exec(html)?.[0] ?? '';
    expect(tile).toContain(FAQ_CATEGORY_LABELS.DORMITORY);
    expect(tile).toContain(String(dormCount));
  });

  it('список статей по умолчанию виден: все вопросы каталога', async () => {
    const Page = HelpPage as unknown as ComponentType;
    const html = await renderPage(createElement(Page));

    expect(html).toContain('data-testid="help-articles"');
    for (const a of FAQ_ARTICLES) {
      expect(html).toContain(`href="/help/${a.id}"`);
    }
  });
});

describe('/help/[slug] — статья', () => {
  it('вопрос, ответ, «Полезно?», связанные статьи и кнопка сервиса', async () => {
    const html = await renderPage(
      createElement(Article, {
        params: Promise.resolve({ slug: 'cert-online' }),
      }),
    );

    expect(html).toContain('data-testid="help-article"');
    expect(html).toContain('Какие справки можно заказать онлайн?');
    expect(html).toContain('Справка об обучении');
    expect(html).toContain('Полезно?');
    expect(html).toContain('data-testid="help-feedback-yes"');
    expect(html).toContain('data-testid="help-feedback-no"');
    expect(html).toContain('data-testid="help-related"');
    // Кнопка сервиса — на заявку в каталоге.
    expect(html).toContain('href="/requests?order=cert-enrollment"');
    expect(html).toContain('Заказать справку');
    // Возврат к списку.
    expect(html).toMatch(/href="\/help"/);
  });

  it('связанные статьи ссылаются на существующие slug', async () => {
    const html = await renderPage(
      createElement(Article, {
        params: Promise.resolve({ slug: 'schol-increased' }),
      }),
    );
    expect(html).toContain('Как получить повышенную стипендию?');
    expect(html).toContain('data-testid="help-related"');
    expect(html).toMatch(/href="\/help\/schol-when"/);
  });

  it('неизвестный slug — notFound', async () => {
    await expect(
      renderPage(
        createElement(Article, {
          params: Promise.resolve({ slug: 'no-such-article' }),
        }),
      ),
    ).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/);
  });
});
