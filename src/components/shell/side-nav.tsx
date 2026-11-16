'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { sectionsForRole, resolveActiveSection } from './nav-items';
import { sectionIcon } from './nav-icons';
import { UnreadBadge } from './unread-badge';

// Ближайший дедлайн — вымышленные данные каркаса; реальные подключит задача
// по расписанию/задачам (DIG-21+). Показывается только на полном меню (≥1024).
const DEADLINE = {
  title: 'Курсовая работа по базам данных',
  due: 'до 20 ноября',
  left: 'осталось 9 дней',
};

// DIG-14: боковое меню. ≥1024 — полное меню 212 px, 768–1023 — иконочный
// рельс (подпись в title/aria-label). Активный раздел — мягкий коралловый фон.
// DIG-34: у раздела «Задачи» — пилюля с числом открытых задач (как у
// уведомлений; 0 — скрыта).
export function SideNav({
  unreadCount,
  tasksCount = 0,
  role = 'STUDENT',
}: {
  unreadCount: number;
  tasksCount?: number;
  role?: 'STUDENT' | 'STAFF';
}) {
  // DIG-48: разделы строятся по роли сессии (у сотрудника — кабинет деканата).
  const pathname = usePathname();
  const sections = sectionsForRole(role);
  const active = resolveActiveSection(pathname, sections);

  return (
    <aside className="sticky top-18 hidden shrink-0 flex-col border-r border-neutral-200/80 bg-white md:flex md:w-16 lg:w-[212px]">
      <nav aria-label="Разделы кабинета" className="flex flex-col gap-1 overflow-y-auto px-2 py-4">
        <ul className="flex flex-col gap-1">
          {sections.map((section) => {
            const Icon = sectionIcon(section.href);
            const isActive = active === section.href;
            const showBadge = section.href === '/notifications' && unreadCount > 0;
            // DIG-34 — счётчик открытых задач у раздела «Задачи».
            const showTasksBadge = section.href === '/tasks' && tasksCount > 0;
            return (
              <li key={section.href}>
                {section.href === '/profile' && (
                  <div className="my-2 border-t border-neutral-200/80" role="separator" />
                )}
                <Link
                  href={section.href}
                  aria-current={isActive ? 'page' : undefined}
                  title={section.label}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-neutral-600 transition-colors hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral-600 md:justify-center lg:justify-start',
                    isActive && 'bg-coral-100 font-medium text-coral-700 hover:bg-coral-100',
                  )}
                >
                  <Icon className="size-5 shrink-0" aria-hidden="true" />
                  <span className="hidden min-w-0 flex-1 truncate lg:inline">{section.label}</span>
                  {showBadge && (
                    // DIG-54: inline-вариант бейджа — без absolute, иначе он
                    // позиционируется относительно <aside sticky> и «уезжает»
                    // в угол сайдбара (баг на проде).
                    <span className="ml-auto hidden lg:inline-flex">
                      <UnreadBadge variant="inline" count={unreadCount} />
                    </span>
                  )}
                  {showTasksBadge && (
                    <span className="ml-auto hidden lg:inline-flex">
                      <span
                        data-testid="tasks-count"
                        className="rounded-pill bg-coral-500 px-2 py-0.5 text-[10px] leading-none font-semibold text-white"
                      >
                        {tasksCount > 99 ? '99+' : tasksCount}
                      </span>
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Карточка «Ближайший дедлайн» — под меню (только полное меню ≥1024,
          только студентам: у сотрудника свой кабинет без дедлайнов пар). */}
      {role === 'STUDENT' && (
      <div className="mx-2 mt-2 mb-4 hidden rounded-2xl border border-coral-200 bg-coral-50 p-3 lg:block">
        <h2 className="text-[11px] font-semibold tracking-wide text-coral-700 uppercase">
          Ближайший дедлайн
        </h2>
        <p className="mt-1 text-sm font-medium text-neutral-900">{DEADLINE.title}</p>
        <p className="mt-0.5 text-xs text-neutral-600">
          {DEADLINE.due} · {DEADLINE.left}
        </p>
      </div>
      )}
    </aside>
  );
}
