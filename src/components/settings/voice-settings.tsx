'use client';

import { t, type Locale } from '@/lib/i18n';

import { useState, useTransition } from 'react';
import { Toggle } from '@/components/ui/toggle';
import { saveVoiceAssistantAction } from '@/server/actions/settings';

// DIG-65 — настройка «Озвучка и голосовой ввод» (вкладка «Вид»): кнопка
// «Прослушать день» на расписании и микрофон в AI-гиде. Сохраняется server
// action'ом (скоуплен сессией) и применяется ко всему кабинету сразу
// (revalidate layout: Shell/AiGuide и страница расписания).
//
// DIG-78 — без оптимистичного переключения: aria-checked отражает значение,
// ПОДТВЕРЖДЁННОЕ записью в StudentSettings. Раньше локальное состояние
// менялось сразу по клику, а action уходил в transition параллельно — e2e
// перезагружает страницу сразу после включения, навигация обрывала in-flight
// POST, значение не записывалось и после перезагрузки читалось старое.
type VoiceStatus = 'idle' | 'pending' | 'saved' | 'error';

export function VoiceSettings({
  voiceAssistant,
  enabled: enabledProp,
  locale = 'ru',
}: {
  /** Текущее состояние озвучки (страница настроек). */
  voiceAssistant?: boolean;
  /** Имя пропа из приёмочного теста DIG-89 (то же значение). */
  enabled?: boolean;
  /** DIG-89 — локаль интерфейса (cookie du-locale, дефолт ru). */
  locale?: Locale;
}) {
  // «Сохранённое» состояние: меняется только после успешного action'а.
  const [saved, setSaved] = useState(voiceAssistant ?? enabledProp ?? false);
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [pending, startTransition] = useTransition();

  const persist = (next: boolean) => {
    if (pending) return; // одна запись за раз — параллельные клики игнорируем
    setStatus('pending');
    startTransition(async () => {
      const ok = await saveVoiceAssistantAction(next);
      if (ok) {
        setSaved(next);
        setStatus('saved');
      } else {
        setStatus('error'); // откат: saved не меняется — показываем ошибку
      }
    });
  };

  return (
    <div className="flex flex-col gap-4" data-testid="voice-assistant-settings">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-neutral-900">{t(locale, 'settings.voice.card')}</p>
          <p className="text-xs text-neutral-600">
            {t(locale, 'settings.voice.desc2')}
          </p>
        </div>
        <Toggle
          checked={saved}
          aria-label={t(locale, 'settings.voice.aria')}
          data-testid="voice-assistant-toggle"
          onCheckedChange={persist}
        />
      </div>
      <p aria-live="polite" role="status" className="text-xs text-neutral-500">
        {status === 'pending'
          ? t(locale, 'settings.voice.saving')
          : status === 'error'
            ? t(locale, 'settings.voice.error')
            : status === 'saved'
              ? t(locale, 'settings.voice.saved')
              : saved
                ? t(locale, 'settings.voice.on')
                : t(locale, 'settings.voice.off')}
      </p>
    </div>
  );
}
