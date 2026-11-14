'use client';

import { useState, useTransition } from 'react';
import { Toggle } from '@/components/ui/toggle';
import { saveQuietHoursAction } from '@/server/actions/settings';
import type { QuietHoursSettings } from '@/server/data/types';

// DIG-44 — тихие часы: окно времени, когда уведомления в кабинете не
// генерируются. Окно поддерживает переход через полночь (22:00 → 08:00).
// Сохранение — server action при каждом изменении (применяется сразу).
export function QuietHoursSettings({ initial }: { initial: QuietHoursSettings }) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
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
        setError('Проверьте окно: «от» и «до» должны быть разным временем в формате ЧЧ:ММ.');
      }
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-neutral-900">Тихие часы</p>
          <p className="text-xs text-neutral-600">
            В выбранное окно уведомления не попадают в ленту кабинета.
          </p>
        </div>
        <Toggle
          checked={enabled}
          aria-label="Тихие часы включены"
          onCheckedChange={(next) => {
            const nextValue = { ...{ enabled, from, to }, enabled: next };
            setEnabled(next);
            save(nextValue);
          }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-700">
        <label htmlFor="quiet-from" className="text-xs font-medium text-neutral-600">
          с
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
          до
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
          'Сохранено — тихие часы уже действуют.'
        ) : (
          `Окно ${from}–${to} ${enabled ? 'активно' : 'выключено'}. Изменения сохраняются сразу.`
        )}
      </p>
    </div>
  );
}
