import { notFound } from 'next/navigation';
import { DesignGallery } from './gallery';

export const metadata = {
  title: 'Дизайн-система — Цифровой деканат',
};

// DIG-13: рендер строго по запросу. Без force-dynamic next build пытается
// статически пререндерить страницу, notFound() падает во время сбора данных
// ("Failed to collect page data") и сборка ломается.
export const dynamic = 'force-dynamic';

export default function DesignPage() {
  // DIG-13: галерея доступна только в dev-режиме; в production-сборке
  // NODE_ENV инлайнится в 'production' — страница статически отдаёт 404.
  if (process.env.NODE_ENV !== 'development') {
    notFound();
  }
  return <DesignGallery />;
}
