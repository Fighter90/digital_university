// DIG-46 — каталог FAQ ассистента: статья «Академический отпуск» и страница
// /faq/[slug]. Приёмка: уникальные слаги, непустые ответы, страница рендерит
// статью, неизвестный слаг — единый 404 (notFound()).
import { describe, expect, it, vi } from 'vitest';
import { createElement, type ComponentType } from 'react';
import { prerenderToNodeStream } from 'react-dom/static';

import { FAQ_ARTICLES, findFaqArticle } from '@/lib/faq-catalog';

describe('каталог FAQ', () => {
  it('содержит статью «Академический отпуск» с непустым ответом', () => {
    const article = findFaqArticle('akademicheskiy-otpusk');
    expect(article).not.toBeNull();
    expect(article?.title).toBe('Академический отпуск');
    expect(article?.question).toContain('академ');
    expect(article?.answer.length).toBeGreaterThan(80);
    expect(article?.steps?.length ?? 0).toBeGreaterThanOrEqual(3);
  });

  it('слаги уникальны, записи с полями для карточки ассистента', () => {
    const slugs = FAQ_ARTICLES.map((a) => a.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const article of FAQ_ARTICLES) {
      expect(article.title.length).toBeGreaterThan(3);
      expect(article.category.length).toBeGreaterThan(2);
    }
  });

  it('неизвестный слаг — null', () => {
    expect(findFaqArticle('no-such-article')).toBeNull();
  });
});

describe('страница /faq/[slug]', () => {
  vi.mock('next/navigation', () => ({
    notFound: vi.fn(() => {
      throw new Error('NOT_FOUND');
    }),
  }));

  async function renderArticle(slug: string): Promise<string> {
    // default-export файла страницы (Next.js не допускает именованных).
    const Page = (await import('@/app/(cabinet)/faq/[slug]/page'))
      .default as unknown as ComponentType<{
      params: Promise<{ slug: string }>;
    }>;
    const { prelude } = await prerenderToNodeStream(
      createElement(Page, { params: Promise.resolve({ slug }) }),
    );
    let html = '';
    for await (const chunk of prelude) {
      html += String(chunk);
    }
    return html.replaceAll('<!-- -->', '');
  }

  it('рендерит статью с заголовком и шагами', async () => {
    const html = await renderArticle('akademicheskiy-otpusk');
    expect(html).toContain('Академический отпуск');
    expect(html).toContain('деканат');
  });

  it('неизвестный слаг — notFound()', async () => {
    await expect(renderArticle('no-such-article')).rejects.toThrow('NOT_FOUND');
  });
});
