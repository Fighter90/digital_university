'use client';

// DIG-41 — клиентский список финансовых документов: пилюли-фильтр по виду
// (Все / Договоры / Допсоглашения / Акты / Квитанции / Счета) и скачивание
// демо-PDF (/api/finance/documents/<id>, роут скоупится по живой сессии).
// Набор документов приходит с сервера уже отфильтрованным по владельцу —
// клиент только фильтрует по виду, ничего не запрашивает и не мутирует.
import { useMemo, useState } from 'react';
import { Download, FileSignature, FileText, ReceiptText, ScrollText } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import {
  FINANCE_DOC_FILTERS,
  formatFinanceDateFull,
  financeDocKindPluralLabel,
  financeFilterEmptyLabel,
  financeFilterLabel,
  financeDocumentTitle,
  type FinanceDocFilter,
  type FinanceDocument,
} from '@/lib/finance-catalog';
import { t, type Locale } from '@/lib/i18n';
import { requestNumberLabel } from '@/lib/requests-view';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';

const KIND_ICONS: Record<FinanceDocument['kind'], LucideIcon> = {
  CONTRACT: FileSignature,
  AGREEMENT: ScrollText,
  ACT: FileText,
  RECEIPT: ReceiptText,
  INVOICE: FileText,
};

export function FinanceDocumentsBrowser({
  documents,
  locale = 'ru',
}: {
  documents: FinanceDocument[];
  /** DIG-89 — локаль интерфейса (cookie du-locale, дефолт ru). */
  locale?: Locale;
}) {
  const [filter, setFilter] = useState<FinanceDocFilter>('ALL');

  const visible = useMemo(
    () => (filter === 'ALL' ? documents : documents.filter((doc) => doc.kind === filter)),
    [documents, filter],
  );

  return (
    <div data-testid="finance-documents">
      <div
        data-testid="finance-doc-filter"
        role="group"
        aria-label={t(locale, 'finance.filter.aria')}
        className="flex gap-2 overflow-x-auto pb-1"
      >
        {FINANCE_DOC_FILTERS.map((kind) => (
          <Chip key={kind} active={filter === kind} onClick={() => setFilter(kind)}>
            {financeFilterLabel(kind, locale)}
          </Chip>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          className="mt-4"
          icon={FileText}
          title={t(locale, 'finance.filter.empty.title')}
          description={financeFilterEmptyLabel(filter === 'ALL' ? 'CONTRACT' : filter, locale)}
        />
      ) : (
        <ul data-testid="finance-doc-list" className="mt-3 flex flex-col gap-2">
          {visible.map((doc) => {
            const Icon = KIND_ICONS[doc.kind];
            return (
              <li
                key={doc.id}
                data-testid={`finance-doc-${doc.kind.toLowerCase()}`}
                className="flex items-center gap-3 rounded-card border border-border bg-card p-3.5 shadow-soft"
              >
                <span
                  aria-hidden="true"
                  className="flex size-10 shrink-0 items-center justify-center rounded-pill bg-accent-soft text-accent-ink"
                >
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {financeDocumentTitle(doc, locale)}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    № {locale === 'en' ? requestNumberLabel(doc.number, 'en') : doc.number}
                    <span aria-hidden="true"> · </span>
                    <time dateTime={doc.date.toISOString()}>{formatFinanceDateFull(doc.date)}</time>
                    <span aria-hidden="true"> · </span>
                    PDF
                  </p>
                </div>
                <a
                  href={`/api/finance/documents/${doc.id}`}
                  download
                  data-testid="finance-doc-download"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-button border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground shadow-soft transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-coral-600"
                >
                  <Download aria-hidden="true" className="size-3.5" />
                  {t(locale, 'finance.download')}
                  <span className="sr-only">
                    {`${financeDocKindPluralLabel(doc.kind, locale)}: ${financeDocumentTitle(doc, locale)}`}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
