// DIG-72 — попап-чат плавающего ассистента и его место в Shell (jsdom):
//  - отправка по Enter и по кнопке, история сессии в памяти (переживает
//    закрытие/открытие попапа);
//  - ответ модели рендерится текстом, fallback — с пометкой демо-режима
//    и ссылкой на источник справки;
//  - ошибка (rate-limit) — не падение, а сообщение в чате;
//  - Shell: FAB виден студенту на /dashboard и скрыт на /ai-assistant
//    (вход не дублируется); сотруднику FAB не показывается.
// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const state = vi.hoisted(() => ({
  askAction: vi.fn<(input: { question: string }) => Promise<unknown>>(),
  pathname: '/dashboard',
}));

vi.mock('@/server/actions/floating-assistant', () => ({
  askFloatingAssistant: state.askAction,
}));

vi.mock('next/navigation', () => ({
  usePathname: () => state.pathname,
}));

// Shell-каркас в юнит-тесте не рендерим целиком: цель — контракты FAB и
// попапа, а не шапка/меню (их покрывают cabinet-shell тесты и e2e).
vi.mock('@/components/shell/top-bar', () => ({ TopBar: () => null }));
vi.mock('@/components/shell/side-nav', () => ({ SideNav: () => null }));
vi.mock('@/components/shell/tab-bar', () => ({ TabBar: () => null }));
vi.mock('@/components/shell/ai-guide', () => ({ AiGuide: () => null }));
vi.mock('@/components/shell/search-palette', () => ({ SearchPalette: () => null }));
vi.mock('@/components/assistant/assistant-panel', () => ({ AssistantPanel: () => null }));

import { FloatingAssistantPopup } from '@/components/assistant/floating-assistant-popup';
import { AiFab } from '@/components/shell/ai-fab';
import { Shell } from '@/components/shell/shell';

const STUDENT = {
  name: 'Анна Ковалёва',
  group: 'ПИ-21',
  email: 'anna@example.edu',
  role: 'STUDENT' as const,
  voiceAssistant: false,
};

const STAFF = { ...STUDENT, name: 'Мария Секретарёва', role: 'STAFF' as const };

const shellProps = {
  user: STUDENT,
  unreadCount: 0,
  recentNotifications: [],
  children: null,
};

beforeEach(() => {
  state.askAction.mockReset();
  state.askAction.mockImplementation(async () => ({
    ok: true,
    mode: 'ai',
    answer: 'Ответ по справке.',
  }));
  state.pathname = '/dashboard';
  // Base UI может позиционировать через ResizeObserver — в jsdom его нет.
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
});

afterEach(cleanup);

describe('FloatingAssistantPopup — чат', () => {
  function openPopup() {
    render(<FloatingAssistantPopup open onOpenChange={() => {}} />);
    return screen.getByRole('dialog', { name: 'AI-ассистент' });
  }

  it('заголовок «AI-ассистент», приветствие, поле ввода и кнопка отправки', () => {
    const dialog = openPopup();
    expect(screen.getByTestId('ai-fab-popup-title')).toHaveTextContent('AI-ассистент');
    expect(screen.getByTestId('ai-fab-popup-close')).toBeInTheDocument();
    expect(screen.getByTestId('ai-fab-popup-input')).toBeInTheDocument();
    expect(screen.getByTestId('ai-fab-popup-send')).toBeInTheDocument();
    expect(screen.getByTestId('ai-fab-popup-messages')).toHaveTextContent(/ассистент/i);
    expect(dialog).toBeInTheDocument();
  });

  it('Enter отправляет вопрос и рендерит ответ текстом', async () => {
    openPopup();
    const input = screen.getByTestId('ai-fab-popup-input');
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Как оформить справку?' } });
      fireEvent.keyDown(input, { key: 'Enter' });
    });
    expect(state.askAction).toHaveBeenCalledWith({ question: 'Как оформить справку?' });
    await waitFor(() => {
      expect(screen.getByTestId('ai-fab-popup-messages')).toHaveTextContent('Ответ по справке.');
    });
    expect(screen.getByTestId('ai-fab-popup-messages')).toHaveTextContent('Как оформить справку?');
  });

  it('кнопка отправки вызывает action; пустой ввод не отправляется', async () => {
    openPopup();
    const input = screen.getByTestId('ai-fab-popup-input');
    await act(async () => {
      fireEvent.click(screen.getByTestId('ai-fab-popup-send'));
    });
    expect(state.askAction).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Про стипендию' } });
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('ai-fab-popup-send'));
    });
    expect(state.askAction).toHaveBeenCalledWith({ question: 'Про стипендию' });
  });

  it('fallback-ответ помечен демо-режимом и ведёт в источник справки', async () => {
    state.askAction.mockImplementation(async () => ({
      ok: true as const,
      mode: 'fallback' as const,
      answer: 'Справка оформляется в разделе «Заявки и справки».',
      notice: 'Демо-режим: показываю подсказку из справки',
      source: { title: 'Справка · Заявки', href: '/guide' },
    }));
    openPopup();
    const input = screen.getByTestId('ai-fab-popup-input');
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Как оформить справку?' } });
      fireEvent.keyDown(input, { key: 'Enter' });
    });
    const messages = screen.getByTestId('ai-fab-popup-messages');
    await waitFor(() => {
      expect(messages).toHaveTextContent(/Демо-режим/i);
    });
    expect(messages).toHaveTextContent('Справка оформляется в разделе «Заявки и справки».');
    expect(screen.getByTestId('ai-fab-popup-source')).toHaveAttribute('href', '/guide');
  });

  it('ошибка action (rate-limit) — сообщение об ошибке, экран не падает', async () => {
    state.askAction.mockImplementation(async () => ({
      ok: false as const,
      error: 'Слишком много вопросов. Подождите минуту.',
    }));
    openPopup();
    const input = screen.getByTestId('ai-fab-popup-input');
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Ещё вопрос' } });
      fireEvent.keyDown(input, { key: 'Enter' });
    });
    await waitFor(() => {
      expect(screen.getByTestId('ai-fab-popup-error')).toHaveTextContent(/Слишком много вопросов/);
    });
  });

  it('история сессии в памяти: переживает закрытие и повторное открытие', async () => {
    const { rerender } = render(<FloatingAssistantPopup open onOpenChange={() => {}} />);
    const input = screen.getByTestId('ai-fab-popup-input');
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Первый вопрос' } });
      fireEvent.keyDown(input, { key: 'Enter' });
    });
    await waitFor(() => {
      expect(screen.getByTestId('ai-fab-popup-messages')).toHaveTextContent('Ответ по справке.');
    });
    rerender(<FloatingAssistantPopup open={false} onOpenChange={() => {}} />);
    rerender(<FloatingAssistantPopup open onOpenChange={() => {}} />);
    expect(screen.getByTestId('ai-fab-popup-messages')).toHaveTextContent('Первый вопрос');
  });
});

describe('AiFab — плавающая кнопка', () => {
  it('кнопка coral с иконкой, поднимается над таб-баром и видна на десктопе', () => {
    render(<AiFab onOpen={() => {}} />);
    const fab = screen.getByRole('button', { name: 'AI-ассистент' });
    expect(fab.className).toContain('bg-coral-500');
    expect(fab.className).toContain('bottom-[calc(4.75rem+env(safe-area-inset-bottom))]');
    // DIG-72: кнопка видима и на десктопе — md:hidden больше нет
    expect(fab.className).not.toContain('md:hidden');
    expect(fab.className).toContain('md:bottom-6');
  });
});

describe('Shell — контракты FAB (DIG-72)', () => {
  it('студент на /dashboard видит FAB; клик открывает попап-чат', async () => {
    render(<Shell {...shellProps} />);
    const fab = screen.getByRole('button', { name: 'AI-ассистент' });
    await act(async () => {
      fireEvent.click(fab);
    });
    expect(await screen.findByRole('dialog', { name: 'AI-ассистент' })).toBeInTheDocument();
  });

  it('на /ai-assistant FAB скрыт — вход не дублируется', () => {
    state.pathname = '/ai-assistant';
    render(<Shell {...shellProps} />);
    expect(screen.queryByRole('button', { name: 'AI-ассистент' })).toBeNull();
  });

  it('сотруднику FAB не показывается', () => {
    render(<Shell {...shellProps} user={STAFF} />);
    expect(screen.queryByRole('button', { name: 'AI-ассистент' })).toBeNull();
  });
});
