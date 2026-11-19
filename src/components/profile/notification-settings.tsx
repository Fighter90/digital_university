'use client';

import { useState, useTransition } from 'react';
import { Badge } from '@/components/ui/badge';
import { Toggle } from '@/components/ui/toggle';
import {
  NOTIFICATION_SETTING_TYPES,
  notificationChannelLabel,
  notificationTypeLabel,
} from '@/lib/notification-labels';
import { t, type Locale } from '@/lib/i18n';
import { saveNotificationChannelAction } from '@/server/actions/profile';
import type {
  NotificationChannel,
  NotificationType,
  StudentSettingsRow,
} from '@/server/data/types';

// DIG-19 (обновлено DIG-44): матрица «тип уведомления × канал»
// («в кабинете» / email / Telegram). Telegram — «скоро»: переключатели
// выключены на сервере и в интерфейсе. Изменение сохраняется сразу
// (server action) и влияет на генерацию уведомлений: тип с выключенным
// каналом «в кабинете» не попадает в ленту.
export function NotificationSettings({
  settings,
  channels,
  locale = 'ru',
}: {
  /** Строка настроек студента (основной сценарий экрана /settings). */
  settings?: StudentSettingsRow;
  /** Каналы напрямую, без полной строки настроек (EN-рендер поверхностей). */
  channels?: StudentSettingsRow['notificationChannels'];
  /** DIG-89 — локаль интерфейса (cookie du-locale, дефолт ru). */
  locale?: Locale;
}) {
  type Channels = Record<NotificationType, Record<NotificationChannel, boolean>>;
  const [current, setCurrent] = useState<Channels>(
    (channels ?? settings?.notificationChannels ?? {}) as Channels,
  );
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const toggle = (type: NotificationType, channel: NotificationChannel, next: boolean) => {
    setSaved(false);
    setCurrent((prev) => ({
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
    <div role="table" aria-label={t(locale, 'profile.notif.aria')} className="flex flex-col gap-2">
      <div
        role="row"
        className="grid grid-cols-[minmax(0,1fr)_repeat(3,auto)] items-center gap-x-2 pb-1"
      >
        <span role="columnheader" className="sr-only">
          {t(locale, 'profile.notif.typeColumn')}
        </span>
        {(['PUSH', 'EMAIL', 'TELEGRAM'] as NotificationChannel[]).map((channel) => (
          <span
            key={channel}
            role="columnheader"
            className="flex items-center justify-center gap-1 text-xs font-medium text-neutral-500"
          >
            {notificationChannelLabel(channel, locale)}
            {channel === 'TELEGRAM' && <Badge status="neutral">{t(locale, 'profile.notif.soon')}</Badge>}
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
            {notificationTypeLabel(type, locale)}
          </span>
          {(['PUSH', 'EMAIL', 'TELEGRAM'] as NotificationChannel[]).map((channel) => {
            const disabled = channel === 'TELEGRAM';
            return (
              <span key={channel} role="cell" className="flex justify-center">
                <Toggle
                  checked={current[type]?.[channel] ?? false}
                  disabled={disabled || isPending}
                  onCheckedChange={(next) => toggle(type, channel, next)}
                  aria-label={`${notificationTypeLabel(type, locale)} — ${notificationChannelLabel(channel, locale)}`}
                />
              </span>
            );
          })}
        </div>
      ))}
      <p aria-live="polite" role="status" className="text-xs text-neutral-500">
        {saved && !isPending
          ? t(locale, 'profile.notif.saved')
          : t(locale, 'profile.notif.idle')}
      </p>
    </div>
  );
}
