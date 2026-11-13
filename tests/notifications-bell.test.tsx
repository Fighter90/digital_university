// DIG-35 — панель колокольчика (NotificationsBell): закрыта по умолчанию,
// открывается кликом и с клавиатуры, показывает максимум 5 строк, Esc закрывает
// и возвращает фокус на колокольчик, клик по строке отмечает прочитанной,
// ведёт к объекту и закрывает панель, ссылки «Все уведомления» и «Настроить
// уведомления», лента панели перечитывается раз в 60 секунд.
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

const { pushMock, markOneMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  markOneMock: vi.fn(async () => ({ ok: true })),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
}));

vi.mock('@/server/actions/notifications', () => ({
  markNotificationReadAction: markOneMock,
  markAllNotificationsReadAction: vi.fn(async () => ({ ok: true, marked: 0 })),
}));

import { NotificationsBell } from '@/components/notifications/notifications-bell';
import type { NotificationFeedItem } from '@/lib/notification-view';

const NOW = new Date(2026, 10, 11, 12, 0, 0);
const iso = (d: Date) => d.toISOString();

const item = (id: string, hour: number, unread = false): NotificationFeedItem => ({
  id,
  type: 'SCHEDULE',
  title: `Уведомление ${id}`,
  body: `Детали уведомления ${id}: объект и что изменилось.`,
  isRead: !unread,
  important: false,
  actionLabel: null,
  link: '/schedule',
  createdAt: iso(new Date(2026, 10, 11, hour, 0)),
});

// 7 строк — панель обязана показать только 5 самых свежих.
const SEVEN = [
  item('n-1', 11, true),
  item('n-2', 10),
  item('n-3', 9, true),
  item('n-4', 8),
  item('n-5', 7),
  item('n-6', 6),
  item('n-7', 5),
];

beforeEach(() => {
  vi.useFakeTimers({ now: NOW.getTime() });
  markOneMock.mockClear();
  pushMock.mockClear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function renderBell(items: NotificationFeedItem[] = SEVEN, count = 3) {
  return render(<NotificationsBell initialItems={items} initialCount={count} />);
}

describe('NotificationsBell — открытие и состав', () => {
  it('по умолчанию закрыта: панели нет, aria-expanded=false, счётчик на кнопке', () => {
    const { container } = renderBell();
    const button = screen.getByTestId('notifications-bell');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveAttribute('aria-controls', 'notifications-panel');
    expect(container.querySelector('[data-testid="notifications-panel"]')).toBeNull();
    expect(screen.getByTestId('unread-count')).toHaveTextContent('3');
  });

  it('клик открывает панель: максимум 5 самых свежих строк и ссылки', () => {
    renderBell();
    fireEvent.click(screen.getByTestId('notifications-bell'));

    const panel = screen.getByTestId('notifications-panel');
    expect(panel).toHaveAttribute('role', 'dialog');
    expect(screen.getByTestId('notifications-bell')).toHaveAttribute('aria-expanded', 'true');
    expect(panel.querySelectorAll('[data-testid="notification-item"]')).toHaveLength(5);
    // 5 самых свежих: n-1…n-5, n-6/n-7 не попадают.
    expect(screen.getByTestId('notification-item-n-5')).toBeInTheDocument();
    expect(screen.queryByTestId('notification-item-n-6')).not.toBeInTheDocument();

    expect(screen.getByTestId('panel-all')).toHaveAttribute('href', '/notifications');
    expect(screen.getByTestId('panel-settings')).toHaveAttribute('href', '/settings');
  });

  it('строки без ссылок/действий остаются просто строками панели (нет падения)', () => {
    const noLink = [{ ...item('n-x', 11, true), link: null, actionLabel: null }];
    renderBell(noLink, 1);
    fireEvent.click(screen.getByTestId('notifications-bell'));
    expect(screen.getByTestId('notification-item-n-x')).toBeInTheDocument();
  });
});

describe('NotificationsBell — клавиатура', () => {
  it('открытие переводит фокус в панель; Esc закрывает и возвращает фокус на колокольчик', () => {
    renderBell();
    const button = screen.getByTestId('notifications-bell');
    // Нативная кнопка: Enter/Space в реальном браузере дают click.
    button.focus();
    fireEvent.click(button);
    const panel = screen.getByTestId('notifications-panel');
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(panel).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('notifications-panel')).not.toBeInTheDocument();
    expect(button).toHaveFocus();
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('Tab не покидает панель: фокус циклится между интерактивами', () => {
    renderBell();
    fireEvent.click(screen.getByTestId('notifications-bell'));
    const panel = screen.getByTestId('notifications-panel');
    const focusables = panel.querySelectorAll<HTMLElement>('button, a[href]');
    expect(focusables.length).toBeGreaterThanOrEqual(3); // строки + «Все» + «Настроить»
    // Shift+Tab с первого элемента — на последний (ловушка фокуса).
    fireEvent.keyDown(panel, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(focusables[focusables.length - 1]);
  });

  it('клик по строке: отметка + переход + закрытие панели', async () => {
    renderBell();
    fireEvent.click(screen.getByTestId('notifications-bell'));
    const row = screen.getByTestId('notification-item-n-1');
    fireEvent.click(within(row).getAllByRole('button')[0]);

    await waitFor(() => expect(markOneMock).toHaveBeenCalledWith('n-1'));
    expect(pushMock).toHaveBeenCalledWith('/schedule');
    await waitFor(() =>
      expect(screen.queryByTestId('notifications-panel')).not.toBeInTheDocument(),
    );
  });
});

describe('NotificationsBell — живая лента панели (polling 60 с)', () => {
  it('раз в 60 секунд перечитывает recent-эндпоинт (limit 5)', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/notifications/recent')) {
        return {
          ok: true,
          json: async () => ({ items: [item('n-fresh', 11, true)] }),
        } as Response;
      }
      return { ok: true, json: async () => ({ count: 4 }) } as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    renderBell(SEVEN, 3);
    fireEvent.click(screen.getByTestId('notifications-bell'));
    expect(screen.queryByTestId('notification-item-n-fresh')).not.toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(60_000);
    await waitFor(() =>
      expect(screen.getByTestId('notification-item-n-fresh')).toBeInTheDocument(),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/notifications/recent'),
      expect.objectContaining({ cache: 'no-store' }),
    );
  });
});
