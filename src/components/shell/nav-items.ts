// DIG-14: навигация кабинета — единый источник истины для бокового меню,
// мобильного таб-бара и страницы «Ещё». Чистые данные без React-импортов,
// чтобы логика активного раздела была одинаковой в меню и в таб-баре.

export type CabinetSection = {
  href: string;
  label: string;
};

// Полное меню кабинета (десктоп ≥1024, иконочный рельс 768–1023).
export const CABINET_SECTIONS: CabinetSection[] = [
  { href: '/dashboard', label: 'Главная' },
  { href: '/schedule', label: 'Расписание' },
  { href: '/grades', label: 'Успеваемость' },
  { href: '/requests', label: 'Заявки и справки' },
  { href: '/notifications', label: 'Уведомления' },
  { href: '/deanery', label: 'Связь с деканатом' },
  { href: '/ai-assistant', label: 'AI-ассистент' },
  { href: '/profile', label: 'Профиль' },
];

// Нижний таб-бар (<768): Главная, Расписание, Оценки, Заявки, Ещё.
export const TAB_SECTIONS: CabinetSection[] = [
  { href: '/dashboard', label: 'Главная' },
  { href: '/schedule', label: 'Расписание' },
  { href: '/grades', label: 'Оценки' },
  { href: '/requests', label: 'Заявки' },
  { href: '/more', label: 'Ещё' },
];

// Разделы, доступные через «Ещё» на мобильном.
export const MORE_SECTIONS: CabinetSection[] = [
  { href: '/notifications', label: 'Уведомления' },
  { href: '/deanery', label: 'Связь с деканатом' },
  { href: '/ai-assistant', label: 'AI-ассистент' },
  { href: '/profile', label: 'Профиль' },
  { href: '/settings', label: 'Настройки' },
];

/**
 * Возвращает href активного раздела для pathname.
 * Совпадение по сегментам пути: `/schedule/week` → `/schedule`,
 * но `/schedule-extra` → null (без ложных срабатываний по префиксу).
 * При вложенности выбирается самый длинный (более конкретный) href.
 */
export function resolveActiveSection(
  pathname: string,
  sections: readonly CabinetSection[],
): string | null {
  let match: string | null = null;
  for (const { href } of sections) {
    const hits = pathname === href || pathname.startsWith(`${href}/`);
    if (hits && (match === null || href.length > match.length)) {
      match = href;
    }
  }
  return match;
}

/**
 * Активная вкладка таб-бара. Разделы из «Ещё» (и сама /more)
 * подсвечивают вкладку «Ещё», чтобы меню и таб-бар не расходились.
 */
export function resolveActiveTab(pathname: string): string | null {
  const direct = resolveActiveSection(
    pathname,
    TAB_SECTIONS.filter((t) => t.href !== '/more'),
  );
  if (direct) return direct;
  if (pathname === '/more' || resolveActiveSection(pathname, MORE_SECTIONS)) {
    return '/more';
  }
  return null;
}
