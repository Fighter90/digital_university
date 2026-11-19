'use client';

import Link from 'next/link';
import { Search, Sparkles } from 'lucide-react';
import type { ShellUser } from '@/lib/user';
import type { NotificationFeedItem } from '@/lib/notification-view';
import { t, type Locale } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { BrandLogo } from '@/components/brand/logo';
import { UserMenu } from './user-menu';
import { LocaleSwitch } from './locale-switch';
import { NotificationsBell } from '@/components/notifications/notifications-bell';

type TopBarProps = {
  user: ShellUser;
  unreadCount: number;
  /** DIG-35 — последние уведомления для панели колокольчика (SSR). */
  recentNotifications: NotificationFeedItem[];
  onOpenSearch: () => void;
  /** DIG-46 — открывает плавающую панель AI-ассистента. */
  onOpenAssistant: () => void;
  /** Ref кнопки поиска — Shell передаёт его палитре для возврата фокуса. */
  searchTriggerRef?: React.Ref<HTMLButtonElement>;
  /** DIG-69 — локаль интерфейса (cookie du-locale, дефолт ru). */
  locale?: Locale;
};

// DIG-14: верхняя панель 72 px (56 px на мобильном): вымышленный логотип,
// поиск (⌘K), AI, колокольчик с панелью уведомлений, аватар и плашка концепта.
export function TopBar({
  user,
  unreadCount,
  recentNotifications,
  onOpenSearch,
  onOpenAssistant,
  searchTriggerRef,
  locale = 'ru',
}: TopBarProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200/80 bg-white/85 backdrop-blur supports-[backdrop-filter]:bg-white/75">
      <div className="mx-auto flex h-14 w-full max-w-[1440px] items-center gap-1.5 px-3 md:h-18 md:gap-3 md:px-6">
        <Link
          href={user.role === 'STAFF' ? '/staff' : '/dashboard'}
          className="flex min-w-0 items-center gap-2 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral-600"
          aria-label={t(locale, 'shell.brandAria')}
        >
          {/* Собственный вымышленный знак (бренд вуза запрещён) — DIG-16 */}
          <BrandLogo className="size-8 shrink-0 rounded-xl" />
          <span className="truncate text-sm font-semibold text-neutral-900 md:text-base">
            {t(locale, 'shell.brandName')}
          </span>
        </Link>

        <span
          data-testid="concept-pill"
          className="hidden shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-medium text-amber-900 md:inline-flex"
        >
          {t(locale, 'concept.pill')}
        </span>

        <div className="ml-auto flex items-center gap-1 md:gap-2">
          {/* DIG-69 — переключатель RU/EN (форма с server action, работает и без JS). */}
          <LocaleSwitch locale={locale} />

          {/* Поиск: широкая кнопка на ≥768, иконка на мобильном */}
          <button
            ref={searchTriggerRef}
            type="button"
            onClick={onOpenSearch}
            aria-label={t(locale, 'shell.searchAria')}
            className={cn(
              'grid size-8 shrink-0 place-items-center rounded-full text-neutral-600 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-coral-600 md:h-9 md:w-full md:max-w-72 md:flex md:flex-row md:items-center md:justify-start md:gap-2 md:rounded-full md:border md:border-neutral-200 md:bg-neutral-50 md:px-3 md:text-sm md:font-normal md:text-neutral-500 md:hover:bg-neutral-100',
            )}
          >
            <Search className="size-4 shrink-0" aria-hidden="true" />
            <span className="hidden flex-1 truncate text-left md:inline">
              {t(locale, 'shell.searchPlaceholder')}
            </span>
            <kbd className="hidden rounded border border-neutral-200 bg-white px-1.5 py-0.5 font-sans text-[11px] text-neutral-500 md:inline">
              ⌘K
            </kbd>
          </button>

          <button
            type="button"
            onClick={onOpenAssistant}
            aria-label={t(locale, 'shell.assistantAria')}
            aria-haspopup="dialog"
            className="grid size-8 shrink-0 place-items-center rounded-full text-neutral-600 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-coral-600 md:size-9"
          >
            <Sparkles className="size-4" aria-hidden="true" />
          </button>

          {/* DIG-35: колокольчик с панелью уведомлений (SSR-данные). Якорь
              e2e-проверки позиции бейджа (DIG-54) — data-testid на кнопке. */}
          <NotificationsBell
            initialItems={recentNotifications}
            initialCount={unreadCount}
            locale={locale}
          />

          <UserMenu user={user} locale={locale} />
        </div>
      </div>
    </header>
  );
}
