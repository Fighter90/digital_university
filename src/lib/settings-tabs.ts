// DIG-44 — вкладки экрана «Настройки». Чистый модуль (без React): страницу
// и вкладки-ссылки объединяет один реестр, неизвестные значения ?tab=
// безопасно откатываются на «Главную».

export type SettingsTabId = 'home' | 'notifications' | 'security' | 'appearance';

export interface SettingsTabMeta {
  id: SettingsTabId;
  label: string;
}

export const SETTINGS_TABS: SettingsTabMeta[] = [
  { id: 'home', label: 'Главная' },
  { id: 'notifications', label: 'Уведомления' },
  { id: 'security', label: 'Безопасность' },
  { id: 'appearance', label: 'Вид' },
];

/** Значение ?tab= из URL → валидный id вкладки (дефолт — «Главная»). */
export function resolveSettingsTab(raw: string | undefined | null): SettingsTabId {
  return SETTINGS_TABS.some((t) => t.id === raw) ? (raw as SettingsTabId) : 'home';
}
