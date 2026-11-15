// DIG-65 — интерактив голосовых компонентов (unit, jsdom):
// ListenDayButton (озвучка дня через мок speechSynthesis) и
// VoiceInputButton (диктовка через мок SpeechRecognition).
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

import { ListenDayButton } from '@/components/schedule/listen-day-button';
import { VoiceInputButton } from '@/components/shell/voice-input';
import type { ScheduleEventCard } from '@/lib/schedule-cards';

// ── Моки Web Speech API ──────────────────────────────────────────────────────

class FakeUtterance {
  text: string;
  lang = '';
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
}

const speakMock = vi.fn();
const cancelMock = vi.fn();

interface FakeRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  abort: ReturnType<typeof vi.fn>;
  onresult: ((event: unknown) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

const recognitions: FakeRecognition[] = [];
const FakeRecognitionCtor = vi.fn(function (this: FakeRecognition) {
  const rec: FakeRecognition = {
    lang: '',
    continuous: false,
    interimResults: false,
    maxAlternatives: 1,
    start: vi.fn(),
    stop: vi.fn(),
    abort: vi.fn(),
    onresult: null,
    onend: null,
    onerror: null,
  };
  recognitions.push(rec);
  return rec;
});

beforeEach(() => {
  speakMock.mockClear();
  cancelMock.mockClear();
  recognitions.length = 0;
  FakeRecognitionCtor.mockClear();
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: { speak: speakMock, cancel: cancelMock },
  });
  Object.defineProperty(window, 'SpeechSynthesisUtterance', {
    configurable: true,
    value: FakeUtterance,
  });
  Object.defineProperty(window, 'SpeechRecognition', {
    configurable: true,
    value: FakeRecognitionCtor,
  });
});

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(window, 'speechSynthesis');
  Reflect.deleteProperty(window, 'SpeechSynthesisUtterance');
  Reflect.deleteProperty(window, 'SpeechRecognition');
  Reflect.deleteProperty(window, 'webkitSpeechRecognition');
});

// ── Фикстура карточки пары ───────────────────────────────────────────────────

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

// ── ListenDayButton ──────────────────────────────────────────────────────────

describe('ListenDayButton (DIG-65)', () => {
  it('по клику озвучивает день: speak с текстом дня, aria-pressed=true', () => {
    render(
      <ListenDayButton
        title="Среда, 11 ноября"
        isToday
        events={[
          card(),
          card({ id: 'ev-2', discipline: 'Физика', status: 'CANCELLED', isCancelled: true }),
        ]}
        enabled
      />,
    );
    const button = screen.getByRole('button', { name: 'Прослушать день' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(button);

    expect(speakMock).toHaveBeenCalledTimes(1);
    const utterance = speakMock.mock.calls[0]![0] as FakeUtterance;
    expect(utterance.text).toContain('Информатика');
    expect(utterance.text).not.toContain('Физика'); // отменённая пара не читается
    expect(utterance.lang).toBe('ru-RU');
    expect(screen.getByRole('button', { name: 'Остановить озвучку' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('повторный клик останавливает: cancel вызван, aria-pressed=false', () => {
    render(<ListenDayButton title="Среда, 11 ноября" isToday events={[card()]} enabled />);
    const button = screen.getByRole('button', { name: 'Прослушать день' });
    fireEvent.click(button);
    fireEvent.click(screen.getByRole('button', { name: 'Остановить озвучку' }));
    expect(cancelMock).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Прослушать день' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('конец озвучки (onend) возвращает кнопку в исходное состояние', () => {
    render(<ListenDayButton title="Среда, 11 ноября" isToday events={[card()]} enabled />);
    fireEvent.click(screen.getByRole('button', { name: 'Прослушать день' }));
    const utterance = speakMock.mock.calls[0]![0] as FakeUtterance;
    act(() => {
      utterance.onend?.();
    });
    expect(screen.getByRole('button', { name: 'Прослушать день' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('выключенная настройка: кнопка не отрисовывается', () => {
    render(<ListenDayButton title="Среда, 11 ноября" isToday events={[card()]} enabled={false} />);
    expect(screen.queryByRole('button', { name: /Прослушать/ })).toBeNull();
    expect(screen.queryByTestId('listen-day')).toBeNull();
  });

  it('браузер без speechSynthesis: кнопка не отрисовывается и не падает', () => {
    Reflect.deleteProperty(window, 'speechSynthesis');
    render(<ListenDayButton title="Среда, 11 ноября" isToday events={[card()]} enabled />);
    expect(screen.queryByRole('button', { name: /Прослушать/ })).toBeNull();
  });

  it('уход со страницы во время озвучки отменяет синтез', () => {
    const { unmount } = render(
      <ListenDayButton title="Среда, 11 ноября" isToday events={[card()]} enabled />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Прослушать день' }));
    unmount();
    expect(cancelMock).toHaveBeenCalled();
  });
});

// ── VoiceInputButton ─────────────────────────────────────────────────────────

describe('VoiceInputButton (DIG-65)', () => {
  it('по клику запускает распознавание (ru-RU, финальные результаты)', () => {
    const onResult = vi.fn();
    render(<VoiceInputButton onResult={onResult} />);
    fireEvent.click(screen.getByRole('button', { name: 'Голосовой ввод' }));

    expect(FakeRecognitionCtor).toHaveBeenCalledTimes(1);
    const rec = recognitions[0]!;
    expect(rec.start).toHaveBeenCalledTimes(1);
    expect(rec.lang).toBe('ru-RU');
    expect(rec.interimResults).toBe(false);
    expect(screen.getByRole('button', { name: 'Остановить запись' })).toBeInTheDocument();
  });

  it('финальная расшифровка попадает в onResult, запись завершается (onend)', () => {
    const onResult = vi.fn();
    render(<VoiceInputButton onResult={onResult} />);
    fireEvent.click(screen.getByRole('button', { name: 'Голосовой ввод' }));
    const rec = recognitions[0]!;

    rec.onresult?.({
      resultIndex: 0,
      results: { 0: { 0: { transcript: '  где мои справки?  ' } }, length: 1 },
    });
    expect(onResult).toHaveBeenCalledWith('где мои справки?');

    act(() => {
      rec.onend?.();
    });
    expect(screen.getByRole('button', { name: 'Голосовой ввод' })).toBeInTheDocument();
  });

  it('повторный клик (остановка) вызывает stop и не запускает второе распознавание', () => {
    render(<VoiceInputButton onResult={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Голосовой ввод' }));
    fireEvent.click(screen.getByRole('button', { name: 'Остановить запись' }));
    const rec = recognitions[0]!;
    expect(rec.stop).toHaveBeenCalledTimes(1);
    // onend ещё не пришёл — третий клик не должен создать второй инстанс
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(1);
    expect(FakeRecognitionCtor).toHaveBeenCalledTimes(1);
  });

  it('браузер без SpeechRecognition: кнопка не отрисовывается', () => {
    Reflect.deleteProperty(window, 'SpeechRecognition');
    Reflect.deleteProperty(window, 'webkitSpeechRecognition');
    render(<VoiceInputButton onResult={vi.fn()} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
