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
  { href: '/finance', label: 'Финансы' },
  { href: '/requests', label: 'Заявки и справки' },
  { href: '/notifications', label: 'Уведомления' },
  { href: '/deanery', label: 'Связь с деканатом' },
  // DIG-40 — понятный канал обратной связи руководству (в аудированном ЛК
  // он назывался «Выразительная кнопка» — из меню неясно, что за ним стоит).
  { href: '/feedback', label: 'Обратная связь' },
  { href: '/help', label: 'Вопросы и ответы' },
  // DIG-70 — «Справка»: детальный гайд «Как пользоваться кабинетом»
  // (отдельный пункт меню, /guide; FAQ остаётся на /help).
  { href: '/guide', label: 'Справка' },
  // DIG-68 — каталог студенческих стартапов «МСП» (/msp).
  { href: '/msp', label: 'МСП' },
  // DIG-42 — «Дополнительное образование» (/dpo): каталог, мои программы, документы.
  { href: '/dpo', label: 'Доп. образование' },
  { href: '/people', label: 'Справочник' },
  { href: '/ai-assistant', label: 'AI-ассистент' },
  // DIG-99 — «MCP-сервер»: заметный вход на страницу документации /mcp
  // и в полном меню (DIG-73 добавил пункт только в мобильное «Ещё»).
  // Подпись — существующий ключ словаря menu.mcp; иконка Plug (nav-icons).
  { href: '/mcp', label: 'Подключить ассистента (MCP)' },
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

// Разделы «Ещё» на мобильном. DIG-34 — «Задачи» первой: экран /tasks
// не входит в нижний таб-бар. DIG-48 — разделы кабинета СОТРУДНИКА деканата
// (роль STAFF): меню и таб-бар строятся по роли сессии, URL /staff студенту
// недоступен (middleware 403).
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

// DIG-70 — «Справка» в «Ещё»: /tasks не входит в нижний таб-бар, остальные —
// второстепенные разделы кабинета. «Справка» рядом с «Вопросами и ответами»:
// FAQ отвечает точечно, гайд — последовательно.

// Разделы, доступные через «Ещё» на мобильном. DIG-34 — «Задачи» первой:
// экран /tasks не входит в нижний таб-бар. DIG-41 — «Финансы» сразу после
// задач (деньги и сроки — actionable-разделы).
export const MORE_SECTIONS: CabinetSection[] = [
  { href: '/tasks', label: 'Задачи' },
  { href: '/finance', label: 'Финансы' },
  { href: '/notifications', label: 'Уведомления' },
  { href: '/deanery', label: 'Связь с деканатом' },
  // DIG-40 — канал обратной связи руководству (см. комментарий выше).
  { href: '/feedback', label: 'Обратная связь' },
  { href: '/help', label: 'Вопросы и ответы' },
  // DIG-70 — детальный гайд «Как пользоваться кабинетом» (экран /guide).
  { href: '/guide', label: 'Справка' },
  // DIG-68 — каталог студенческих стартапов «МСП» (/msp).
  { href: '/msp', label: 'МСП' },
  // DIG-43 — афиша мероприятий вуза и запись (/events).
  { href: '/events', label: 'Мероприятия' }, // DIG-42 — «Дополнительное образование» (/dpo).
  { href: '/dpo', label: 'Доп. образование' },
  { href: '/people', label: 'Справочник' },
  { href: '/ai-assistant', label: 'AI-ассистент' },
  // DIG-73 — документация MCP: заметный вход на страницу-инструкцию /mcp.
  { href: '/mcp', label: 'Подключить ассистента (MCP)' },
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
