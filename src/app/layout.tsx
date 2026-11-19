import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { ConceptBanner } from '@/components/concept-banner';
import { getLocale } from '@/lib/i18n/server';
import { getA11yPrefs } from '@/lib/a11y/server';
import { a11yClasses } from '@/lib/a11y';
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
  // DIG-16: база для абсолютных OG/Twitter-URL (канонический адрес — APP_URL
  // из .env.example; в dev/локальном старте — localhost).
  metadataBase: new URL(process.env.APP_URL ?? 'http://localhost:3000'),
  title: 'Цифровой деканат — личный кабинет студента',
  description:
    'Концепт для конкурса «Цифровой деканат будущего»: расписание, успеваемость, заявки и уведомления в одном кабинете. Все данные вымышленные.',
  // DIG-16 — превью ссылки (Open Graph 1200×630) и Twitter-карточка.
  openGraph: {
    title: 'Цифровой деканат — всё университетское в одном окне',
    description:
      'Концепт личного кабинета студента: расписание, оценки, заявки и справки с проверкой подлинности. Все данные вымышленные.',
    images: [
      {
        url: '/og.jpg',
        width: 1200,
        height: 630,
        alt: 'Цифровой деканат — личный кабинет студента, концепт для конкурса',
      },
    ],
    locale: 'ru_RU',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Цифровой деканат — всё университетское в одном окне',
    description:
      'Концепт личного кабинета студента: расписание, оценки, заявки и справки с проверкой подлинности. Все данные вымышленные.',
    images: ['/og.jpg'],
  },
};

// DIG-46 — экранная клавиатура не перекрывает поле ввода ассистента:
// страница «сжимается» (resizes-content) вместо прокрутки поверх клавиатуры.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  interactiveWidget: 'resizes-content',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // DIG-44: тема, размер шрифта и «уменьшить анимацию» применяются server-side
  // к <html> (до первой отрисовки) из настроек владельца сессии; аноним и
  // сотрудник получают значения по умолчанию. Системная тема — инлайн-скрипт.
  // DIG-69: локаль интерфейса из cookie (дефолт ru) — lang у <html> и плашка.
  // DIG-86: режим доступности «Крупный текст и без эффектов» — cookie du-a11y
  // (server action setA11y), классы a11y-large-text / a11y-no-effects на <html>.
  const appearance = await getAppliedAppearance();
  const locale = await getLocale();
  const a11yPrefs = await getA11yPrefs();
  const htmlClasses = [
    inter.variable,
    'antialiased',
    ...appearanceClasses(appearance),
    ...a11yClasses(a11yPrefs),
  ];

  return (
    <html lang={locale} className={htmlClasses.join(' ')}>
      <body className="antialiased">
        {appearance.theme === 'SYSTEM' && (
          <script dangerouslySetInnerHTML={{ __html: SYSTEM_THEME_SCRIPT }} />
        )}
        <ConceptBanner locale={locale} />
        {children}
      </body>
    </html>
  );
}
