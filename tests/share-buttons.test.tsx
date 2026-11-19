// DIG-101 — юнит-контракт клиентского компонента ShareButtons (jsdom):
// четыре кнопки (ВКонтакте / Telegram / WhatsApp / копирование), href
// share-сервисов в новой вкладке, aria-label по словарю RU/EN, корень-
// относительный url превращается в абсолютный после гидрации, копирование
// через navigator.clipboard с видимым подтверждением «Ссылка скопирована»
// и честным фолбэком/ошибкой, когда clipboard недоступен.
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { ShareButtons } from '@/components/share/share-buttons';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const PAGE_URL = 'https://du.example/help/dorm';
const TITLE = 'Как получить справку';

describe('ShareButtons — share-ссылки', () => {
  it('четыре кнопки: href сервисов, target=_blank, aria-label (RU)', () => {
    render(<ShareButtons url={PAGE_URL} title={TITLE} />);

    const vk = screen.getByTestId('share-vk');
    expect(vk).toHaveAttribute(
      'href',
      `https://vk.com/share.php?url=${encodeURIComponent(PAGE_URL)}`,
    );
    expect(vk).toHaveAttribute('target', '_blank');
    expect(vk).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(vk).toHaveAttribute('aria-label', 'Поделиться во ВКонтакте');

    const telegram = screen.getByTestId('share-telegram');
    expect(telegram).toHaveAttribute(
      'href',
      `https://t.me/share/url?url=${encodeURIComponent(PAGE_URL)}&text=${encodeURIComponent(TITLE)}`,
    );
    expect(telegram).toHaveAttribute('aria-label', 'Поделиться в Telegram');

    const whatsapp = screen.getByTestId('share-whatsapp');
    expect(whatsapp).toHaveAttribute(
      'href',
      `https://wa.me/?text=${encodeURIComponent(`${TITLE} ${PAGE_URL}`)}`,
    );
    expect(whatsapp).toHaveAttribute('aria-label', 'Поделиться в WhatsApp');

    expect(screen.getByTestId('share-copy')).toHaveAttribute('aria-label', 'Скопировать ссылку');
    expect(screen.getByTestId('share-buttons')).toHaveAttribute(
      'aria-label',
      'Поделиться в соцсетях',
    );
  });

  it('EN-локаль: aria-label из английского словаря', () => {
    render(<ShareButtons url={PAGE_URL} title={TITLE} locale="en" />);
    expect(screen.getByTestId('share-vk')).toHaveAttribute('aria-label', 'Share on VK');
    expect(screen.getByTestId('share-telegram')).toHaveAttribute('aria-label', 'Share on Telegram');
    expect(screen.getByTestId('share-whatsapp')).toHaveAttribute('aria-label', 'Share on WhatsApp');
    expect(screen.getByTestId('share-copy')).toHaveAttribute('aria-label', 'Copy the link');
  });

  it('корень-относительный url становится абсолютным после гидрации', async () => {
    render(<ShareButtons url="/help/dorm" title={TITLE} />);
    const vk = screen.getByTestId('share-vk');
    // SSR-разметка ещё без origin — href как передали; после эффекта — абсолютный.
    await waitFor(() =>
      expect(vk).toHaveAttribute(
        'href',
        `https://vk.com/share.php?url=${encodeURIComponent('http://localhost:3000/help/dorm')}`,
      ),
    );
  });
});

describe('ShareButtons — «Скопировать ссылку»', () => {
  const withClipboard = (writeText: (text: string) => Promise<void>) => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  };

  it('clipboard доступен: ссылка в буфере, подтверждение «Ссылка скопирована»', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    withClipboard(writeText);
    render(<ShareButtons url={PAGE_URL} title={TITLE} />);

    fireEvent.click(screen.getByTestId('share-copy'));
    await waitFor(() =>
      expect(screen.getByTestId('share-copy-status')).toHaveTextContent('Ссылка скопирована'),
    );
    expect(writeText).toHaveBeenCalledWith(PAGE_URL);
  });

  it('clipboard недоступен: фолбэк execCommand тоже копирует с подтверждением', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    const execCommand = vi.fn(() => true);
    document.execCommand = execCommand as unknown as typeof document.execCommand;
    render(<ShareButtons url={PAGE_URL} title={TITLE} />);

    fireEvent.click(screen.getByTestId('share-copy'));
    await waitFor(() =>
      expect(screen.getByTestId('share-copy-status')).toHaveTextContent('Ссылка скопирована'),
    );
    expect(execCommand).toHaveBeenCalledWith('copy');
  });

  it('ни clipboard, ни execCommand: честное «Не удалось скопировать»', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    withClipboard(writeText);
    document.execCommand = vi.fn(() => false) as unknown as typeof document.execCommand;
    render(<ShareButtons url={PAGE_URL} title={TITLE} />);

    fireEvent.click(screen.getByTestId('share-copy'));
    await waitFor(() =>
      expect(screen.getByTestId('share-copy-status')).toHaveTextContent('Не удалось скопировать'),
    );
  });

  it('кастомные testid (статья новости сохраняет контракт e2e DIG-36)', () => {
    render(
      <ShareButtons
        url={PAGE_URL}
        title={TITLE}
        copyTestId="news-share"
        statusTestId="news-share-status"
      />,
    );
    expect(screen.getByTestId('news-share')).toBeInTheDocument();
    expect(screen.getByTestId('news-share-status')).toBeInTheDocument();
  });
});

// DIG-101 — панель «Детали пары» шарит безопасную публичную ссылку на день
// расписания (/schedule?date=…&share=lesson-…): контракт исходника (панель —
// клиентский диалог, поведенческое покрытие — e2e schedule-event-details).
describe('панель «Детали пары» — шаринг ссылки на день', () => {
  it('исходник панели монтирует ShareButtons с share=lesson-<id> и датой', () => {
    const source = readFileSync(
      resolve(import.meta.dirname, '../src/components/schedule/event-details-panel.tsx'),
      'utf8',
    );
    expect(source).toContain('<ShareButtons');
    expect(source).toContain('share=lesson-');
    expect(source).toContain('moscowDateKey(view.startsAt)');
    expect(source).toContain('schedule.share.dayTitle');
  });
});
