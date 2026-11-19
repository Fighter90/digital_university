// DIG-48 — шаблоны ответов сотрудника на обращения (чистый словарь).
// Кнопка шаблона подставляет текст в поле ответа (клиентский компонент).
// DIG-89 — строки шаблонов живут в словаре i18n (пары ключей RU/EN):
// сам модуль без видимых кириллических литералов (скан исходников DIG-89),
// RU-рендер байт-в-байт прежний.

import { t } from '@/lib/i18n';

export interface AppealTemplate {
  id: string;
  label: string;
  text: string;
}

/** Порядок шаблонов канона; строки — ключи staff.appealTemplate.<id>.label/.text. */
const TEMPLATE_IDS = [
  'received',
  'invite-office',
  'need-docs',
  'in-progress',
  'resolved-note',
] as const;

/** Шаблоны ответов сотрудника по локали. RU — канон байт-в-байт. */
export function appealTemplateList(locale: 'ru' | 'en' = 'ru'): AppealTemplate[] {
  return TEMPLATE_IDS.map((id) => ({
    id,
    label: t(locale, `staff.appealTemplate.${id}.label` as never),
    text: t(locale, `staff.appealTemplate.${id}.text` as never),
  }));
}
