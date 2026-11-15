import { PagePlaceholder } from '@/components/page-placeholder';
import { ExternalLink } from 'lucide-react';
import { ASSISTANT_DOC_URL } from '@/lib/docs-links';

export default function AiAssistantPage() {
  return (
    <PagePlaceholder
      title="AI-ассистент"
      description="AI-ассистент поможет найти пару, преподавателя или нужную справку."
    >
      {/* DIG-59 — перекрёстная ссылка: полная справка по ассистенту (docs/assistant.md). */}
      <div className="mt-4 flex flex-col gap-1">
        <p className="text-sm text-neutral-600">
          Раздел в разработке: диалог появится в кабинете вместе с цифровым ассистентом.
        </p>
        <a
          href={ASSISTANT_DOC_URL}
          target="_blank"
          rel="noreferrer noopener"
          data-testid="docs-link-assistant"
          className="inline-flex items-center gap-2 self-start rounded-card border border-border bg-muted px-3 py-2.5 text-sm font-semibold text-neutral-900 transition-colors hover:border-coral-200 hover:bg-coral-50 focus-visible:outline-2 focus-visible:outline-coral-600"
        >
          Возможности, примеры запросов и MCP-интеграции — в справке ассистента
          <ExternalLink className="size-4 shrink-0 text-neutral-400" aria-hidden="true" />
        </a>
      </div>
    </PagePlaceholder>
  );
}
