'use client';

import Link from 'next/link';
import { Bell, Search, Sparkles } from 'lucide-react';
import type { ShellUser } from '@/lib/user';
import { cn } from '@/lib/utils';
import { UnreadBadge } from './unread-badge';
import { UserMenu } from './user-menu';

type TopBarProps = {
  user: ShellUser;
  unreadCount: number;
  onOpenSearch: () => void;
  /** Ref кнопки поиска — Shell передаёт его палитре для возврата фокуса. */
  searchTriggerRef?: React.Ref<HTMLButtonElement>;
};

// DIG-14: верхняя панель 72 px (56 px на мобильном): вымышленный логотип,
// поиск (⌘K), AI, колокольчик с непрочитанными, аватар с меню и плашка концепта.
export function TopBar({ user, unreadCount, onOpenSearch, searchTriggerRef }: TopBarProps) {
  return (
    <header className="z-40 border-b border-neutral-200/80 bg-white/85 backdrop-blur supports-[backdrop-filter]:bg-white/75 md:sticky md:top-0">
      <div className="mx-auto flex h-14 w-full max-w-[1440px] items-center gap-1.5 px-3 md:h-18 md:gap-3 md:px-6">
        <Link
          href="/dashboard"
          className="flex min-w-0 items-center gap-2 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral-600"
          aria-label="Цифровой деканат — на главную"
        >
          {/* Собственный вымышленный знак (бренд вуза запрещён) */}
          <span
            aria-hidden="true"
            className="grid size-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-coral-500 to-amber-400 text-xs font-bold text-white"
          >
            ЦД
          </span>
          <span className="truncate text-sm font-semibold text-neutral-900 md:text-base">
            Цифровой деканат
          </span>
        </Link>

        <span
          data-testid="concept-pill"
          className="hidden shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-medium text-amber-900 md:inline-flex"
        >
          Концепт для конкурса
        </span>

        <div className="ml-auto flex items-center gap-1 md:gap-2">
          {/* Поиск: широкая кнопка на ≥768, иконка на мобильном */}
          <button
            ref={searchTriggerRef}
            type="button"
            onClick={onOpenSearch}
            aria-label="Поиск по кабинету (Command+K)"
            className={cn(
              'grid size-8 shrink-0 place-items-center rounded-full text-neutral-600 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-coral-600 md:h-9 md:w-full md:max-w-72 md:flex md:flex-row md:items-center md:justify-start md:gap-2 md:rounded-full md:border md:border-neutral-200 md:bg-neutral-50 md:px-3 md:text-sm md:font-normal md:text-neutral-500 md:hover:bg-neutral-100',
            )}
          >
            <Search className="size-4 shrink-0" aria-hidden="true" />
            <span className="hidden flex-1 truncate text-left md:inline">
              Найти пару, преподавателя, справку…
            </span>
            <kbd className="hidden rounded border border-neutral-200 bg-white px-1.5 py-0.5 font-sans text-[11px] text-neutral-500 md:inline">
              ⌘K
            </kbd>
          </button>

          <Link
            href="/ai-assistant"
            aria-label="AI-ассистент"
            className="grid size-8 shrink-0 place-items-center rounded-full text-neutral-600 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-coral-600 md:size-9"
          >
            <Sparkles className="size-4" aria-hidden="true" />
          </Link>

          <Link
            href="/notifications"
            className="relative grid size-8 shrink-0 place-items-center rounded-full text-neutral-600 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-coral-600 md:size-9"
          >
            <Bell className="size-4" aria-hidden="true" />
            <UnreadBadge count={unreadCount} />
            <span className="sr-only">Уведомления: {unreadCount} непрочитанных</span>
          </Link>

          <UserMenu user={user} />
        </div>
      </div>
    </header>
  );
}
