// DIG-45 — вымышленный каталог «Вопросы и ответы» для поиска по кабинету.
// Ответы на частые вопросы студента (все данные и формулировки вымышленные,
// AGENTS.md). Это заготовка: экран FAQ — DIG-38, он заберёт каталог себе
// (или расширит); структура записи рассчитана и на поиск, и на будущую
// страницу статьи (href ведёт на место действия уже сегодня).

export interface FaqEntry {
  /** Стабильный id (в тестах и будущих ссылках /faq#<id>). */
  id: string;
  question: string;
  /** Короткий ответ без точки в конце. */
  answer: string;
  /** Слова-синонимы для поиска, не показываются в UI. */
  tags: string[];
  /** Куда ведёт попадание (место действия, внутренняя ссылка). */
  href: string;
}

/** EN-варианты записей (DIG-88): вопрос/ответ/теги по id. */
export interface FaqEntryEnText {
  question: string;
  answer: string;
  tags: string[];
}

const FAQ_ENTRIES_EN_TEXT: Record<string, FaqEntryEnText> = {
  'faq-order-enrollment-cert': {
    question: 'How do I order an enrollment certificate?',
    answer: '“Requests & certificates” → pick the certificate → “Order”; ready in 2–3 days.',
    tags: ['certificate', 'document', 'enrollment', 'order'],
  },
  'faq-scholarship-cert': {
    question: 'Where do I get a scholarship certificate?',
    answer: 'Ordered in “Requests & certificates”, takes 2–3 days, delivered as a PDF.',
    tags: ['certificate', 'scholarship', 'document'],
  },
  'faq-scholarship-increased': {
    question: 'Who is entitled to the increased scholarship?',
    answer: 'Students at the top of the course ranking; the threshold and list are in “Grades”.',
    tags: ['scholarship', 'ranking', 'grades'],
  },
  'faq-appeal-grade': {
    question: 'How do I contest a grade?',
    answer: 'The discipline card has a “Grade error?” form — it goes to the deanery.',
    tags: ['grade', 'appeal', 'dispute', 'retake'],
  },
  'faq-retake-signup': {
    question: 'How do I sign up for a retake?',
    answer: 'The “Session” screen → the “Retakes” section → the sign-up button for a date.',
    tags: ['retake', 'session', 'exam', 'sign-up'],
  },
  'faq-schedule-change': {
    question: 'What if a class is rescheduled?',
    answer: 'The class is marked in the schedule: the new room and time are visible on the class card.',
    tags: ['schedule', 'reschedule', 'class', 'room'],
  },
  'faq-request-number': {
    question: 'Where do I find my request number?',
    answer: 'A number like SR-YYYY-XXXXX — in the request list and on the request card.',
    tags: ['request', 'number', 'status'],
  },
  'faq-ask-deanery': {
    question: 'How do I ask the deanery a question?',
    answer: 'The “Deanery contact” section — a ticket answered within one business day.',
    tags: ['deanery', 'question', 'ticket', 'contact'],
  },
  'faq-dormitory-place': {
    question: 'How do I apply for the dormitory?',
    answer: '“Requests & certificates” → “Dormitory move-in”; review takes up to 5 days.',
    tags: ['dormitory', 'move-in', 'application'],
  },
};

export const FAQ_ENTRIES: FaqEntry[] = [
  {
    id: 'faq-order-enrollment-cert',
    question: 'Как заказать справку об обучении?',
    answer: 'Раздел «Заявки и справки» → выбрать справку → «Заказать»; готовность 2–3 дня.',
    tags: ['справка', 'документ', 'обучение', 'заказ'],
    href: '/requests?order=cert-enrollment',
  },
  {
    id: 'faq-scholarship-cert',
    question: 'Где взять справку о стипендии?',
    answer: 'Заказывается в «Заявках и справках», срок 2–3 дня, приходит в PDF.',
    tags: ['справка', 'стипендия', 'документ'],
    href: '/requests?order=fin-scholarship-cert',
  },
  {
    id: 'faq-scholarship-increased',
    question: 'Кому положена повышенная стипендия?',
    answer: 'Студентам в топе рейтинга курса; порог и список — в «Успеваемости».',
    tags: ['стипендия', 'рейтинг', 'оценки'],
    href: '/grades',
  },
  {
    id: 'faq-appeal-grade',
    question: 'Как оспорить оценку за работу?',
    answer: 'На карточке дисциплины есть форма «Ошибка в оценке?» — уйдёт в деканат.',
    tags: ['оценка', 'апелляция', 'спор', 'пересдача'],
    href: '/grades',
  },
  {
    id: 'faq-retake-signup',
    question: 'Как записаться на пересдачу?',
    answer: 'Экран «Сессия» → раздел «Пересдачи» → кнопка записи на дату.',
    tags: ['пересдача', 'сессия', 'экзамен', 'запись'],
    href: '/grades/session',
  },
  {
    id: 'faq-schedule-change',
    question: 'Что делать, если пару перенесли?',
    answer: 'Пара помечается в расписании: новая аудитория и время видны в карточке пары.',
    tags: ['расписание', 'перенос', 'пара', 'аудитория'],
    href: '/schedule',
  },
  {
    id: 'faq-request-number',
    question: 'Где посмотреть номер моей заявки?',
    answer: 'Номер вида SR-ГГГГ-XXXXX — в списке заявок и в карточке заявки.',
    tags: ['заявка', 'номер', 'статус'],
    href: '/requests',
  },
  {
    id: 'faq-ask-deanery',
    question: 'Как задать вопрос деканату?',
    answer: 'Раздел «Связь с деканатом» — обращение с ответом в рабочий день.',
    tags: ['деканат', 'вопрос', 'обращение', 'связь'],
    href: '/deanery',
  },
  {
    id: 'faq-dormitory-place',
    question: 'Как подать заявление в общежитие?',
    answer: '«Заявки и справки» → «Заселение в общежитие»; рассмотрение до 5 дней.',
    tags: ['общежитие', 'заселение', 'заявление'],
    href: '/requests?order=dorm-checkin',
  },
];

/**
 * DIG-88 — каталог по локали: RU — канон (прежний массив), EN — те же
 * id/href с английскими вопросом/ответом/тегами (паритет — юнит-тест).
 */
export function faqEntries(locale: 'ru' | 'en' = 'ru'): FaqEntry[] {
  if (locale !== 'en') return FAQ_ENTRIES;
  return FAQ_ENTRIES.map((entry) => {
    const en = FAQ_ENTRIES_EN_TEXT[entry.id];
    // EN-тексты обязательны для каждой записи; отсутствие — fallback на канон.
    return en ? { ...entry, question: en.question, answer: en.answer, tags: en.tags } : entry;
  });
}
