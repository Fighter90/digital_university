// DIG-65 — voice-assistant: голосовые функции кабинета средствами браузера
// (Web Speech API), без внешних ключей и серверных вызовов.
//
//  - buildDaySpeechText: детерминированный русский текст выбранного дня
//    расписания для SpeechSynthesis (дата, счёт пар, каждая не-отменённая
//    пара: дисциплина, тип, время, аудитория «аудитория N»/«онлайн»,
//    преподаватель; перенос помечается «пара перенесена»);
//  - isSpeechSynthesisSupported / getSpeechRecognitionCtor: SSR-safe
//    детекторы (в Node и в старых браузерах — false/null, без исключений).
//
// SpeechRecognition отсутствует в стандартных DOM-типах TypeScript —
// ниже минимальные локальные интерфейсы (только то, что использует
// VoiceInputButton: start/stop, onresult/onend/onerror, ru-RU).

import { LESSON_KIND_LABELS } from '@/lib/dashboard-format';
import { pairsLabel } from '@/lib/schedule-cards';
import type { ScheduleKind } from '@/server/data/types';

/** Минимальный набор полей карточки пары, достаточный для текста озвучки. */
export interface SpeechEventInput {
  discipline: string;
  kind: ScheduleKind;
  startLabel: string;
  endLabel: string;
  roomLabel: string;
  teacher: string;
  isMoved: boolean;
  isCancelled: boolean;
}

export interface DaySpeechInput {
  /** «Среда, 11 ноября» — заголовок дня (formatDayTitle). */
  title: string;
  /** «Сегодня, среда, 11 ноября» — интро для текущего дня. */
  isToday: boolean;
  events: readonly SpeechEventInput[];
}

const ORDINALS = ['Первая', 'Вторая', 'Третья', 'Четвёртая', 'Пятая', 'Шестая'] as const;

/** «ауд. 305» → «аудитория 305» (синтез читает сокращение плохо); «онлайн» — как есть. */
function spokenRoom(roomLabel: string): string {
  return roomLabel.startsWith('ауд. ') ? `аудитория ${roomLabel.slice('ауд. '.length)}` : roomLabel;
}

/**
 * Текст озвучки выбранного дня: интро (дата/«сегодня»), счёт пар и
 * перечисление не-отменённых пар. Отменённые пары не читаются; если все
 * отменены — честное «Все пары на этот день отменены»; пустой день —
 * «Пар в этот день нет» (те же формулировки, что видит студент на экране).
 */
export function buildDaySpeechText({ title, isToday, events }: DaySpeechInput): string {
  const intro = isToday ? `Сегодня, ${title.toLowerCase()}` : title;
  const active = events.filter((event) => !event.isCancelled);

  if (active.length === 0) {
    return events.length > 0
      ? `${intro}. Все пары на этот день отменены.`
      : `${intro}. Пар в этот день нет.`;
  }

  const items = active.map((event, index) => {
    const prefix = ORDINALS[index] ? `${ORDINALS[index]} пара` : `Пара ${index + 1}`;
    const kind = LESSON_KIND_LABELS[event.kind]?.toLowerCase() ?? 'занятие';
    const item =
      `${prefix} — ${event.discipline}, ${kind}, ` +
      `с ${event.startLabel} до ${event.endLabel}, ${spokenRoom(event.roomLabel)}, ` +
      `преподаватель ${event.teacher}`;
    return event.isMoved ? `${item}. Пара перенесена` : item;
  });

  return `${intro}. ${pairsLabel(active.length)}. ${items.join('. ')}.`;
}

/** Браузерный синтез речи (озвучка дня). false — на сервере и в старых браузерах. */
export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

// ── SpeechRecognition: минимальные локальные типы (нет в lib.dom) ────────────

export interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

export interface SpeechRecognitionResultLike {
  readonly 0: SpeechRecognitionAlternativeLike;
}

export interface SpeechRecognitionResultListLike {
  length: number;
  readonly [index: number]: SpeechRecognitionResultLike;
}

export interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
}

export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: unknown) => void) | null;
}

export type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

/**
 * Конструктор распознавания речи (Chrome: SpeechRecognition / webkitSpeech-
 * Recognition). null — на сервере и в браузерах без поддержки: кнопка-
 * микрофон в этом случае честно не отрисовывается.
 */
export function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}
