// DIG-70 — каталог «Справки» (/guide): статический вымышленный гайд
// «Как пользоваться кабинетом». Чистые данные без React-импортов — единый
// источник правды для страницы, клиентского поиска и тестов (как lib/faq-catalog
// для DIG-38). Глубинные ссылки ведут в реальные разделы кабинета; поверхностей
// данных нет — страница GET-only, IDOR невозможен по построению.
import type { Locale } from '@/lib/i18n';

/** Один шаг инструкции: текст и необязательная глубинная ссылка. */
export interface HelpStep {
  /** Законченная инструкция одним предложением (или двумя короткими). */
  text: string;
  /** Ссылка в реальный раздел кабинета, где шаг выполняется. */
  link?: {
    href: string;
    label: string;
  };
}

/** Callout-блок: «Совет» или «Важно». */
export type HelpCalloutKind = 'tip' | 'warning';

export interface HelpCallout {
  kind: HelpCalloutKind;
  text: string;
}

/** Раздел гайда: якорь на странице, шаги, ссылки и callout'ы. */
export interface HelpSection {
  /** Якорь на странице /guide (без «#») — id заголовка раздела. */
  id: string;
  /** Заголовок раздела. */
  title: string;
  /** href раздела кабинета, к которому относится инструкция. */
  href: string;
  /** Одно предложение — зачем раздел. */
  summary: string;
  /** Нумерованные шаги. */
  steps: HelpStep[];
  /** Совет / Важно. */
  callouts?: HelpCallout[];
}

export const GUIDE_HEADING = 'Как пользоваться кабинетом';

export const GUIDE_INTRO =
  'Справка по кабинету: короткие пошаговые инструкции по каждому разделу — от входа до ICS-подписки. Все данные в кабинете вымышленные, прототип — концепт для конкурса.';

export const EMPTY_SEARCH_MESSAGE = 'Ничего не найдено';

export const EMPTY_SEARCH_HINT =
  'Попробуйте другое слово: например «статус», «пароль» или «расписание».';

// Статусы канона заявок упомянуты словами из lib/request-machine (CANONICAL_
// REQUEST_STATUS_LABELS): Подана → Принята → В работе → Готова → Выдана.
export const GUIDE_SECTIONS: HelpSection[] = [
  {
    id: 'login',
    title: 'Вход и безопасность',
    href: '/login',
    summary: 'Как попасть в кабинет и выйти из него, почему пароль в безопасности.',
    steps: [
      {
        text: 'Откройте страницу входа и введите логин и пароль, выданные вам деканатом (в прототипе — вымышленные демо-аккаунты).',
        link: { href: '/login', label: 'Открыть страницу входа' },
      },
      {
        text: 'Пароль хранится только в виде argon2id-хэша: никто, включая сотрудников деканата, не видит его в открытом виде.',
      },
      {
        text: 'Чтобы выйти, откройте меню профиля в шапке кабинета и выберите «Выйти» — сессия закроется сразу.',
      },
    ],
    callouts: [
      {
        kind: 'warning',
        text: 'Не передавайте пароль никому: сотрудники деканата никогда не запрашивают его в чате или по почте.',
      },
    ],
  },
  {
    id: 'schedule',
    title: 'Расписание и детали пары',
    href: '/schedule',
    summary: 'День, неделя и месяц; панель деталей пары и отметки о переносах.',
    steps: [
      {
        text: 'По умолчанию мобильный показывает «Сегодня», десктоп — неделю; переключатель вида меняет «День / Неделя / Месяц».',
        link: { href: '/schedule', label: 'Открыть расписание' },
      },
      {
        text: 'Нажмите на пару — откроется панель деталей: время, аудитория, преподаватель и тип занятия; перенос и отмена отмечены особо.',
      },
      {
        text: 'Листайте дни и недели стрелками рядом с датой; кнопка «Сегодня» возвращает к текущему дню.',
      },
    ],
    callouts: [
      {
        kind: 'tip',
        text: 'Детали пары открываются по прямой ссылке с параметром ?event= — ссылку на конкретную пару можно сохранить или переслать.',
      },
    ],
  },
  {
    id: 'requests',
    title: 'Заявки и справки',
    href: '/requests',
    summary: 'Мастер заказа, номера заявок, канон статусов и готовые PDF.',
    steps: [
      {
        text: 'Нажмите «Заказать» — мастер проведёт по шагам: тип справки, ваши данные, подтверждение.',
        link: { href: '/requests?order=new', label: 'Открыть мастер заказа' },
      },
      {
        text: 'Заявке присваивается номер вида ЗД-2026-000123 (или SR-2026-XXXXX для сервисных заявок) — он виден в списке и в карточке заявки.',
      },
      {
        text: 'Следите за статусом: Подана → Принята → В работе → Готова → Выдана.',
      },
      {
        text: 'Статус «Нужна доработка» означает, что деканат ждёт правок: откройте карточку заявки — там написано, что исправить.',
      },
      {
        text: '«Отклонена» и «Отменена» — финальные статусы с причиной в карточке; готовую справку скачайте PDF из карточки.',
      },
    ],
    callouts: [
      {
        kind: 'tip',
        text: 'О смене статуса придёт уведомление на выбранные каналы — push, e-mail или Telegram (см. раздел «Настройки»).',
      },
      {
        kind: 'warning',
        text: 'Кабинет показывает только ваши заявки: открыть чужой номер нельзя — попытка фиксируется в журнале доступа.',
      },
    ],
  },
  {
    id: 'deanery',
    title: 'Обращения в деканат',
    href: '/deanery',
    summary: 'Чат с менеджером деканата по номеру обращения TS-.',
    steps: [
      {
        text: 'Выберите тему и напишите сообщение — обращение получит номер вида TS-2026-XXXXX.',
        link: { href: '/deanery', label: 'Открыть обращения' },
      },
      {
        text: 'Переписка с менеджером идёт в чате карточки обращения: ответ приходит уведомлением, история сохраняется.',
      },
      {
        text: 'К одному обращению можно приложить файлы — фото документа или скриншот.',
      },
    ],
    callouts: [
      {
        kind: 'tip',
        text: 'По одному вопросу пишите в существующий чат, а не новым обращением: менеджер видит всю историю.',
      },
    ],
  },
  {
    id: 'feedback',
    title: 'Предложение или жалоба',
    href: '/feedback',
    summary: 'Канал руководству: типы обращения, адресаты и анонимность.',
    steps: [
      {
        text: 'Выберите тип — Предложение, Жалоба или Благодарность — и адресата: деканат, учебный офис, руководство программы или вуза.',
        link: { href: '/feedback', label: 'Открыть канал руководству' },
      },
      {
        text: 'По умолчанию адресат видит ваше имя и группу. Включите «Анонимно» — тогда обращение не хранит связи с аккаунтом нигде.',
      },
      {
        text: 'Ответ приходит в течение 3 рабочих дней; статусы: На рассмотрении → Отвечено → Решено.',
      },
    ],
    callouts: [
      {
        kind: 'warning',
        text: 'Анонимное обращение нельзя отследить в кабинете: сохраните номер, чтобы сопоставить ответ в ленте «Что мы изменили».',
      },
    ],
  },
  {
    id: 'tasks',
    title: 'Задачи и дедлайны',
    href: '/tasks',
    summary: 'Личный задачник: ближайшие дедлайны и счётчик в меню.',
    steps: [
      {
        text: 'Список задач собирается из ваших дисциплин: ближайшие дедлайны — сверху.',
        link: { href: '/tasks', label: 'Открыть задачи' },
      },
      {
        text: 'Выполненную задачу отмечайте галочкой; счётчик открытых задач виден рядом с пунктом меню «Задачи».',
      },
      {
        text: 'Просроченные задачи выделяются отдельно, чтобы не потерялись.',
      },
    ],
    callouts: [
      {
        kind: 'tip',
        text: 'Уведомления о дедлайнах включаются в разделе «Настройки → Уведомления».',
      },
    ],
  },
  {
    id: 'people',
    title: 'Справочник',
    href: '/people',
    summary: '«Мои преподаватели», контакты, консультации и ближайшие пары.',
    steps: [
      {
        text: 'В списке «Мои преподаватели» видны только те, кто ведёт ваши дисциплины, — с пометками предметов.',
        link: { href: '/people', label: 'Открыть справочник' },
      },
      {
        text: 'На карточке преподавателя — контакты, время консультаций и раздел «Ближайшие пары» с этим преподавателем.',
      },
      {
        text: 'Поиск ищет по имени и дисциплине — можно найти, кто ведёт нужный предмет.',
      },
    ],
    callouts: [
      {
        kind: 'tip',
        text: 'Вопрос по конкретной паре удобнее задать через «Обращения в деканат» — ответ зафиксируется в чате.',
      },
    ],
  },
  {
    id: 'ai-assistant',
    title: 'AI-ассистент',
    href: '/ai-assistant',
    summary: 'Ответы по данным кабинета: расписание, заявки, стипендии.',
    steps: [
      {
        text: 'Задайте вопрос текстом или голосом — ассистент отвечает по вашим данным кабинета, без общих догадок.',
        link: { href: '/ai-assistant', label: 'Открыть AI-ассистента' },
      },
      {
        text: 'В ответах ассистент даёт ссылки на разделы: можно перейти к паре, заявке или обращению в один клик.',
      },
    ],
    callouts: [
      {
        kind: 'tip',
        text: 'Ассистент подсказывает, но официальные действия — заявки и обращения — оформляйте в своих разделах.',
      },
    ],
  },
  {
    id: 'events',
    title: 'Мероприятия',
    href: '/events',
    summary: 'Афиша событий вуза: лекции, хакатоны, карьерные дни — и запись в один клик.',
    steps: [
      {
        text: 'Фильтруйте ленту чипами: «На этой неделе», «Карьера», «Онлайн» — или листайте афишу целиком.',
        link: { href: '/events', label: 'Открыть мероприятия' },
      },
      {
        text: 'Нажмите «Записаться» на карточке — место закреплено. Повторный клик отменяет запись.',
      },
      {
        text: '«Осталось N мест» считается по вместимости события; «Мест нет» — запись закрыта.',
      },
      {
        text: 'Откройте карточку события — полное описание, дата, площадка или ссылка на трансляцию.',
      },
    ],
    callouts: [
      { kind: 'tip', text: 'Записанные события отмечены чипом «Вы записаны» — легко найти свои.' },
    ],
  },
  {
    id: 'msp',
    title: 'МСП: студенческие стартапы',
    href: '/msp',
    summary:
      'Каталог студенческих проектов по образцу Product Hunt: голосование, комментарии, запуск дня.',
    steps: [
      {
        text: 'Голосуйте кнопкой «▲ Поддержать» — один голос на проект, повторный клик снимает голос.',
        link: { href: '/msp', label: 'Открыть МСП' },
      },
      {
        text: 'Сортируйте ленту: «Новые» или «Топ недели»; блок «Запуск дня» — проект с наибольшим числом голосов.',
      },
      {
        text: 'Откройте карточку запуска: описание, команда, комментарии. Ответьте автору в форме под описанием.',
      },
      {
        text: 'Своя команда? Нажмите «Запустить проект» — название, слоган, описание и теги. Проект появится в ленте.',
      },
    ],
    callouts: [
      { kind: 'tip', text: 'Голос можно снять тем же кликом — счётчик честно пересчитается.' },
      { kind: 'warning', text: 'Все проекты вымышленные — это демо-каталог для концепта.' },
    ],
  },
  {
    id: 'dpo',
    title: 'Дополнительное образование',
    href: '/dpo',
    summary: 'Каталог программ ДПО, ваши записи с прогрессом и документы по программам.',
    steps: [
      {
        text: 'Вкладка «Каталог»: фильтры по формату (онлайн/офлайн/гибрид), цене и длительности — чипы комбинируются.',
        link: { href: '/dpo', label: 'Открыть ДПО' },
      },
      {
        text: '«Записаться» на программу — она появится во вкладке «Мои программы» с полосой прогресса.',
      },
      {
        text: 'Вкладка «Документы»: договоры, акты, квитанции и сертификаты ваших программ.',
      },
    ],
    callouts: [
      {
        kind: 'tip',
        text: '«Скачать» документ активно после выпуска программы — в прототипе это заглушка.',
      },
    ],
  },
  {
    id: 'finance',
    title: 'Финансы',
    href: '/finance',
    summary: 'Форма обучения, стипендия, задолженности, договоры и платежи — в одном месте.',
    steps: [
      {
        text: 'Сводка сверху: форма обучения (бюджет/договор), стипендия с датой выплаты, задолженности или отметка «нет».',
        link: { href: '/finance', label: 'Открыть финансы' },
      },
      {
        text: 'Договоры и платежи — списком с номерами и статусами; PDF-документы доступны после выпуска.',
      },
    ],
    callouts: [
      { kind: 'warning', text: 'Реальной оплаты в прототипе нет — все платежи вымышленные.' },
    ],
  },
  {
    id: 'language',
    title: 'Язык интерфейса (RU/EN)',
    href: '/settings',
    summary: 'Переключение русского и английского интерфейса — сохраняется между визитами.',
    steps: [
      {
        text: 'Переключатель RU | EN — в правой части шапки. Нажмите EN — весь интерфейс переключится.',
      },
      {
        text: 'Выбор сохраняется: после перезахода кабинет откроется на выбранном языке.',
      },
      {
        text: 'Демо-данные (имена, дисциплины, новости) остаются на русском — переводится интерфейс, а не контент.',
      },
    ],
    callouts: [{ kind: 'tip', text: 'Даты и числа форматируются по выбранному языку.' }],
  },
  {
    id: 'settings',
    title: 'Настройки',
    href: '/settings',
    summary: 'Уведомления, смена пароля, тема и язык интерфейса.',
    steps: [
      {
        text: 'Вкладка «Уведомления»: каналы (push, e-mail, Telegram) по типам событий и тихие часы.',
        link: { href: '/settings?tab=notifications', label: 'Открыть настройки уведомлений' },
      },
      {
        text: 'Вкладка «Безопасность»: смена пароля и список активных сессий — чужую сессию можно завершить.',
        link: { href: '/settings?tab=security', label: 'Открыть безопасность' },
      },
      {
        text: 'Вкладка «Вид»: тема, язык интерфейса (русский или английский), размер шрифта и анимации.',
        link: { href: '/settings?tab=appearance', label: 'Открыть вид' },
      },
    ],
    callouts: [
      {
        kind: 'tip',
        text: 'Настройки применяются сразу и сохраняются в вашем профиле, а не в браузере.',
      },
    ],
  },
  {
    id: 'calendar',
    title: 'ICS-календарь и MCP',
    href: '/grades/session',
    summary: 'Подписка на расписание в вашем календаре и доступ для ИИ-ассистентов.',
    steps: [
      {
        text: 'Живая подписка на календарь: карточка «Подписка на календарь» на странице «Сессия» — добавьте ссылку в Google- или Apple-календарь.',
        link: { href: '/grades/session', label: 'Открыть страницу сессии' },
      },
      {
        text: 'MCP-сервер деканата: вкладка «Настройка MCP» — персональный URL и токен для ИИ-ассистентов (Claude и других).',
        link: { href: '/settings?tab=mcp', label: 'Открыть настройку MCP' },
      },
    ],
    callouts: [
      {
        kind: 'warning',
        text: 'Токен — это ключ доступа к вашим данным: не публикуйте его и перевыпускайте, если он попал в чужие руки.',
      },
    ],
  },
  {
    // DIG-73 — dedicated раздел про подключение внешнего ассистента по MCP.
    id: 'mcp',
    title: 'Подключить внешнего AI-ассистента (MCP)',
    href: '/mcp',
    summary:
      'MCP-сервер деканата: расписание, оценки и уведомления — в ChatGPT, Claude или Cursor по персональному токену.',
    steps: [
      {
        text: 'Откройте страницу «Подключение ассистента (MCP)» — там объяснение протокола, список доступных данных и готовый JSON-конфиг.',
        link: { href: '/mcp', label: 'Открыть страницу MCP' },
      },
      {
        text: 'Выпустите персональный токен во вкладке «Настройка MCP»: полный токен показывается один раз, в кабинете остаётся только хэш и маска.',
        link: { href: '/settings?tab=mcp', label: 'Открыть настройку MCP' },
      },
      {
        text: 'Скопируйте JSON-конфиг со страницы MCP и вставьте его в Claude Desktop, Cursor или другой MCP-клиент, заменив <ВАШ_ТОКЕН> на свой токен.',
      },
      {
        text: 'Спросите ассистента: «Что у меня по расписанию сегодня?» или «Какие у меня последние оценки?» — ответ придёт из кабинета.',
      },
    ],
    callouts: [
      {
        kind: 'warning',
        text: 'Доступ через MCP read-only: ассистент видит только ваши данные и не может ничего изменить. Токен персонален — перевыпускайте его, если он попал в чужие руки.',
      },
    ],
  },
];

/**
 * Чистый фильтр разделов по запросу: простое вхождение по нижнему регистру
 * в заголовок, описание, тексты шагов, ссылки и callout'ы. Пустая строка
 * (и одни пробелы) возвращает все разделы. Порядок каталога сохраняется.
 * Источник по умолчанию — GUIDE_SECTIONS (страница передаёт его явно).
 */
export function filterHelpSections(
  query: string,
  all: HelpSection[] = GUIDE_SECTIONS,
): HelpSection[] {
  const normalized = query.trim().toLowerCase();
  if (normalized === '') return [...all];
  return all.filter((section) => sectionSearchText(section).includes(normalized));
}

/** Весь искомый текст раздела одной строкой (заголовок + шаги + callout'ы). */
function sectionSearchText(section: HelpSection): string {
  const parts: string[] = [section.title, section.summary, section.href];
  for (const step of section.steps) {
    parts.push(step.text);
    if (step.link) parts.push(step.link.label, step.link.href);
  }
  for (const callout of section.callouts ?? []) parts.push(callout.text);
  return parts.join(' ').toLowerCase();
}

// ── DIG-88 — EN-версия каталога (/guide при locale=en) ──────────────────────
// RU-каталог выше — канон и источник RAG-чанков по умолчанию; EN-каталог
// параллелен по id/href/kind callout'ов (паритет проверяет юнит-тест),
// демо-данные и глубинные ссылки совпадают, переводятся только тексты.

export const GUIDE_HEADING_EN = 'How to use the cabinet';

export const GUIDE_INTRO_EN =
  'Cabinet guide: short step-by-step instructions for every section — from signing in to ICS subscriptions. All cabinet data is fictional; the prototype is a contest concept.';

export const EMPTY_SEARCH_MESSAGE_EN = 'Nothing found';

export const EMPTY_SEARCH_HINT_EN =
  'Try another word: for example “status”, “password” or “schedule”.';

const GUIDE_SECTIONS_EN: HelpSection[] = [
  {
    id: 'login',
    title: 'Sign-in and security',
    href: '/login',
    summary: 'How to get into the cabinet and sign out, and why your password stays safe.',
    steps: [
      {
        text: 'Open the sign-in page and enter the login and password issued to you by the deanery (in the prototype — fictional demo accounts).',
        link: { href: '/login', label: 'Open the sign-in page' },
      },
      {
        text: 'Your password is stored only as an argon2id hash: nobody, including the deanery staff, can see it in plain text.',
      },
      {
        text: 'To sign out, open the profile menu in the cabinet header and choose “Sign out” — the session ends immediately.',
      },
    ],
    callouts: [
      {
        kind: 'warning',
        text: 'Never share your password with anyone: deanery staff will never ask for it in a chat or by email.',
      },
    ],
  },
  {
    id: 'schedule',
    title: 'Schedule and class details',
    href: '/schedule',
    summary: 'Day, week and month; the class details panel and rescheduling marks.',
    steps: [
      {
        text: 'By default mobile shows “Today” and desktop shows the week; the view switcher toggles Day / Week / Month.',
        link: { href: '/schedule', label: 'Open the schedule' },
      },
      {
        text: 'Tap a class — the details panel opens: time, room, teacher and class type; a reschedule or a cancellation is marked separately.',
      },
      {
        text: 'Browse days and weeks with the arrows next to the date; the “Today” button returns you to the current day.',
      },
    ],
    callouts: [
      {
        kind: 'tip',
        text: 'Class details open via a direct link with the ?event= parameter — you can save or forward the link to a specific class.',
      },
    ],
  },
  {
    id: 'requests',
    title: 'Requests and certificates',
    href: '/requests',
    summary: 'The order wizard, request numbers, the status pipeline and ready PDFs.',
    steps: [
      {
        text: 'Click “Order” — the wizard guides you through the steps: certificate type, your details, confirmation.',
        link: { href: '/requests?order=new', label: 'Open the order wizard' },
      },
      {
        text: 'A request gets a number like ZD-2026-000123 (or SR-2026-XXXXX for service requests) — it is visible in the list and on the request card.',
      },
      {
        text: 'Follow the status: Submitted → Accepted → In progress → Ready → Issued.',
      },
      {
        text: '“Needs revision” means the deanery is waiting for fixes: open the request card — it says what to correct.',
      },
      {
        text: '“Rejected” and “Cancelled” are final statuses with the reason on the card; download the ready certificate as a PDF from the card.',
      },
    ],
    callouts: [
      {
        kind: 'tip',
        text: 'A status change sends a notification to your chosen channels — push, email or Telegram (see “Settings”).',
      },
      {
        kind: 'warning',
        text: 'The cabinet shows only your own requests: someone else’s number cannot be opened — the attempt is recorded in the access log.',
      },
    ],
  },
  {
    id: 'deanery',
    title: 'Messages to the deanery',
    href: '/deanery',
    summary: 'Chat with the deanery manager by ticket number TS-.',
    steps: [
      {
        text: 'Pick a topic and write your message — the ticket gets a number like TS-2026-XXXXX.',
        link: { href: '/deanery', label: 'Open deanery messages' },
      },
      {
        text: 'The conversation with the manager happens in the ticket chat: the reply arrives as a notification and the history is kept.',
      },
      {
        text: 'You can attach files to a ticket — a photo of a document or a screenshot.',
      },
    ],
    callouts: [
      {
        kind: 'tip',
        text: 'For one question, write in the existing chat rather than a new ticket: the manager sees the whole history.',
      },
    ],
  },
  {
    id: 'feedback',
    title: 'Suggestion or complaint',
    href: '/feedback',
    summary: 'A channel to the leadership: message types, recipients and anonymity.',
    steps: [
      {
        text: 'Choose the type — Suggestion, Complaint or Thank-you — and the recipient: the deanery, the academic office, the programme leadership or the university.',
        link: { href: '/feedback', label: 'Open the leadership channel' },
      },
      {
        text: 'By default the recipient sees your name and group. Turn on “Anonymous” — then the message stores no link to your account anywhere.',
      },
      {
        text: 'A reply arrives within 3 business days; statuses: Under review → Answered → Resolved.',
      },
    ],
    callouts: [
      {
        kind: 'warning',
        text: 'An anonymous message cannot be traced in the cabinet: save the number to match the reply in the “What we changed” feed.',
      },
    ],
  },
  {
    id: 'tasks',
    title: 'Tasks and deadlines',
    href: '/tasks',
    summary: 'Your personal task list: nearest deadlines and the menu counter.',
    steps: [
      {
        text: 'The task list is built from your disciplines: the nearest deadlines are on top.',
        link: { href: '/tasks', label: 'Open tasks' },
      },
      {
        text: 'Check off a completed task; the counter of open tasks sits next to the “Tasks” menu item.',
      },
      {
        text: 'Overdue tasks are highlighted separately so they don’t get lost.',
      },
    ],
    callouts: [
      {
        kind: 'tip',
        text: 'Deadline notifications are enabled in “Settings → Notifications”.',
      },
    ],
  },
  {
    id: 'people',
    title: 'Directory',
    href: '/people',
    summary: '“My teachers”, contacts, office hours and upcoming classes.',
    steps: [
      {
        text: 'The “My teachers” list shows only those who teach your disciplines — with subject marks.',
        link: { href: '/people', label: 'Open the directory' },
      },
      {
        text: 'A teacher’s card has contacts, office hours and “Upcoming classes” with that teacher.',
      },
      {
        text: 'Search matches names and disciplines — you can find who teaches the subject you need.',
      },
    ],
    callouts: [
      {
        kind: 'tip',
        text: 'A question about a specific class is best asked via “Messages to the deanery” — the answer stays in the chat.',
      },
    ],
  },
  {
    id: 'ai-assistant',
    title: 'AI assistant',
    href: '/ai-assistant',
    summary: 'Answers based on your cabinet data: schedule, requests, scholarships.',
    steps: [
      {
        text: 'Ask by text or voice — the assistant answers from your cabinet data, not generic guesses.',
        link: { href: '/ai-assistant', label: 'Open the AI assistant' },
      },
      {
        text: 'Answers include links to sections: jump to a class, a request or a ticket in one click.',
      },
    ],
    callouts: [
      {
        kind: 'tip',
        text: 'The assistant gives hints, but official actions — requests and tickets — should be submitted in their own sections.',
      },
    ],
  },
  {
    id: 'events',
    title: 'Events',
    href: '/events',
    summary: 'The university events board: lectures, hackathons, career days — and one-click sign-up.',
    steps: [
      {
        text: 'Filter the feed with chips: “This week”, “Career”, “Online” — or scroll the whole board.',
        link: { href: '/events', label: 'Open events' },
      },
      {
        text: 'Click “Sign up” on a card — your spot is reserved. Clicking again cancels it.',
      },
      {
        text: '“N spots left” is counted from the event capacity; “No spots” means sign-up is closed.',
      },
      {
        text: 'Open an event card — the full description, date, venue or stream link.',
      },
    ],
    callouts: [
      { kind: 'tip', text: 'Signed-up events carry the “You are signed up” chip — easy to find yours.' },
    ],
  },
  {
    id: 'msp',
    title: 'MSP: student startups',
    href: '/msp',
    summary:
      'A Product-Hunt-style catalog of student projects: voting, comments, launch of the day.',
    steps: [
      {
        text: 'Vote with the “▲ Support” button — one vote per project, clicking again removes it.',
        link: { href: '/msp', label: 'Open MSP' },
      },
      {
        text: 'Sort the feed: “New” or “Top of the week”; the “Launch of the day” block is the project with the most votes.',
      },
      {
        text: 'Open a launch card: description, team, comments. Reply to the author in the form below the description.',
      },
      {
        text: 'Got your own team? Click “Launch a project” — name, slogan, description and tags. Your project appears in the feed.',
      },
    ],
    callouts: [
      { kind: 'tip', text: 'You can remove your vote with the same click — the counter recalculates honestly.' },
      { kind: 'warning', text: 'All projects are fictional — this is a demo catalog for the concept.' },
    ],
  },
  {
    id: 'dpo',
    title: 'Continuing education',
    href: '/dpo',
    summary: 'The catalog of continuing-education programmes, your enrolments with progress, and programme documents.',
    steps: [
      {
        text: 'The “Catalog” tab: filters by format (online/offline/hybrid), price and duration — chips combine.',
        link: { href: '/dpo', label: 'Open continuing education' },
      },
      {
        text: '“Enroll” in a programme — it appears in the “My programmes” tab with a progress bar.',
      },
      {
        text: 'The “Documents” tab: contracts, acceptance certificates, receipts and certificates of your programmes.',
      },
    ],
    callouts: [
      {
        kind: 'tip',
        text: '“Download” becomes active after the programme graduates — in the prototype it is a stub.',
      },
    ],
  },
  {
    id: 'finance',
    title: 'Finance',
    href: '/finance',
    summary: 'Study format, scholarship, debts, contracts and payments — in one place.',
    steps: [
      {
        text: 'The summary on top: study format (state-funded/contract), the scholarship with its payment date, debts or a “none” mark.',
        link: { href: '/finance', label: 'Open finance' },
      },
      {
        text: 'Contracts and payments are listed with numbers and statuses; PDF documents become available after issuance.',
      },
    ],
    callouts: [
      { kind: 'warning', text: 'There is no real payment in the prototype — all payments are fictional.' },
    ],
  },
  {
    id: 'language',
    title: 'Interface language (RU/EN)',
    href: '/settings',
    summary: 'Switching the interface between Russian and English — kept between visits.',
    steps: [
      {
        text: 'The RU | EN switch is on the right side of the header. Click EN — the whole interface switches.',
      },
      {
        text: 'The choice is remembered: after re-signing-in the cabinet opens in the selected language.',
      },
      {
        text: 'Demo data (names, disciplines, news) stays in Russian — the interface is translated, not the content.',
      },
    ],
    callouts: [{ kind: 'tip', text: 'Dates and numbers are formatted according to the selected language.' }],
  },
  {
    id: 'settings',
    title: 'Settings',
    href: '/settings',
    summary: 'Notifications, password change, appearance and interface language.',
    steps: [
      {
        text: 'The “Notifications” tab: channels (push, email, Telegram) per event type and quiet hours.',
        link: { href: '/settings?tab=notifications', label: 'Open notification settings' },
      },
      {
        text: 'The “Security” tab: password change and the list of active sessions — you can terminate any session.',
        link: { href: '/settings?tab=security', label: 'Open security' },
      },
      {
        text: 'The “Appearance” tab: theme, interface language (Russian or English), font size and animations.',
        link: { href: '/settings?tab=appearance', label: 'Open appearance' },
      },
    ],
    callouts: [
      {
        kind: 'tip',
        text: 'Settings apply immediately and are saved in your profile, not in the browser.',
      },
    ],
  },
  {
    id: 'calendar',
    title: 'ICS calendar and MCP',
    href: '/grades/session',
    summary: 'Subscribing to your schedule in your calendar and access for AI assistants.',
    steps: [
      {
        text: 'Live calendar subscription: the “Calendar subscription” card on the “Session” page — add the link to your Google or Apple calendar.',
        link: { href: '/grades/session', label: 'Open the session page' },
      },
      {
        text: 'The deanery MCP server: the “MCP setup” tab — a personal URL and token for AI assistants (Claude and others).',
        link: { href: '/settings?tab=mcp', label: 'Open MCP setup' },
      },
    ],
    callouts: [
      {
        kind: 'warning',
        text: 'The token is an access key to your data: never publish it, and re-issue it if it falls into the wrong hands.',
      },
    ],
  },
  {
    id: 'mcp',
    title: 'Connect an external AI assistant (MCP)',
    href: '/mcp',
    summary:
      'The deanery MCP server: schedule, grades and notifications — in ChatGPT, Claude or Cursor via a personal token.',
    steps: [
      {
        text: 'Open the “Connect your assistant (MCP)” page — it explains the protocol, lists the available data and gives a ready JSON config.',
        link: { href: '/mcp', label: 'Open the MCP page' },
      },
      {
        text: 'Issue a personal token in the “MCP setup” tab: the full token is shown once — only its hash and mask stay in the cabinet.',
        link: { href: '/settings?tab=mcp', label: 'Open MCP setup' },
      },
      {
        text: 'Copy the JSON config from the MCP page and paste it into Claude Desktop, Cursor or another MCP client, replacing <YOUR_TOKEN> with your token.',
      },
      {
        text: 'Ask the assistant: “What is on my schedule today?” or “What are my latest grades?” — the answer comes from your cabinet.',
      },
    ],
    callouts: [
      {
        kind: 'warning',
        text: 'MCP access is read-only: the assistant sees only your data and cannot change anything. The token is personal — re-issue it if it falls into the wrong hands.',
      },
    ],
  },
];

/**
 * Заголовок гайда по локали (RU — канон, прежняя строка байт-в-байт).
 */
export function guideHeading(locale: Locale = 'ru'): string {
  return locale === 'en' ? GUIDE_HEADING_EN : GUIDE_HEADING;
}

/** Интро страницы /guide по локали. */
export function guideIntro(locale: Locale = 'ru'): string {
  return locale === 'en' ? GUIDE_INTRO_EN : GUIDE_INTRO;
}

/** Подсказка пустого поиска по локали. */
export function emptySearchHint(locale: Locale = 'ru'): string {
  return locale === 'en' ? EMPTY_SEARCH_HINT_EN : EMPTY_SEARCH_HINT;
}

/** Заголовок пустого поиска по локали. */
export function emptySearchMessage(locale: Locale = 'ru'): string {
  return locale === 'en' ? EMPTY_SEARCH_MESSAGE_EN : EMPTY_SEARCH_MESSAGE;
}

/**
 * Каталог разделов справки по локали. RU — канон (GUIDE_SECTIONS, прежний
 * массив), EN — параллельный каталог с теми же id/href.
 */
export function guideSections(locale: Locale = 'ru'): HelpSection[] {
  return locale === 'en' ? GUIDE_SECTIONS_EN : GUIDE_SECTIONS;
}

/** EN-плюрализация разделов для строки «Найдено: N …» (RU — прежняя). */
export function guideStepCountLabel(n: number, locale: Locale = 'ru'): string {
  if (locale === 'en') return n === 1 ? 'section' : 'sections';
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'раздел';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'раздела';
  return 'разделов';
}
