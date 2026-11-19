// DIG-100 — места ссылки «Версия для слабовидящих»: полоска НАД шапкой
// (кабинет Shell и шапка лендинга) и ссылка со значком Eye в футере
// (лендинг + Shell). В plain-режиме — обратная ссылка «Обычная версия»
// в тех же местах. Тексты — из словаря (RU/EN), значение для action —
// в hidden-поле формы (version=plain|off), работает без JavaScript.
// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';

const state = vi.hoisted(() => ({
  pathname: '/dashboard',
  toggleAction: vi.fn(async () => undefined),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => state.pathname,
}));

// Server action не вызывается в render-тесте; мок отрезает импорт
// '@/server/data' (баррель с data-слоем) из клиентского графа.
vi.mock('@/server/actions/a11y', () => ({
  setA11y: vi.fn(async () => true),
  toggleA11yVersion: state.toggleAction,
}));

// Каркас Shell: тяжёлые дети — стабы (цель теста — полоска и футер).
// TopBar рендерит настоящий <header>: проверяем, что полоска НАД шапкой.
vi.mock('@/components/shell/top-bar', () => ({
  TopBar: () => <header data-testid="top-bar-stub" />,
}));
vi.mock('@/components/shell/side-nav', () => ({ SideNav: () => null }));
vi.mock('@/components/shell/tab-bar', () => ({ TabBar: () => null }));
vi.mock('@/components/shell/ai-guide', () => ({ AiGuide: () => null }));
vi.mock('@/components/shell/ai-fab', () => ({ AiFab: () => null }));
vi.mock('@/components/shell/search-palette', () => ({ SearchPalette: () => null }));
vi.mock('@/components/assistant/assistant-panel', () => ({ AssistantPanel: () => null }));
vi.mock('@/components/assistant/floating-assistant-popup', () => ({
  FloatingAssistantPopup: () => null,
}));

import { Shell } from '@/components/shell/shell';
import { LandingContent } from '@/components/landing/landing-content';

const STUDENT = {
  name: 'Анна Ковалёва',
  group: 'ПИ-21',
  email: 'anna@example.edu',
  role: 'STUDENT' as const,
  voiceAssistant: false,
};

const shellProps = {
  user: STUDENT,
  unreadCount: 0,
  recentNotifications: [],
  children: null,
};

beforeEach(() => {
  state.pathname = '/dashboard';
  state.toggleAction.mockClear();
});

afterEach(cleanup);

/** Полоска в DOM идёт раньше шапки (document order). */
function expectStripBeforeHeader(strip: HTMLElement, header: HTMLElement): void {
  const preceding = strip.compareDocumentPosition(header);
  expect(Boolean(preceding & Node.DOCUMENT_POSITION_FOLLOWING), 'полоска раньше шапки').toBe(true);
}

describe('DIG-100: Shell кабинета — полоска над шапкой и футер', () => {
  it('полоска «Версия для слабовидящих» стоит НАД шапкой, hidden version=plain', () => {
    const { container } = render(<Shell {...shellProps} locale="ru" />);

    const strip = screen.getByTestId('a11y-version-strip');
    expectStripBeforeHeader(strip, screen.getByTestId('top-bar-stub'));

    const link = within(strip).getByRole('button', { name: 'Версия для слабовидящих' });
    expect(link).toBeVisible();
    expect(within(strip).getByDisplayValue('plain')).toHaveAttribute('name', 'version');
    // возврат после входа — на текущий раздел кабинета
    expect(within(strip).getByDisplayValue('/dashboard')).toHaveAttribute('name', 'next');
    expect(container).toBeTruthy();
  });

  it('в plain-режиме полоска предлагает «Обычная версия» с version=off', () => {
    render(<Shell {...shellProps} locale="ru" a11yPlain />);
    const strip = screen.getByTestId('a11y-version-strip');
    expect(within(strip).getByRole('button', { name: 'Обычная версия' })).toBeVisible();
    expect(within(strip).getByDisplayValue('off')).toHaveAttribute('name', 'version');
  });

  it('в футере кабинета — та же ссылка со значком Eye', () => {
    render(<Shell {...shellProps} locale="ru" />);
    const footer = screen.getByTestId('a11y-version-footer');
    expect(within(footer).getByRole('button', { name: /Версия для слабовидящих/ })).toBeVisible();
    // значок lucide Eye рядом с текстом
    expect(within(footer).getByTestId('a11y-version-eye')).toBeInTheDocument();
  });
});

describe('DIG-100: лендинг — полоска над шапкой и футер', () => {
  it('полоска «Версия для слабовидящих» стоит НАД шапкой лендинга', () => {
    const { container } = render(<LandingContent locale="ru" />);

    const strip = screen.getByTestId('a11y-version-strip');
    const header = container.querySelector('header');
    expect(header, 'шапка лендинга отрисована').toBeTruthy();
    expectStripBeforeHeader(strip, header as HTMLElement);
    expect(within(strip).getByRole('button', { name: 'Версия для слабовидящих' })).toBeVisible();
    expect(within(strip).getByDisplayValue('/')).toHaveAttribute('name', 'next');
  });

  it('в футере лендинга — та же ссылка со значком Eye', () => {
    const { container } = render(<LandingContent locale="ru" />);
    const footer = screen.getByTestId('a11y-version-footer');
    expect(within(footer).getByRole('button', { name: /Версия для слабовидящих/ })).toBeVisible();
    expect(within(footer).getByTestId('a11y-version-eye')).toBeInTheDocument();
    const landingFooter = container.querySelector('footer');
    expect(landingFooter?.contains(footer), 'ссылка внутри футера лендинга').toBe(true);
  });

  it('EN: «Accessibility version», в plain — «Standard version»', () => {
    render(<LandingContent locale="en" />);
    const strip = screen.getByTestId('a11y-version-strip');
    expect(within(strip).getByRole('button', { name: 'Accessibility version' })).toBeVisible();
    cleanup();
    render(<LandingContent locale="en" plain />);
    const stripPlain = screen.getByTestId('a11y-version-strip');
    expect(within(stripPlain).getByRole('button', { name: 'Standard version' })).toBeVisible();
  });
});
