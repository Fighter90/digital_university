import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ConceptBanner } from '@/components/concept-banner';
import {
  appearanceClasses,
  getAppliedAppearance,
  SYSTEM_THEME_SCRIPT,
} from '@/server/data/appearance';
import './globals.css';
import './themes/dark.css';

// RC redesign + макеты Figma: Inter (OFL). Веса 400–800, латиница + кириллица.
const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600', '700', '800'],
});

export const metadata: Metadata = {
  title: 'Цифровой деканат — личный кабинет студента',
  description:
    'Концепт для конкурса «Цифровой деканат будущего»: расписание, успеваемость, заявки и уведомления в одном кабинете. Все данные вымышленные.',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // DIG-44: тема, размер шрифта и «уменьшить анимацию» применяются server-side
  // к <html> (до первой отрисовки) из настроек владельца сессии; аноним и
  // сотрудник получают значения по умолчанию. Системная тема — инлайн-скрипт.
  const appearance = await getAppliedAppearance();
  const htmlClasses = [inter.variable, 'antialiased', ...appearanceClasses(appearance)];

  return (
    <html lang="ru" className={htmlClasses.join(' ')}>
      <body className="antialiased">
        {appearance.theme === 'SYSTEM' && (
          <script dangerouslySetInnerHTML={{ __html: SYSTEM_THEME_SCRIPT }} />
        )}
        <ConceptBanner />
        {children}
      </body>
    </html>
  );
}
