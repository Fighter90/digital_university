// DIG-42 — вкладки экрана «Дополнительное образование». Чистый модуль
// (без React): страницу и вкладки-ссылки объединяет один реестр, неизвестные
// значения ?tab= безопасно откатываются на «Каталог» (паттерн settings-tabs).
//
// DIG-89 — подписи вкладок словарные (RU — канон, EN — перевод): кириллических
// литералов в исходнике нет.
import { t, type Locale, type TranslationKey } from '@/lib/i18n';

export type DpoTabId = 'catalog' | 'my' | 'docs';

export interface DpoTabMeta {
  id: DpoTabId;
  /** Ключ словаря подписи вкладки («dpo.tab.catalog» …). */
  labelKey: TranslationKey;
}

export const DPO_TABS: DpoTabMeta[] = [
  { id: 'catalog', labelKey: 'dpo.tab.catalog' },
  { id: 'my', labelKey: 'dpo.tab.my' },
  { id: 'docs', labelKey: 'dpo.tab.docs' },
];

/** Подпись вкладки ДПО по локали: «Каталог программ» / «Program catalog». */
export function dpoTabLabel(id: DpoTabId, locale: Locale = 'ru'): string {
  const meta = DPO_TABS.find((tab) => tab.id === id) ?? DPO_TABS[0]!;
  return t(locale, meta.labelKey);
}

/** Значение ?tab= из URL → валидный id вкладки (дефолт — «Каталог»). */
export function resolveDpoTab(raw: string | undefined | null): DpoTabId {
  return DPO_TABS.some((tab) => tab.id === raw) ? (raw as DpoTabId) : 'catalog';
}

/**
 * href вкладки с сохранением фильтра формата: вкладки живут на одном экране
 * с ?tab= и ?format=, переход по вкладке не должен терять выбранный фильтр.
 */
export function dpoTabHref(tab: DpoTabId, format?: string): string {
  const params = new URLSearchParams();
  if (tab !== 'catalog') params.set('tab', tab);
  if (format && format !== 'ALL' && tab === 'catalog') params.set('format', format);
  const query = params.toString();
  return query.length > 0 ? `/dpo?${query}` : '/dpo';
}
