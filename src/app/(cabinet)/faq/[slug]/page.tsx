// DIG-46 — статья базы знаний FAQ ассистента: /faq/<slug>.
//
// Каталог — src/lib/faq-catalog.ts (статичный, вымышленный контент);
// неизвестный слаг — единый 404 через notFound(). Полный экран «Вопросы
// и ответы» с поиском — DIG-38 и расширит каталог. NOTE: без loading.tsx
// в этом сегменте — Suspense стримил бы оболочку с HTTP 200 до
// срабатывания notFound() (контракт единого 404).
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { findFaqArticle } from '@/lib/faq-catalog';

export const metadata = { title: 'Вопросы и ответы — Цифровой деканат' };

// NOTE: только default-export — Next.js 15 отклоняет лишние именованные
// экспорты файла страницы («not a valid Page export field»).
export default async function FaqArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = findFaqArticle(slug);
  if (!article) notFound();

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 md:py-8">
      <Link
        href="/ai-assistant"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        AI-ассистент
      </Link>

      <article data-testid="faq-article" className="flex flex-col gap-4">
        <header>
          <p className="text-xs font-semibold uppercase tracking-heading text-muted-foreground">
            Вопросы и ответы · {article.category}
          </p>
          <h1 className="mt-1 text-xl font-extrabold tracking-heading text-foreground sm:text-2xl">
            {article.title}
          </h1>
        </header>

        <div className="rounded-card border border-border bg-card p-5 shadow-soft md:p-6">
          <h2 className="text-base font-bold text-foreground">{article.question}</h2>
          <p className="mt-2 text-sm leading-relaxed text-foreground-muted">{article.answer}</p>
          {article.steps && article.steps.length > 0 ? (
            <ol className="mt-4 flex flex-col gap-2.5" data-testid="faq-steps">
              {article.steps.map((step, index) => (
                <li key={step} className="flex items-start gap-3 text-sm leading-relaxed">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-pill bg-accent-soft text-xs font-bold text-accent-ink"
                  >
                    {index + 1}
                  </span>
                  <span className="text-foreground-muted">{step}</span>
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      </article>
    </section>
  );
}
