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

/** Нормализация вопроса: нижний регистр, схлопнутые пробелы. */
export function normalizeGuideQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Свободный вопрос → первый совпавший сценарий по ключевым словам
 * (корень слова — подстрока нормализованного вопроса). Пустой вопрос и
 * вопросы без совпадений — null: гид не выдумывает ответ.
 */
export function matchAiGuideScenario(query: string): AiGuideScenario | null {
  const q = normalizeGuideQuery(query);
  if (q === '') return null;
  return (
    GUIDE_SCENARIOS.find((scenario) => scenario.keywords.some((keyword) => q.includes(keyword))) ??
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
