// DIG-69 — server action переключения языка кабинета (RU/EN).
//
// Локаль — cookie du-locale у ВЛАДЕЛЬЦА сессии: действие owner-scoped
// (requireDataCtx строит контекст из живой сессии, IDOR невозможен) и не
// трогает data-слой (cookie достаточно для прототипа, поле locale в
// StudentSettingsRow не добавляем).
//
// Форма-переключатель работает и без JS: кнопки с name="locale" отдают
// значение обычным POST на текущий URL. revalidatePath('/', 'layout')
// перерисовывает каркас и страницы с новой локалью.
'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { requireDataCtx } from '@/server/data';
import { isLocale, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, type Locale } from '@/lib/i18n';

export async function setLocale(formData: FormData): Promise<void> {
  // Владелец-скоуп: анонимный посетитель не переключает язык кабинета.
  await requireDataCtx('/settings');

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
