'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { TAB_SECTIONS, resolveActiveTab } from './nav-items';
import { sectionIcon } from './nav-icons';

// DIG-14: нижний таб-бар мобильного (<768). Фиксированный, с отступом
// под жест-бар iPhone через env(safe-area-inset-bottom). Активная вкладка
// синхронизирована с боковым меню через resolveActiveTab.
export function TabBar() {
  const pathname = usePathname();
  const activeTab = resolveActiveTab(pathname);

  return (
    <nav
      aria-label="Мобильная навигация"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200/80 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="mx-auto flex max-w-md">
        {TAB_SECTIONS.map((tab) => {
          const Icon = sectionIcon(tab.href);
          const isActive = activeTab === tab.href;
          return (
            <li key={tab.href} className="min-w-0 flex-1">
              <Link
                href={tab.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex flex-col items-center gap-0.5 py-2 text-[11px] focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-coral-600',
                  isActive
                    ? 'font-medium text-coral-600'
                    : 'text-neutral-500 hover:text-neutral-700',
                )}
              >
                <Icon className="size-5 shrink-0" aria-hidden="true" />
                <span className="truncate">{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
