// DIG-70 — экран «Справка» (/guide, отдельный пункт меню рядом с
// «Вопросами и ответами»): детальный гайд «Как пользоваться кабинетом».
// GET-only, статический вымышленный контент из lib/help-content — слоя данных
// нет, owner-scope не нужен, IDOR-поверхности нет; доступ гарантирует
// requireUser каркаса кабинета (layout). Поиск и оглавление — клиентские
// (help-search.tsx), сама страница — серверный компонент.
import type { Metadata } from 'next';

import { HelpSearch } from '@/components/help/help-search';
import { GUIDE_HEADING, GUIDE_INTRO, GUIDE_SECTIONS } from '@/lib/help-content';

export const metadata: Metadata = { title: 'Справка — Цифровой деканат' };

export default function GuidePage() {
  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-6 md:py-8">
      <h1 className="text-xl font-bold sm:text-2xl">{GUIDE_HEADING}</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{GUIDE_INTRO}</p>

      <HelpSearch sections={GUIDE_SECTIONS} />
    </section>
  );
}
