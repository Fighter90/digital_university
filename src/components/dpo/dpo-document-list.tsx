// DIG-42 — список документов ДПО (вкладка «Документы»): иконка вида
// (квитанция — Receipt, остальные — FileText), номер, дата, название и
// «Скачать» — disabled-заглушка с тултипом «Доступно после выпуска»
// (реальных файлов в прототипе нет). Строки приходят из owner-scoped
// чтения (getDpoDocuments) — чужих документов на экране не бывает.
import { FileText, Receipt } from 'lucide-react';
import { Tooltip } from '@/components/ui/tooltip';
import { t, type Locale, type TranslationKey } from '@/lib/i18n';
import type { DpoDocumentKind, DpoDocumentRow } from '@/server/data';

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/** Ключ словаря по виду документа (типизированный индекс). */
const DOC_KIND_KEY: Record<DpoDocumentKind, TranslationKey> = {
  CONTRACT: 'dpo.doc.contract',
  ACT: 'dpo.doc.act',
  RECEIPT: 'dpo.doc.receipt',
  CERTIFICATE: 'dpo.doc.certificate',
};

export function DpoDocumentList({
  documents,
  locale = 'ru',
}: {
  documents: DpoDocumentRow[];
  locale?: Locale;
}) {
  return (
    <ul className="flex flex-col gap-3" data-testid="dpo-documents">
      {documents.map((doc) => (
        <li key={doc.id}>
          <article className="flex items-start gap-3 rounded-card border border-border bg-card p-4 shadow-soft">
            <span
              aria-hidden="true"
              className="flex size-10 shrink-0 items-center justify-center rounded-pill bg-accent-soft text-accent-ink"
            >
              {doc.kind === 'RECEIPT' ? (
                <Receipt className="size-5" />
              ) : (
                <FileText className="size-5" />
              )}
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-snug">{doc.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t(locale, DOC_KIND_KEY[doc.kind])} · {doc.number} ·{' '}
                {dateFormatter.format(doc.issuedAt)}
              </p>
            </div>

            <Tooltip content={t(locale, 'dpo.doc.downloadHint')}>
              <span
                data-testid={`dpo-doc-download-${doc.id}`}
                className="inline-flex select-none items-center rounded-pill border border-border bg-muted px-4 py-1.5 text-sm font-medium text-muted-foreground"
              >
                {t(locale, 'dpo.download')}
              </span>
            </Tooltip>
          </article>
        </li>
      ))}
    </ul>
  );
}
