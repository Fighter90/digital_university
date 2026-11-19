// DIG-89 — RU→EN-таблицы ДЕМО-ДАННЫХ и runtime-шаблонов уведомлений.
//
// Сопроводительный модуль к src/lib/en-demo-content.ts: словари с русскими
// ключами/регэкспами (транслит сида, шаблоны уведомлений) живут здесь, чтобы
// сами билдеры EN-контента и логика локализации оставались чистыми от
// кириллических литералов (статический контур «no Cyrillic on EN»).
//
// Модуль чистый (без next/headers и серверных импортов): импортируется и
// сервером, и клиентскими компонентами.
import { requestNumberLabel } from '@/lib/requests-view';

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
  // DIG-93 — названия заявлок demo-seed (лента «Мои заявки», композер, задачи).
  'Справка для военкомата': 'Military deferment certificate',
  'Справка об обучении для налоговой': 'Enrollment certificate for the tax office',
  'Заявление на перезачёт дисциплины': 'Discipline credit transfer application',
  'Заявление на место в общежитии': 'Dormitory residence application',
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
    /^Заявка ([A-ZА-ЯЁ0-9-]+) — запись на пересдачу по «(.+)» \((.+), каб\. (.+)\)\. Деканат подтвердит запись в статусе заявки\.$/,
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

// ── DIG-93 — таблицы демо-контента кабинета (RU-ключи → EN) ──────────────────
// Сопроводительный слой src/lib/en-demo-content.ts: сам модуль сканируется
// тестом «no Cyrillic literals», поэтому все русские ключи/регэкспы живут
// здесь (тот же контракт, что у таблиц выше).

/** EN-имена демо-персон (студенты, преподаватели, сотрудники, авторы МСП). */
export const PEOPLE_NAME_EN: Record<string, string> = {
  // студенты
  'Анна Смирнова': 'Anna Smirnova',
  'Илья Петров': 'Ilya Petrov',
  'Дарья Орлова': 'Daria Orlova',
  'Артём Бекетов': 'Artem Beketov',
  'Полина Царёва': 'Polina Tsareva',
  // сокурсники (рейтинг группы, авторы МСП-комментариев)
  'Дмитрий Волков': 'Dmitry Volkov',
  'Полина Егорова': 'Polina Egorova',
  'Артём Фёдоров': 'Artem Fedorov',
  'София Гусева': 'Sofia Guseva',
  // преподаватели (demo-seed, сшиты со справочником /people)
  'Петров Пётр Петрович': 'Pyotr Petrov',
  'Иванова Ирина Игоревна': 'Irina Ivanova',
  'Соколов Сергей Сергеевич': 'Sergey Sokolov',
  'Орлов Олег Олегович': 'Oleg Orlov',
  'Кузнецова Ксения Кирилловна': 'Ksenia Kuznetsova',
  // сотрудники (справочник /people, деканат)
  'Мария Ковалёва': 'Maria Kovaleva',
  'Андрей Семёнов': 'Andrey Semyonov',
  'Наталья Белова': 'Natalia Belova',
  'Сергей Гаврилов': 'Sergey Gavrilov',
  'Елена Романова': 'Elena Romanova',
  'Ольга Титова': 'Olga Titova',
  'Виктор Никитин': 'Viktor Nikitin',
  // автор изменений расписания (demo-seed/prisma)
  'Мария Петрова (деканат)': 'Maria Petrova (deanery)',
  'Мария Петрова': 'Maria Petrova',
  // преподаватели prisma-сида (режим PostgreSQL)
  'Волков Артём Игоревич': 'Artyom Volkov',
  'Крылова Дарья Максимовна': 'Daria Krylova',
  'Никитин Егор Дмитриевич': 'Egor Nikitin',
  'Соловьёва Марина Андреевна': 'Marina Solovyova',
  'Захаров Игорь Львович': 'Igor Zakharov',
  'Гусева Ольга Сергеевна': 'Olga Guseva',
  'Белов Пётр Романович': 'Pyotr Belov',
  'Морозова Алина Викторовна': 'Alina Morozova',
  'Титов Арсений Павлович': 'Arseny Titov',
  'Романова Екатерина Ильинична': 'Ekaterina Romanova',
};

/** Кириллическая буква — guard «не рисуем RU на EN». */
export const CYRILLIC_LETTER = /[А-Яа-яЁё]/;

/** Заметки пар/пересдач/консультаций (closed set сида) → EN. */
export const SCHEDULE_NOTES_EN: Record<string, string> = {
  'Перенесено из ауд. 310': 'Moved from room 310',
  'Пара перенесена в ауд. 305': 'Class moved to room 305',
  'Лаборатория закрыта': 'The lab room is closed',
  'Начало в 9:00 вместо 10:40': 'Starts at 9:00 instead of 10:40',
  'Перед зачётом «Защита проекта»': 'Before the “Project defense” credit test',
  'Перед зачётом': 'Before the credit test',
  'Перед экзаменом': 'Before the exam',
  'Допуск: все лабораторные сданы': 'Admission: all labs submitted',
  'Защита проекта — дедлайн сдачи работы': 'Project defense — submission deadline',
  'Пересдача коллоквиума': 'Colloquium retake',
  'Пересдача лабораторных': 'Lab retake',
  'Пересдача экзамена (закрыто)': 'Exam retake (closed)',
  'В ауд. 310 монтируют новое оборудование': 'New equipment is being installed in room 310',
  'Аудитория 214 занята факультетским мероприятием':
    'Room 214 is taken by a faculty event',
  'Занятие будет восполнено 20 ноября, ауд. 212': 'The class will be made up on November 20, room 212',
  // prisma-сид (режим PostgreSQL)
  'Аудитория занята факультетским мероприятием — пара переносится в Б-204':
    'The room is taken by a faculty event — the class moves to B-204',
  'Аудитория А-312 занята факультетским мероприятием':
    'Room A-312 is taken by a faculty event',
  'Лектор в командировке — занятие перенесено на 12:30':
    'The lecturer is away — the class moves to 12:30',
  'Лектор в командировке': 'The lecturer is away',
  'Консультация отменена: преподаватель на конференции, вопросы — через обращения в деканат':
    'Consultation cancelled: the teacher is at a conference — ask questions via deanery tickets',
  'Консультация будет восполнена в следующую пятницу, ауд. А-305':
    'The consultation will be made up next Friday, room A-305',
  'Решить задачи 3.1–3.4 из задачника': 'Solve problems 3.1–3.4 from the workbook',
  'Решить задачи из листка к следующей паре':
    'Solve the problems from the worksheet before the next class',
  'Конспект лекции, листок задач (библиотека курса)':
    'Lecture notes, problem sheet (course library)',
  'Письменный экзамен, 90 минут': 'Written exam, 90 minutes',
  'Устный экзамен по билетам': 'Oral exam by ticket',
  'Письменный экзамен с калькуляторами': 'Written exam with calculators',
  'Пересдача: письменная работа повышенной сложности':
    'Retake: a written paper of increased difficulty',
  'Зачёт с оценкой по накопленным результатам': 'Graded credit by accumulated results',
  'Защита проектов': 'Project defense',
};

/** Элементы контроля сида («Тест 1», «Лабораторная 2») → EN. */
export const ELEMENT_NAME_EN: Record<string, string> = {
  'Тест 1': 'Test 1',
  'Тест 2': 'Test 2',
  'Коллоквиум': 'Colloquium',
  'Экзамен': 'Exam',
  'Лабораторная 2': 'Lab 2',
  'Лабораторная 3': 'Lab 3',
  'Проект': 'Project',
  'Зачёт': 'Credit test',
  'Семинар': 'Seminar',
  // prisma-сид
  'Лабораторные работы': 'Labs',
  'Домашние задания': 'Homework',
  'Контрольная работа': 'Test paper',
  'Контрольные работы': 'Test papers',
  'Эссе': 'Essay',
  'Презентация': 'Presentation',
  'Посещение и активность': 'Attendance and activity',
  'Нормативы': 'Fitness tests',
  'Зачёт с оценкой': 'Graded credit',
};

/** Адресат/ключевой параметр в названии заявки («для военкомата») → EN. */
export const REQUEST_DESTINATION_EN: Record<string, string> = {
  'для военкомата': 'for the military office',
  'для банка': 'for the bank',
  'для налоговой': 'for the tax office',
  'для работодателя': 'for an employer',
  'для соцзащиты': 'for social services',
  'для визового центра': 'for a visa center',
  'по месту требования': 'as required at the place of submission',
  'утрата оригинала': 'original lost',
};

/** Причины доработки/отказа (канонические комментарии сида) → EN. */
export const REQUEST_REASON_EN: Record<string, string> = {
  'Укажите ФИО латиницей': 'Provide the full name in Latin script',
  'Нужны два подписанных экземпляра': 'Two signed copies are required',
  'Приложите скан подписанного заявления': 'Attach a scan of the signed application',
  'Документ сформирован автоматически': 'The document was generated automatically',
  'Отличная работа с граничными случаями': 'Great work on the edge cases',
};

/** RU-глаголы задач (порядок getTasks без локали) → EN-шаблоны словаря. */
export const TASK_VERB_EN: Record<string, string> = {
  'Доработать заявку': 'Revise the request',
  'Ответить на обращение': 'Reply to the appeal',
  'Записаться на пересдачу': 'Sign up for the retake',
};

/** Титул сессии сида → EN. */
const SEASON_TITLE_EN: Record<string, string> = {
  'Сессия': 'Exam session',
  'Зимняя сессия': 'Winter exam session',
  'Летняя сессия': 'Summer session',
};

export function enSeasonTitle(title: string): string {
  return SEASON_TITLE_EN[title] ?? title;
}

/** Отсчёт до первого экзамена сида («До первого экзамена 3 дня») → EN. */
export function enCountdownLabel(label: string): string {
  const days = label.match(/^До первого экзамена (\d+) (?:день|дня|дней)$/u);
  if (days) {
    const n = Number(days[1]);
    return `The first exam is in ${n} ${n === 1 ? 'day' : 'days'}`;
  }
  const table: Record<string, string> = {
    'Первый экзамен сегодня': 'The first exam is today',
    'Сессия уже идёт': 'The exam session is under way',
  };
  return table[label] ?? label;
}

/** Подпись статуса допуска сида («Допущен» / «Сдано · 9») → EN. */
const EXAM_STATUS_LABEL_EN: Record<string, string> = {
  'Допущен': 'Admitted',
  'Не допущен': 'Not admitted',
  'Пересдача': 'Retake',
};

export function enExamStatusLabel(label: string): string {
  if (EXAM_STATUS_LABEL_EN[label]) return EXAM_STATUS_LABEL_EN[label]!;
  const passed = label.match(/^Сдано · (\d+)$/u);
  return passed ? `Passed · ${passed[1]}` : label;
}

/** Тип контрольной сида («Экзамен» / «Зачёт») → EN. */
const EXAM_KIND_LABEL_EN: Record<string, string> = {
  'Экзамен': 'Exam',
  'Зачёт': 'Credit test',
  'Пересдача': 'Retake',
};

export function enExamKindLabel(label: string): string {
  return EXAM_KIND_LABEL_EN[label] ?? label;
}

/** Причина недопуска сида («Не сдано: Тест 2») → EN («Missing: Test 2»). */
export function enAdmissionReasonText(reason: string): string {
  const m = reason.match(/^Не сдано: (.+)$/u);
  if (!m) return reason;
  const elements = m[1].split(', ');
  const enElements = elements.map((name) => ELEMENT_NAME_EN[name] ?? name);
  return `Missing: ${enElements.join(', ')}`;
}

/** «Договор об образовании У-2026-114» → «Training contract U-2026-114». */
export function enManualContractOrigin(origin: string): string | null {
  const contract = origin.match(/^Договор об образовании (У-\d{4}-\d+)$/u);
  return contract ? `Training contract ${requestNumberLabel(contract[1], 'en')}` : null;
}

/** RU-слово источника ручной задачи без note («Деканат») → EN. */
export const MANUAL_TASK_ORIGIN_RU = 'Деканат';

/** «Сдать: X» / уже собранный словарём «Submit: X» → хвост X; иначе null. */
export function submitTaskVerbTail(verb: string): string | null {
  const m = verb.match(/^(?:Сдать|Submit): (.+)$/u);
  return m ? m[1]! : null;
}

/** Хвост origin-задачи «Название · параметр · ЗД-2026-000003» → номер канона. */
export function requestNumberFromTaskOrigin(origin: string): string | null {
  const parts = origin.split(' · ');
  const last = parts.at(-1) ?? '';
  return parts.length > 1 && /^[A-ZА-ЯЁ]{2,4}-\S*-\S/u.test(last) ? last : null;
}
