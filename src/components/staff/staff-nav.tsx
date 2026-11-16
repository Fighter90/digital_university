'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { STAFF_SECTIONS, resolveActiveSection } from '@/components/shell/nav-items';
import { sectionIcon } from '@/components/shell/nav-icons';

// DIG-48 — поднавигация кабинета сотрудника внутри Shell: пилюли-разделы
// над содержимым (Сводка / Заявки / Обращения / Объявления). Активный
// раздел синхронизирован с боковым меню через resolveActiveSection.
export function StaffNav() {
  const pathname = usePathname();
  const active = resolveActiveSection(pathname, STAFF_SECTIONS);

  return (
    <nav
      aria-label="Разделы деканата"
      data-testid="staff-nav"
      className="mb-5 flex gap-1.5 overflow-x-auto pb-1"
    >
      {STAFF_SECTIONS.map((section) => {
        const Icon = sectionIcon(section.href);
        const isActive = active === section.href;
        return (
          <Link
            key={section.href}
            href={section.href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-pill border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral-600',
              isActive
                ? 'border-coral-600 bg-coral-600 text-white'
                : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50',
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
