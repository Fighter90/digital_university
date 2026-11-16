'use client';

import { useRef, useState, useTransition } from 'react';
import { ChevronDown, ChevronUp, GripVertical } from 'lucide-react';
import { cn } from 'cn';
import { Toggle } from '@/components/ui/toggle';
import { saveWidgetsAction } from '@/server/actions/settings';
import {
  DASHBOARD_WIDGETS,
  moveWidget,
  setWidgetEnabled,
  widgetDescription,
  widgetLabel,
  type DashboardWidgetId,
  type WidgetState,
} from '@/lib/dashboard-widgets';

// DIG-44 — вкладка «Главная»: порядок и видимость виджетов главной.
//
// Порядок меняется ДВУМЯ путями (критерий приёмки): перетаскиванием (drag &
// drop, мышь) и с клавиатуры — кнопками «вверх/вниз» у каждого виджета.
// Каждое изменение сразу сохраняется server action'ом (сохранение
// сериализовано: на сервер всегда улетает ПОСЛЕДНЕЕ состояние, быстрые
// нажатия не перезаписывают друг друга устаревшим порядком).
export function WidgetsSettings({ initial }: { initial: WidgetState[] }) {
  const [widgets, setWidgets] = useState<WidgetState[]>(initial);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Очередь на сохранение: refs переживают ре-рендеры и не дают быстрым
  // мутациям устраивать гонку «устаревший порядок перезаписал свежий».
  const pendingRef = useRef(false);
  const latestRef = useRef<WidgetState[] | null>(null);
  const dragIdRef = useRef<DashboardWidgetId | null>(null);

  const flush = () => {
    const payload = latestRef.current;
    if (!payload || pendingRef.current) return;
    pendingRef.current = true;
    latestRef.current = null;
    startTransition(async () => {
      const ok = await saveWidgetsAction({
        order: payload.map((w) => w.id),
        disabled: payload.filter((w) => !w.enabled).map((w) => w.id),
      });
      pendingRef.current = false;
      if (ok) setSaved(true);
      if (latestRef.current) flush();
    });
  };

  const persist = (next: WidgetState[]) => {
    setWidgets(next);
    setSaved(false);
    latestRef.current = next;
    flush();
  };

  const move = (id: DashboardWidgetId, direction: 'up' | 'down') => {
    persist(moveWidget(widgets, id, direction));
  };

  const onDropOn = (targetId: DashboardWidgetId) => {
    const sourceId = dragIdRef.current;
    dragIdRef.current = null;
    if (!sourceId || sourceId === targetId) return;
    const next = [...widgets];
    const from = next.findIndex((w) => w.id === sourceId);
    const to = next.findIndex((w) => w.id === targetId);
    if (from < 0 || to < 0) return;
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    persist(next);
  };

  const enabledWidgets = widgets.filter((w) => w.enabled);

  return (
    <div className="flex flex-col gap-5">
      {/* Список виджетов: drag & drop + клавиатурные кнопки + переключатели */}
      <ul className="flex flex-col gap-2" aria-label="Виджеты главной">
        {widgets.map((widget, index) => (
          <li
            key={widget.id}
            draggable
            onDragStart={() => {
              dragIdRef.current = widget.id;
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => onDropOn(widget.id)}
            data-widget-id={widget.id}
            data-enabled={widget.enabled ? 'true' : 'false'}
            className={cn(
              'flex items-center gap-3 rounded-card border border-border bg-card px-3 py-2.5 shadow-soft',
              !widget.enabled && 'opacity-60',
            )}
          >
            <span
              aria-hidden="true"
              title="Перетащите, чтобы изменить порядок"
              className="cursor-grab text-neutral-400"
            >
              <GripVertical className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-neutral-900">
                {widgetLabel(widget.id)}
              </p>
              <p className="truncate text-xs text-neutral-600">{widgetDescription(widget.id)}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => move(widget.id, 'up')}
                disabled={index === 0}
                aria-label={`Поднять виджет «${widgetLabel(widget.id)}»`}
                className="flex size-8 items-center justify-center rounded-pill border border-border text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronUp className="size-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => move(widget.id, 'down')}
                disabled={index === widgets.length - 1}
                aria-label={`Опустить виджет «${widgetLabel(widget.id)}»`}
                className="flex size-8 items-center justify-center rounded-pill border border-border text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronDown className="size-4" aria-hidden="true" />
              </button>
              <Toggle
                checked={widget.enabled}
                onCheckedChange={(next) => persist(setWidgetEnabled(widgets, widget.id, next))}
                aria-label={`Показывать виджет «${widgetLabel(widget.id)}»`}
              />
            </div>
          </li>
        ))}
      </ul>

      {/* Предпросмотр главной: включённые виджеты в итоговом порядке */}
      <div className="rounded-card border border-border bg-muted p-4">
        <p className="text-sm font-semibold text-neutral-900">Предпросмотр главной</p>
        <p className="mt-0.5 text-xs text-neutral-600">
          Так виджеты встанут на главной: {enabledWidgets.length} из {DASHBOARD_WIDGETS.length}.
        </p>
        <ol
          data-testid="widgets-preview"
          aria-label="Предпросмотр главной"
          className="mt-3 flex flex-col gap-1.5"
        >
          {enabledWidgets.map((widget, index) => (
            <li
              key={widget.id}
              className="flex items-center gap-2 rounded-card-sm border border-border bg-card px-3 py-1.5 text-sm text-neutral-800 shadow-soft"
            >
              <span className="flex size-5 shrink-0 items-center justify-center rounded-pill bg-accent-soft text-xs font-bold text-accent-ink">
                {index + 1}
              </span>
              {widgetLabel(widget.id)}
            </li>
          ))}
        </ol>
      </div>

      <p aria-live="polite" role="status" className="text-xs text-neutral-500">
        {saved && !isPending
          ? 'Сохранено — главная уже показывает новый порядок.'
          : isPending
            ? 'Сохраняем…'
            : 'Перетащите виджет или нажмите «вверх/вниз». Изменения сохраняются сразу.'}
      </p>
    </div>
  );
}
