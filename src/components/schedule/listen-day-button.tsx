'use client';

import { useEffect, useRef, useState } from 'react';
import { Volume2 } from 'lucide-react';
import { cn } from 'cn';

import type { ScheduleEventCard } from '@/lib/schedule-cards';
import { buildDaySpeechText, isSpeechSynthesisSupported } from '@/lib/voice-assistant';

// DIG-65 — «Прослушать день»: озвучка выбранного дня расписания браузерным
// синтезом речи (SpeechSynthesis, ru-RU) — доступность на мобильном и для
// слабовидящих, без внешних сервисов и ключей. Кнопка-переключатель
// (aria-pressed): повторный клик останавливает, уход со страницы отменяет
// озвучку (cleanup). При выключенной настройке voiceAssistant или в браузере
// без speechSynthesis кнопка честно не отрисовывается.
export interface ListenDayButtonProps {
  /** Заголовок дня («Среда, 11 ноября») — попадает в интро озвучки. */
  title: string;
  /** «Сегодня, …» в интро и честная формулировка пустого дня. */
  isToday: boolean;
  /** Карточки пар выбранного дня (серверные данные, сериализуемы). */
  events: readonly ScheduleEventCard[];
  /** Настройка «Озвучка и голосовой ввод» (voiceAssistant студента). */
  enabled: boolean;
  className?: string;
}

export function ListenDayButton({
  title,
  isToday,
  events,
  enabled,
  className,
}: ListenDayButtonProps) {
  const [speaking, setSpeaking] = useState(false);
  const speakingRef = useRef(false);

  // Отмена озвучки при уходе со страницы (unmount / soft-навигация).
  useEffect(() => {
    return () => {
      if (speakingRef.current && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Настройка выключена или браузер без поддержки — функции нет.
  if (!enabled || !isSpeechSynthesisSupported()) return null;

  const toggle = () => {
    const synthesis = window.speechSynthesis;
    if (speaking) {
      synthesis.cancel();
      speakingRef.current = false;
      setSpeaking(false);
      return;
    }
    try {
      const utterance = new SpeechSynthesisUtterance(
        buildDaySpeechText({ title, isToday, events }),
      );
      utterance.lang = 'ru-RU';
      utterance.onend = () => {
        speakingRef.current = false;
        setSpeaking(false);
      };
      utterance.onerror = () => {
        speakingRef.current = false;
        setSpeaking(false);
      };
      synthesis.cancel();
      synthesis.speak(utterance);
      speakingRef.current = true;
      setSpeaking(true);
    } catch {
      // Headless-браузеры без голосовых движков: тихо остаёмся в idle.
      speakingRef.current = false;
      setSpeaking(false);
    }
  };

  return (
    <button
      type="button"
      data-testid="listen-day"
      onClick={toggle}
      aria-pressed={speaking}
      aria-label={speaking ? 'Остановить озвучку' : 'Прослушать день'}
      className={cn(
        'inline-flex items-center gap-1.5 self-start rounded-button border border-border bg-card px-3 py-1.5 text-sm font-semibold text-neutral-900 shadow-soft transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-coral-600',
        speaking && 'border-accent bg-accent-soft text-accent-ink hover:bg-accent-soft',
        className,
      )}
    >
      <Volume2 className="size-4 shrink-0" aria-hidden="true" />
      {speaking ? 'Остановить' : 'Прослушать день'}
    </button>
  );
}
