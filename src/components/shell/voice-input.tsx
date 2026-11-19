'use client';

import { useRef, useState } from 'react';
import { Mic } from 'lucide-react';
import { cn } from 'cn';

import { getSpeechRecognitionCtor, type SpeechRecognitionLike } from '@/lib/voice-assistant';
import { t, type Locale } from '@/lib/i18n';

// DIG-65 — голосовой ввод в AI-гиде: кнопка-микрофон рядом со свободным
// вводом. Распознавание выполняет браузер (Web Speech API) — демо без
// внешних ключей; расшифровка дописывается в поле вопроса и никуда
// не отправляется из нашего кода. В браузере без SpeechRecognition кнопка
// честно не отрисовывается (мёртвой кнопки нет).
// DIG-93 — подписи и язык распознавания по локали интерфейса.
export function VoiceInputButton({
  onResult,
  className,
  locale = 'ru',
}: {
  /** Финальная расшифровка сказанного (trimmed). */
  onResult: (text: string) => void;
  className?: string;
  /** Локаль интерфейса — подписи кнопки и язык распознавания. */
  locale?: Locale;
}) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  if (!getSpeechRecognitionCtor()) return null;

  const stopLabel = t(locale, 'aiguide.voice.stop');
  const startLabel = t(locale, 'aiguide.voice.start');

  const stopListening = () => {
    recognitionRef.current = null;
    setListening(false);
  };

  const startListening = () => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor || recognitionRef.current) return;
    try {
      const recognition = new Ctor();
      recognition.lang = locale === 'en' ? 'en-US' : 'ru-RU';
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.onresult = (event) => {
        const result = event.results[event.resultIndex] ?? event.results[0];
        const transcript = result?.[0]?.transcript?.trim();
        if (transcript) onResult(transcript);
      };
      recognition.onend = stopListening;
      recognition.onerror = stopListening;
      recognitionRef.current = recognition;
      recognition.start();
      setListening(true);
    } catch {
      // start() бросает при запрете микрофона и подобных состояниях — тихо остаёмся в idle.
      stopListening();
    }
  };

  const toggle = () => {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    startListening();
  };

  return (
    <button
      type="button"
      data-testid="voice-input"
      onClick={toggle}
      aria-pressed={listening}
      aria-label={listening ? stopLabel : startLabel}
      title={listening ? stopLabel : startLabel}
      className={cn(
        'grid size-9 shrink-0 place-items-center rounded-lg border border-border text-neutral-700 transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-coral-600',
        listening && 'border-coral-500 bg-coral-50 text-coral-600 animate-pulse',
        className,
      )}
    >
      <Mic className="size-4" aria-hidden="true" />
    </button>
  );
}
