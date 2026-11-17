// DIG-14: навигация кабинета — единый источник истины для бокового меню,
// мобильного таб-бара и страницы «Ещё». Чистые данные без React-импортов,
// чтобы логика активного раздела была одинаковой в меню и в таб-баре.

export type CabinetSection = {
  href: string;
  label: string;
};

// Полное меню кабинета (десктоп ≥1024, иконочный рельс 768–1023).
// DIG-34 — «Задачи» сразу после «Главной»: задачник — actionable-инбокс.
export const CABINET_SECTIONS: CabinetSection[] = [
  { href: '/dashboard', label: 'Главная' },
  { href: '/tasks', label: 'Задачи' },
  { href: '/schedule', label: 'Расписание' },
  { href: '/grades', label: 'Успеваемость' },
  { href: '/requests', label: 'Заявки и справки' },
  { href: '/notifications', label: 'Уведомления' },
  { href: '/deanery', label: 'Связь с деканатом' },
  // DIG-40 — понятный канал обратной связи руководству (в аудированном ЛК
  // он назывался «Выразительная кнопка» — из меню неясно, что за ним стоит).
  { href: '/feedback', label: 'Обратная связь' },
  { href: '/help', label: 'Вопросы и ответы' },
  { href: '/people', label: 'Справочник' },
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

// Разделы, доступные через «Ещё» на мобильном. DIG-34 — «Задачи» первой:
// экран /tasks не входит в нижний таб-бар.// DIG-48 — разделы кабинета СОТРУДНИКА деканата (роль STAFF): меню и таб-бар
// строятся по роли сессии, URL /staff студенту недоступен (middleware 403).
export const STAFF_SECTIONS: CabinetSection[] = [
  { href: '/staff', label: 'Сводка' },
  { href: '/staff/requests', label: 'Заявки' },
  { href: '/staff/appeals', label: 'Обращения' },
  { href: '/staff/announcements', label: 'Объявления' },
];

/** Меню по роли сессии: сотруднику — его разделы, студенту — кабинет. */
export function sectionsForRole(role: 'STUDENT' | 'STAFF'): CabinetSection[] {
  return role === 'STAFF' ? STAFF_SECTIONS : CABINET_SECTIONS;
}

/** Таб-бар по роли сессии (у сотрудника все разделы помещаются в четыре вкладки). */
export function tabsForRole(role: 'STUDENT' | 'STAFF'): CabinetSection[] {
  return role === 'STAFF' ? STAFF_SECTIONS : TAB_SECTIONS;
}

// Разделы, доступные через «Ещё» на мобильном.
export const MORE_SECTIONS: CabinetSection[] = [
  { href: '/tasks', label: 'Задачи' },
  { href: '/notifications', label: 'Уведомления' },
  { href: '/deanery', label: 'Связь с деканатом' },
  // DIG-40 — канал обратной связи руководству (см. комментарий выше).
  { href: '/feedback', label: 'Обратная связь' },
  { href: '/help', label: 'Вопросы и ответы' },
  { href: '/people', label: 'Справочник' },
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
 * DIG-48: у сотрудника вкладки — его разделы (/staff*), «Ещё» нет.
 */
export function resolveActiveTab(
  pathname: string,
  role: 'STUDENT' | 'STAFF' = 'STUDENT',
): string | null {
  const tabs = tabsForRole(role);
  const direct = resolveActiveSection(
    pathname,
    tabs.filter((t) => t.href !== '/more'),
  );
  if (direct) return direct;
  if (role === 'STAFF') return null;
  if (pathname === '/more' || resolveActiveSection(pathname, MORE_SECTIONS)) {
    return '/more';
  }
  return null;
}
