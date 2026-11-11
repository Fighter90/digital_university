import { notFound } from 'next/navigation';
import { DesignGallery } from './gallery';

export const metadata = {
  title: 'Дизайн-система — Цифровой деканат',
};

export default function DesignPage() {
  // DIG-13: галерея доступна только в dev-режиме; в production-сборке
  // NODE_ENV инлайнится в 'production' — страница статически отдаёт 404.
  if (process.env.NODE_ENV !== 'development') {
    notFound();
  }
  return <DesignGallery />;
}
