// CHANGE remove-a11y-top-strip — по решению владельца полоска «Версия для
// слабовидящих» НАД шапкой убрана с сайта (лендинг и кабинет Shell). Вход в
// plain-режим остался: ссылка со значком Eye в футере (лендинг + Shell), в
// plain-режиме — обратная ссылка «Обычная версия» там же. Тексты — из
// словаря (RU/EN), значение для action — в hidden-поле (version=plain|off),
// работает без JavaScript.
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

// Каркас Shell: тяжёлые дети — стабы (цель теста — отсутствие полоски, футер).
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

describe('remove-a11y-top-strip: полоски над шапкой больше нет', () => {
  it('Shell кабинета: полоска удалена, шапка первая', () => {
    const { container } = render(<Shell {...shellProps} locale="ru" />);

    expect(screen.queryByTestId('a11y-version-strip')).not.toBeInTheDocument();
    expect(screen.getByTestId('top-bar-stub')).toBeVisible();
    expect(container).toBeTruthy();
  });

  it('лендинг: полоска удалена, шапка первая', () => {
    const { container } = render(<LandingContent locale="ru" />);

    expect(screen.queryByTestId('a11y-version-strip')).not.toBeInTheDocument();
    expect(container.querySelector('header'), 'шапка лендинга отрисована').toBeTruthy();
  });
});

describe('remove-a11y-top-strip: вход в plain-режим остался в футере', () => {
  it('футер кабинета — ссылка со значком Eye, hidden version=plain, next=текущий раздел', () => {
    render(<Shell {...shellProps} locale="ru" />);
    const footer = screen.getByTestId('a11y-version-footer');
    const link = within(footer).getByRole('button', { name: /Версия для слабовидящих/ });
    expect(link).toBeVisible();
    expect(within(footer).getByTestId('a11y-version-eye')).toBeInTheDocument();
    expect(within(footer).getByDisplayValue('plain')).toHaveAttribute('name', 'version');
    expect(within(footer).getByDisplayValue('/dashboard')).toHaveAttribute('name', 'next');
  });

  it('в plain-режиме футер кабинета предлагает «Обычная версия» с version=off', () => {
    render(<Shell {...shellProps} locale="ru" a11yPlain />);
    const footer = screen.getByTestId('a11y-version-footer');
    expect(within(footer).getByRole('button', { name: 'Обычная версия' })).toBeVisible();
    expect(within(footer).getByDisplayValue('off')).toHaveAttribute('name', 'version');
  });

  it('футер лендинга — ссылка со значком Eye внутри <footer>', () => {
    const { container } = render(<LandingContent locale="ru" />);
    const footer = screen.getByTestId('a11y-version-footer');
    expect(within(footer).getByRole('button', { name: /Версия для слабовидящих/ })).toBeVisible();
    expect(within(footer).getByTestId('a11y-version-eye')).toBeInTheDocument();
    const landingFooter = container.querySelector('footer');
    expect(landingFooter?.contains(footer), 'ссылка внутри футера лендинга').toBe(true);
    expect(within(footer).getByDisplayValue('/')).toHaveAttribute('name', 'next');
  });

  it('EN: «Accessibility version» в футере, в plain — «Standard version»', () => {
    render(<LandingContent locale="en" />);
    const footer = screen.getByTestId('a11y-version-footer');
    expect(within(footer).getByRole('button', { name: 'Accessibility version' })).toBeVisible();
    cleanup();
    render(<LandingContent locale="en" plain />);
    const footerPlain = screen.getByTestId('a11y-version-footer');
    expect(within(footerPlain).getByRole('button', { name: 'Standard version' })).toBeVisible();
  });
});
