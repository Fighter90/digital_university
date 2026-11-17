// DIG-39 — «Обращения в деканат»: список обращений + композер нового.
// Все данные из getDeaneryPage (owner-scoped по requireDataCtx): студент
// видит только свои обращения. На десктопе (≥1024 px) — две панели
// (Figma «17 · Деканат»), на мобильном — колонкой. Сотруднику раздел
// недоступен («Доступно студентам»).
//
// DIG-38: «Написать в деканат» из пустого состояния /help переносит текст
// запроса в ?q= — композер открывается с готовым черновиком обращения.
// Только предзаполнение textarea (React экранирует), длина ограничена.
import { requireDataCtx, getDeaneryPage } from '@/server/data';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';
import { dataDb } from '@/server/data/db';
import { TicketList } from '@/components/deanery/ticket-list';
import { TicketComposer } from '@/components/deanery/ticket-composer';
import { RESPONSE_PROMISE } from '@/lib/tickets';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionTitle } from '@/components/shell/section-title';
import { MessagesSquare } from 'lucide-react';

/** Лимит переноса запроса из базы знаний в черновик обращения. */
const MAX_TICKET_DRAFT_LENGTH = 300;

export default async function DeaneryPage({
  searchParams = Promise.resolve({}),
}: {
  searchParams?: Promise<Record<string, string>>;
}) {
  const [ctx, locale] = await Promise.all([requireDataCtx('/deanery'), getLocale()]);
  const page = await getDeaneryPage(dataDb, ctx);
  const params = await searchParams;
  const draftBody = (params.q ?? '').trim().slice(0, MAX_TICKET_DRAFT_LENGTH);

  if (ctx.role === 'STAFF') {
    return (
      <section className="mx-auto w-full max-w-3xl px-4 py-8">
        <SectionTitle
          href="/deanery"
          className="mb-1 text-xl font-bold tracking-heading sm:text-2xl"
        />
        <EmptyState
          icon={MessagesSquare}
          title={t(locale, 'empty.staffOnlyTitle')}
          description={t(locale, 'empty.deaneryStaffDesc')}
        />
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-6 md:py-8">
      <header>
        <SectionTitle href="/deanery" className="text-xl font-bold tracking-heading sm:text-2xl" />
        <p data-testid="deanery-sla" className="mt-1 text-sm text-muted-foreground">
          {RESPONSE_PROMISE}
        </p>
      </header>

      {/* Две панели на десктопе; на мобильном — список, затем композер. */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <TicketList tickets={page.tickets} />
        <TicketComposer
          requests={page.requests}
          disciplines={page.disciplines}
          initialBody={draftBody}
          locale={locale}
        />
      </div>
    </section>
  );
}
