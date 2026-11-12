// DIG-29 — карточка сервиса каталога: иконка категории, название, одна
// строка пользы, срок пилюлей, формат (PDF / Бумажная), «Заказать» или
// «Открыть», звёздочка избранного. Компонент нейтрален к месту рендера
// (серверные блоки избранного/подборки и клиентский каталог), при передаче
// query подсвечивает совпадения поиска (<mark>).
import Link from 'next/link';
import {
  BedDouble,
  BookOpen,
  ClipboardList,
  FileText,
  LifeBuoy,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { cn } from 'cn';

import {
  CATEGORY_LABELS,
  ETA_LABELS,
  FORMAT_LABELS,
  splitHighlight,
  type ServiceEntry,
} from '@/lib/services-catalog';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { FavoriteStar } from './favorite-star';

export const CATEGORY_ICONS: Record<ServiceEntry['category'], LucideIcon> = {
  CERTIFICATES: FileText,
  STATEMENTS: ClipboardList,
  STUDY: BookOpen,
  FINANCE: Wallet,
  DORMITORY: BedDouble,
  HELP: LifeBuoy,
};

export interface ServiceCardProps {
  service: ServiceEntry;
  isFavorite: boolean;
  /** Запрос поиска: подсвечивает совпадения в названии и пользе. */
  query?: string;
}

function Highlighted({ text, query }: { text: string; query?: string }) {
  if (!query || !query.trim()) return <>{text}</>;
  return (
    <>
      {splitHighlight(text, query).map((chunk, i) =>
        chunk.hit ? (
          <mark key={i} className="rounded-sm bg-accent-soft px-0.5 text-accent-ink">
            {chunk.text}
          </mark>
        ) : (
          <span key={i}>{chunk.text}</span>
        ),
      )}
    </>
  );
}

export function ServiceCard({ service, isFavorite, query }: ServiceCardProps) {
  const Icon = CATEGORY_ICONS[service.category];
  return (
    <article
      data-testid={`service-card-${service.id}`}
      className="relative flex h-full flex-col rounded-card border border-border bg-card p-4 shadow-soft"
    >
      <div className="mb-2 flex items-start gap-3 pr-9">
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-button bg-accent-soft text-accent-ink"
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-bold leading-snug">
            <Highlighted text={service.title} query={query} />
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {CATEGORY_LABELS[service.category]}
          </p>
        </div>
      </div>

      <FavoriteStar serviceId={service.id} serviceTitle={service.title} isFavorite={isFavorite} />

      <p className="mb-3 text-sm text-muted-foreground">
        <Highlighted text={service.benefit} query={query} />
      </p>

      <div className="mt-auto flex flex-wrap items-center gap-1.5">
        <Badge status="info">{ETA_LABELS[service.eta]}</Badge>
        {service.format ? <Badge>{FORMAT_LABELS[service.format]}</Badge> : null}
      </div>

      <Link
        href={service.href}
        className={cn(
          buttonVariants({
            variant: service.action === 'ORDER' ? 'primary' : 'secondary',
            size: 'sm',
          }),
          'mt-3 w-full',
        )}
      >
        {service.action === 'ORDER' ? 'Заказать' : 'Открыть'}
      </Link>
    </article>
  );
}
