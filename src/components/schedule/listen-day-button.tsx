'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Volume2 } from 'lucide-react';
import { cn } from 'cn';

import type { ScheduleEventCard } from '@/lib/schedule-cards';
import { buildDaySpeechText, isSpeechSynthesisSupported } from '@/lib/voice-assistant';
import { t, type Locale } from '@/lib/i18n';

// DIG-65 — «Прослушать день»: озвучка выбранного дня расписания браузерным
// синтезом речи (SpeechSynthesis, ru-RU) — доступность на мобильном и для
// слабовидящих, без внешних сервисов и ключей. Кнопка-переключатель
// (aria-pressed): повторный клик останавливает, уход со страницы отменяет
// озвучку (cleanup). При выключенной настройке voiceAssistant или в браузере
// без speechSynthesis кнопка честно не отрисовывается.
// DIG-87 — подписи и текст озвучки по локали (дефолт 'ru').
// DIG-85 (BUG-18): браузеры БЕЗ голосовых движков (headless, часть WebView)
// молча проглатывают speak() — ни onstart, ни onerror не приходят. Ставим
// сторож: если озвучка не стартовала за WATCHDOG_MS — запасное сообщение
// role="status", состояние сбрасывается; «тихое ничего» запрещено.
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
  /** DIG-87 — локаль интерфейса (cookie du-locale, дефолт ru). */
  locale?: Locale;
}

/** Сколько ждём onstart, прежде чем признать движок недоступным. */
const WATCHDOG_MS = 1200;

/** DIG-104: способность браузера статична за жизнь документа — подписка не нужна. */
const subscribeToNothing = (): (() => void) => () => {};

export function ListenDayButton({
  title,
  isToday,
  events,
  enabled,
  className,
  locale = 'ru',
}: ListenDayButtonProps) {
  const [speaking, setSpeaking] = useState(false);
  const speakingRef = useRef(false);
  /** DIG-85 (BUG-18) — запасное сообщение, когда движка нет. */
  const [fallbackMessage, setFallbackMessage] = useState<string | null>(null);
  const startedRef = useRef(false);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * DIG-104: доступность движка озвучки — внешняя «способность» браузера,
   * читается через useSyncExternalStore: серверный снапшот всегда false,
   * клиентский после гидрации — по наличию window.speechSynthesis.
   * Проверка в рендере напрямую была server/client веткой (SSR → null,
   * браузер → кнопка) и ломала гидрацию с React #418; вариант с setState
   * в эффекте триггерит каскадный рендер (react-hooks lint).
   */
  const speechReady = useSyncExternalStore(
    subscribeToNothing,
    isSpeechSynthesisSupported,
    () => false,
  );

  const clearWatchdog = (): void => {
    if (watchdogRef.current !== null) {
      clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
  };

  // Отмена озвучки при уходе со страницы (unmount / soft-навигация).
  useEffect(() => {
    return () => {
      clearWatchdog();
      if (speakingRef.current && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Настройка выключена или движка нет (узнаётся после монтирования) — функции нет.
  if (!enabled || !speechReady) return null;

  const showFallback = (): void => {
    clearWatchdog();
    try {
      window.speechSynthesis.cancel();
    } catch {
      // нет движка — cancel не нужен
    }
    speakingRef.current = false;
    setSpeaking(false);
    setFallbackMessage(t(locale, 'schedule.listen.unavailable'));
  };

  const toggle = () => {
    const synthesis = window.speechSynthesis;
    if (speaking) {
      clearWatchdog();
      synthesis.cancel();
      speakingRef.current = false;
      setSpeaking(false);
      return;
    }
    // Новая попытка — прежнее сообщение о недоступности снимаем.
    setFallbackMessage(null);
    startedRef.current = false;
    try {
      const utterance = new SpeechSynthesisUtterance(
        buildDaySpeechText({ title, isToday, events, locale }),
      );
      utterance.lang = locale === 'en' ? 'en-US' : 'ru-RU';
      utterance.onstart = () => {
        startedRef.current = true;
        clearWatchdog();
      };
      utterance.onend = () => {
        clearWatchdog();
        speakingRef.current = false;
        setSpeaking(false);
      };
      utterance.onerror = () => {
        // Ошибка до старта = движок не смог начать — честное сообщение.
        if (!startedRef.current) showFallback();
        else {
          clearWatchdog();
          speakingRef.current = false;
          setSpeaking(false);
        }
      };
      synthesis.cancel();
      synthesis.speak(utterance);
      speakingRef.current = true;
      setSpeaking(true);
      // Сторож: движок есть, но озвучка не стартовала — сообщаем честно.
      watchdogRef.current = setTimeout(showFallback, WATCHDOG_MS);
    } catch {
      // Headless-браузеры/старые сборки: исключение вместо молчания.
      showFallback();
    }
  };

  return (
    <>
      <button
        type="button"
        data-testid="listen-day"
        onClick={toggle}
        aria-pressed={speaking}
        aria-label={
          speaking ? t(locale, 'schedule.listen.stopAria') : t(locale, 'schedule.listen.play')
        }
        className={cn(
          'inline-flex items-center gap-1.5 self-start rounded-button border border-border bg-card px-3 py-1.5 text-sm font-semibold text-neutral-900 shadow-soft transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-coral-600',
          speaking && 'border-accent bg-accent-soft text-accent-ink hover:bg-accent-soft',
          className,
        )}
      >
        <Volume2 className="size-4 shrink-0" aria-hidden="true" />
        {speaking ? t(locale, 'schedule.listen.stop') : t(locale, 'schedule.listen.play')}
      </button>
      {fallbackMessage ? (
        <p
          role="status"
          data-testid="listen-day-fallback"
          className="mt-2 rounded-button border border-border bg-muted px-3 py-2 text-xs text-muted-foreground"
        >
          {fallbackMessage}
        </p>
      ) : null}
    </>
  );
}
