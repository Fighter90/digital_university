// DIG-38 — экран «Вопросы и ответы» (/help, Figma «11 · Вопросы и ответы»):
// база знаний с поиском, который находит. Статьи публичны и одинаковы для
// студента и сотрудника — owner-scoped данных нет, IDOR-поверхности нет;
// доступ гарантирует requireUser каркаса кабинета (layout). Поиск и фильтры
// клиентские, каталог — статический вымышленный контент из lib/faq-kb-catalog.
import type { Metadata } from 'next';

import { HelpBrowser } from '@/components/help/help-browser';

export const metadata: Metadata = { title: 'Вопросы и ответы — Цифровой деканат' };

export default function HelpPage() {
  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-6 md:py-8">
      <h1 className="text-xl font-bold sm:text-2xl">Вопросы и ответы</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        База знаний деканата: поиск понимает словоформы — стипендия, стипендии, стипендиальный
        найдут одно и то же.
      </p>

      <HelpBrowser />
    </section>
  );
}
