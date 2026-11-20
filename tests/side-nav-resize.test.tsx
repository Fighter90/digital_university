// @vitest-environment jsdom
// DIG-127 — перетаскиваемая граница левого меню кабинета.
//
// Контракт:
//   1) на правой границе полного меню (lg ≥1024) есть ручка-разделитель
//      (role="separator", aria-orientation="vertical"), видимая только на lg;
//   2) drag мышью/тачем меняет ширину меню (CSS-переменная --nav-w на aside);
//   3) клавиатура: стрелки ←/→ шаг ±16px, Shift+стрелка — крупный шаг ±48px,
//      Home/End — min/max; изменение клампится в 180–340px (дефолт 212);
//   4) выбор сохраняется в localStorage (du-nav-width) и восстанавливается
//      после перезагрузки; мусорное значение из хранилища игнорируется;
//   5) aria: aria-valuenow/min/max отражают текущую ширину;
//   6) aria-label локализован (RU/EN), в EN-версии нет кириллицы.
import { afterEach, describe, expect, it, beforeEach, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/dashboard'),
}));

import { SideNav } from '@/components/shell/side-nav';

const KEY = 'du-nav-width';

/** CSS-переменная --nav-w с корневого aside (текущая ширина меню). */
function navWidth(container: HTMLElement): string | undefined {
  const aside = container.querySelector('aside');
  const value = aside?.style.getPropertyValue('--nav-w');
  return value || undefined;
}

function handle(): HTMLElement {
  return screen.getByTestId('nav-resize-handle');
}

beforeEach(() => {
  localStorage.clear();
});

// vitest без globals: auto-cleanup testing-library не регистрируется сам
afterEach(() => {
  cleanup();
});

describe('SideNav: ручка изменения ширины (DIG-127)', () => {
  it('ручка-разделитель присутствует: role=separator, vertical, клампы в aria', () => {
    const { container } = render(<SideNav unreadCount={0} />);
    const h = handle();
    expect(h.getAttribute('aria-orientation')).toBe('vertical');
    expect(h.getAttribute('aria-valuemin')).toBe('180');
    expect(h.getAttribute('aria-valuemax')).toBe('340');
    expect(h.getAttribute('aria-valuenow')).toBe('212');
    // дефолтная ширина — прежние 212px (макет Figma не меняется)
    expect(navWidth(container)).toBe('212px');
    // ручка скрыта на иконочном рельсе (<lg) — flex только от lg
    expect(h.className).toContain('hidden');
    expect(h.className).toContain('lg:flex');
  });

  it('стрелка → расширяет меню на 16px, ← сужает', () => {
    const { container } = render(<SideNav unreadCount={0} />);
    const h = handle();
    fireEvent.keyDown(h, { key: 'ArrowRight' });
    expect(navWidth(container)).toBe('228px');
    fireEvent.keyDown(h, { key: 'ArrowLeft' });
    expect(navWidth(container)).toBe('212px');
    expect(h.getAttribute('aria-valuenow')).toBe('212');
  });

  it('Shift+стрелка — крупный шаг ±48px', () => {
    const { container } = render(<SideNav unreadCount={0} />);
    const h = handle();
    fireEvent.keyDown(h, { key: 'ArrowRight', shiftKey: true });
    expect(navWidth(container)).toBe('260px');
    fireEvent.keyDown(h, { key: 'ArrowLeft', shiftKey: true });
    expect(navWidth(container)).toBe('212px');
  });

  it('клампы: ширина не выходит за 180…340 (клавиатура)', () => {
    const { container } = render(<SideNav unreadCount={0} />);
    const h = handle();
    for (let i = 0; i < 30; i += 1) fireEvent.keyDown(h, { key: 'ArrowLeft' });
    expect(navWidth(container)).toBe('180px');
    for (let i = 0; i < 30; i += 1) fireEvent.keyDown(h, { key: 'ArrowRight' });
    expect(navWidth(container)).toBe('340px');
    expect(h.getAttribute('aria-valuenow')).toBe('340');
  });

  it('Home/End — min/max мгновенно', () => {
    const { container } = render(<SideNav unreadCount={0} />);
    const h = handle();
    fireEvent.keyDown(h, { key: 'Home' });
    expect(navWidth(container)).toBe('180px');
    fireEvent.keyDown(h, { key: 'End' });
    expect(navWidth(container)).toBe('340px');
  });

  it('drag: pointerdown+pointermove меняют ширину по clientX, pointerup сохраняет в localStorage', () => {
    const { container } = render(<SideNav unreadCount={0} />);
    const h = handle();
    // jsdom: getBoundingClientRect() = 0 → ширина = clientX (кламп 180–340)
    fireEvent.pointerDown(h, { pointerId: 1, clientX: 212 });
    fireEvent.pointerMove(h, { pointerId: 1, clientX: 300 });
    expect(navWidth(container)).toBe('300px');
    fireEvent.pointerMove(h, { pointerId: 1, clientX: 999 });
    expect(navWidth(container)).toBe('340px');
    fireEvent.pointerUp(h, { pointerId: 1, clientX: 999 });
    expect(localStorage.getItem(KEY)).toBe('340');
  });

  it('ширина восстанавливается из localStorage после «перезагрузки»', () => {
    localStorage.setItem(KEY, '280');
    const { container } = render(<SideNav unreadCount={0} />);
    expect(navWidth(container)).toBe('280px');
  });

  it('мусорное/некорректное значение localStorage игнорируется (дефолт 212)', () => {
    localStorage.setItem(KEY, 'не число');
    const first = render(<SideNav unreadCount={0} />);
    expect(navWidth(first.container)).toBe('212px');
    first.unmount();
    localStorage.setItem(KEY, '9999');
    const second = render(<SideNav unreadCount={0} />);
    expect(navWidth(second.container)).toBe('340px');
    second.unmount();
    localStorage.setItem(KEY, '50');
    const third = render(<SideNav unreadCount={0} />);
    expect(navWidth(third.container)).toBe('180px');
    third.unmount();
  });

  it('aria-label локализован: RU по умолчанию, EN — без кириллицы', () => {
    const ru = render(<SideNav unreadCount={0} locale="ru" />);
    const ruLabel = handle().getAttribute('aria-label') ?? '';
    expect(ruLabel).toContain('ширину меню');
    ru.unmount();

    const en = render(<SideNav unreadCount={0} locale="en" />);
    const enLabel = handle().getAttribute('aria-label') ?? '';
    expect(enLabel).toMatch(/width/i);
    expect(enLabel).not.toMatch(/[\u0400-\u04FF]/);
    en.unmount();
  });

  it('сохранённая ширина не ломает бейджи и дедлайн-карточку (DIG-14/34/54)', () => {
    localStorage.setItem(KEY, '300');
    const { container } = render(<SideNav unreadCount={3} tasksCount={2} />);
    expect(container.querySelector('[data-testid="tasks-count"]')).not.toBeNull();
    expect(container.textContent).toContain('Ближайший дедлайн');
  });

  // DIG-127 (доработка 20.11): двойной клик по ручке — сброс к дефолту 212.
  it('двойной клик по ручке сбрасывает ширину к дефолту и сохраняет', () => {
    const { container } = render(<SideNav unreadCount={0} />);
    const h = handle();
    fireEvent.keyDown(h, { key: 'End' });
    expect(navWidth(container)).toBe('340px');
    fireEvent.doubleClick(h);
    expect(navWidth(container)).toBe('212px');
    expect(localStorage.getItem(KEY)).toBe('212');
  });

  // DIG-127 (доработка 20.11): подписи разделов не обрезаются многоточием —
  // переносятся на две строки (жалоба пользователя: «пункты меню урезаны»).
  it('подписи разделов переносятся (line-clamp-2), а не truncate', () => {
    const { container } = render(<SideNav unreadCount={0} />);
    const labels = container.querySelectorAll('nav a span');
    expect(labels.length).toBeGreaterThan(0);
    for (const span of labels) {
      expect(span.className).not.toContain('truncate');
      expect(span.className).toContain('line-clamp-2');
      expect(span.className).toContain('break-words');
    }
  });
});
