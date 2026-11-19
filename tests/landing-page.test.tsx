// DIG-57 — контракт публичного лендинга на «/»:
// - hero: бренд «Цифровой деканат» + слоган «Всё университетское — в одном окне»,
//   подзаголовок, CTA «Войти» и «Демо-доступ» — обе ведут на /login;
// - ВСЕ ссылки страницы ведут на /login (демо-доступ = вход с чипами
//   демо-аккаунтов) или на #-якоря секций лендинга;
// - 5 карточек преимуществ (расписание, оценки, заявки, справки с QR,
//   AI-ассистент) — иконка + заголовок + описание;
// - плашка «Концепт для конкурса» видима (в проде — из корневого layout);
// - Reveal (IntersectionObserver): блок скрыт до пересечения с вьюпортом,
//   видим после, без IO — сразу видим (деградация без скрытого контента);
// - QA-тексты: без двойных пробелов.
// @vitest-environment jsdom
import * as React from 'react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';

import { ConceptBanner } from '@/components/concept-banner';
import { LandingContent } from '@/components/landing/landing-content';

// Лендинг читает локаль из cookies (du-locale) — в jsdom мокаем RU по умолчанию.
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => (name === 'du-locale' ? { name, value: 'ru' } : undefined),
  })),
}));
import { Reveal } from '@/components/landing/reveal';

afterEach(cleanup);

function renderLanding() {
  // Плашку концепта на реальной странице даёт корневой layout — в тесте
  // воспроизводим ту же композицию (как в tests/login-screen.test.tsx).
  return render(
    <>
      <ConceptBanner />
      <LandingContent locale="ru" />
    </>,
  );
}

describe('LandingPage — hero (DIG-57)', () => {
  it('renders the brand, the tagline and the subtitle in the hero', () => {
    renderLanding();
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toBeVisible();
    expect(h1).toHaveTextContent('Цифровой деканат');
    expect(h1).toHaveTextContent('Всё университетское — в одном окне');
    // подзаголовок перечисляет возможности, а не «заглушка каркаса»
    expect(screen.getByText(/Расписание и оценки/)).toBeInTheDocument();
  });

  it('shows both CTAs «Войти» and «Демо-доступ» pointing to /login', () => {
    renderLanding();
    expect(screen.getByRole('link', { name: 'Войти' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'Демо-доступ' })).toHaveAttribute('href', '/login');
  });
});

describe('LandingPage — все CTA ведут на /login (DIG-57)', () => {
  it('keeps every link either an entry point, an in-page anchor, help or the portal', () => {
    const { container } = renderLanding();
    const links = Array.from(container.querySelectorAll('a[href]'));
    expect(links.length).toBeGreaterThanOrEqual(2);
    for (const link of links) {
      const href = link.getAttribute('href') ?? '';
      // DIG-90: разрешины вход (/login), якоря секций, справка (/help)
      // и личный кабинет (/dashboard — middleware сам отправит на вход).
      expect(
        ['/login', '/help', '/dashboard'].some((h) => href === h) || href.startsWith('#'),
      ).toBe(true);
    }
  });

  it('links the final CTA block to /login too', () => {
    renderLanding();
    const finalCta = screen.getByRole('link', { name: /Попробовать демо/ });
    expect(finalCta).toHaveAttribute('href', '/login');
  });
});

describe('LandingPage — меню шапки (DIG-90)', () => {
  it('has the «Личный кабинет» menu link pointing to /dashboard', () => {
    renderLanding();
    const cabinet = screen.getAllByRole('link', { name: /Личный кабинет/ });
    expect(cabinet.length).toBeGreaterThanOrEqual(1);
    for (const link of cabinet) expect(link).toHaveAttribute('href', '/dashboard');
  });

  it('has the «Справка» menu link pointing to /help', () => {
    renderLanding();
    const help = screen.getAllByRole('link', { name: 'Справка' });
    expect(help.length).toBeGreaterThanOrEqual(1);
    for (const link of help) expect(link).toHaveAttribute('href', '/help');
  });

  it('shows the full language switcher «Русский / English»', () => {
    renderLanding();
    expect(screen.getByRole('button', { name: 'Русский' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'English' })).toBeInTheDocument();
    expect(screen.getByTestId('locale-switch')).toBeInTheDocument();
  });
});

describe('LandingPage — 5 карточек преимуществ (DIG-57)', () => {
  const FEATURES = [
    { title: 'Расписание', hint: /пар|занят|недел/i },
    { title: 'Оценки', hint: /оценк|успева|балл/i },
    { title: 'Заявки', hint: /заявк|деканат|статус/i },
    { title: 'Справки с проверкой подлинности', hint: /QR|справк/i },
    { title: 'AI-ассистент', hint: /AI|вопрос|ассистент/i },
  ];

  it('renders five feature cards with icon, title and description', () => {
    const { container } = renderLanding();
    for (const feature of FEATURES) {
      const heading = screen.getByRole('heading', { name: feature.title });
      expect(heading).toBeVisible();
      // описание рядом с заголовком
      const card = heading.closest('[data-testid="landing-feature"]');
      expect(card, `card for ${feature.title}`).not.toBeNull();
      expect(card!.querySelector('svg'), `icon in ${feature.title}`).not.toBeNull();
      expect(card!.textContent).toMatch(feature.hint);
    }
    const cards = container.querySelectorAll('[data-testid="landing-feature"]');
    expect(cards).toHaveLength(5);
  });
});

describe('LandingPage — контекст конкурса (DIG-57)', () => {
  it('keeps the contest concept note visible on the landing', () => {
    renderLanding();
    expect(screen.getByRole('note', { name: 'Концепт для конкурса' })).toBeVisible();
  });

  it('uses clean copy: no double spaces anywhere', () => {
    const { container } = renderLanding();
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      expect(node.textContent ?? '').not.toMatch(/ {2,}/);
      node = walker.nextNode();
    }
  });
});

describe('Reveal — появление по IntersectionObserver (DIG-57)', () => {
  type IOCallback = (entries: Array<{ isIntersecting: boolean }>) => void;
  let observers: Array<{ callback: IOCallback; disconnect: ReturnType<typeof vi.fn> }>;

  beforeEach(() => {
    observers = [];
    class FakeIntersectionObserver {
      callback: IOCallback;
      disconnect = vi.fn();
      constructor(callback: IOCallback) {
        this.callback = callback;
        observers.push(this);
      }
      observe() {}
      unobserve() {}
    }
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts hidden and becomes visible when it intersects the viewport', () => {
    const { container } = render(
      <Reveal>
        <p>контент секции</p>
      </Reveal>,
    );
    const box = container.firstElementChild as HTMLElement;
    expect(box).toHaveAttribute('data-reveal');
    expect(box.className).toContain('reveal');
    expect(box.className).not.toContain('reveal-visible');

    expect(observers).toHaveLength(1);
    act(() => {
      observers[0]!.callback([{ isIntersecting: true }]);
    });
    expect(box.className).toContain('reveal-visible');
    expect(screen.getByText('контент секции')).toBeVisible();
  });

  it('stays visible once revealed (one-shot)', () => {
    const { container } = render(
      <Reveal>
        <p>раз</p>
      </Reveal>,
    );
    const box = container.firstElementChild as HTMLElement;
    act(() => {
      observers[0]!.callback([{ isIntersecting: true }]);
    });
    expect(box.className).toContain('reveal-visible');
    act(() => {
      observers[0]!.callback([{ isIntersecting: false }]);
    });
    expect(box.className).toContain('reveal-visible');
    expect(observers[0]!.disconnect).toHaveBeenCalled();
  });

  it('renders content immediately without IntersectionObserver (no hidden content)', () => {
    vi.unstubAllGlobals();
    const { container } = render(
      <Reveal>
        <p>без IO</p>
      </Reveal>,
    );
    const box = container.firstElementChild as HTMLElement;
    expect(box.className).toContain('reveal-visible');
    expect(screen.getByText('без IO')).toBeVisible();
  });
});
