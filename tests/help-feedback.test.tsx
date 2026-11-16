// DIG-38 — «Полезно? Да / Нет» на странице статьи (unit, jsdom).
// Delta-спека help-knowledge-base, сценарий «Фидбек статьи»: после ответа
// видна благодарность и повторный выбор возможен — голос можно сменить,
// не теряя благодарности (раунд 4 ревью: кнопки не исчезают).
// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import * as React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { HelpFeedback } from '@/components/help/help-feedback';

afterEach(() => {
  cleanup();
});

describe('HelpFeedback — «Полезно? Да / Нет»', () => {
  it('вопрос и две кнопки до ответа, без благодарности', () => {
    render(React.createElement(HelpFeedback));

    expect(screen.getByText('Полезно?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Да' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Нет' })).toBeInTheDocument();
    expect(screen.queryByText(/Спасибо/)).not.toBeInTheDocument();
    // Ни один вариант ещё не выбран.
    expect(screen.getByRole('button', { name: 'Да' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Нет' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('клик «Да» — благодарность видна, выбор отмечен', () => {
    render(React.createElement(HelpFeedback));

    fireEvent.click(screen.getByRole('button', { name: 'Да' }));

    expect(screen.getByText(/Спасибо/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Да' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Нет' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('повторный выбор возможен: «Нет» сменяет «Да», благодарность остаётся', () => {
    render(React.createElement(HelpFeedback));

    fireEvent.click(screen.getByRole('button', { name: 'Да' }));
    // Кнопки остаются доступными — голос можно поменять.
    fireEvent.click(screen.getByRole('button', { name: 'Нет' }));

    expect(screen.getByText(/Спасибо/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Нет' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Да' })).toHaveAttribute('aria-pressed', 'false');
    // Обратная смена тоже работает.
    fireEvent.click(screen.getByRole('button', { name: 'Да' }));
    expect(screen.getByRole('button', { name: 'Да' })).toHaveAttribute('aria-pressed', 'true');
  });
});
