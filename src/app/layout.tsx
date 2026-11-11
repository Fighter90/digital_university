import type { Metadata } from 'next';
import { Onest } from 'next/font/google';
import { ConceptBanner } from '@/components/concept-banner';
import './globals.css';

// DIG-13: интерфейсный шрифт Onest (лицензия OFL), веса 400–800,
// латиница + кириллица. Airbnb Cereal из референса не используется — лицензия
// не позволяет (см. AGENTS.md / THIRD_PARTY_LICENSES.md).
const onest = Onest({
  variable: '--font-onest',
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
      {/* переменная шрифта на <html>: html { font-sans } видит --font-onest */}
      <body className="antialiased">
        <ConceptBanner />
        {children}
      </body>
    </html>
  );
}
