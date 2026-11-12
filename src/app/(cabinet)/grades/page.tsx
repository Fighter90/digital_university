// DIG-26/DIG-27 — раздел «Оценки». Вёрстку экрана «Успеваемость» (Figma
// «05») делает задача DIG-26; чтобы зачётка была достижима уже сейчас,
// заглушка несёт кнопку «Перейти в зачётную книжку» (кнопка из аналога
// аудированного ЛК) и прямую ссылку на карточку дисциплины-примера нет —
// список дисциплин живёт внутри зачётки.
import Link from 'next/link';
import { ArrowRight, BookOpenText } from 'lucide-react';

import { PagePlaceholder } from '@/components/page-placeholder';

export const metadata = { title: 'Успеваемость — Цифровой деканат' };

export default function GradesPage() {
  return (
    <PagePlaceholder
      title="Успеваемость"
      description="Оценки, зачётка и прогресс по дисциплинам появятся здесь."
    >
      <Link
        href="/grades/gradebook"
        data-testid="gradebook-link"
        className="mt-4 inline-flex select-none items-center gap-2 rounded-button bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-neutral-700"
      >
        <BookOpenText aria-hidden="true" className="size-4" />
        Перейти в зачётную книжку
        <ArrowRight aria-hidden="true" className="size-4" />
      </Link>
    </PagePlaceholder>
  );
}
