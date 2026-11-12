// DIG-29 — вымышленный каталог сервисов кабинета (чистый модуль без
// серверных импортов: работает и на сервере, и в клиентском поиске).
//
// Проблемы аудированного каталога, которые решает контракт:
//  - 12 вкладок → 6 категорий пилюлями (CATEGORY_LABELS);
//  - студенту рекомендовали «Личный кабинет абитуриента» → сервисы чужих
//    ролей присутствуют в данных, но servicesForRole('STUDENT') их
//    отфильтровывает (см. tests/services-catalog.test.ts);
//  - дубли «Популярного» и «Рекомендуем» → одна подборка picksForCourse,
//    из которой слой данных убирает избранное;
//  - «зоопарк внешних систем» → все ссылки внутренние («Заказать» — вход
//    в поток заявок, «Открыть» — страница кабинета);
//  - опечатки («Мои зачетная книжка») → QA-тест: «ёлочки», en-dash, ё.

export type ServiceRole = 'STUDENT' | 'APPLICANT' | 'STAFF';

export type ServiceCategory =
  'CERTIFICATES' | 'STATEMENTS' | 'STUDY' | 'FINANCE' | 'DORMITORY' | 'HELP';

export type ServiceEta = 'INSTANT' | 'DAYS_1' | 'DAYS_2_3' | 'DAYS_5';

export type ServiceFormat = 'PDF' | 'PAPER';

export type ServiceAction = 'ORDER' | 'OPEN';

export interface ServiceEntry {
  /** Стабильный id (в URL заказа, избранном и testid). */
  id: string;
  title: string;
  /** Одна строка пользы — без точки в конце. */
  benefit: string;
  category: ServiceCategory;
  eta: ServiceEta;
  /** Документ на выходе; null — услуга без документа («Открыть»). */
  format: ServiceFormat | null;
  action: ServiceAction;
  /** Всегда внутренняя ссылка кабинета (/…). */
  href: string;
  /** Кому доступен сервис; студент видит только записи с STUDENT. */
  audiences: ServiceRole[];
  /** Курсы, на которых сервис «часто нужен» (подборка «Часто нужно»). */
  picks?: number[];
}

export const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  CERTIFICATES: 'Справки',
  STATEMENTS: 'Заявления',
  STUDY: 'Учёба',
  FINANCE: 'Финансы и стипендии',
  DORMITORY: 'Общежитие',
  HELP: 'Помощь',
};

export const ETA_LABELS: Record<ServiceEta, string> = {
  INSTANT: 'Мгновенно',
  DAYS_1: '1 день',
  DAYS_2_3: '2–3 дня',
  DAYS_5: 'до 5 дней',
};

export const FORMAT_LABELS: Record<ServiceFormat, string> = {
  PDF: 'PDF',
  PAPER: 'Бумажная',
};

/** Лимит закреплённых сервисов в избранном (по задаче — до 6). */
export const MAX_FAVORITES = 6;

// Порядок записей = порядок в каталоге и в подборках курса.
export const SERVICES: ServiceEntry[] = [
  // ── Справки ─────────────────────────────────────────────────────────────
  {
    id: 'cert-enrollment',
    title: 'Справка об обучении',
    benefit: 'Для банка, визы и работы',
    category: 'CERTIFICATES',
    eta: 'DAYS_2_3',
    format: 'PDF',
    action: 'ORDER',
    href: '/requests?order=cert-enrollment',
    audiences: ['STUDENT'],
    picks: [2, 3],
  },
  {
    id: 'cert-grades',
    title: 'Справка с оценками',
    benefit: 'Официальный список оценок за сессию',
    category: 'CERTIFICATES',
    eta: 'DAYS_2_3',
    format: 'PDF',
    action: 'ORDER',
    href: '/requests?order=cert-grades',
    audiences: ['STUDENT'],
    picks: [1],
  },
  {
    id: 'cert-tax',
    title: 'Справка для налогового вычета',
    benefit: 'Родителям — для вычета НДФЛ',
    category: 'CERTIFICATES',
    eta: 'DAYS_5',
    format: 'PDF',
    action: 'ORDER',
    href: '/requests?order=cert-tax',
    audiences: ['STUDENT'],
    picks: [1, 2],
  },
  {
    id: 'cert-defer',
    title: 'Справка для отсрочки от армии',
    benefit: 'Для военкомата по месту учёбы',
    category: 'CERTIFICATES',
    eta: 'DAYS_1',
    format: 'PDF',
    action: 'ORDER',
    href: '/requests?order=cert-defer',
    audiences: ['STUDENT'],
    picks: [1],
  },
  {
    id: 'transcript-instant',
    title: 'Выписка из зачётной книжки',
    benefit: 'Все оценки сразу, без заявки',
    category: 'CERTIFICATES',
    eta: 'INSTANT',
    format: 'PDF',
    action: 'OPEN',
    href: '/grades/gradebook',
    audiences: ['STUDENT'],
    picks: [2, 3],
  },

  // ── Заявления ───────────────────────────────────────────────────────────
  {
    id: 'stmt-individual-plan',
    title: 'Индивидуальный учебный план',
    benefit: 'Своя траектория дисциплин',
    category: 'STATEMENTS',
    eta: 'DAYS_2_3',
    format: 'PAPER',
    action: 'ORDER',
    href: '/requests?order=stmt-individual-plan',
    audiences: ['STUDENT'],
    picks: [2],
  },
  {
    id: 'stmt-academic-leave',
    title: 'Академический отпуск',
    benefit: 'Перерыв в учёбе до одного года',
    category: 'STATEMENTS',
    eta: 'DAYS_5',
    format: 'PAPER',
    action: 'ORDER',
    href: '/requests?order=stmt-academic-leave',
    audiences: ['STUDENT'],
  },
  {
    id: 'stmt-transfer',
    title: 'Перевод на другую программу',
    benefit: 'Смена программы или формы обучения',
    category: 'STATEMENTS',
    eta: 'DAYS_5',
    format: 'PAPER',
    action: 'ORDER',
    href: '/requests?order=stmt-transfer',
    audiences: ['STUDENT'],
  },

  // ── Учёба ────────────────────────────────────────────────────────────────
  {
    id: 'study-duplicate-gradebook',
    title: 'Дубликат зачётной книжки',
    benefit: 'При утере или износе книжки',
    category: 'STUDY',
    eta: 'DAYS_5',
    format: 'PAPER',
    action: 'ORDER',
    href: '/requests?order=study-duplicate-gradebook',
    audiences: ['STUDENT'],
  },
  {
    id: 'study-schedule',
    title: 'Расписание занятий',
    benefit: 'Пары и изменения на неделю',
    category: 'STUDY',
    eta: 'INSTANT',
    format: null,
    action: 'OPEN',
    href: '/schedule',
    audiences: ['STUDENT'],
  },
  {
    id: 'study-performance',
    title: 'Успеваемость и GPA',
    benefit: 'Оценки, рейтинг и долги',
    category: 'STUDY',
    eta: 'INSTANT',
    format: null,
    action: 'OPEN',
    href: '/grades',
    audiences: ['STUDENT'],
  },

  // ── Финансы и стипендии ─────────────────────────────────────────────────
  {
    id: 'fin-scholarship-cert',
    title: 'Справка о стипендии',
    benefit: 'Для банка и социальных служб',
    category: 'FINANCE',
    eta: 'DAYS_2_3',
    format: 'PDF',
    action: 'ORDER',
    href: '/requests?order=fin-scholarship-cert',
    audiences: ['STUDENT'],
    picks: [1],
  },
  {
    id: 'fin-tuition-cert',
    title: 'Справка о стоимости обучения',
    benefit: 'Суммы и график платежей по договору',
    category: 'FINANCE',
    eta: 'DAYS_2_3',
    format: 'PDF',
    action: 'ORDER',
    href: '/requests?order=fin-tuition-cert',
    audiences: ['STUDENT'],
  },

  // ── Общежитие ───────────────────────────────────────────────────────────
  {
    id: 'dorm-residence-cert',
    title: 'Справка о проживании',
    benefit: 'Для визы, льгот и банка',
    category: 'DORMITORY',
    eta: 'DAYS_2_3',
    format: 'PDF',
    action: 'ORDER',
    href: '/requests?order=dorm-residence-cert',
    audiences: ['STUDENT'],
  },
  {
    id: 'dorm-checkin',
    title: 'Заселение в общежитие',
    benefit: 'Заявление на место в общежитии',
    category: 'DORMITORY',
    eta: 'DAYS_5',
    format: 'PAPER',
    action: 'ORDER',
    href: '/requests?order=dorm-checkin',
    audiences: ['STUDENT'],
    picks: [1],
  },

  // ── Помощь ──────────────────────────────────────────────────────────────
  {
    id: 'help-deanery',
    title: 'Вопрос деканату',
    benefit: 'Ответ в течение рабочего дня',
    category: 'HELP',
    eta: 'INSTANT',
    format: null,
    action: 'OPEN',
    href: '/deanery',
    audiences: ['STUDENT'],
  },
  {
    id: 'help-ai',
    title: 'AI-ассистент',
    benefit: 'Подскажет, как заказать документ',
    category: 'HELP',
    eta: 'INSTANT',
    format: null,
    action: 'OPEN',
    href: '/ai-assistant',
    audiences: ['STUDENT'],
  },

  // ── Чужие роли: в данных есть, студенту не показываются ────────────────
  {
    id: 'app-personal-cabinet',
    title: 'Личный кабинет абитуриента',
    benefit: 'Статус документов и конкурсные списки',
    category: 'HELP',
    eta: 'INSTANT',
    format: null,
    action: 'OPEN',
    href: '/services',
    audiences: ['APPLICANT'],
  },
  {
    id: 'staff-schedule-editor',
    title: 'Редактор расписания',
    benefit: 'Изменение пар и аудиторий',
    category: 'STUDY',
    eta: 'INSTANT',
    format: null,
    action: 'OPEN',
    href: '/schedule',
    audiences: ['STAFF'],
  },
];

/** Только сервисы роли: студенту не показывается ни одна чужая запись. */
export function servicesForRole(role: ServiceRole): ServiceEntry[] {
  return SERVICES.filter((service) => service.audiences.includes(role));
}

/** Сервис по id или null (вне каталога). */
export function findService(id: string): ServiceEntry | null {
  return SERVICES.find((service) => service.id === id) ?? null;
}

/** Подборка «Часто нужно на N курсе»: детерминирована курсом, без дублей. */
export function picksForCourse(course: number): ServiceEntry[] {
  const picks = servicesForRole('STUDENT').filter((s) => s.picks?.includes(course));
  const seen = new Set<string>();
  const unique: ServiceEntry[] = [];
  for (const service of picks) {
    if (!seen.has(service.id)) {
      seen.add(service.id);
      unique.push(service);
    }
  }
  return unique;
}

/** Нормализация запроса: нижний регистр, схлопнутые пробелы. */
export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Поиск по названию, строке пользы и метке категории; пустой запрос — всё. */
export function matchService(service: ServiceEntry, query: string): boolean {
  const q = normalizeQuery(query);
  if (q === '') return true;
  const haystacks = [
    service.title.toLowerCase(),
    service.benefit.toLowerCase(),
    CATEGORY_LABELS[service.category].toLowerCase(),
  ];
  return haystacks.some((text) => text.includes(q));
}

export interface HighlightChunk {
  text: string;
  hit: boolean;
}

/**
 * Разбивает текст на куски для подсветки совпадений (`<mark>`): без учёта
 * регистра, все вхождения; пустой запрос или без совпадений — один кусок.
 */
export function splitHighlight(text: string, query: string): HighlightChunk[] {
  const q = normalizeQuery(query);
  if (q === '') return [{ text, hit: false }];
  const lower = text.toLowerCase();
  const chunks: HighlightChunk[] = [];
  let cursor = 0;
  while (true) {
    const at = lower.indexOf(q, cursor);
    if (at === -1) break;
    if (at > cursor) chunks.push({ text: text.slice(cursor, at), hit: false });
    chunks.push({ text: text.slice(at, at + q.length), hit: true });
    cursor = at + q.length;
  }
  if (chunks.length === 0) return [{ text, hit: false }];
  if (cursor < text.length) chunks.push({ text: text.slice(cursor), hit: false });
  return chunks;
}
