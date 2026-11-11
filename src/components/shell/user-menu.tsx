'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { LogOut, Settings, UserRound } from 'lucide-react';
import type { ShellUser } from '@/lib/user';

// DIG-14: меню аватара (Профиль, Настройки, Выйти). Доступно с клавиатуры:
// Enter открывает, фокус уходит на первый пункт, Escape закрывает и
// возвращает фокус на кнопку. «Выйти» — заглушка до DIG-18 (signOut).
export function UserMenu({ user }: { user: ShellUser }) {
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

  const initials = user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <div className="relative" data-user-menu>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="user-menu"
        aria-label="Меню пользователя"
        onClick={() => setOpen((value) => !value)}
        className="grid size-8 shrink-0 place-items-center rounded-full bg-coral-100 text-xs font-semibold text-coral-700 ring-1 ring-coral-200 hover:bg-coral-200 focus-visible:outline-2 focus-visible:outline-coral-600 md:size-9 md:text-sm"
      >
        <span aria-hidden="true">{initials}</span>
      </button>

      {open && (
        <div
          id="user-menu"
          role="menu"
          aria-label="Меню пользователя"
          className="absolute top-11 right-0 z-50 w-52 overflow-hidden rounded-xl border border-neutral-200 bg-white py-1 shadow-lg"
        >
          <div className="border-b border-neutral-100 px-3 py-2">
            <p className="text-sm font-medium text-neutral-900">{user.name}</p>
            <p className="truncate text-xs text-neutral-500">
              {user.group} · {user.email}
            </p>
          </div>
          <Link
            ref={firstItemRef}
            role="menuitem"
            href="/profile"
            className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100 focus-visible:bg-neutral-100 focus-visible:outline-none"
            onClick={() => setOpen(false)}
          >
            <UserRound className="size-4" aria-hidden="true" /> Профиль
          </Link>
          <Link
            role="menuitem"
            href="/settings"
            className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100 focus-visible:bg-neutral-100 focus-visible:outline-none"
            onClick={() => setOpen(false)}
          >
            <Settings className="size-4" aria-hidden="true" /> Настройки
          </Link>
          <div className="my-1 border-t border-neutral-100" role="separator" />
          <Link
            role="menuitem"
            href="/login"
            className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100 focus-visible:bg-neutral-100 focus-visible:outline-none"
            onClick={() => setOpen(false)}
          >
            <LogOut className="size-4" aria-hidden="true" /> Выйти
          </Link>
        </div>
      )}
    </div>
  );
}
