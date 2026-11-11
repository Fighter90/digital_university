import { notFound } from 'next/navigation';
import { DesignGallery } from './gallery';

// DIG-13: галерея дизайн-системы доступна только в dev-режиме.
// В production-сборке NODE_ENV инлайнится в 'production' — страница отдаёт 404.
if (process.env.NODE_ENV !== 'development') {
  notFound();
}

export const metadata = {
  title: 'Дизайн-система — Цифровой деканат',
};

export default function DesignPage() {
  return <DesignGallery />;
}
