// DIG-42 — вкладки экрана «Дополнительное образование». Чистый модуль
// (без React): страницу и вкладки-ссылки объединяет один реестр, неизвестные
// значения ?tab= безопасно откатываются на «Каталог» (паттерн settings-tabs).

export type DpoTabId = 'catalog' | 'my' | 'docs';

export interface DpoTabMeta {
  id: DpoTabId;
  label: string;
}

export const DPO_TABS: DpoTabMeta[] = [
  { id: 'catalog', label: 'Каталог программ' },
  { id: 'my', label: 'Мои программы' },
  { id: 'docs', label: 'Документы' },
];

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
