// DIG-104 — регресс: ListenDayButton проверял isSpeechSynthesisSupported()
// прямо в рендере — это server/client ветка: SSR (без window) рисовал null,
// браузер (со speechSynthesis) — кнопку. Расхождение первого рендера =
// ошибка гидрации React #418 на мобильном виде расписания («Прослушать день»).
//
// Контракт гидробезопасности: ПЕРВЫЙ рендер не зависит от возможностей
// window; кнопка появляется после монтирования (эффект), если движок есть.
// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { act, cleanup, render } from '@testing-library/react';
import { renderToString } from 'react-dom/server';

import { ListenDayButton } from '@/components/schedule/listen-day-button';
import type { ScheduleEventCard } from '@/lib/schedule-cards';

beforeAll(() => {
  // браузер с движком озвучки (в jsdom speechSynthesis нет — мокаем явно)
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: { speak: vi.fn(), cancel: vi.fn() },
  });
});

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

const card = (over: Partial<ScheduleEventCard> = {}): ScheduleEventCard => ({
  id: 'ev-1',
  dateKey: '2026-11-11',
  startMinutes: 600,
  endMinutes: 690,
  startLabel: '10:00',
  endLabel: '11:30',
  timeLabel: '10:00–11:30',
  kind: 'LECTURE',
  discipline: 'Информатика',
  teacher: 'Петров Пётр Петрович',
  room: '301',
  roomLabel: 'ауд. 301',
  status: 'SCHEDULED',
  isMoved: false,
  isCancelled: false,
  previousRoomLabel: null,
  previousTimeLabel: null,
  note: null,
  changeNote: null,
  ariaLabel: 'Лекция, Информатика, 10:00–11:30, ауд. 301',
  ...over,
});

function renderButton() {
  return render(
    <ListenDayButton title="Среда, 11 ноября" isToday events={[card()]} enabled locale="ru" />,
  );
}

describe('ListenDayButton — гидробезопасность (DIG-104)', () => {
  it('server HTML не зависит от window: в SSR-строке кнопки нет', () => {
    // Дефект DIG-104: isSpeechSynthesisSupported() вызывался в рендере —
    // server/client ветка. renderToString не выполняет эффектов: если кнопка
    // появляется в SSR-строке при наличии движка, гидрация расходится
    // (SSR без window рисует null) → React #418.
    const html = renderToString(
      <ListenDayButton title="Среда, 11 ноября" isToday events={[card()]} enabled locale="ru" />,
    );
    expect(html).not.toContain('data-testid="listen-day"');
    expect(html).not.toContain('Прослушать день');
  });

  it('после монтирования (браузер с движком) кнопка появляется', async () => {
    const { container } = renderButton();
    await act(async () => {}); // эффекты монтирования
    expect(container.querySelector('[data-testid="listen-day"]')).not.toBeNull();
  });

  it('после монтирования без движка озвучки кнопка так и не появляется', async () => {
    Reflect.deleteProperty(window, 'speechSynthesis');
    const { container } = renderButton();
    await act(async () => {});
    expect(container.querySelector('[data-testid="listen-day"]')).toBeNull();
  });
});
