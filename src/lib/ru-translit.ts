// DIG-89 — RU→EN-таблицы ДЕМО-ДАННЫХ и runtime-шаблонов уведомлений.
//
// Сопроводительный модуль к src/lib/en-demo-content.ts: словари с русскими
// ключами/регэкспами (транслит сида, шаблоны уведомлений) живут здесь, чтобы
// сами билдеры EN-контента и логика локализации оставались чистыми от
// кириллических литералов (статический контур «no Cyrillic on EN»).
//
// Модуль чистый (без next/headers и серверных импортов): импортируется и
// сервером, и клиентскими компонентами.

// ── факультеты / группы / учебные формы / основа обучения (сид) ─────────────

export const FACULTY_EN: Record<string, string> = {
  'ИТ': 'IT',
  'ЭК': 'Economics',
  'Дизайн': 'Design',
  'Менеджмент': 'Management',
  'Педагогика': 'Education',
  'Безопасность': 'Security',
};

export const GROUP_EN: Record<string, string> = {
  'ПИ-21': 'PI-21',
  'ЭК-11': 'EK-11',
};

export const STUDY_FORM_EN: Record<string, string> = {
  'очная': 'full-time',
  'очно-заочная': 'part-time',
  'заочная': 'extramural',
};

export const FUNDING_EN: Record<string, string> = {
  'бюджет': 'state-funded',
  'контракт': 'contract-based',
};

// ── дисциплины и программы (сид) ─────────────────────────────────────────────

export const DISCIPLINE_EN_BY_CODE: Record<string, string> = {
  'PI21-PHYS': 'Physics',
  'PI21-HIST': 'History',
  'PI21-DISC': 'Discrete Mathematics',
  'PI21-ALG': 'Algorithms and Data Structures',
  'EK11-MATH': 'Calculus',
  'EK11-ECON': 'Economic Theory',
  'PI21-INFO': 'Computer Science',
  'PI21-PROG': 'Programming',
  'PI21-DB': 'Databases',
};

export const DISCIPLINE_EN_BY_NAME: Record<string, string> = {
  'Физика': 'Physics',
  'История': 'History',
  'Дискретная математика': 'Discrete Mathematics',
  'Алгоритмы и структуры данных': 'Algorithms and Data Structures',
  'Математический анализ': 'Calculus',
  'Экономическая теория': 'Economic Theory',
  'Информатика': 'Computer Science',
  'Программирование': 'Programming',
  'Базы данных': 'Databases',
};

export const PROGRAM_EN: Record<string, string> = {
  'Прикладная информатика': 'Applied Computer Science',
  'Экономика': 'Economics',
};

// ── источники новостей и адресаты обращений (сид/каталог) ────────────────────

export const NEWS_SOURCES_EN: Record<string, string> = {
  'Деканат': 'Deanery',
  'Отдел стипендий': 'Scholarship office',
  'Куратор группы': 'Group curator',
  'Кафедра информатики': 'Computer science department',
  'Студенческий совет ЭК': 'EC student council',
  'Студенческий совет ИТ': 'IT student council',
  'Учёный совет ИТ': 'IT research board',
  'Учебно-вычислительный центр': 'Computing center',
  'Факультет ЭК': 'Economics faculty',
  'Библиотека': 'Library',
  'Управление общежитий': 'Dormitory office',
  'ИТ-служба университета': 'University IT service',
};

// ── runtime-уведомления: месяцы, действия, имена типов заявок ────────────────

/** Месяцы: RU-генитив в шаблонах → EN-название («18 ноября» → «November 18»). */
export const RU_MONTH_TO_EN: Record<string, string> = {
  'января': 'January',
  'февраля': 'February',
  'марта': 'March',
  'апреля': 'April',
  'мая': 'May',
  'июня': 'June',
  'июля': 'July',
  'августа': 'August',
  'сентября': 'September',
  'октября': 'October',
  'ноября': 'November',
  'декабря': 'December',
};

/** «18 ноября» / «5 декабря» → «November 18» / «December 5» (иные строки — как есть). */
export function enDatePhrase(text: string): string {
  return text.replace(/(\d{1,2})\s+([а-яё]+)/g, (full, day: string, month: string) => {
    const en = RU_MONTH_TO_EN[month];
    return en ? `${en} ${day}` : full;
  });
}

/** EN-подписи действий уведомлений (известные значения сида и рантайма). */
export const ACTION_LABELS_EN: Record<string, string> = {
  'Скачать': 'Download',
  'Открыть расписание': 'Open schedule',
  'Открыть заявку': 'Open request',
  'Открыть': 'Open',
  'Ответить': 'Reply',
  'Оплатить': 'Pay',
};

/** RU-имя типа заявки (сид canonical-requests) → EN-название; неизвестное — как есть. */
const REQUEST_NAME_EN: Record<string, string> = {
  'Справка об обучении': 'Enrollment certificate',
  'Выписка оценок': 'Grades extract',
  'Дубликат диплома': 'Diploma copy',
  'Заявление на академический отпуск': 'Academic leave application',
  'Заявление на материальную помощь': 'Material aid application',
  'Справка о размере стипендии': 'Scholarship amount certificate',
};

export function enRequestName(name: string): string {
  return REQUEST_NAME_EN[name] ?? name;
}

// ── runtime-уведомления: таблицы титулов и фраз тела ─────────────────────────

/**
 * Титулы: детерминированные RU-формулы → EN. Порядок важен: сначала
 * шаблоны целиком, затем общий префикс «Заявка …» → «Request …».
 */
export const NOTIFICATION_TITLE_RULES_EN: ReadonlyArray<readonly [RegExp, string]> = [
  [/^Заявка\s+(?=[A-ZА-ЯЁ0-9«])/, 'Request '],
  [/^Заявка на пересдачу создана$/, 'Retake request created'],
  [/^Заявка на «(.+)» создана$/, 'Request for "$1" created'],
  [/^Заявка «(.+)» — нужна доработка$/, 'Request "$1" — needs fixes'],
  [/^Заявка на летнюю практику передана на кафедру$/, 'Summer internship request forwarded to the department'],
  [/^Заявление на общежитие принято в работу$/, 'Dormitory application accepted for processing'],
  [/^Справка для военкомата готова$/, 'Military deferment certificate is ready'],
  [/^Документ отправлен на email$/, 'Document sent to email'],
  [/^Ответ по обращению$/, 'Ticket reply'],
  [/^Новая оценка: (\d+)\/100 — (.+)$/, 'New grade: $1/100 — $2'],
  [/^Оплата за общежитие — до (.+)$/, 'Dormitory payment — due $1'],
  [/^Оплата по договору — до (.+)$/, 'Contract payment — due $1'],
  [/^Открыта запись на консультации перед сессией$/, 'Sign-up for pre-session consultations is open'],
  [/^Долг по коллоквиуму «(.+)» — до начала сессии$/, '"$1" colloquium debt — due before the session'],
  [/^Кабинет обновлён: уведомления теперь по категориям$/, 'Cabinet updated: notifications are now grouped'],
  [/^Пара «(.+)» перенесена в ауд\. (.+)$/, 'Class "$1" rescheduled to room $2'],
  [/^Пара «(.+)» сегодня отменена$/, 'Class "$1" is cancelled today'],
  [/^Пара «(.+)» сегодня начнётся в (.+)$/, 'Class "$1" starts today at $2'],
];

/** Фразы-предложения тела ««Тип»: …» — переходы статусов и хвосты. */
export const REQUEST_SENTENCE_RULES_EN: ReadonlyArray<readonly [RegExp, string]> = [
  [/^документ готов к скачиванию$/, 'the document is ready for download'],
  [/^заявка подана$/, 'the request has been submitted'],
  [/^документ выдан$/, 'the document has been issued'],
  [/^заявка отменена студентом$/, 'the request was cancelled by the student'],
  [/^заявка исправлена и подана повторно$/, 'the request was fixed and resubmitted'],
  [/^заявка принята деканатом$/, 'the request has been accepted by the deanery'],
  [/^деканат принял заявку/, 'the deanery accepted the request'],
  [/^заявка принята в работу/, 'the request has been taken into work'],
  [/^деканат готовит документ/, 'the deanery is preparing the document'],
  [/^документ готов к выдаче/, 'the document is ready for pick-up'],
  [/^нужна правка данных/, 'data fixes are needed'],
  [/^нужна доработка/, 'revisions are needed'],
  [/^заявка отклонена/, 'the request was rejected'],
  [/^заявка отменена/, 'the request was cancelled'],
];

/** Подписи статусов канонической заявки для формулы «Подана → Принята». */
export const REQUEST_STATUS_LABEL_EN: Record<string, string> = {
  'Подана': 'Submitted',
  'Принята': 'Accepted',
  'В работе': 'In progress',
  'Готова': 'Ready',
  'Выдана': 'Issued',
  'Нужна доработка': 'Needs fixes',
  'Отклонена': 'Rejected',
  'Отменена': 'Cancelled',
};

/**
 * Одно предложение тела известного шаблона. Неизвестное — возвращается
 * как есть (RU-фолбэк осознанный: данные пользователя не выдумываем).
 */
export function enRequestSentence(sentence: string): string {
  const s = sentence.trim();
  const ready = s.match(/^Готовность до (.+)$/);
  if (ready) return `Ready by ${enDatePhrase(ready[1])}`;
  const reason = s.match(/^Причина: (.+)$/);
  if (reason) return `Reason: ${reason[1]}`;
  const arrow = s.match(/^([А-ЯЁ][А-Яа-яЁё ]+?) → ([А-ЯЁ][А-Яа-яЁё ]+)$/);
  if (arrow) {
    const from = REQUEST_STATUS_LABEL_EN[arrow[1].trim()];
    const to = REQUEST_STATUS_LABEL_EN[arrow[2].trim()];
    if (from && to) {
      const lower = (v: string) => v.charAt(0).toLowerCase() + v.slice(1);
      return `the request moved from ${lower(from)} to ${lower(to)}`;
    }
  }
  for (const [re, en] of REQUEST_SENTENCE_RULES_EN) {
    if (re.test(s)) return s.replace(re, en);
  }
  return s;
}

/**
 * Составные шаблоны тела вне схемы ««Тип»: …»: пересдача, ассистент, email,
 * обращения, перенос пар. Функция получает совпадения и возвращает EN или
 * null (не матчится — пробуем следующее правило).
 */
export type BodyRule = (
  body: string,
) => string | null;

const retakeBodyRule: BodyRule = (body) => {
  const m = body.match(
    /^Заявка ([A-ZА-ЯЁ0-9-]+) — запись на пересдачу по «(.+)» \((.+), (?:каб|ауд)\. (.+)\)\. Деканат подтвердит запись в статусе заявки\.$/,
  );
  if (!m) return null;
  const [, num, disc, when, room] = m;
  return (
    `Request ${num} — retake sign-up for "${disc}" (${enDatePhrase(when)}, room ${room}). ` +
    'The deanery will confirm the sign-up in the request status.'
  );
};

const assistantBodyRule: BodyRule = (body) => {
  const m = body.match(
    /^Заявка ([A-ZА-ЯЁ0-9-]+) создана через AI-ассистента по вашему подтверждению\. Деканат возьмёт её в работу — статус виден на странице заявки\.$/,
  );
  return m
    ? 'Request $1 was created via the AI assistant upon your confirmation. The deanery will take it into work — the status is visible on the request page.'.replace(
        '$1',
        m[1],
      )
    : null;
};

export const NOTIFICATION_BODY_RULES_EN: ReadonlyArray<BodyRule> = [
  retakeBodyRule,
  assistantBodyRule,
  (body) => {
    const m = body.match(/^«(.+)» \((.+)\) отправлен на (.+)\.$/);
    return m ? `"${m[1]}" (${m[2]}) has been sent to ${m[3]}.` : null;
  },
  (body) => {
    const m = body.match(/^(.+) ответил(а)? в обращении №(.+)\.$/);
    return m ? `${m[1]} replied to ticket №${m[3]}.` : null;
  },
  (body) => {
    const m = body.match(/^(.+) ответил(а)? в обращении по (.+)\.$/);
    return m ? `${m[1]} replied to the ${m[3]} ticket.` : null;
  },
  (body) => {
    const m = body.match(/^Лаборатория «(.+)» сегодня в (.+) пройдёт в ауд\. (.+) вместо (.+) \(замена от деканата\)\.$/);
    return m
      ? `The ${m[1]} lab today at ${m[2]} takes place in room ${m[3]} instead of ${m[4]} (change by the deanery).`
      : null;
  },
  (body) => {
    const m = body.match(/^Лаборатория «(.+)» сегодня в (.+) не состоится \((.+)\)\. (.+)\.$/);
    return m ? `The ${m[1]} lab today at ${m[2]} will not take place (${m[3]}). ${m[4]}.` : null;
  },
  (body) => {
    const m = body.match(/^Практика «(.+)» сегодня: (.+) \(аудитория та же, ауд\. (.+)\)\.$/);
    return m ? `The ${m[1]} practice today: ${m[2]} (same room, room ${m[3]}).` : null;
  },
  (body) => (body.includes('сегодня в ') ? body.replace(/сегодня в /, 'today at ') : null),
];

/** Тело по схеме ««Имя»: …» — имя переводим (известное), предложения — по таблице. */
export function enRequestBody(body: string): string | null {
  const m = body.match(/^«(.+?)»: ([\s\S]+)$/);
  if (!m) return null;
  const trailingDot = /\.$/.test(m[2]);
  const rest = m[2].replace(/\.$/, '');
  const sentences = rest.split(/\. (?=\S)/);
  const translated = sentences.map(enRequestSentence).join('. ');
  return `"${enRequestName(m[1])}": ${translated}${trailingDot ? '.' : ''}`;
}
