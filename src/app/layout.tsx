import type { Metadata } from 'next';
import { Onest } from 'next/font/google';
import { ConceptBanner } from '@/components/concept-banner';
import './globals.css';

<<<<<<< HEAD
// DIG-13: шрифт дизайн-системы — Onest (OFL), веса 400–800, латиница +
// кириллица. Переменная --font-onest маппится в --font-sans в globals.css.
// (Завершение DIG-13: тест design-tokens требовал подключение, а layout
// ещё держал Inter — цепочка --font-sans была разорвана на всех экранах.)
const onest = Onest({
  variable: '--font-onest',
=======
// DIG-13: шрифт Onest (OFL) — решение дизайн-системы, globals.css маппит
// --font-sans на переменную --font-onest. Латиница + кириллица, веса 400–800.
const onest = Onest({
  variable: '--font-onest',
  weight: ['400', '500', '600', '700', '800'],
>>>>>>> c2b7324 (feat(cabinet): profile + settings pages per Figma M-screens, auth session wiring — DIG-19 WIP)
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600', '700', '800'],
});

export const metadata: Metadata = {
  title: 'Цифровой деканат — личный кабинет студента',
  description:
    'Концепт для конкурса «Цифровой деканат будущего»: расписание, успеваемость, заявки и уведомления в одном кабинете. Все данные вымышленные.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className={onest.variable}>
      <body className="antialiased">
        <ConceptBanner />
        {children}
      </body>
    </html>
  );
}
