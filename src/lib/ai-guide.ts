// DIG-62 — AI-гид по кабинету: чистый модуль без серверных импортов
// (импортируется и клиентским компонентом, и unit-тестами).
//
// Тренд Product Hunt: AI-агент ведёт пользователя по продукту. Здесь это
// детерминированный прототип без сети и LLM: фиксированные шаги экскурсии
// и сценарии-подсказки с матчингом по ключевым словам. Данные вымышленные,
// серверных мутаций нет — только навигация по существующим экранам.

/** Ключ localStorage: гид показан/отключён и не мешает повторным входам. */
export const GUIDE_STORAGE_KEY = 'ai-guide:seen';

/** Один шаг экскурсии: раздел кабинета и его польза одной строкой. */
export interface AiGuideTourStep {
  id: string;
  title: string;
  description: string;
  /** Внутренняя ссылка кабинета — кнопка шага ведёт сюда. */
  href: string;
}

/** Порядок экскурсии из задачи: расписание → оценки → заявки → справки. */
export const TOUR_STEPS: AiGuideTourStep[] = [
  {
    id: 'schedule',
    title: 'Расписание',
    description: 'Пары на неделю, переносы и отмена — видно сразу, без бумажек.',
    href: '/schedule',
  },
  {
    id: 'grades',
    title: 'Оценки',
    description: 'Текущий балл по дисциплинам, рейтинг и GPA в одном месте.',
    href: '/grades',
  },
  {
    id: 'requests',
    title: 'Заявки',
    description: 'Заявления и справки подаются онлайн — статус виден в кабинете.',
    href: '/requests',
  },
  {
    id: 'services',
    title: 'Справки',
    description: 'Каталог справок и выписок: срок готовности и заказ в два клика.',
    href: '/services',
  },
];

/** Ответ гида на сценарий: короткий текст + кнопка-ссылка на нужный экран. */
export interface AiGuideScenario {
  id: string;
  /** Вопрос, который гид показывает чипом-подсказкой. */
  question: string;
  /** Ключевые слова (корни) для матчинга свободного вопроса. */
  keywords: string[];
  answer: string;
  cta: { label: string; href: string };
}

export const GUIDE_SCENARIOS: AiGuideScenario[] = [
  {
    id: 'certificates',
    question: 'Где мои справки?',
    keywords: ['справк', 'выписк', 'документ'],
    answer:
      'Справки и выписки живут в каталоге сервисов: срок готовности указан на каждой карточке, заказ — в два клика.',
    cta: { label: 'Открыть: Справки', href: '/services' },
  },
  {
    id: 'retake-signup',
    question: 'Как записаться на пересдачу?',
    keywords: ['пересдач', 'пересдать'],
    answer:
      'Запись — на экране «Сессия»: в разделе «Пересдачи» выберите дату и нажмите «Записаться», заявка создаётся автоматически.',
    cta: { label: 'Открыть: Пересдачи', href: '/grades/session' },
  },
];

// ── DIG-93 — EN-слой гида: шаги экскурсии и сценарии по локали ───────────────
// RU-данные выше — канон; EN-варианты по тем же id, чтобы гид на английской
// версии не показывал кириллицу (пилюля, панель, чипы-подсказки).

const TOUR_STEPS_EN: AiGuideTourStep[] = [
  {
    id: 'schedule',
    title: 'Schedule',
    description: 'Classes for the week, reschedules and cancellations — visible at once, no paperwork.',
    href: '/schedule',
  },
  {
    id: 'grades',
    title: 'Grades',
    description: 'The current score per discipline, the group ranking and GPA in one place.',
    href: '/grades',
  },
  {
    id: 'requests',
    title: 'Requests',
    description: 'Applications and certificates are submitted online — the status lives in the cabinet.',
    href: '/requests',
  },
  {
    id: 'services',
    title: 'Certificates',
    description: 'The catalog of certificates and extracts: lead time on every card, ordering in two clicks.',
    href: '/services',
  },
];

const GUIDE_SCENARIOS_EN: AiGuideScenario[] = [
  {
    id: 'certificates',
    question: 'Where are my certificates?',
    keywords: ['certificat', 'extract', 'document'],
    answer:
      'Certificates and extracts live in the services catalog: the lead time is on every card, ordering takes two clicks.',
    cta: { label: 'Open: Certificates', href: '/services' },
  },
  {
    id: 'retake-signup',
    question: 'How do I sign up for a retake?',
    keywords: ['retake', 'resit'],
    answer:
      'Sign-up is on the “Exam session” screen: pick a date in the “Retakes” section and press “Sign up” — the request is created automatically.',
    cta: { label: 'Open: Retakes', href: '/grades/session' },
  },
];

/** Шаги экскурсии по локали (RU — канон, EN — словарь по тем же id). */
export function guideTourSteps(locale: 'ru' | 'en'): AiGuideTourStep[] {
  return locale === 'en' ? TOUR_STEPS_EN : TOUR_STEPS;
}

/** Сценарии-подсказки по локали (RU — канон, EN — словарь по тем же id). */
export function guideScenarios(locale: 'ru' | 'en'): AiGuideScenario[] {
  return locale === 'en' ? GUIDE_SCENARIOS_EN : GUIDE_SCENARIOS;
}

/** Нормализация вопроса: нижний регистр, схлопнутые пробелы. */
export function normalizeGuideQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Свободный вопрос → первый совпавший сценарий по ключевым словам
 * (корень слова — подстрока нормализованного вопроса). Пустой вопрос и
 * вопросы без совпадений — null: гид не выдумывает ответ.
 * DIG-93 — на EN матчинг идёт по EN-сценариям и EN-ключам.
 */
export function matchAiGuideScenario(query: string, locale: 'ru' | 'en' = 'ru'): AiGuideScenario | null {
  const q = normalizeGuideQuery(query);
  if (q === '') return null;
  return (
    guideScenarios(locale).find((scenario) => scenario.keywords.some((keyword) => q.includes(keyword))) ??
    null
  );
}

/** Считан ли флаг «гид уже показан/отключён» (SSR-safe: на сервере false). */
export function isGuideSeen(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(GUIDE_STORAGE_KEY) === '1';
  } catch {
    // Приватный режим/запрет хранилища: считаем, что гид уже показан —
    // панель без «памяти» открывалась бы на каждом входе и мешала бы.
    return true;
  }
}

/** Записать флаг «гид показан/отключён» (SSR-safe, сбой хранилища — тихо). */
export function markGuideSeen(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(GUIDE_STORAGE_KEY, '1');
  } catch {
    // Хранилище недоступно — гид будет предлагаться снова, это не ошибка.
  }
}
