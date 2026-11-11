import Link from 'next/link';
import { MORE_SECTIONS } from '@/components/shell/nav-items';
import { sectionIcon } from '@/components/shell/nav-icons';
import { PagePlaceholder } from '@/components/page-placeholder';

// DIG-14: «Ещё» — разделы, которым не нашлось места в мобильном таб-баре.
export default function MorePage() {
  return (
    <PagePlaceholder
      title="Ещё"
      description="Остальные разделы кабинета — уведомления, деканат, AI и профиль."
    >
      <ul className="mt-4 grid gap-1">
        {MORE_SECTIONS.map((section) => {
          const Icon = sectionIcon(section.href);
          return (
            <li key={section.href}>
              <Link
                href={section.href}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-neutral-700 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-coral-600"
              >
                <Icon className="size-5 shrink-0 text-neutral-500" aria-hidden="true" />
                <span className="truncate">{section.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </PagePlaceholder>
  );
}
