'use client';

import { useState, useTransition } from 'react';
import { Toggle } from '@/components/ui/toggle';
import { saveVoiceAssistantAction } from '@/server/actions/settings';

// DIG-65 — настройка «Озвучка и голосовой ввод» (вкладка «Вид»): кнопка
// «Прослушать день» на расписании и микрофон в AI-гиде. Сохраняется server
// action'ом (скоуплен сессией) и применяется ко всему кабинету сразу
// (revalidate layout: Shell/AiGuide и страница расписания).
export function VoiceSettings({ voiceAssistant }: { voiceAssistant: boolean }) {
  const [enabled, setEnabled] = useState(voiceAssistant);
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
          <p className="text-sm font-semibold text-neutral-900">Озвучка и голосовой ввод</p>
          <p className="text-xs text-neutral-600">
            Кнопка «Прослушать день» на расписании и микрофон в AI-гиде.
          </p>
        </div>
        <Toggle
          checked={enabled}
          aria-label="Озвучка и голосовой ввод"
          data-testid="voice-assistant-toggle"
          onCheckedChange={persist}
        />
      </div>
      <p aria-live="polite" role="status" className="text-xs text-neutral-500">
        {saved
          ? 'Сохранено — голосовые функции обновлены во всём кабинете.'
          : enabled
            ? 'Включено: день расписания можно слушать, ассистенту можно диктовать.'
            : 'Выключено: кнопка озвучки и микрофон скрыты во всём кабинете.'}
      </p>
    </div>
  );
}
