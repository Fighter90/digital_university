'use client';

import { useState, useTransition } from 'react';
import { Badge } from '@/components/ui/badge';
import { Toggle } from '@/components/ui/toggle';
import {
  NOTIFICATION_CHANNEL_LABELS,
  NOTIFICATION_SETTING_TYPES,
  NOTIFICATION_TYPE_LABELS,
} from '@/lib/notification-labels';
import { saveNotificationChannelAction } from '@/server/actions/profile';
import type { NotificationChannel, NotificationType, StudentSettingsRow } from '@/server/data/types';

// DIG-19: матрица «тип уведомления × канал» (push / email / Telegram).
// Telegram — «скоро»: переключатели выключены на сервере и в интерфейсе.
// Изменение сохраняется сразу (server action) и влияет на генерацию
// уведомлений: тип с выключенным push не попадает в ленту.
export function NotificationSettings({ settings }: { settings: StudentSettingsRow }) {
  const [channels, setChannels] = useState(settings.notificationChannels);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const toggle = (type: NotificationType, channel: NotificationChannel, next: boolean) => {
    setSaved(false);
    setChannels((prev) => ({
      ...prev,
      [type]: { ...prev[type], [channel]: next },
    }));
    // Async transition: isPending держится, пока server action не сохранит
    // значение на сервере — оптимистичное состояние не «отваливается».
    startTransition(async () => {
      const ok = await saveNotificationChannelAction({ type, channel, enabled: next });
      if (ok) setSaved(true);
    });
  };

  return (
    <div
      role="table"
      aria-label="Каналы уведомлений"
      className="flex flex-col gap-2"
    >
      <div role="row" className="grid grid-cols-[minmax(0,1fr)_repeat(3,auto)] items-center gap-x-2 pb-1">
        <span role="columnheader" className="sr-only">
          Тип уведомлений
        </span>
        {(['PUSH', 'EMAIL', 'TELEGRAM'] as NotificationChannel[]).map((channel) => (
          <span
            key={channel}
            role="columnheader"
            className="flex items-center justify-center gap-1 text-xs font-medium text-neutral-500"
          >
            {NOTIFICATION_CHANNEL_LABELS[channel]}
            {channel === 'TELEGRAM' && <Badge status="neutral">скоро</Badge>}
          </span>
        ))}
      </div>

      {NOTIFICATION_SETTING_TYPES.map((type) => (
        <div
          key={type}
          role="row"
          className="grid grid-cols-[minmax(0,1fr)_repeat(3,auto)] items-center gap-x-2 rounded-card-sm border border-border px-3 py-2"
        >
          <span role="cell" className="min-w-0 truncate text-sm font-medium text-neutral-900">
            {NOTIFICATION_TYPE_LABELS[type]}
          </span>
          {(['PUSH', 'EMAIL', 'TELEGRAM'] as NotificationChannel[]).map((channel) => {
            const disabled = channel === 'TELEGRAM';
            return (
              <span key={channel} role="cell" className="flex justify-center">
                <Toggle
                  checked={channels[type]?.[channel] ?? false}
                  disabled={disabled || isPending}
                  onCheckedChange={(next) => toggle(type, channel, next)}
                  aria-label={`${NOTIFICATION_TYPE_LABELS[type]} — ${NOTIFICATION_CHANNEL_LABELS[channel]}`}
                />
              </span>
            );
          })}
        </div>
      ))}
      <p aria-live="polite" role="status" className="text-xs text-neutral-500">
        {saved && !isPending
          ? 'Сохранено — настройка уже влияет на генерацию уведомлений.'
          : 'Push — лента уведомлений в кабинете. Изменения сохраняются сразу.'}
      </p>
    </div>
  );
}
