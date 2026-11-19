'use client';

import { t, type Locale } from '@/lib/i18n';

import { useState, useTransition } from 'react';
import { Toggle } from '@/components/ui/toggle';
import { saveQuietHoursAction } from '@/server/actions/settings';
import type { QuietHoursSettings } from '@/server/data/types';

// DIG-44 — тихие часы: окно времени, когда уведомления в кабинете не
// генерируются. Окно поддерживает переход через полночь (22:00 → 08:00).
// Сохранение — server action при каждом изменении (применяется сразу).
export function QuietHoursSettings({
  quietHours,
  initial,
  locale = 'ru',
}: {
  /** Текущее окно тихих часов. */
  quietHours?: QuietHoursSettings;
  /** Прежнее имя пропа (страница настроек) — оставлено для совместимости. */
  initial?: QuietHoursSettings;
  /** DIG-89 — локаль интерфейса (cookie du-locale, дефолт ru). */
  locale?: Locale;
}) {
  const prefs = quietHours ?? initial;
  const [enabled, setEnabled] = useState(prefs?.enabled ?? false);
  const [from, setFrom] = useState(prefs?.from ?? '22:00');
  const [to, setTo] = useState(prefs?.to ?? '08:00');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const save = (next: QuietHoursSettings) => {
    setSaved(false);
    setError(null);
    startTransition(async () => {
      const ok = await saveQuietHoursAction(next);
      if (ok) setSaved(true);
      else {
        setError(t(locale, 'settings.quiet.error'));
      }
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-neutral-900">{t(locale, 'settings.quiet.title')}</p>
          <p className="text-xs text-neutral-600">
            {t(locale, 'settings.quiet.desc')}
          </p>
        </div>
        <Toggle
          checked={enabled}
          aria-label={t(locale, 'settings.quiet.enabledAria')}
          onCheckedChange={(next) => {
            const nextValue = { ...{ enabled, from, to }, enabled: next };
            setEnabled(next);
            save(nextValue);
          }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-700">
        <label htmlFor="quiet-from" className="text-xs font-medium text-neutral-600">
          {t(locale, 'settings.quiet.from')}
        </label>
        <input
          id="quiet-from"
          type="time"
          value={from}
          onChange={(event) => {
            const next = event.target.value;
            setFrom(next);
            save({ enabled, from: next, to });
          }}
          className="rounded-button border border-border bg-card px-2.5 py-1.5 font-mono text-sm"
        />
        <label htmlFor="quiet-to" className="text-xs font-medium text-neutral-600">
          {t(locale, 'settings.quiet.to')}
        </label>
        <input
          id="quiet-to"
          type="time"
          value={to}
          onChange={(event) => {
            const next = event.target.value;
            setTo(next);
            save({ enabled, from, to: next });
          }}
          className="rounded-button border border-border bg-card px-2.5 py-1.5 font-mono text-sm"
        />
      </div>

      <p aria-live="polite" role="status" className="text-xs text-neutral-500">
        {error ? (
          <span className="text-error-ink">{error}</span>
        ) : saved && !isPending ? (
          t(locale, 'settings.quiet.saved')
        ) : (
          t(locale, 'settings.quiet.idle', {
            from,
            to,
            state: enabled ? t(locale, 'settings.quiet.stateOn') : t(locale, 'settings.quiet.stateOff'),
          })
        )}
      </p>
    </div>
  );
}
