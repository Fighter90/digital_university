// DIG-44 — pure helpers of the «Настройки → Главная» tab: the dashboard
// widget registry (order/visibility) and the quiet-hours window math.
// These are the keyboard-first reorder primitives the screen and the
// dashboard both rely on.
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WIDGET_ORDER,
  DASHBOARD_WIDGETS,
  enabledWidgetIds,
  moveWidget,
  normalizeWidgets,
  setWidgetEnabled,
  widgetLabel,
  type WidgetState,
} from '@/lib/dashboard-widgets';
import { isWithinQuietHours, isValidTime } from '@/lib/quiet-hours';

describe('widget registry', () => {
  it('lists exactly the six widgets of DIG-44, labels unique', () => {
    expect(DEFAULT_WIDGET_ORDER).toEqual([
      'today',
      'deadlines',
      'performance',
      'requests',
      'news',
      'events',
    ]);
    expect(DASHBOARD_WIDGETS).toHaveLength(6);
    const labels = DASHBOARD_WIDGETS.map((w) => w.label);
    expect(new Set(labels).size).toBe(6);
    for (const label of [
      'Сегодня',
      'Дедлайны',
      'Успеваемость',
      'Заявки',
      'Новости',
      'Мероприятия',
    ]) {
      expect(labels).toContain(label);
    }
  });
});

describe('normalizeWidgets — legacy/partial input becomes a full ordered list', () => {
  it('undefined → all six enabled in the default order', () => {
    expect(normalizeWidgets(undefined)).toEqual(
      DEFAULT_WIDGET_ORDER.map((id) => ({ id, enabled: true })),
    );
  });

  it('keeps a custom order, appends missing ids, drops unknown ids', () => {
    const input: WidgetState[] = [
      { id: 'news', enabled: false },
      { id: 'today', enabled: true },
      { id: 'hax', enabled: true } as unknown as WidgetState, // unknown id — dropped
    ];
    const result = normalizeWidgets(input);
    expect(result.map((w) => w.id)).toEqual([
      'news',
      'today',
      'deadlines',
      'performance',
      'requests',
      'events',
    ]);
    expect(result.find((w) => w.id === 'news')?.enabled).toBe(false);
    // missing ids default to enabled
    expect(result.find((w) => w.id === 'deadlines')?.enabled).toBe(true);
  });

  it('deduplicates a duplicated id (first occurrence wins)', () => {
    const result = normalizeWidgets([
      { id: 'today', enabled: false },
      { id: 'today', enabled: true },
    ]);
    expect(result.filter((w) => w.id === 'today')).toHaveLength(1);
    expect(result.find((w) => w.id === 'today')?.enabled).toBe(false);
  });
});

describe('moveWidget — keyboard reorder (up/down)', () => {
  const list = normalizeWidgets(undefined);

  it('moves a widget up by one position', () => {
    const next = moveWidget(list, 'deadlines', 'up');
    expect(next.map((w) => w.id).slice(0, 2)).toEqual(['deadlines', 'today']);
  });

  it('moves a widget down by one position', () => {
    const next = moveWidget(list, 'today', 'down');
    expect(next.map((w) => w.id).slice(0, 2)).toEqual(['deadlines', 'today']);
  });

  it('is a no-op at the edges and never mutates the input', () => {
    const up = moveWidget(list, 'today', 'up');
    const down = moveWidget(list, 'events', 'down');
    expect(up.map((w) => w.id)).toEqual(DEFAULT_WIDGET_ORDER);
    expect(down.map((w) => w.id)).toEqual(DEFAULT_WIDGET_ORDER);
    expect(list.map((w) => w.id)).toEqual(DEFAULT_WIDGET_ORDER);
  });
});

describe('setWidgetEnabled / enabledWidgetIds', () => {
  it('toggles a single widget without touching others', () => {
    const list = normalizeWidgets([{ id: 'news', enabled: false }]);
    const next = setWidgetEnabled(list, 'news', true);
    expect(next.find((w) => w.id === 'news')?.enabled).toBe(true);
    expect(next.filter((w) => w.enabled)).toHaveLength(6);
  });

  it('enabledWidgetIds respects the saved order', () => {
    const list = normalizeWidgets([
      { id: 'news', enabled: true },
      { id: 'deadlines', enabled: true },
      { id: 'today', enabled: false },
    ]);
    expect(enabledWidgetIds(list)).toEqual([
      'news',
      'deadlines',
      'performance',
      'requests',
      'events',
    ]);
  });
});

describe('widgetLabel', () => {
  it('maps ids to RU labels', () => {
    expect(widgetLabel('today')).toBe('Сегодня');
    expect(widgetLabel('performance')).toBe('Успеваемость');
  });
});

describe('isWithinQuietHours — midnight-crossing window', () => {
  it('suppresses inside the 22:00–08:00 window (evening side)', () => {
    const quiet = { enabled: true, from: '22:00', to: '08:00' };
    expect(isWithinQuietHours(quiet, new Date(2026, 10, 11, 23, 30))).toBe(true);
    expect(isWithinQuietHours(quiet, new Date(2026, 10, 11, 22, 0))).toBe(true);
  });

  it('suppresses inside the window (morning side, past midnight)', () => {
    const quiet = { enabled: true, from: '22:00', to: '08:00' };
    expect(isWithinQuietHours(quiet, new Date(2026, 10, 11, 6, 0))).toBe(true);
    expect(isWithinQuietHours(quiet, new Date(2026, 10, 11, 7, 59))).toBe(true);
  });

  it('allows outside the window', () => {
    const quiet = { enabled: true, from: '22:00', to: '08:00' };
    expect(isWithinQuietHours(quiet, new Date(2026, 10, 11, 12, 0))).toBe(false);
    expect(isWithinQuietHours(quiet, new Date(2026, 10, 11, 8, 0))).toBe(false);
  });

  it('supports a same-day window', () => {
    const quiet = { enabled: true, from: '13:00', to: '15:00' };
    expect(isWithinQuietHours(quiet, new Date(2026, 10, 11, 14, 0))).toBe(true);
    expect(isWithinQuietHours(quiet, new Date(2026, 10, 11, 16, 0))).toBe(false);
  });

  it('disabled or degenerate (from === to) windows never suppress', () => {
    expect(
      isWithinQuietHours(
        { enabled: false, from: '22:00', to: '08:00' },
        new Date(2026, 10, 11, 23, 0),
      ),
    ).toBe(false);
    expect(
      isWithinQuietHours(
        { enabled: true, from: '01:00', to: '01:00' },
        new Date(2026, 10, 11, 1, 0),
      ),
    ).toBe(false);
  });
});

describe('isValidTime', () => {
  it('accepts HH:MM 00:00–23:59 and rejects the rest', () => {
    expect(isValidTime('00:00')).toBe(true);
    expect(isValidTime('23:59')).toBe(true);
    expect(isValidTime('24:00')).toBe(false);
    expect(isValidTime('12:60')).toBe(false);
    expect(isValidTime('12')).toBe(false);
    expect(isValidTime('ab:cd')).toBe(false);
    expect(isValidTime('')).toBe(false);
  });
});
