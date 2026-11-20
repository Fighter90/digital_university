// DIG-69 — server action переключения языка кабинета (RU/EN).
//
// Локаль — ПРЕДПОЧТЕНИЕ ИНТЕРФЕЙСА самого посетителя: cookie du-locale
// достаточно для прототипа (поле locale в StudentSettingsRow не добавляем),
// data-слой действие не трогает. Действие доступно и БЕЗ сессии: переключатель
// стоит в шапке ПУБЛИЧНОГО лендинга (DIG-90/DIG-106 — аноним обязан уметь
// сменить язык, а не выпадать на /login). Значение — whitelist ru/en; запись
// идёт только в cookie самого запрашивающего браузера (httpOnly, lax) —
// читать/писать чужие данные действие не может, IDOR невозможен.
//
// Форма-переключатель работает и без JavaScript: кнопки с name="locale"
// отдают значение обычным POST на текущий URL. revalidatePath('/', 'layout')
// перерисовывает каркас и страницы с новой локалью.
'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { isLocale, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, type Locale } from '@/lib/i18n';

export async function setLocale(formData: FormData): Promise<void> {
  const raw = formData.get('locale');
  const locale: Locale | null = isLocale(raw) ? raw : null;
  if (!locale) return; // битое значение — молча ничего не меняем

  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: 'lax',
    httpOnly: true,
  });

  // Перерисовать весь каркас (layout + страницы) с новой локалью.
  revalidatePath('/', 'layout');
}
