'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { navLabel, t, type Locale } from '@/lib/i18n';
import { calendarDaysLeft, daysLeftLabel, formatLongDate } from '@/lib/dashboard-format';
import { sectionsForRole, resolveActiveSection } from './nav-items';
import { sectionIcon } from './nav-icons';
import { UnreadBadge } from './unread-badge';

// DIG-127: ширина полного меню настраивается перетаскиванием правой границы
// (или стрелками с клавиатуры). Дефолт — прежние 212px из макета Figma.
// Выбор хранится в localStorage и восстанавливается после перезагрузки;
// мусорное значение из хранилища игнорируется (возврат к дефолту).
const NAV_WIDTH_DEFAULT = 212;
const NAV_WIDTH_MIN = 180;
const NAV_WIDTH_MAX = 340;
const NAV_WIDTH_STORAGE_KEY = 'du-nav-width';

function clampNavWidth(value: number): number {
  if (!Number.isFinite(value)) return NAV_WIDTH_DEFAULT;
  return Math.min(NAV_WIDTH_MAX, Math.max(NAV_WIDTH_MIN, Math.round(value)));
}

/** DIG-127 — ширина из localStorage (только на клиенте, после гидрации). */
function readStoredNavWidth(): number {
  try {
    const raw = localStorage.getItem(NAV_WIDTH_STORAGE_KEY);
    if (raw === null) return NAV_WIDTH_DEFAULT;
    return clampNavWidth(Number(raw));
  } catch {
    return NAV_WIDTH_DEFAULT;
  }
}

function storeNavWidth(value: number): void {
  try {
    localStorage.setItem(NAV_WIDTH_STORAGE_KEY, String(value));
  } catch {
    // приватный режим — ширина просто не переживёт перезагрузку
  }
}

// Ближайший дедлайн — вымышленные данные каркаса; реальные подключит задача
// по расписанию/задачам (DIG-21+). Показывается только на полном меню (≥1024).
// Срок считается динамически (BUG-06: было захардкожено «9 дней») той же
// логикой, что карточка «Дедлайны» дашборда: разница календарных дней
// (calendarDaysLeft) + общий daysLeftLabel. Дата задана в явной зоне
// Europe/Moscow, поэтому SSR и гидрация дают одну строку при любом TZ.
const DEADLINE_DUE = new Date('2026-11-20T00:00:00+03:00'); // 20 ноября 2026, МСК

function deadlineDaysLeft(now: Date): number {
  return Math.max(calendarDaysLeft(DEADLINE_DUE, now), 0);
}

// DIG-14: боковое меню. ≥1024 — полное меню 212 px, 768–1023 — иконочный
// рельс (подпись в title/aria-label). Активный раздел — мягкий коралловый фон.
// DIG-34: у раздела «Задачи» — пилюля с числом открытых задач (как у
// уведомлений; 0 — скрыта).
export function SideNav({
  unreadCount,
  tasksCount = 0,
  role = 'STUDENT',
  locale = 'ru',
}: {
  unreadCount: number;
  tasksCount?: number;
  role?: 'STUDENT' | 'STAFF';
  /** DIG-69 — локаль интерфейса (cookie du-locale, дефолт ru). */
  locale?: Locale;
}) {
  // DIG-48: разделы строятся по роли сессии (у сотрудника — кабинет деканата).
  const pathname = usePathname();
  const sections = sectionsForRole(role);
  const active = resolveActiveSection(pathname, sections);

  // DIG-127: ширина полного меню (lg ≥1024). Начальное значение — дефолт
  // 212px (SSR и первый клиентский рендер совпадают — без гидрационного
  // рассинхрона); сохранённый выбор подставляется после монтирования.
  const [navWidth, setNavWidth] = useState(NAV_WIDTH_DEFAULT);
  const [dragging, setDragging] = useState(false);
  const asideRef = useRef<HTMLElement>(null);

  useEffect(() => {
    // Гидрация: SSR и первый клиентский рендер обязаны совпасть (212px),
    // сохранённый выбор подставляется только после монтирования — поэтому
    // setState в эффекте здесь намеренный (DIG-127).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- см. комментарий выше
    setNavWidth(readStoredNavWidth());
  }, []);

  const applyWidth = useCallback((next: number, persist: boolean) => {
    const width = clampNavWidth(next);
    setNavWidth(width);
    if (persist) storeNavWidth(width);
  }, []);

  // Клавиатура: ←/→ шаг ±16px, Shift — крупный шаг ±48px, Home/End — min/max.
  const onResizeKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const step = event.shiftKey ? 48 : 16;
      let next: number | null = null;
      if (event.key === 'ArrowRight') next = navWidth + step;
      else if (event.key === 'ArrowLeft') next = navWidth - step;
      else if (event.key === 'Home') next = NAV_WIDTH_MIN;
      else if (event.key === 'End') next = NAV_WIDTH_MAX;
      if (next === null) return;
      event.preventDefault();
      applyWidth(next, true);
    },
    [navWidth, applyWidth],
  );

  // Drag: pointer capture держит события даже при уходе курсора за пределы
  // ручки. Ширина = X курсора − левый край aside (кламп 180–340).
  const onResizePointerDown = useCallback((event: React.PointerEvent) => {
    if (event.button !== 0) return;
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // jsdom/старые окружения — drag по событиям на самой ручке
    }
    setDragging(true);
  }, []);

  const onResizePointerMove = useCallback(
    (event: React.PointerEvent) => {
      if (!dragging) return;
      const left = asideRef.current?.getBoundingClientRect().left ?? 0;
      applyWidth(event.clientX - left, false);
    },
    [dragging, applyWidth],
  );

  const endDrag = useCallback(
    (event: React.PointerEvent) => {
      if (!dragging) return;
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // capture уже снят
      }
      setDragging(false);
      const left = asideRef.current?.getBoundingClientRect().left ?? 0;
      applyWidth(event.clientX - left, true);
    },
    [dragging, applyWidth],
  );

  // DIG-127: двойной клик по ручке — быстрый сброс к дефолту макета (212px).
  const onResizeDoubleClick = useCallback(() => {
    applyWidth(NAV_WIDTH_DEFAULT, true);
  }, [applyWidth]);

  return (
    <aside
      ref={asideRef}
      style={{ '--nav-w': `${navWidth}px` } as React.CSSProperties}
      className={cn(
        'sticky top-18 hidden shrink-0 flex-col border-r border-neutral-200/80 bg-white md:flex md:w-16 lg:w-[var(--nav-w,212px)]',
        // во время drag — без выделения текста под курсором
        dragging && 'select-none',
      )}
    >
      {/* DIG-127: ручка-разделитель на правой границе (только полное меню ≥1024:
          иконочный рельс 768–1023 не расширяется). Фокус + стрелки — доступно
          с клавиатуры (WAI-ARIA splitter). */}
      <div
        data-testid="nav-resize-handle"
        role="separator"
        aria-orientation="vertical"
        aria-label={t(locale, 'shell.navResizeAria')}
        aria-valuemin={NAV_WIDTH_MIN}
        aria-valuemax={NAV_WIDTH_MAX}
        aria-valuenow={navWidth}
        tabIndex={0}
        onKeyDown={onResizeKeyDown}
        onPointerDown={onResizePointerDown}
        onPointerMove={onResizePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={onResizeDoubleClick}
        style={{ touchAction: 'none' }}
        className="absolute inset-y-0 -right-1.5 z-10 hidden w-3 cursor-col-resize items-center justify-center lg:flex focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-coral-600"
      >
        {/* видимая линия границы: заметная базовая, усиливается при hover/drag/фокусе */}
        <span
          aria-hidden="true"
          className={cn(
            'h-full w-0.5 bg-neutral-300 transition-colors',
            dragging && 'w-1 bg-coral-500',
          )}
        />
      </div>
      <nav
        aria-label={t(locale, 'shell.navAria')}
        className="flex flex-col gap-1 overflow-y-auto px-2 py-4"
      >
        <ul className="flex flex-col gap-1">
          {sections.map((section) => {
            const Icon = sectionIcon(section.href);
            const isActive = active === section.href;
            // DIG-69: подпись по локали (RU — байт-в-байт прежняя).
            const label = navLabel(locale, section.href, section.label);
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
                  title={label}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-neutral-600 transition-colors hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral-600 md:justify-center lg:justify-start',
                    isActive && 'bg-coral-100 font-medium text-coral-700 hover:bg-coral-100',
                  )}
                >
                  <Icon className="size-5 shrink-0" aria-hidden="true" />
                  <span className="hidden min-w-0 flex-1 break-words line-clamp-2 lg:inline">
                    {label}
                  </span>
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
            {t(locale, 'shell.deadlineTitle')}
          </h2>
          <p className="mt-1 text-sm font-medium text-neutral-900">
            {t(locale, 'shell.deadline.course')}
          </p>
          <p className="mt-0.5 text-xs text-neutral-600">
            {t(locale, 'shell.deadline.due', {
              date: formatLongDate(DEADLINE_DUE, locale),
              days: daysLeftLabel(deadlineDaysLeft(new Date()), locale),
            })}
          </p>
        </div>
      )}
    </aside>
  );
}
