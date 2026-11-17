// DIG-43 — обложка-заглушка карточки мероприятия: градиент по хэшу
// названия (eventCoverOf) + иконка Lucide по типу события. Внешних
// картинок нет — прототип без внешних сервисов; обложка детерминирована
// (одинаковое название — одинаковая обложка между сборками).
import { BriefcaseBusiness, CodeXml, PartyPopper, Presentation } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { cn } from 'cn';

import { eventCoverOf, type CampusEventKind } from '@/lib/events';

const KIND_ICONS: Record<CampusEventKind, LucideIcon> = {
  LECTURE: Presentation,
  HACKATHON: CodeXml,
  CAREER: BriefcaseBusiness,
  CULTURE: PartyPopper,
};

export function EventCover({
  title,
  kind,
  className,
}: {
  title: string;
  kind: CampusEventKind;
  className?: string;
}) {
  const palette = eventCoverOf(title);
  const Icon = KIND_ICONS[kind];
  return (
    <div
      aria-hidden="true"
      className={cn('flex items-center justify-center bg-gradient-to-br', palette.cover, className)}
    >
      <Icon className={cn('size-10', palette.ink)} strokeWidth={1.5} />
    </div>
  );
}
