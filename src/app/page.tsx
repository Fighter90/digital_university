// DIG-57/74 — публичный лендинг на «/»: hero «Всё университетское — в одном окне»,
// 5 карточек преимуществ, финальный CTA и футер. Открывается без авторизации,
// все CTA ведут на /login (демо-аккаунты подсказаны чипами на экране входа).
// Дизайн-токены DIG-13 (Inter, палитра, радиусы, тени, градиент бренда),
// анимации — Reveal (IntersectionObserver) + animate-float, без внешних
// зависимостей. Плашка «Концепт для конкурса» — из корневого layout.
// DIG-74 — локализация RU/EN: локаль из cookie du-locale (RU по умолчанию),
// переключатель LocaleSwitch в шапке лендинга.
import type { CSSProperties } from 'react';
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { cookies } from 'next/headers';
import {
  ArrowRight,
  Award,
  Bot,
  CalendarDays,
  CheckCircle2,
  FileText,
  GraduationCap,
  QrCode,
  Sparkles,
} from 'lucide-react';
import { Reveal } from '@/components/landing/reveal';
import { LocaleSwitch } from '@/components/shell/locale-switch';
import { LandingContent } from '@/components/landing/landing-content';
import type { Locale } from '@/lib/i18n';

async function getLandingLocale(): Promise<Locale> {
  const store = await cookies();
  return store.get('du-locale')?.value === 'en' ? 'en' : 'ru';
}

export const metadata = {
  title: 'Цифровой деканат — всё университетское в одном окне',
};

export default async function LandingPage() {
  const locale = await getLandingLocale();
  return <LandingContent locale={locale} />;
}
