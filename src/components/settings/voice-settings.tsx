'use client';

import { t, type Locale } from '@/lib/i18n';

import { useState, useTransition } from 'react';
import { Toggle } from '@/components/ui/toggle';
import { saveVoiceAssistantAction } from '@/server/actions/settings';

// DIG-65 — настройка «Озвучка и голосовой ввод» (вкладка «Вид»): кнопка
// «Прослушать день» на расписании и микрофон в AI-гиде. Сохраняется server
// action'ом (скоуплен сессией) и применяется ко всему кабинету сразу
// (revalidate layout: Shell/AiGuide и страница расписания).
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
  const [enabled, setEnabled] = useState(voiceAssistant ?? enabledProp ?? false);
  const [saved, setSaved] = useState(false);
  const [, startTransition] = useTransition();

  const persist = (next: boolean) => {
    setSaved(false);
    setEnabled(next);
    startTransition(async () => {
      if (await saveVoiceAssistantAction(next)) setSaved(true);
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
          checked={enabled}
          aria-label={t(locale, 'settings.voice.aria')}
          data-testid="voice-assistant-toggle"
          onCheckedChange={persist}
        />
      </div>
      <p aria-live="polite" role="status" className="text-xs text-neutral-500">
        {saved
          ? t(locale, 'settings.voice.saved')
          : enabled
            ? t(locale, 'settings.voice.on')
            : t(locale, 'settings.voice.off')}
      </p>
    </div>
  );
}
