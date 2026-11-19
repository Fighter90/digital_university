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
  serviceBenefit,
  serviceCategoryLabel,
  serviceEtaLabel,
  serviceFormatLabel,
  serviceTitle,
  splitHighlight,
  type ServiceEntry,
} from '@/lib/services-catalog';
import { t, type Locale } from '@/lib/i18n';
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
  /** DIG-89 — локаль интерфейса (cookie du-locale, дефолт ru). */
  locale?: Locale;
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

export function ServiceCard({ service, isFavorite, query, locale = 'ru' }: ServiceCardProps) {
  // Неизвестная категория (вне каталога) — дефолтная иконка, карточка не падает.
  const Icon = CATEGORY_ICONS[service.category] ?? FileText;
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
            <Highlighted text={serviceTitle(service, locale)} query={locale === 'ru' ? query : ''} />
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {serviceCategoryLabel(service.category, locale)}
          </p>
        </div>
      </div>

      <FavoriteStar serviceId={service.id} serviceTitle={serviceTitle(service, locale)} isFavorite={isFavorite} locale={locale} />

      <p className="mb-3 text-sm text-muted-foreground">
        <Highlighted text={serviceBenefit(service, locale)} query={locale === 'ru' ? query : ''} />
      </p>

      <div className="mt-auto flex flex-wrap items-center gap-1.5">
        <Badge status="info">{serviceEtaLabel(service.eta, locale)}</Badge>
        {service.format ? <Badge>{serviceFormatLabel(service.format, locale)}</Badge> : null}
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
        {service.action === 'ORDER' ? t(locale, 'services.card.order') : t(locale, 'services.card.open')}
      </Link>
    </article>
  );
}
