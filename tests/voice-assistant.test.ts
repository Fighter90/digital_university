// DIG-65 — чистый модуль voice-assistant: сборка текста озвучки дня
// (детерминированный русский текст для SpeechSynthesis) и SSR-safe
// детекторы Web Speech API. Node-окружение: window нет — детекторы
// обязаны возвращать false, а не падать.
import { describe, expect, it } from 'vitest';

import {
  buildDaySpeechText,
  getSpeechRecognitionCtor,
  isSpeechSynthesisSupported,
  type SpeechEventInput,
} from '@/lib/voice-assistant';

const ev = (over: Partial<SpeechEventInput> = {}): SpeechEventInput => ({
  discipline: 'Информатика',
  kind: 'LECTURE',
  startLabel: '10:00',
  endLabel: '11:30',
  roomLabel: 'ауд. 301',
  teacher: 'Петров Пётр Петрович',
  isMoved: false,
  isCancelled: false,
  ...over,
});

describe('buildDaySpeechText — день с парами (DIG-65)', () => {
  it('сегодняшний день: интро «Сегодня, …», счёт пар и описание каждой пары', () => {
    const text = buildDaySpeechText({
      title: 'Среда, 11 ноября',
      isToday: true,
      events: [
        ev(),
        ev({
          discipline: 'Математический анализ',
          kind: 'SEMINAR',
          startLabel: '12:00',
          endLabel: '13:30',
          roomLabel: 'ауд. 305',
          teacher: 'Кузнецова Ксения Кирилловна',
        }),
      ],
    });
    expect(text).toContain('Сегодня, среда, 11 ноября.');
    expect(text).toContain('2 пары');
    expect(text).toContain('Первая пара — Информатика, лекция, с 10:00 до 11:30');
    expect(text).toContain('аудитория 301');
    expect(text).toContain('преподаватель Петров Пётр Петрович');
    expect(text).toContain('Вторая пара — Математический анализ, семинар');
    expect(text).toContain('преподаватель Кузнецова');
  });

  it('не-сегодняшний день: интро — просто заголовок дня без «Сегодня»', () => {
    const text = buildDaySpeechText({
      title: 'Четверг, 12 ноября',
      isToday: false,
      events: [ev()],
    });
    expect(text.startsWith('Четверг, 12 ноября.')).toBe(true);
    expect(text).not.toContain('Сегодня');
  });

  it('«ауд. N» читается как «аудитория N», «онлайн» — как есть', () => {
    const text = buildDaySpeechText({
      title: 'Среда, 11 ноября',
      isToday: true,
      events: [ev({ roomLabel: 'онлайн' })],
    });
    expect(text).toContain('онлайн');
    expect(text).not.toContain('ауд.');
  });

  it('отменённые пары не озвучиваются; перенос помечается «пара перенесена»', () => {
    const text = buildDaySpeechText({
      title: 'Среда, 11 ноября',
      isToday: true,
      events: [ev({ isCancelled: true }), ev({ discipline: 'Физика', isMoved: true })],
    });
    expect(text).toContain('1 пара');
    expect(text).toContain('Физика');
    expect(text).toContain('Пара перенесена');
    expect(text).not.toContain('Информатика');
  });

  it('день из одних отменённых пар: «Все пары на этот день отменены»', () => {
    const text = buildDaySpeechText({
      title: 'Среда, 11 ноября',
      isToday: true,
      events: [ev({ isCancelled: true })],
    });
    expect(text).toContain('Все пары на этот день отменены');
  });

  it('пустой день: «Пар в этот день нет»', () => {
    const text = buildDaySpeechText({
      title: 'Воскресенье, 15 ноября',
      isToday: true,
      events: [],
    });
    expect(text).toContain('Пар в этот день нет');
  });

  it('больше шести пар: нумерация не ломается («Седьмая пара» → «Пара 7»)', () => {
    const text = buildDaySpeechText({
      title: 'Среда, 11 ноября',
      isToday: true,
      events: Array.from({ length: 7 }, () => ev()),
    });
    expect(text).toContain('Пара 7 — Информатика');
  });
});

describe('детекторы Web Speech API — SSR-safe (DIG-65)', () => {
  it('в Node (без window) синтез и распознавание не поддерживаются, без исключений', () => {
    expect(isSpeechSynthesisSupported()).toBe(false);
    expect(getSpeechRecognitionCtor()).toBeNull();
  });
});
