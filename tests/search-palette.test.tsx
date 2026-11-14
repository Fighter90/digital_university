// DIG-45 — поведение командной палитры поиска (jsdom, unit).
// Пиним приёмку: группы из ответа /api/search, навигация ↑/↓ и Tab по
// группам, Enter открывает (router.push + закрытие + недавний запрос),
// AI-подвал «Спросить AI: „<запрос>“», пустое состояние (недавние +
// популярные действия по роли), нулевой результат и ошибка сети.
// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const pushMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { SearchPalette } from '@/components/shell/search-palette';
import { MAX_CACHED_QUERIES, type SearchResponse } from '@/lib/search-core';

const DEBOUNCE_MS = 120;

const FIXTURE: SearchResponse = {
  query: 'справка',
  groups: [
    {
      kind: 'action',
      label: 'Действия',
      hits: [
        {
          id: 'action-cert-enrollment',
          kind: 'action',
          title: 'Справка об обучении',
          subtitle: 'Для банка, визы и работы',
          href: '/requests?order=cert-enrollment',
        },
      ],
    },
    {
      kind: 'faq',
      label: 'Вопросы и ответы',
      hits: [
        {
          id: 'faq-spravka',
          kind: 'faq',
          title: 'Как заказать справку об обучении?',
          subtitle: 'Заказ занимает 2–3 дня',
          href: '/requests?order=cert-enrollment',
        },
      ],
    },
    {
      kind: 'news',
      label: 'Новости',
      hits: [
        {
          id: 'news-scholarship',
          kind: 'news',
          title: 'Повышенная стипендия: документы',
          href: '/notifications',
        },
      ],
    },
  ],
};

const fetchMock = vi.fn();

beforeEach(() => {
  localStorage.clear();
  pushMock.mockReset();
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => ({
    ok: true,
    json: async () => FIXTURE,
  }));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderPalette(props: Partial<Parameters<typeof SearchPalette>[0]> = {}) {
  const onClose = props.onClose ?? vi.fn();
  render(<SearchPalette open onClose={onClose} role="STUDENT" {...props} />);
  const input = screen.getByRole('combobox', { name: 'Поиск по кабинету' }) as HTMLInputElement;
  return { onClose, input };
}

function typeQuery(input: HTMLInputElement, value: string) {
  fireEvent.change(input, { target: { value } });
}

async function settled(input: HTMLInputElement, query: string) {
  typeQuery(input, query);
  await waitFor(() => expect(fetchMock).toHaveBeenCalled(), { timeout: 2000 });
  await waitFor(() => expect(screen.getAllByRole('option').length).toBeGreaterThan(0), {
    timeout: 2000,
  });
}

describe('результаты по группам', () => {
  it('рендерит группы в порядке ответа и подсвечивает активную строку', async () => {
    const { input } = renderPalette();
    await settled(input, 'справка');

    expect(screen.getByRole('heading', { name: 'Действия' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Вопросы и ответы' })).toBeVisible();
    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', options[0]!.id);
  });

  it('поиск ходит в /api/search с закодированным запросом', async () => {
    const { input } = renderPalette();
    await settled(input, 'справка');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(encodeURIComponent('справка')),
      expect.anything(),
    );
  });
});

describe('клавиатура', () => {
  it('ArrowDown/ArrowUp двигают активную строку по общему списку', async () => {
    const { input } = renderPalette();
    await settled(input, 'справка');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    const second = screen.getAllByRole('option')[1]!;
    expect(input).toHaveAttribute('aria-activedescendant', second.id);
    expect(second).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    const first = screen.getAllByRole('option')[0]!;
    expect(input).toHaveAttribute('aria-activedescendant', first.id);
  });

  it('Tab перескакивает на первую строку следующей группы', async () => {
    const { input } = renderPalette();
    await settled(input, 'справка');

    fireEvent.keyDown(input, { key: 'Tab' });
    const options = screen.getAllByRole('option');
    // вторая группа = «Вопросы и ответы» (вторая опция общего списка)
    expect(input).toHaveAttribute('aria-activedescendant', options[1]!.id);

    fireEvent.keyDown(input, { key: 'Tab', shiftKey: true });
    expect(input).toHaveAttribute('aria-activedescendant', options[0]!.id);
  });

  it('Enter открывает активный результат, закрывает палитру и сохраняет запрос', async () => {
    localStorage.setItem('du.search.recent.v1', JSON.stringify(['старый']));
    const { input, onClose } = renderPalette();
    await settled(input, 'справка');

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(pushMock).toHaveBeenCalledWith('/requests?order=cert-enrollment');
    expect(onClose).toHaveBeenCalled();
    const recents = JSON.parse(localStorage.getItem('du.search.recent.v1') ?? '[]');
    expect(recents).toEqual(['справка', 'старый']);
  });

  it('Enter на AI-подвале ведёт в AI-ассистент с запросом', async () => {
    const { input } = renderPalette();
    await settled(input, 'справка');

    // спускаемся в конец списка: последняя опция — AI-подвал
    const ai = screen.getAllByRole('option').at(-1)!;
    while (input.getAttribute('aria-activedescendant') !== ai.id) {
      fireEvent.keyDown(input, { key: 'ArrowDown' });
    }
    expect(screen.getAllByRole('option').at(-1)).toHaveAttribute('data-kind', 'ai');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(pushMock).toHaveBeenCalledWith('/ai-assistant?q=' + encodeURIComponent('справка'));
  });
});

describe('AI-подвал и пустые состояния', () => {
  it('подвал «Спросить AI: «<запрос>»» виден при непустом запросе', async () => {
    const { input } = renderPalette();
    await settled(input, 'справка');
    expect(screen.getByText(/Спросить AI/)).toBeVisible();
    expect(screen.getByText(/«справка»/)).toBeVisible();
  });

  it('пустое поле: недавние запросы и популярные действия по роли', () => {
    localStorage.setItem('du.search.recent.v1', JSON.stringify(['справка']));
    renderPalette();
    expect(screen.getByText('Недавние запросы')).toBeVisible();
    expect(screen.getByRole('button', { name: 'справка' })).toBeVisible();
    expect(screen.getByText('Популярные действия')).toBeVisible();
    expect(screen.getByText('Справка об обучении')).toBeVisible();
  });

  it('клик по недавнему выполняет поиск', async () => {
    localStorage.setItem('du.search.recent.v1', JSON.stringify(['справка']));
    const { input } = renderPalette();
    fireEvent.click(screen.getByRole('button', { name: 'справка' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled(), { timeout: 2000 });
    expect(input.value).toBe('справка');
  });

  it('«Очистить» удаляет недавние запросы', () => {
    localStorage.setItem('du.search.recent.v1', JSON.stringify(['справка']));
    renderPalette();
    fireEvent.click(screen.getByRole('button', { name: 'Очистить' }));
    expect(localStorage.getItem('du.search.recent.v1')).toBeNull();
    expect(screen.queryByText('Недавние запросы')).not.toBeInTheDocument();
  });

  it('нулевой результат показывает «Ничего не найдено» и AI-подвал', async () => {
    fetchMock.mockImplementation(async () => ({
      ok: true,
      json: async () => ({ query: 'вымышленныйзапрос', groups: [] }),
    }));
    const { input } = renderPalette();
    typeQuery(input, 'вымышленныйзапрос');
    await waitFor(() => expect(screen.getByText(/Ничего не найдено/)).toBeVisible(), {
      timeout: 2000,
    });
    expect(screen.getByText(/Спросить AI/)).toBeVisible();
  });

  it('ошибка сети — сообщение о недоступности', async () => {
    fetchMock.mockImplementation(async () => ({ ok: false }));
    const { input } = renderPalette();
    typeQuery(input, 'справка');
    await waitFor(() => expect(screen.getByText(/Поиск временно недоступен/)).toBeVisible(), {
      timeout: 2000,
    });
  });
});

describe('кеш повторов: лимит (DIG-45 р2)', () => {
  it('повтор запроса идёт из кеша; вытесненная запись ищется заново', async () => {
    vi.useFakeTimers();
    try {
      const { input } = renderPalette();
      const search = async (term: string) => {
        typeQuery(input, term);
        await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + 30);
      };
      await search('справка');
      expect(fetchMock).toHaveBeenCalledTimes(1);
      await search('справка');
      expect(fetchMock).toHaveBeenCalledTimes(1); // из кеша, сеть не трогаем

      // переполняем кеш уникальными запросами — «справка» вытесняется
      for (let i = 0; i < MAX_CACHED_QUERIES; i += 1) {
        await search(`запрос номер ${i}`);
      }
      expect(fetchMock).toHaveBeenCalledTimes(1 + MAX_CACHED_QUERIES);

      await search('справка');
      expect(fetchMock).toHaveBeenCalledTimes(2 + MAX_CACHED_QUERIES); // кеш не бездонный
    } finally {
      vi.useRealTimers();
    }
  });
});
