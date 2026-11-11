import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ConceptBanner } from '@/components/concept-banner';
import './globals.css';

// Правило проекта: шрифт Inter, как в макетах Figma (латиница + кириллица).
const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin', 'cyrillic'],
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
    <html lang="ru" className={inter.variable}>
      <body className="antialiased">
        <ConceptBanner />
        {children}
      </body>
    </html>
  );
}
