'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ShellUser } from '@/lib/user';
import type { NotificationFeedItem } from '@/lib/notification-view';
import { TopBar } from './top-bar';
import { SideNav } from './side-nav';
import { TabBar } from './tab-bar';
import { AiFab } from './ai-fab';
import { AiGuide } from './ai-guide';
import { SearchPalette } from './search-palette';
import { AssistantPanel } from '@/components/assistant/assistant-panel';

type ShellProps = {
  user: ShellUser;
  unreadCount: number;
  /** DIG-35 — последние 5 уведомлений владельца для панели колокольчика. */
  recentNotifications: NotificationFeedItem[];
  /** DIG-34 — открытые задачи для счётчика меню; 0 — пилюля скрыта. */
  tasksCount?: number;
  children: React.ReactNode;
};

// DIG-14: общий каркас всех экранов кабинета (Figma «Shell · Кабинет»).
// Десктоп: верхняя панель + меню 212 px. Планшет: иконочный рельс.
// Мобильный (<768): таб-бар + плавающая AI-кнопка. Первая таб-стоп —
// skip-link «К содержимому» (доступность с клавиатуры).
// DIG-46: AI-кнопки (плавающая и в шапке) открывают выезжающую панель
// ассистента на любом экране; полный экран раздела — /ai-assistant.
export function Shell({
  user,
  unreadCount,
  recentNotifications,
  tasksCount = 0,
  children,
}: ShellProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
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
        К содержимому
      </a>

      <TopBar
        user={user}
        unreadCount={unreadCount}
        recentNotifications={recentNotifications}
        onOpenSearch={() => setSearchOpen(true)}
        onOpenAssistant={() => setAssistantOpen(true)}
        searchTriggerRef={searchTriggerRef}
      />

      <div className="mx-auto flex w-full max-w-[1440px]">
        <SideNav unreadCount={unreadCount} />
        <main
          id="main-content"
          tabIndex={-1}
          className="min-w-0 flex-1 px-3 pt-4 pb-28 focus:outline-none md:px-6 md:pt-6 md:pb-12"
        >
          {children}
        </main>
      </div>

      <TabBar />
      <AiFab onOpen={() => setAssistantOpen(true)} />
      {/* DIG-62: AI-гид — вне <main>, чтобы краулер DIG-60 и геометрия
          контента не видели его ссылки; только роль студента. DIG-65:
          флаг voiceAssistant прячет/показывает микрофон голосового ввода. */}
      <AiGuide userName={user.name} role={user.role} voiceEnabled={user.voiceAssistant} />
      <SearchPalette
        open={searchOpen}
        onClose={closeSearch}
        returnFocusRef={searchTriggerRef}
        role={user.role}
      />
      <AssistantPanel open={assistantOpen} onOpenChange={setAssistantOpen} />
    </div>
  );
}
