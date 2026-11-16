// DIG-39 — подсказки FAQ перед отправкой обращения: «Возможно, это ответ
// на ваш вопрос». Прототип использует вымышленный каталог-минимум (раздел
// FAQ подключается в DIG-38 — замена данных не меняет интерфейс подбора).
// Чистый модуль без серверных импортов: работает и на сервере, и в клиенте.

import type { TicketSubject } from '@/server/data/types';

export interface FaqArticle {
  id: string;
  title: string;
  category: string;
  /** Ключевые слова (нижний регистр) для подбора по тексту вопроса. */
  keywords: string[];
  /** Темы обращений, к которым статья относится (приоритет подбора). */
  subjects: TicketSubject[];
}

/**
 * Каталог-минимум: покрывает все пять тем обращений. Заголовки — с
 * типографскими «ёлочками», без прямых кавычек.
 */
export const FAQ_ARTICLES: FaqArticle[] = [
  {
    id: 'faq-academic-leave',
    title: 'Как оформить академический отпуск',
    category: 'Обучение',
    keywords: [
      'академический',
      'академ',
      'отпуск',
      'академический отпуск',
      'перерыв',
      'по семейным',
    ],
    subjects: ['ACADEMIC_LEAVE', 'OTHER'],
  },
  {
    id: 'faq-curriculum-plan',
    title: 'Где посмотреть «Успеваемость» и учебный план',
    category: 'Обучение',
    keywords: ['учебный план', 'план', 'дисциплины', 'кредиты', 'успеваемость'],
    subjects: ['CURRICULUM'],
  },
  {
    id: 'faq-grade-fix',
    title: 'Что делать, если в зачётке ошибка в оценке',
    category: 'Обучение',
    keywords: ['оценк', 'зачётк', 'зачетк', 'ведомость', 'балл', 'пересдач', 'экзамен'],
    subjects: ['GRADES'],
  },
  {
    id: 'faq-transfer',
    title: 'Как перевестись на другую программу или на бюджет',
    category: 'Обучение',
    keywords: ['перевест', 'перевод', 'бюджет', 'другую программу', 'другое направление'],
    subjects: ['TRANSFER'],
  },
  {
    id: 'faq-request-status',
    title: 'Как узнать статус заявки и указать её номер в обращении',
    category: 'Заявки',
    keywords: ['заявк', 'статус заявки', 'номер заявки', 'справк', 'документ'],
    subjects: ['OTHER', 'CURRICULUM'],
  },
  {
    id: 'faq-scholarship',
    title: 'Когда приходит стипендия',
    category: 'Стипендии и выплаты',
    keywords: ['стипенд', 'выплат', 'начисл'],
    subjects: ['OTHER'],
  },
];

/** Значимых символов меньше — подсказки не показываем (шум, не вопрос). */
const MIN_QUERY_LENGTH = 3;

const normalize = (text: string): string => text.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, ' ');

/** Сколько значимых символов во вводе (буквы/цифры, без пробелов). */
const significantLength = (text: string): number => text.replace(/\s/g, '').length;

/**
 * До `limit` статей по ключевым словам текста. Статьи темы обращения
 * приоритетны, порядок стабильный, без дублей. Короткий или мусорный ввод
 * (менее трёх значимых символов, только знаки препинания) → пусто.
 */
export function suggestFaqArticles(text: string, subject?: TicketSubject, limit = 3): FaqArticle[] {
  const query = normalize(text);
  if (significantLength(query) < MIN_QUERY_LENGTH) return [];

  const scored: Array<{ article: FaqArticle; score: number }> = [];
  for (const article of FAQ_ARTICLES) {
    let score = 0;
    for (const keyword of article.keywords) {
      if (query.includes(keyword)) score += keyword.includes(' ') ? 2 : 1;
    }
    if (score > 0) {
      // Тема обращения поднимает свои статьи, но не отменяет релевантность.
      if (subject !== undefined && article.subjects.includes(subject)) score += 3;
      scored.push({ article, score });
    }
  }

  scored.sort((a, b) => b.score - a.score || a.article.id.localeCompare(b.article.id));
  return scored.slice(0, limit).map(({ article }) => article);
}
