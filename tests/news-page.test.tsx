// DIG-36 — render contract экранов новостей (unit, SSR).
// Лента /news: заголовок «Новости и объявления», полоса «Важно» с пометкой
// «Прочитано», вкладки скоупа (дефолт «Моя группа»), пилюли тем, карточки
// (обложка img с alt + loading="lazy", дата, источник, заголовок, 2 строки).
// Статья /news/[id]: заголовок, дата, источник, автор, абзацы, вложения,
// «Поделиться ссылкой»; открытие помечает прочитанным; неизвестный id —
// notFound(). Скелетон внутри Suspense.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createElement, type ComponentType } from 'react';
import { prerenderToNodeStream } from 'react-dom/static';

import type { NewsPageData } from '@/server/data/news';
import type { NewsEntry } from '@/lib/news-catalog';

const studentCtx = {
  userId: 'auth-anna',
  login: 'anna.smirnova',
  role: 'STUDENT' as const,
  studentId: 'st-anna',
  groupName: 'ПИ-21',
  faculty: 'ИТ',
};

const entry = (over: Partial<NewsEntry> & Pick<NewsEntry, 'id' | 'title'>): NewsEntry => ({
  excerpt: 'Короткий текст новости в две строки для карточки ленты.',
  body: ['Первый абзац статьи.', 'Второй абзац статьи.'],
  topic: 'study',
  scope: 'group',
  group: 'ПИ-21',
  faculty: null,
  source: 'Деканат',
  authorName: 'Мария Петрова',
  publishedAt: new Date(2026, 10, 12, 10, 0),
  important: false,
  ...over,
});

const feedFixture: NewsPageData = {
  scope: 'group',
  scopeDefaulted: false,
  topic: 'all',
  announcements: [
    {
      ...entry({ id: 'retake-order', title: 'Изменился порядок пересдач', important: true }),
      isRead: true,
    },
    {
      ...entry({
        id: 'session-consul',
        title: 'Открыта запись на консультации перед сессией',
        important: true,
        scope: 'university',
        group: null,
      }),
      isRead: false,
    },
  ],
  items: [
    {
      ...entry({ id: 'pi21-lab-deadline', title: 'Отчёты по лабораторным: дедлайн 24 ноября' }),
      isRead: false,
    },
    {
      ...entry({
        id: 'pi21-curator-hour',
        title: 'Кураторский час: как планировать сессию',
        topic: 'events',
      }),
      isRead: false,
    },
  ],
};

const emptyFixture: NewsPageData = {
  ...feedFixture,
  topic: 'dormitory',
  announcements: [],
  items: [],
};

const articleFixture = entry({
  id: 'retake-order',
  title: 'Изменился порядок пересдач',
  important: true,
  attachments: [
    {
      name: 'Порядок пересдач (извлечение)',
      href: '/news/files/retake-order-2026.txt',
      sizeLabel: 'TXT · 2 КБ',
    },
  ],
});

vi.mock('@/server/auth/session', () => ({
  getAuthSession: vi.fn(async () => null),
  requireUser: vi.fn(async () => ({
    id: 'auth-anna',
    login: 'anna.smirnova',
    role: 'STUDENT' as const,
  })),
  requireStaff: vi.fn(async () => ({ id: 'x', login: 'x', role: 'STAFF' as const })),
}));

vi.mock('@/server/data/db', () => ({ dataDb: {} }));

// notFound() в юнит-среде вне Next-рантайма: контракт — специальная ошибка.
const notFoundState = { called: false };
vi.mock('next/navigation', () => ({
  notFound: () => {
    notFoundState.called = true;
    throw new Error('NEXT_HTTP_ERROR_FALLBACK;404');
  },
}));

const getNewsPageMock = vi.fn(async (db: unknown, ctx: unknown) => {
  void db;
  void ctx;
  return feedFixture;
});
const getNewsArticleMock = vi.fn(async (db: unknown, ctx: unknown, id: string) => {
  void db;
  void ctx;
  return id === articleFixture.id ? { article: articleFixture, isRead: false } : null;
});
const markNewsReadMock = vi.fn(async (db: unknown, ctx: unknown, id: string) => {
  void db;
  void ctx;
  void id;
  return true;
});

vi.mock('@/server/data', () => ({
  requireDataCtx: vi.fn(async () => studentCtx),
  getNewsPage: (...args: Parameters<typeof getNewsPageMock>) => getNewsPageMock(...args),
  getNewsArticle: (...args: Parameters<typeof getNewsArticleMock>) => getNewsArticleMock(...args),
  markNewsRead: (...args: Parameters<typeof markNewsReadMock>) => markNewsReadMock(...args),
}));

import FeedPage from '@/app/(cabinet)/news/page';
import ArticlePage from '@/app/(cabinet)/news/[id]/page';

async function renderPage<P extends Record<string, unknown>>(
  Page: ComponentType<P>,
  props: Partial<P> & Record<string, unknown> = {},
): Promise<string> {
  const { prelude } = await prerenderToNodeStream(
    createElement(Page, { searchParams: Promise.resolve({}), ...props } as P),
  );
  let html = '';
  for await (const chunk of prelude) {
    html += String(chunk);
  }
  return html;
}

beforeEach(() => {
  getNewsPageMock.mockClear();
  getNewsArticleMock.mockClear();
  markNewsReadMock.mockClear();
});

describe('/news (DIG-36) — лента новостей', () => {
  it('заголовок, полоса «Важно» с пометкой «Прочитано» и маркером нового', async () => {
    const html = await renderPage(FeedPage);
    expect(html).toContain('Новости и объявления');
    expect(html).toContain('Важно');
    expect(html).toContain('Изменился порядок пересдач');
    expect(html).toContain('Прочитано');
    // Непрочитанное объявление помечено как новое (dot / aria).
    expect(html).toMatch(/data-unread="true"/);
    // Карточки объявлений ведут на страницы новостей.
    expect(html).toContain('href="/news/retake-order"');
    expect(html).toContain('href="/news/session-consul"');
  });

  it('вкладки скоупа: дефолт «Моя группа», все три опции, ссылки с темой', async () => {
    const html = await renderPage(FeedPage);
    expect(html).toContain('Моя группа');
    expect(html).toContain('Мой факультет');
    expect(html).toContain('Весь вуз');
    expect(html).toMatch(
      /aria-checked="true"[^>]*>Моя группа|>Моя группа[\s\S]{0,200}aria-checked="true"/,
    );
    expect(html).toContain('href="/news?scope=university"');
    // Активная вкладка подписана aria-checked.
    expect(html).toMatch(/role="radio"[\s\S]{0,300}aria-checked="true"/);
  });

  it('пилюли тем: Все, Учёба, Мероприятия, Стипендии, Общежитие', async () => {
    const html = await renderPage(FeedPage);
    expect(html).toContain('Учёба');
    expect(html).toContain('Мероприятия');
    expect(html).toContain('Стипендии');
    expect(html).toContain('Общежитие');
    expect(html).toMatch(/href="\/news\?topic=dormitory"/);
    expect(html).toContain('data-testid="news-topics"');
  });

  it('карточки: обложка img с alt, loading="lazy", decoding="async", дата, источник, 2 строки', async () => {
    const html = await renderPage(FeedPage);
    expect(html).toMatch(/<img[^>]+loading="lazy"/);
    // DIG-36 р3 (замечание ревью): спека обещает decoding="async" — код обязан
    // её ставить (иначе после openspec archive спека ↔ код расходятся).
    expect(html).toMatch(/<img[^>]+decoding="async"/);
    expect(html).toMatch(/<img[^>]+alt="[^"]{10,}"/);
    expect(html).toContain('12 ноября 2026');
    expect(html).toContain('Деканат');
    expect(html).toContain('Отчёты по лабораторным: дедлайн 24 ноября');
    expect(html).toContain('line-clamp-2');
    expect(html).toContain('href="/news/pi21-lab-deadline"');
    expect(html).toContain('data-testid="news-card-pi21-lab-deadline"');
  });

  it('пустой результат: состояние «Новостей пока нет»', async () => {
    getNewsPageMock.mockResolvedValueOnce(emptyFixture);
    const html = await renderPage(FeedPage);
    expect(html).toContain('Новостей пока нет');
  });

  it('страница — section внутри shell (нет своего <main>)', async () => {
    const html = await renderPage(FeedPage);
    expect(html).toContain('<section');
    expect(html).not.toContain('<main');
  });

  it('скелетон подключён: Suspense + NewsSkeleton в исходнике', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const source = readFileSync(
      resolve(import.meta.dirname, '../src/app/(cabinet)/news/page.tsx'),
      'utf8',
    );
    expect(source).toContain('<Suspense');
    expect(source).toContain('NewsSkeleton');
    expect(source).toContain('searchParams');
  });
});

describe('/news/[id] (DIG-36) — страница новости', () => {
  it('заголовок, дата, источник, автор, абзацы, вложения, шэринг', async () => {
    const html = await renderPage(ArticlePage, {
      params: Promise.resolve({ id: 'retake-order' }),
    });
    expect(html).toContain('Изменился порядок пересдач');
    expect(html).toContain('12 ноября 2026');
    expect(html).toContain('Мария Петрова');
    expect(html).toContain('Первый абзац статьи.');
    expect(html).toContain('Порядок пересдач (извлечение)');
    expect(html).toContain('href="/news/files/retake-order-2026.txt"');
    // Обложка статьи: lazy + decoding="async" (тот же контракт, что у ленты).
    expect(html).toMatch(/<img[^>]+loading="lazy"/);
    expect(html).toMatch(/<img[^>]+decoding="async"/);
    expect(html).toContain('Поделиться ссылкой');
    // DIG-101 — полный блок «Поделиться»: VK-ссылка на статью и три сети.
    expect(html).toContain('data-testid="share-buttons"');
    expect(html).toContain(
      `https://vk.com/share.php?url=${encodeURIComponent('/news/retake-order')}`,
    );
    expect(html).toMatch(/data-testid="news-share"/);
    expect(html).toMatch(/data-testid="news-share-status"/);
    // Возврат в ленту.
    expect(html).toMatch(/href="\/news"/);
  });

  it('открытие новости помечает её прочитанной (markNewsRead вызван с id)', async () => {
    await renderPage(ArticlePage, { params: Promise.resolve({ id: 'retake-order' }) });
    expect(markNewsReadMock).toHaveBeenCalledTimes(1);
    expect(markNewsReadMock.mock.calls[0][2]).toBe('retake-order');
  });

  it('неизвестный id — notFound (спец-ошибка Next, 404)', async () => {
    notFoundState.called = false;
    await expect(
      renderPage(ArticlePage, { params: Promise.resolve({ id: 'no-such-news' }) }),
    ).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404/);
    expect(notFoundState.called).toBe(true);
    expect(markNewsReadMock).not.toHaveBeenCalled();
  });
});
