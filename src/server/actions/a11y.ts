// DIG-86 — server action переключения режима доступности «Крупный текст
// и без эффектов» (для слабовидящих).
//
// Режимы — cookie du-a11y у ВЛАДЕЛЬЦА сессии: действие owner-scoped
// (requireDataCtx строит контекст из живой сессии — анонимный посетитель
// выпадает на /login, IDOR невозможен) и не трогает data-слой (cookie
// достаточно для прототипа — паттерн du-locale, src/server/actions/locale.ts).
//
// Значение cookie — подмножество whitelist ['large-text', 'no-effects'];
// биты и неизвестные значения отклоняются без записи. revalidatePath('/',
// 'layout') перерисовывает каркас: root layout ставит классы a11y-* на
// <html> сразу.
'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { requireDataCtx } from '@/server/data';
import {
  A11Y_COOKIE,
  A11Y_COOKIE_MAX_AGE,
  a11yPrefsToCookie,
  isA11yPref,
  withA11yPref,
} from '@/lib/a11y';
import {
  A11Y_VERSION_COOKIE,
  A11Y_VERSION_COOKIE_MAX_AGE,
  isA11yVersion,
} from '@/lib/a11y/version';
import { getA11yPrefs } from '@/lib/a11y/server';

/**
 * Включает/выключает один режим доступности владельца сессии.
 * pref ∈ {'large-text', 'no-effects'}; второй режим не затрагивается.
 * Возвращает true, если значение прошло whitelist и cookie записана.
 */
export async function setA11y(pref: string, enabled: boolean): Promise<boolean> {
  // Владелец-скоуп: анонимный посетитель не переключает режим кабинета.
  await requireDataCtx('/settings');
  if (!isA11yPref(pref) || typeof enabled !== 'boolean') return false;

  const current = await getA11yPrefs();
  const next = withA11yPref(current, pref, enabled);
  const value = a11yPrefsToCookie(next);
  const store = await cookies();
  if (!value) {
    // Оба режима выключены — cookie не нужна.
    store.delete(A11Y_COOKIE);
  } else {
    store.set(A11Y_COOKIE, value, {
      path: '/',
      maxAge: A11Y_COOKIE_MAX_AGE,
      sameSite: 'lax',
      httpOnly: true,
    });
  }

  // Перерисовать весь каркас (layout + страницы) с новыми классами.
  revalidatePath('/', 'layout');
  return true;
}

/**
 * DIG-100 — включает/выключает plain-версию для слабовидящих владельца
 * сессии (cookie du-a11y-version = 'plain' | 'off'). Значение приходит
 * из формы A11yVersionLink (кнопка с hidden version — работает и без JS).
 *
 * Владелец-скоуп: requireDataCtx по живой сессии (анонимный посетитель
 * выпадает на /login, IDOR невозможен) — паттерн setA11y/setLocale.
 * Поле next — необязательный внутренний путь возврата после входа:
 * строгое «/…» без схемы и протокола, иначе отбрасывается (open redirect
 * невозможен). revalidatePath перерисовывает каркас: root layout ставит
 * класс a11y-plain на <html> сразу.
 */
export async function toggleA11yVersion(formData: FormData): Promise<void> {
  const rawNext = formData.get('next');
  // Внутренний путь: начинается с одного «/», без «//», пробелов и схемы.
  const nextPath =
    typeof rawNext === 'string' && /^\/(?!\/)\S*$/.test(rawNext) ? rawNext : undefined;

  // Владелец-скоуп: анонимный посетитель не переключает версию интерфейса.
  await requireDataCtx(nextPath);

  const raw = formData.get('version');
  const version = isA11yVersion(raw) ? raw : null;
  if (!version) return; // битое значение — молча ничего не меняем

  const store = await cookies();
  store.set(A11Y_VERSION_COOKIE, version, {
    path: '/',
    maxAge: A11Y_VERSION_COOKIE_MAX_AGE,
    sameSite: 'lax',
    httpOnly: true,
  });

  // Перерисовать весь каркас (layout + страницы) с классом a11y-plain.
  revalidatePath('/', 'layout');
}
