'use client';

import Link from 'next/link';
import { Sparkles } from 'lucide-react';

// DIG-14: плавающая круглая кнопка AI на мобильном (<768), поднимается над
// таб-баром с учётом safe-area iPhone.
export function AiFab() {
  return (
    <Link
      href="/ai-assistant"
      aria-label="AI-ассистент"
      className="fixed right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 grid size-12 place-items-center rounded-full bg-coral-500 text-white shadow-lg shadow-coral-500/30 transition-colors hover:bg-coral-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral-600 md:hidden"
    >
      <Sparkles className="size-6" aria-hidden="true" />
    </Link>
  );
}
