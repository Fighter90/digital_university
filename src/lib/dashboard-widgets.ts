// DIG-44 — виджеты главной кабинета: реестр и чистые операции порядка/видимости.
//
// Реестр — единственный источник меток для настроек («Настройки → Главная»)
// и для главной (`/dashboard`): порядок виджетов и их выключенность живут в
// настройках студента (StudentSettingsRow.widgets) и применяются сразу.
// Модуль чистый (без React и серверных импортов) — используется и в клиентских
// компонентах, и в server-компонентах, и в тестах.

export type DashboardWidgetId =
  'today' | 'tasks' | 'deadlines' | 'performance' | 'requests' | 'news' | 'events';

export interface DashboardWidgetMeta {
  id: DashboardWidgetId;
  /** Метка в настройках и в предпросмотре. */
  label: string;
  /** Однострочное описание назначения виджета. */
  description: string;
}

/** Канонический порядок по умолчанию = порядок макета главной. */
export const DEFAULT_WIDGET_ORDER: DashboardWidgetId[] = [
  'today',
  'deadlines',
  'tasks',
  'performance',
  'requests',
  'news',
  'events',
];

// DIG-89 — мета виджетов из словаря: RU байт-в-байт прежние литералы
// (widgets.label.* / widgets.desc.*), EN — английский словарь.
import { t, type Locale } from '@/lib/i18n';

const WIDGET_KEYS: Record<DashboardWidgetId, `widgets.label.${DashboardWidgetId}`> = {
  today: 'widgets.label.today',
  deadlines: 'widgets.label.deadlines',
  tasks: 'widgets.label.tasks',
  performance: 'widgets.label.performance',
  requests: 'widgets.label.requests',
  news: 'widgets.label.news',
  events: 'widgets.label.events',
};

const WIDGET_DESC_KEYS: Record<DashboardWidgetId, `widgets.desc.${DashboardWidgetId}`> = {
  today: 'widgets.desc.today',
  deadlines: 'widgets.desc.deadlines',
  tasks: 'widgets.desc.tasks',
  performance: 'widgets.desc.performance',
  requests: 'widgets.desc.requests',
  news: 'widgets.desc.news',
  events: 'widgets.desc.events',
};

export const DASHBOARD_WIDGETS: DashboardWidgetMeta[] = DEFAULT_WIDGET_ORDER.map((id) => ({
  id,
  label: t('ru', WIDGET_KEYS[id]),
  description: t('ru', WIDGET_DESC_KEYS[id]),
}));

const WIDGET_BY_ID = new Map<DashboardWidgetId, DashboardWidgetMeta>(
  DASHBOARD_WIDGETS.map((w) => [w.id, w]),
);

/** Мета виджета по локали: «Сегодня» / «Today». */
export function dashboardWidgetMeta(
  id: DashboardWidgetId,
  locale: Locale = 'ru',
): DashboardWidgetMeta {
  const base = WIDGET_BY_ID.get(id)!;
  if (locale === 'ru') return base;
  return {
    id,
    label: t('en', WIDGET_KEYS[id]),
    description: t('en', WIDGET_DESC_KEYS[id]),
  };
}

export function isDashboardWidgetId(value: unknown): value is DashboardWidgetId {
  return typeof value === 'string' && WIDGET_BY_ID.has(value as DashboardWidgetId);
}

export function widgetLabel(id: DashboardWidgetId): string {
  return WIDGET_BY_ID.get(id)?.label ?? id;
}

export function widgetDescription(id: DashboardWidgetId): string {
  return WIDGET_BY_ID.get(id)?.description ?? '';
}

/** Состояние одного виджета в настройках студента. */
export interface WidgetState {
  id: DashboardWidgetId;
  enabled: boolean;
}

/**
 * Приводит сохранённый список к валидному виду: известные id — в порядке
 * пользователя, пропущенные — дописываются в конце (включённые), неизвестные
 * и дубликаты отбрасываются (первое вхождение выигрывает). `undefined`
 * (строка без DIG-44 полей) → все виджеты включены в каноническом порядке.
 */
export function normalizeWidgets(input: readonly WidgetState[] | undefined | null): WidgetState[] {
  const seen = new Set<DashboardWidgetId>();
  const ordered: WidgetState[] = [];
  if (Array.isArray(input)) {
    for (const item of input) {
      if (!item || !isDashboardWidgetId(item.id) || seen.has(item.id)) continue;
      seen.add(item.id);
      ordered.push({ id: item.id, enabled: item.enabled !== false });
    }
  }
  for (const id of DEFAULT_WIDGET_ORDER) {
    if (!seen.has(id)) ordered.push({ id, enabled: true });
  }
  return ordered;
}

/** Сдвигает виджет на одну позицию вверх/вниз; на краях — no-op. Чистая. */
export function moveWidget(
  widgets: readonly WidgetState[],
  id: DashboardWidgetId,
  direction: 'up' | 'down',
): WidgetState[] {
  const index = widgets.findIndex((w) => w.id === id);
  const target = direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= widgets.length) return [...widgets];
  const next = [...widgets];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** Включает/выключает один виджет, не трогая остальные. Чистая. */
export function setWidgetEnabled(
  widgets: readonly WidgetState[],
  id: DashboardWidgetId,
  enabled: boolean,
): WidgetState[] {
  return widgets.map((w) => (w.id === id ? { ...w, enabled } : w));
}

/** Id включённых виджетов в сохранённом порядке — порядок главной. */
export function enabledWidgetIds(widgets: readonly WidgetState[]): DashboardWidgetId[] {
  return widgets.filter((w) => w.enabled).map((w) => w.id);
}
