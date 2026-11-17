// DIG-40 — «Обратная связь руководству» (/feedback, Figma «18 ·
// Предложения»): понятный канал обратной связи вместо непонятного пункта
// «Выразительная кнопка» аудированного ЛК.
//
// Все данные из getFeedbackPage (owner-scoped по requireDataCtx): студент
// видит только СВОИ подписанные обращения; анонимных в списке нет — у них
// нет связи с аккаунтом (приёмка DIG-40). На десктопе (≥1024 px) — две
// панели (список + композер), на мобильном — колонкой. Ниже — публичная
// лента «Что мы изменили по вашим предложениям». Сотруднику раздел
// недоступен («Доступно студентам»).
import { requireDataCtx, getFeedbackPage } from '@/server/data';
import { dataDb } from '@/server/data/db';
import { FeedbackList } from '@/components/feedback/feedback-list';
import { FeedbackComposer } from '@/components/feedback/feedback-composer';
import { FeedbackOutcomes } from '@/components/feedback/feedback-outcomes';
import { FEEDBACK_OUTCOMES_TITLE, FEEDBACK_RESPONSE_PROMISE } from '@/lib/feedback';
import { EmptyState } from '@/components/ui/empty-state';
import { MessageSquareHeart } from 'lucide-react';

export default async function FeedbackPage() {
  const ctx = await requireDataCtx('/feedback');
  const page = await getFeedbackPage(dataDb, ctx);

  if (ctx.role === 'STAFF') {
    return (
      <section className="mx-auto w-full max-w-3xl px-4 py-8">
        <h1 className="mb-1 text-xl font-bold tracking-heading sm:text-2xl">
          Обратная связь руководству
        </h1>
        <EmptyState
          icon={MessageSquareHeart}
          title="Доступно студентам"
          description="Предложения, жалобы и благодарности руководству создаются в кабинете студента."
        />
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-6 md:py-8">
      <header>
        <h1 className="text-xl font-bold tracking-heading sm:text-2xl">
          Обратная связь руководству
        </h1>
        <p data-testid="feedback-sla" className="mt-1 text-sm text-muted-foreground">
          {FEEDBACK_RESPONSE_PROMISE}
        </p>
      </header>

      {/* Две панели на десктопе; на мобильном — список, затем композер. */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <FeedbackList items={page.items} />
        <FeedbackComposer />
      </div>

      {/* Публичная лента решённых предложений (без авторов). */}
      <FeedbackOutcomes title={FEEDBACK_OUTCOMES_TITLE} items={page.feed} />
    </section>
  );
}
