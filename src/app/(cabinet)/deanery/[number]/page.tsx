// DIG-39 — чат обращения по публичному номеру (никогда cuid).
// requireDataCtx() → openTicketChat() скоупит поиск владельцем сессии:
// чужой и несуществующий номер отвечают одинаковым 404 (попытка — в аудит).
//
// На десктопе (≥1024 px) — две панели: слева список обращений, справа чат
// (Figma «17 · Деканат»); на мобильном — отдельный экран чата со ссылкой
// назад к списку.
//
// NOTE: над этим сегментом НЕ должно быть loading.tsx — Suspense-граница
// стримит shell до notFound() и чужой адрес ответил бы 200 вместо
// контрактного 404 (см. requests/[number]/page.tsx). Скелетон списка живёт
// в соседней route-group (list).
import Link from 'next/link';
import { notFound } from 'next/navigation';

import {
  requireDataCtx,
  getDeaneryPage,
  openTicketChat,
  normalizeTicketNumber,
} from '@/server/data';
import { dataDb } from '@/server/data/db';
import { NewTicketLink, TicketList } from '@/components/deanery/ticket-list';
import { TicketChat } from '@/components/deanery/ticket-chat';
import { TicketReplyForm } from '@/components/deanery/ticket-reply-form';
import { getLocale } from '@/lib/i18n/server';
import { t } from '@/lib/i18n';

export default async function TicketChatPage({ params }: { params: Promise<{ number: string }> }) {
  const { number: rawNumber } = await params;
  const locale = await getLocale();
  let number: string;
  try {
    number = normalizeTicketNumber(decodeURIComponent(rawNumber));
  } catch {
    // Некорректный percent-encoding (URIError) — тот же контрактный 404,
    // что для чужого и несуществующего номера, а не 500
    // (см. requests/[number]/page.tsx про единый notFound()).
    notFound();
  }
  const ctx = await requireDataCtx(`/deanery/${rawNumber}`);

  const chat = await openTicketChat(dataDb, ctx, number);
  if (!chat) notFound();

  const page = await getDeaneryPage(dataDb, ctx);

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-6 md:py-8">
      {/* Мобильный: отдельный экран чата — назад к списку. На десктопе
          слева и так тот же список. */}
      <Link
        href="/deanery"
        className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground lg:hidden"
      >
        {t(locale, 'deanery.backAll')}
      </Link>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* Левая панель только на десктопе; на мобильном список — на /deanery. */}
        <aside data-testid="deanery-chat-aside" className="hidden flex-col gap-3 lg:flex">
          <h2 className="text-base font-semibold">{t(locale, 'deanery.detail.title')}</h2>
          <TicketList tickets={page.tickets} variant="aside" locale={locale} />
          <NewTicketLink locale={locale} />
        </aside>

        <div className="min-w-0">
          <TicketChat chat={chat} locale={locale} />
          <TicketReplyForm ticketNumber={chat.ticket.number} locale={locale} />
        </div>
      </div>
    </section>
  );
}
