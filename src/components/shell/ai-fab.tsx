'use client';

import { Sparkles } from 'lucide-react';
import { t, type Locale } from '@/lib/i18n';

// DIG-72: плавающая круглая кнопка AI в правом нижнем углу всех страниц
// кабинета (на мобильном поднята над таб-баром с учётом safe-area iPhone,
// на десктопе — с отступом от края, чтобы не мешать контенту). Открывает
// попап-чат ассистента (RAG по справке + OpenRouter). Полноэкранный
// раздел с карточками DIG-46 — /ai-assistant и кнопка AI в шапке.
// DIG-93 — aria-подпись по локали.
export function AiFab({ onOpen, locale = 'ru' }: { onOpen: () => void; locale?: Locale }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={t(locale, 'menu.aiAssistant')}
      aria-haspopup="dialog"
      className="fixed right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 grid size-12 place-items-center rounded-full bg-coral-500 text-white shadow-lg shadow-coral-500/30 transition-colors hover:bg-coral-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral-600 md:right-6 md:bottom-6"
    >
      <Sparkles className="size-6" aria-hidden="true" />
    </button>
  );
}
