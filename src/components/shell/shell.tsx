'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { ShellUser } from '@/lib/user';
import type { NotificationFeedItem } from '@/lib/notification-view';
import { t, type Locale } from '@/lib/i18n';
import { A11yVersionLink } from '@/components/a11y/version-link';
import { TopBar } from './top-bar';
import { SideNav } from './side-nav';
import { TabBar } from './tab-bar';
import { AiFab } from './ai-fab';
import { AiGuide } from './ai-guide';
import { SearchPalette } from './search-palette';
import { AssistantPanel } from '@/components/assistant/assistant-panel';
import { FloatingAssistantPopup } from '@/components/assistant/floating-assistant-popup';

type ShellProps = {
  user: ShellUser;
  unreadCount: number;
  /** DIG-35 — последние 5 уведомлений владельца для панели колокольчика. */
  recentNotifications: NotificationFeedItem[];
  /** DIG-34 — открытые задачи для счётчика меню; 0 — пилюля скрыта. */
  tasksCount?: number;
  /** DIG-69 — локаль интерфейса кабинета (cookie du-locale, дефолт ru). */
  locale?: Locale;
  /**
   * DIG-100 — включена ли plain-версия для слабовидящих (cookie
   * du-a11y-version, читает cabinet layout): текст полоски и футера —
   * «Обычная версия» вместо «Версия для слабовидящих».
   */
  a11yPlain?: boolean;
  children: React.ReactNode;
};

// DIG-14: общий каркас всех экранов кабинета (Figma «Shell · Кабинет»).
// Десктоп: верхняя панель + меню 212 px. Планшет: иконочный рельс.
// Мобильный (<768): таб-бар + плавающая AI-кнопка. Первая таб-стоп —
// skip-link «К содержимому» (доступность с клавиатуры).
// DIG-46: кнопка AI в шапке открывает выезжающую панель ассистента с
// карточками на любом экране; полный экран раздела — /ai-assistant.
// DIG-72: плавающая кнопка (FAB) в правом нижнем углу открывает лёгкий
// попап-чат по справке (RAG + OpenRouter); на экране /ai-assistant FAB
// скрыт, чтобы не дублировать вход.
export function Shell({
  user,
  unreadCount,
  recentNotifications,
  tasksCount = 0,
  locale = 'ru',
  a11yPlain = false,
  children,
}: ShellProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  // DIG-72: отдельное состояние попап-чата FAB (панель DIG-46 — кнопка шапки).
  const [fabOpen, setFabOpen] = useState(false);
  // FAB скрыт на самом экране /ai-assistant: вход там уже есть.
  const pathname = usePathname();
  const showFab = user.role === 'STUDENT' && pathname !== '/ai-assistant';
  // Кнопка поиска: ссылка нужна палитре, чтобы вернуть фокус при закрытии.
  const searchTriggerRef = useRef<HTMLButtonElement>(null);
  const closeSearch = useCallback(() => setSearchOpen(false), []);

  // Глобальный хоткей ⌘K / Ctrl+K — открыть/закрыть поиск.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.code === 'KeyK') {
        event.preventDefault();
        setSearchOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="min-h-dvh bg-neutral-50">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-neutral-900 focus:shadow-lg focus:outline focus:outline-2 focus:outline-coral-600"
      >
        {t(locale, 'shell.skipToContent')}
      </a>

      {/* DIG-100: полоска «Версия для слабовидящих» НАД шапкой кабинета
          (в plain-режиме — обратная ссылка «Обычная версия» там же). */}
      <A11yVersionLink locale={locale} variant="strip" plain={a11yPlain} next={pathname} />

      <TopBar
        user={user}
        unreadCount={unreadCount}
        recentNotifications={recentNotifications}
        locale={locale}
        onOpenSearch={() => setSearchOpen(true)}
        onOpenAssistant={() => setAssistantOpen(true)}
        searchTriggerRef={searchTriggerRef}
      />

      <div className="mx-auto flex w-full max-w-[1440px]">
        <SideNav
          unreadCount={unreadCount}
          tasksCount={tasksCount}
          role={user.role}
          locale={locale}
        />
        <main
          id="main-content"
          tabIndex={-1}
          className="min-w-0 flex-1 px-3 pt-4 pb-28 focus:outline-none md:px-6 md:pt-6 md:pb-12"
        >
          {children}
        </main>
      </div>

      {/* DIG-100: ссылка версии в футере кабинета (под основным контентом,
          выше фиксированного таб-бара на мобайле — pb-28). */}
      <footer className="border-t border-neutral-200 px-3 pt-4 pb-28 text-center md:px-6 md:pb-12">
        <A11yVersionLink locale={locale} variant="footer" plain={a11yPlain} next={pathname} />
      </footer>

      {/* DIG-48: таб-бар по роли сессии (у сотрудника — разделы деканата). */}
      <TabBar role={user.role} locale={locale} />
      {/* DIG-72: плавающая кнопка попап-чата ассистента — только студенту
          (у сотрудника свой кабинет); на /ai-assistant скрыта. */}
      {showFab && <AiFab onOpen={() => setFabOpen(true)} />}
      {/* DIG-62: AI-гид — вне <main>, чтобы краулер DIG-60 и геометрия
          контента не видели его ссылки; только роль студента. DIG-65:
          флаг voiceAssistant прячет/показывает микрофон голосового ввода. */}
      {user.role === 'STUDENT' && (
        <AiGuide userName={user.name} role={user.role} voiceEnabled={user.voiceAssistant} />
      )}
      <SearchPalette
        open={searchOpen}
        onClose={closeSearch}
        returnFocusRef={searchTriggerRef}
        role={user.role}
      />
      <AssistantPanel open={assistantOpen} onOpenChange={setAssistantOpen} locale={locale} />
      {/* DIG-72: попап-чат ассистента по справке (монтирован всегда —
          история сессии живёт в памяти компонента и переживает закрытие). */}
      {user.role === 'STUDENT' && (
        <FloatingAssistantPopup open={fabOpen} onOpenChange={setFabOpen} locale={locale} />
      )}
    </div>
  );
}
