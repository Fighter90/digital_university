// DIG-46 — контракт стриминга ответа в клиентском чате (не SSR!).
// Ответ дописывается по частям и ОБЯЗАН завершиться: полный текст без
// курсора ▍, кнопки/подсказки снова активны. Поймал дефект: цепочка тиков
// обрывалась после первого тика (флаги found/finished читались снаружи
// setDialogs-updater, который React вызывает позже) — текст навсегда
// залипал на 3 символах с мигающим курсором (e2e assistant.spec.ts).
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { createElement } from 'react';

import type { AssistantContext } from '@/lib/assistant-engine';
import { AssistantChat } from '@/components/assistant/assistant-chat';

const context: AssistantContext = {
  role: 'STUDENT',
  firstName: 'Анна',
  fullName: 'Анна Смирнова',
  groupLabel: 'ПИ-21',
  tomorrow: {
    dateKey: '2026-11-16',
    dateLabel: 'понедельник, 16 ноября',
    events: [
      {
        timeLabel: '12:00–13:30',
        discipline: 'Программирование',
        kindLabel: 'Лабораторная',
        roomLabel: 'ауд. 405',
        // AssistantLesson.teacher — непустая строка (контракт движка,
        // тот же сериализатор, что у экрана расписания).
        teacher: 'Кузнецова Ксения Кирилловна',
        isMoved: true,
        isCancelled: false,
        isOnline: false,
      },
      {
        timeLabel: '16:00–17:30',
        discipline: 'Базы данных',
        kindLabel: 'Консультация',
        roomLabel: 'ауд. 212',
        teacher: 'Соколов Сергей Сергеевич',
        isMoved: false,
        isCancelled: false,
        isOnline: false,
      },
    ],
  },
  nextStudyDayLabel: null,
  disciplines: [],
};

describe('AssistantChat — стриминг завершается', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // jsdom не реализует matchMedia, а чат читает prefers-reduced-motion.
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('seeded-ответ дописывается до конца: полный текст без курсора ▍', async () => {
    render(
      createElement(AssistantChat, { context, seedQuestion: 'Что у меня завтра?' }),
    );

    // Даю стримингу досчитать. Каждый act — отдельный тик: React коммитит
    // обновление и эффект планирует следующий таймер уже после flush, поэтому
    // продвигаем время пошагово, пока стрим не завершится (верхняя граница —
    // с запасом; текст ответа ~100–150 символов при 3 символах за тик).
    for (let step = 0; step < 200; step += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(50);
      });
      if (vi.getTimerCount() === 0) break;
    }

    const messages = document.querySelector('[data-testid="assistant-messages"]');
    expect(messages?.textContent).toContain('у вас 2 пары');
    expect(messages?.textContent).not.toContain('▍');
  });

  it('после завершения стрима подсказки снова активны (можно задать вопрос)', async () => {
    render(createElement(AssistantChat, { context }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    const hints = document.querySelectorAll('[data-testid="assistant-hints"] button');
    expect(hints.length).toBe(4);
    for (const hint of hints) {
      expect((hint as HTMLButtonElement).disabled).toBe(false);
    }
  });
});
