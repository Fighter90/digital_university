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

import { lessonKindLabel, pairWord } from '@/lib/dashboard-format';
import { pairsLabel } from '@/lib/schedule-cards';
import { t } from '@/lib/i18n';
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
  /** DIG-87 — язык озвучки (дефолт 'ru' — прежний русский текст). */
  locale?: 'ru' | 'en';
}

const ORDINAL_KEYS = [
  'speech.ordinal1',
  'speech.ordinal2',
  'speech.ordinal3',
  'speech.ordinal4',
  'speech.ordinal5',
  'speech.ordinal6',
] as const;

/** «ауд. 305» → «аудитория 305» / «Room 305» → «room 305» (синтез читает сокращение плохо). */
function spokenRoom(roomLabel: string, locale: 'ru' | 'en'): string {
  const ruPrefix = 'ауд. ';
  const enPrefix = 'Room ';
  if (roomLabel.startsWith(ruPrefix))
    return t(locale, 'speech.room', { room: roomLabel.slice(ruPrefix.length) });
  if (locale === 'en' && roomLabel.startsWith(enPrefix))
    return `${enPrefix.toLowerCase()}${roomLabel.slice(enPrefix.length)}`;
  return roomLabel;
}

/**
 * Текст озвучки выбранного дня: интро (дата/«сегодня»), счёт пар и
 * перечисление не-отменённых пар. Отменённые пары не читаются; если все
 * отменены — честное «Все пары на этот день отменены»; пустой день —
 * «Пар в этот день нет» (те же формулировки, что видит студент на экране).
 */
export function buildDaySpeechText({
  title,
  isToday,
  events,
  locale = 'ru',
}: DaySpeechInput): string {
  const intro = isToday ? t(locale, 'speech.intro.today', { title: title.toLowerCase() }) : title;
  const active = events.filter((event) => !event.isCancelled);

  if (active.length === 0) {
    return events.length > 0
      ? `${intro}. ${t(locale, 'speech.allCancelled')}`
      : `${intro}. ${t(locale, 'speech.empty')}`;
  }

  const items = active.map((event, index) => {
    const ordinal = t(locale, ORDINAL_KEYS[index] ?? 'speech.ordinal6');
    const prefix = ORDINAL_KEYS[index]
      ? `${ordinal} ${pairWord(1, locale)}`
      : t(locale, 'speech.pairN', { n: index + 1 });
    const kind =
      lessonKindLabel(event.kind, locale).toLowerCase() || t(locale, 'speech.kindFallback');
    const item = t(locale, 'speech.item', {
      prefix,
      discipline: event.discipline,
      kind,
      start: event.startLabel,
      end: event.endLabel,
      room: spokenRoom(event.roomLabel, locale),
      teacher: event.teacher,
    });
    return event.isMoved ? `${item}. ${t(locale, 'speech.moved')}` : item;
  });

  return `${intro}. ${pairsLabel(active.length, locale)}. ${items.join('. ')}.`;
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
