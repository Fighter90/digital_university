// DIG-16 — PWA-манифест (file convention Next.js: <link rel="manifest">).
// Иконки 192/512 сгенерированы из public/brand/logo.svg (см. docs/ai-log/assets.md).
import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Цифровой деканат — личный кабинет студента',
    short_name: 'Деканат',
    description:
      'Концепт для конкурса «Цифровой деканат будущего»: расписание, успеваемость, заявки и уведомления в одном кабинете. Все данные вымышленные.',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#F7F7F7',
    theme_color: '#E7645A',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
