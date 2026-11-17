// DIG-70 — callout-блок «Справки»: Совет (accent-soft) и Важно (coral-50).
// Чисто презентационный компонент: статический контент, никакого состояния.
import { Lightbulb, TriangleAlert, type LucideIcon } from 'lucide-react';

import type { HelpCallout } from '@/lib/help-content';

const CALLOUT_STYLES: Record<
  HelpCallout['kind'],
  { label: string; icon: LucideIcon; box: string; iconColor: string; titleColor: string }
> = {
  tip: {
    label: 'Совет',
    icon: Lightbulb,
    box: 'border-blue-200 bg-accent-soft',
    iconColor: 'text-accent-ink',
    titleColor: 'text-accent-ink',
  },
  warning: {
    label: 'Важно',
    icon: TriangleAlert,
    box: 'border-coral-200 bg-coral-50',
    iconColor: 'text-coral-600',
    titleColor: 'text-coral-600',
  },
};

export function Callout({ callout }: { callout: HelpCallout }) {
  const style = CALLOUT_STYLES[callout.kind];
  const Icon = style.icon;
  return (
    <aside
      data-testid={`guide-callout-${callout.kind}`}
      className={`rounded-card border p-3 shadow-soft ${style.box}`}
    >
      <p
        className={`flex items-center gap-1.5 text-xs font-extrabold tracking-heading ${style.titleColor}`}
      >
        <Icon className="size-4 shrink-0" aria-hidden="true" />
        {style.label}
      </p>
      <p className="mt-1 text-sm leading-relaxed text-foreground">{callout.text}</p>
    </aside>
  );
}
