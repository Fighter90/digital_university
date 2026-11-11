import Link from 'next/link';
import { Bot, FileText, Mail, PenLine } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';

// DIG-20: «Быстрые действия» — четыре частых сценария одним касанием;
// каждое действие ведёт в свой раздел кабинета.

interface QuickAction {
  label: string;
  href: string;
  icon: LucideIcon;
}

const ACTIONS: QuickAction[] = [
  { label: 'Заказать справку', href: '/requests', icon: FileText },
  { label: 'Подать заявление', href: '/requests', icon: PenLine },
  { label: 'Написать в деканат', href: '/deanery', icon: Mail },
  { label: 'Спросить AI', href: '/ai-assistant', icon: Bot },
];

export function QuickActions() {
  return (
    <section aria-labelledby="dashboard-actions-heading" className="flex flex-col gap-3">
      <h2 id="dashboard-actions-heading" className="text-lg font-extrabold tracking-heading sm:text-xl">
        Быстрые действия
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ACTIONS.map((action) => (
          <Link key={action.label} href={action.href} className="group">
            <Card className="lift-hover flex h-full flex-col items-start gap-2 p-4 group-hover:border-accent-soft">
              <span className="flex size-9 items-center justify-center rounded-pill bg-accent-soft text-accent-ink">
                <Icon icon={action.icon} size={18} />
              </span>
              <span className="text-sm font-semibold leading-snug">{action.label}</span>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
