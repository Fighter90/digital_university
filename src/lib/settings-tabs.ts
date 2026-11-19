// DIG-44 — вкладки экрана «Настройки». Чистый модуль (без React): страницу
// и вкладки-ссылки объединяет один реестр, неизвестные значения ?tab=
// безопасно откатываются на «Главную».
import { t, type Locale } from '@/lib/i18n';

export type SettingsTabId =
  'home' | 'notifications' | 'security' | 'appearance' | 'accessibility' | 'mcp';

export interface SettingsTabMeta {
  id: SettingsTabId;
  label: string;
}

// DIG-89 — подписи вкладок берутся из словаря (settings.tab.*): RU байт-в-байт
// равен прежним литералам, EN — из EN-словаря (вкладки локале-зависимы).
const SETTINGS_TAB_KEYS: Record<
  SettingsTabId,
  | 'settings.tab.home'
  | 'settings.tab.notifications'
  | 'settings.tab.security'
  | 'settings.tab.appearance'
  | 'settings.tab.accessibility'
  | 'settings.tab.mcp'
> = {
  home: 'settings.tab.home',
  notifications: 'settings.tab.notifications',
  security: 'settings.tab.security',
  appearance: 'settings.tab.appearance',
  accessibility: 'settings.tab.accessibility',
  mcp: 'settings.tab.mcp',
};

export const SETTINGS_TABS: SettingsTabMeta[] = [
  { id: 'home', label: t('ru', 'settings.tab.home') },
  { id: 'notifications', label: t('ru', 'settings.tab.notifications') },
  { id: 'security', label: t('ru', 'settings.tab.security') },
  { id: 'appearance', label: t('ru', 'settings.tab.appearance') },
  // DIG-86 — «Доступность»: крупный текст и без эффектов (для слабовидящих).
  { id: 'accessibility', label: t('ru', 'settings.tab.accessibility') },
  { id: 'mcp', label: t('ru', 'settings.tab.mcp') },
];

/** Подпись вкладки настроек по локали: «Главная» / «Home». */
export function settingsTabLabel(id: SettingsTabId, locale: Locale = 'ru'): string {
  return t(locale, SETTINGS_TAB_KEYS[id]);
}

/** Значение ?tab= из URL → валидный id вкладки (дефолт — «Главная»). */
export function resolveSettingsTab(raw: string | undefined | null): SettingsTabId {
  return SETTINGS_TABS.some((tab) => tab.id === raw) ? (raw as SettingsTabId) : 'home';
}
