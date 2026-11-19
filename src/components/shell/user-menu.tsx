'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { LogOut, Settings, UserRound } from 'lucide-react';
import { signOutAction } from '@/server/actions/auth';
import type { ShellUser } from '@/lib/user';
import { t, type Locale } from '@/lib/i18n';
import { localizeInitials, localizePersonName, localizedGroup } from '@/lib/en-demo-content';

// DIG-14: меню аватара (Профиль, Настройки, Выйти). Доступно с клавиатуры:
// Enter открывает, фокус уходит на первый пункт, Escape закрывает и
// возвращает фокус на кнопку.
// DIG-55: «Выйти» больше не ссылка-заглушка на /login (та не завершала
// сессию — на проде «Выйти не работает»), а submit-форма server action
// signOutAction: удаляет сессию в БД и обе куки, редирект на /login?signedOut=1.
export function UserMenu({ user, locale = 'ru' }: { user: ShellUser; locale?: Locale }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstItemRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Element)) return;
      if (!event.target.closest('[data-user-menu]')) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    firstItemRef.current?.focus();
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  // DIG-93: инициалы по локали — на EN латиница из EN-имени маппинга
  // («Анна Смирнова» → «AS»), иначе из email-префикса; RU — как было.
  const initials = localizeInitials(locale, user.name, user.email);

  return (
    <div className="relative" data-user-menu>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="user-menu"
        aria-label={t(locale, 'shell.userMenuAria')}
        onClick={() => setOpen((value) => !value)}
        className="grid size-8 shrink-0 place-items-center rounded-full bg-coral-100 text-xs font-semibold text-coral-700 ring-1 ring-coral-200 hover:bg-coral-200 focus-visible:outline-2 focus-visible:outline-coral-600 md:size-9 md:text-sm"
      >
        <span aria-hidden="true">{initials}</span>
      </button>

      {open && (
        <div
          id="user-menu"
          role="menu"
          aria-label={t(locale, 'shell.userMenuAria')}
          className="absolute top-11 right-0 z-50 w-52 overflow-hidden rounded-xl border border-neutral-200 bg-white py-1 shadow-lg"
        >
          <div className="border-b border-neutral-100 px-3 py-2">
            <p className="text-sm font-medium text-neutral-900">
              {localizePersonName(locale, user.name)}
            </p>
            <p className="truncate text-xs text-neutral-500">
              {localizedGroup(locale, user.group)} · {user.email}
            </p>
          </div>
          <Link
            ref={firstItemRef}
            role="menuitem"
            href="/profile"
            className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100 focus-visible:bg-neutral-100 focus-visible:outline-none"
            onClick={() => setOpen(false)}
          >
            <UserRound className="size-4" aria-hidden="true" /> {t(locale, 'menu.profile')}
          </Link>
          <Link
            role="menuitem"
            href="/settings"
            className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100 focus-visible:bg-neutral-100 focus-visible:outline-none"
            onClick={() => setOpen(false)}
          >
            <Settings className="size-4" aria-hidden="true" /> {t(locale, 'menu.settings')}
          </Link>
          <div className="my-1 border-t border-neutral-100" role="separator" />
          {/* DIG-55: submit-форма server action signOutAction. ВАЖНО: кнопка НЕ
              закрывает меню в onClick — размонтирование формы до завершения
              клика отменяет встроенную отправку формы, и сессия не завершается
              (видно в e2e: страница оставалась на /dashboard). Редирект action
              сам уводит со страницы, поэтому закрытие не нужно. */}
          <form action={signOutAction}>
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-100 focus-visible:bg-neutral-100 focus-visible:outline-none"
            >
              <LogOut className="size-4" aria-hidden="true" /> {t(locale, 'shell.logout')}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
