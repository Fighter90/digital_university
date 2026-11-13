// DIG-35 — поведение экрана «Уведомления» (клиентский NotificationsScreen):
// фильтры сужают список и показывают свой пустой результат, клик по строке
// отмечает прочитанной и ведёт к объекту, «Отметить все прочитанными» —
// разом и с блокировкой, пустое состояние ленты. Мутации через server actions
// (мокаются), переходы — через useRouter (мокается).
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

const { pushMock, refreshMock, markOneMock, markAllMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  refreshMock: vi.fn(),
  markOneMock: vi.fn(async () => ({ ok: true })),
  markAllMock: vi.fn(async () => ({ ok: true, marked: 2 })),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock, back: vi.fn() }),
}));

vi.mock('@/server/actions/notifications', () => ({
  markNotificationReadAction: markOneMock,
  markAllNotificationsReadAction: markAllMock,
}));

import { NotificationsScreen } from '@/components/notifications/notifications-screen';
import type { NotificationFeedItem } from '@/lib/notification-view';

const NOW = new Date(2026, 10, 11, 12, 0, 0);
const iso = (d: Date) => d.toISOString();

const ITEMS: NotificationFeedItem[] = [
  {
    id: 'n-1',
    type: 'SCHEDULE',
    title: 'Пара «Базы данных» перенесена в ауд. Б-204',
    body: 'Сегодня практика в 12:00 — Б-204 вместо А-312.',
    isRead: false,
    important: true,
    actionLabel: 'Открыть расписание',
    link: '/schedule',
    createdAt: iso(new Date(2026, 10, 11, 8, 5)),
  },
  {
    id: 'n-2',
    type: 'REQUEST',
    title: 'Справка для военкомата готова',
    body: 'PDF с QR-кодом доступен в карточке заявки.',
    isRead: false,
    important: false,
    actionLabel: 'Скачать',
    link: '/requests',
    createdAt: iso(new Date(2026, 10, 11, 10, 40)),
  },
  {
    id: 'n-3',
    type: 'DEADLINE',
    title: 'Оплата за общежитие — до 25 ноября',
    body: 'Счёт за ноябрь выставлен: 3 450 ₽.',
    isRead: true,
    important: true,
    actionLabel: null,
    link: '/requests',
    createdAt: iso(new Date(2026, 10, 10, 18, 30)),
  },
  {
    id: 'n-4',
    type: 'NEWS',
    title: 'Открыта запись на консультации перед сессией',
    body: 'Слоты с 18 декабря через «Связь с деканатом».',
    isRead: true,
    important: false,
    actionLabel: null,
    link: '/deanery',
    createdAt: iso(new Date(2026, 10, 6, 12, 0)),
  },
];

beforeEach(() => {
  vi.useFakeTimers({ now: NOW.getTime() });
  markOneMock.mockClear();
  markAllMock.mockClear();
  pushMock.mockClear();
  refreshMock.mockClear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('NotificationsScreen — структура', () => {
  it('заголовок, 6 фильтров, группы дней и ссылка в «Настройки»', () => {
    render(<NotificationsScreen initialItems={ITEMS} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Уведомления' })).toBeInTheDocument();

    const group = screen.getByRole('group', { name: 'Фильтры уведомлений' });
    for (const label of ['Все', 'Непрочитанные', 'Учёба', 'Заявки', 'Деканат', 'Финансы']) {
      expect(within(group).getByRole('button', { name: label })).toBeInTheDocument();
    }

    expect(screen.getByRole('heading', { name: 'Сегодня' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Вчера' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ранее' })).toBeInTheDocument();

    const settings = screen.getByTestId('notification-settings-link');
    expect(settings).toHaveAttribute('href', '/settings');
  });

  it('«Важно» стоит только на срочных строках (2 из 4)', () => {
    render(<NotificationsScreen initialItems={ITEMS} />);
    expect(screen.getAllByText('Важно')).toHaveLength(2);
  });

  it('непрочитанные строки несут точку «не прочитано»', () => {
    render(<NotificationsScreen initialItems={ITEMS} />);
    expect(screen.getAllByTestId('unread-dot')).toHaveLength(2);
  });

  it('время: сегодня — HH:MM, ранее — DD.MM', () => {
    render(<NotificationsScreen initialItems={ITEMS} />);
    expect(screen.getByText('08:05')).toBeInTheDocument();
    expect(screen.getByText('06.11')).toBeInTheDocument();
  });
});

describe('NotificationsScreen — фильтры', () => {
  it('«Финансы» оставляет только DEADLINE-строки', () => {
    render(<NotificationsScreen initialItems={ITEMS} />);
    fireEvent.click(screen.getByRole('button', { name: 'Финансы' }));
    expect(screen.getByText('Оплата за общежитие — до 25 ноября')).toBeInTheDocument();
    expect(screen.queryByText('Справка для военкомата готова')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Пара «Базы данных» перенесена в ауд. Б-204'),
    ).not.toBeInTheDocument();
  });

  it('«Непрочитанные» — только непрочитанные; «Все» возвращает всё', () => {
    render(<NotificationsScreen initialItems={ITEMS} />);
    fireEvent.click(screen.getByRole('button', { name: 'Непрочитанные' }));
    expect(screen.getAllByTestId('notification-item')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Все' }));
    expect(screen.getAllByTestId('notification-item')).toHaveLength(4);
  });

  it('«Учёба» = SCHEDULE + GRADE', () => {
    render(<NotificationsScreen initialItems={ITEMS} />);
    fireEvent.click(screen.getByRole('button', { name: 'Учёба' }));
    expect(screen.getAllByTestId('notification-item')).toHaveLength(1);
    expect(screen.getByText('Пара «Базы данных» перенесена в ауд. Б-204')).toBeInTheDocument();
  });

  it('пустой результат фильтра виден, когда строк под фильтр нет', () => {
    const allRead = ITEMS.map((i) => ({ ...i, isRead: true }));
    render(<NotificationsScreen initialItems={allRead} />);
    fireEvent.click(screen.getByRole('button', { name: 'Непрочитанные' }));
    expect(screen.getByTestId('notifications-filter-empty')).toHaveTextContent('Здесь пока пусто');
    expect(screen.queryByTestId('notifications-empty')).not.toBeInTheDocument();
  });
});

describe('NotificationsScreen — прочтение и действия', () => {
  it('клик по строке: отметка прочитанной + переход к объекту', async () => {
    render(<NotificationsScreen initialItems={ITEMS} />);
    const row = screen.getByTestId('notification-item-n-1');
    fireEvent.click(within(row).getByRole('button', { name: `Открыть: ${ITEMS[0].title}` }));

    await waitFor(() => expect(markOneMock).toHaveBeenCalledWith('n-1'));
    expect(pushMock).toHaveBeenCalledWith('/schedule');
    // Оптимистичная отметка: точка исчезла.
    await waitFor(() => expect(within(row).queryByTestId('unread-dot')).not.toBeInTheDocument());
  });

  it('кнопка действия («Скачать») тоже отмечает и ведёт к объекту, без срабатывания строки', async () => {
    render(<NotificationsScreen initialItems={ITEMS} />);
    const row = screen.getByTestId('notification-item-n-2');
    fireEvent.click(within(row).getByRole('button', { name: 'Скачать' }));

    await waitFor(() => expect(markOneMock).toHaveBeenCalledWith('n-2'));
    expect(pushMock).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith('/requests');
  });

  it('«Отметить все прочитанными»: действие, все точки сняты, кнопка disabled', async () => {
    render(<NotificationsScreen initialItems={ITEMS} />);
    const button = screen.getByTestId('mark-all-read');
    expect(button).toBeEnabled();

    fireEvent.click(button);
    await waitFor(() => expect(markAllMock).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByTestId('unread-dot')).not.toBeInTheDocument());
    expect(button).toBeDisabled();
    // Обновление серверных частей (шапка/меню) без перезагрузки.
    expect(refreshMock).toHaveBeenCalled();
  });

  it('когда всё прочитано — кнопка неактивна изначально', () => {
    const allRead = ITEMS.map((i) => ({ ...i, isRead: true }));
    render(<NotificationsScreen initialItems={allRead} />);
    expect(screen.getByTestId('mark-all-read')).toBeDisabled();
  });
});

describe('NotificationsScreen — пустые состояния', () => {
  it('пустая лента: иллюстрация «Новых уведомлений нет»', () => {
    render(<NotificationsScreen initialItems={[]} />);
    expect(screen.getByTestId('notifications-empty')).toHaveTextContent('Новых уведомлений нет');
    expect(screen.getByTestId('mark-all-read')).toBeDisabled();
  });
});

describe('NotificationsScreen — живая лента (polling 60 с)', () => {
  it('раз в 60 секунд перечитывает recent-эндпоинт и подмешивает новые строки', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/notifications/recent')) {
        return {
          ok: true,
          json: async () => ({
            items: [
              ...ITEMS,
              {
                id: 'n-new',
                type: 'GRADE',
                title: 'Новая оценка: 92/100 — лабораторная 2',
                body: 'Лабораторная 2 по «Программированию» оценена на 92 из 100.',
                isRead: false,
                important: false,
                actionLabel: null,
                link: '/grades',
                createdAt: iso(new Date(2026, 10, 11, 11, 50)),
              },
            ],
          }),
        } as Response;
      }
      return { ok: true, json: async () => ({ count: 3 }) } as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<NotificationsScreen initialItems={ITEMS} />);
    expect(screen.queryByText('Новая оценка: 92/100 — лабораторная 2')).not.toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(60_000);
    await waitFor(() =>
      expect(screen.getByText('Новая оценка: 92/100 — лабораторная 2')).toBeInTheDocument(),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/notifications/recent'),
      expect.objectContaining({ cache: 'no-store' }),
    );

    vi.unstubAllGlobals();
  });
});
