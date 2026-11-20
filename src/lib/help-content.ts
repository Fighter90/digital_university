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
  // ── DIG-112 — «максимальная полнота»: по разделу на каждый экран меню ────
  {
    id: 'dashboard',
    title: 'Главная «Ваша неделя»',
    href: '/dashboard',
    summary: 'Сводка недели: ближайшие пары, дедлайны и быстрые действия — в одном экране.',
    steps: [
      {
        text: 'Сверху — «Ваша неделя»: ближайшие пары и изменения расписания; ниже — виджеты задач, заявок и уведомлений.',
        link: { href: '/dashboard', label: 'Открыть главную' },
      },
      {
        text: 'Быстрые действия ведут в разделы: заказать справку, написать в деканат, открыть расписание.',
      },
      {
        text: 'Состав и порядок виджетов главной настраиваются в «Настройки»: спрячьте лишнее, поднимите важное.',
        link: { href: '/settings', label: 'Открыть настройки' },
      },
    ],
    callouts: [
      {
        kind: 'tip',
        text: 'Карточки-виджеты кликабельны: переход сразу к паре, задаче или уведомлению.',
      },
    ],
  },
  {
    id: 'grades',
    title: 'Успеваемость и зачётка',
    href: '/grades',
    summary: 'Сводка «как у меня дела», зачётка, карточки дисциплин, сессия и рейтинг группы.',
    steps: [
      {
        text: 'Сводка показывает средний балл, кредиты и место в группе; баллы по заданиям — в зачётке.',
        link: { href: '/grades', label: 'Открыть успеваемость' },
      },
      {
        text: 'Зачётка раскрывается по дисциплинам: баллы за задания, посещаемость и комментарии преподавателя.',
        link: { href: '/grades/gradebook', label: 'Открыть зачётку' },
      },
      {
        text: '«Сессия»: экзамены и консультации; ICS-подписка добавит расписание экзаменов в ваш календарь.',
        link: { href: '/grades/session', label: 'Открыть сессию' },
      },
      {
        text: '«Рейтинг группы» — таблица студентов по среднему баллу и ваше место: «в N% лучших».',
        link: { href: '/grades/rating', label: 'Открыть рейтинг группы' },
      },
    ],
    callouts: [
      {
        kind: 'tip',
        text: 'График динамики на карточке дисциплины показывает, как складывается итоговый балл.',
      },
    ],
  },
  {
    id: 'notifications',
    title: 'Уведомления',
    href: '/notifications',
    summary: 'Центр уведомлений: события по дням, панель колокольчика и тихие часы.',
    steps: [
      {
        text: 'Лента сгруппирована по дням: новые события сверху, непрочитанные выделены; кнопка «Отметить все прочитанными» снимает отметки.',
        link: { href: '/notifications', label: 'Открыть уведомления' },
      },
      {
        text: 'Колокольчик в шапке — быстрый доступ к последним уведомлениям из любого раздела кабинета.',
      },
      {
        text: 'Каналы доставки (push, e-mail, Telegram) и тихие часы настраиваются в «Настройки → Уведомления».',
        link: { href: '/settings?tab=notifications', label: 'Открыть настройки уведомлений' },
      },
    ],
    callouts: [
      {
        kind: 'warning',
        text: 'Строки «Система» в матрице каналов нет: сервисные уведомления о безопасности приходят всегда.',
      },
    ],
  },
  {
    id: 'news',
    title: 'Новости и объявления',
    href: '/news',
    summary: 'Лента новостей вуза: чтение, отметка «Прочитано» и кнопка «Поделиться».',
    steps: [
      {
        text: 'Лента показывает свежие новости и объявления вуза; открытие новости помечает её «Прочитано».',
        link: { href: '/news', label: 'Открыть новости' },
      },
      {
        text: 'В карточке новости — полный текст, дата и «Поделиться»: соцсети или копирование ссылки.',
      },
    ],
    callouts: [
      {
        kind: 'tip',
        text: 'Ссылкой на новость можно поделиться с однокурсниками — откроется та же страница.',
      },
    ],
  },
  {
    id: 'profile',
    title: 'Профиль',
    href: '/profile',
    summary: 'Личные данные, студенческий билет с маской и правка данных через деканат.',
    steps: [
      {
        text: 'Профиль показывает ФИО, группу, факультет, университетскую почту и студенческий билет; часть реквизитов скрыта маской.',
        link: { href: '/profile', label: 'Открыть профиль' },
      },
      {
        text: 'Нашли ошибку в данных? Кнопка на карточке профиля создаёт обращение в деканат с подставленными данными.',
      },
    ],
    callouts: [
      {
        kind: 'warning',
        text: 'Пароль и активные сессии меняются не здесь, а в «Настройки → Безопасность».',
      },
    ],
  },
  {
    id: 'help-faq',
    title: 'Вопросы и ответы',
    href: '/help',
    summary: 'База знаний: поиск по словоформам, категории плитками и статьи с действиями.',
    steps: [
      {
        text: 'Введите вопрос в поле «Найдите ответ»: поиск понимает словоформы — «стипендию» и «стипендиальный» находят статьи про стипендии.',
        link: { href: '/help', label: 'Открыть вопросы и ответы' },
      },
      {
        text: 'Категории плитками фильтруют статьи: учёба, справки, стипендии, общежитие, перевод, IT и разделы кабинета.',
      },
      {
        text: 'В статье отметьте «Полезно? Да / Нет», воспользуйтесь кнопкой действия и загляните в связанные статьи.',
      },
    ],
    callouts: [
      {
        kind: 'tip',
        text: 'Последовательная инструкция по каждому экрану — в «Справке» рядом: гайд «Как пользоваться кабинетом».',
      },
    ],
  },
  {
    id: 'staff',
    title: 'Сотрудникам: сводка деканата',
    href: '/staff',
    summary: 'Дежурная сводка: заявки за день, среднее время обработки и просрочки.',
    steps: [
      {
        text: 'Сводка показывает цифры дня по вашему факультету: поступившие заявки, среднее время обработки, просроченные.',
        link: { href: '/staff', label: 'Открыть сводку' },
      },
      {
        text: 'Карточки сводки ведут в разделы сотрудника: очередь заявок, обращения, объявления.',
      },
    ],
    callouts: [
      {
        kind: 'warning',
        text: 'Разделы /staff доступны только роли «Сотрудник деканата»: студенту сервер отвечает 403.',
      },
    ],
  },
  {
    id: 'staff-requests',
    title: 'Сотрудникам: очередь заявок',
    href: '/staff/requests',
    summary: 'Заявки факультета с SLA-подсветкой и каноническими переходами статусов.',
    steps: [
      {
        text: 'Очередь показывает заявки вашего факультета: горящие и просроченные по SLA подсвечены, фильтры — по статусу.',
        link: { href: '/staff/requests', label: 'Открыть очередь заявок' },
      },
      {
        text: 'В карточке заявки — данные студента, история и допустимые переходы статуса; причина обязательна для «Нужна доработка» и «Отклонена».',
      },
      {
        text: 'Готовую справку скачайте PDF: на документе QR-код проверки подлинности для /verify.',
      },
    ],
    callouts: [
      { kind: 'tip', text: 'Канон статусов: Подана → Принята → В работе → Готова → Выдана.' },
    ],
  },
  {
    id: 'staff-appeals',
    title: 'Сотрудникам: обращения',
    href: '/staff/appeals',
    summary: 'Обращения студентов факультета: чат, шаблоны ответов, статус «Решено».',
    steps: [
      {
        text: 'Список обращений факультета: темы, статусы и последние сообщения; откройте карточку — чат со студентом.',
      },
      {
        text: 'Отвечайте в чате: шаблоны закрывают типовые вопросы, история сохраняется по номеру TS-.',
        link: { href: '/staff/appeals', label: 'Открыть обращения' },
      },
      {
        text: 'Когда вопрос закрыт, переведите обращение в статус «Решено» — студент получит уведомление.',
      },
    ],
    callouts: [
      {
        kind: 'tip',
        text: 'Ответ по одному вопросу — в существующем чате, а не новым обращением.',
      },
    ],
  },
  {
    id: 'staff-announcements',
    title: 'Сотрудникам: объявления',
    href: '/staff/announcements',
    summary: 'Публикация объявлений факультету или группе с живым предпросмотром.',
    steps: [
      {
        text: 'Заполните заголовок, текст и аудиторию — факультет или конкретная группа (группа проверяется на принадлежность факультету).',
        link: { href: '/staff/announcements', label: 'Открыть объявления' },
      },
      {
        text: 'Живой предпросмотр показывает, как объявление увидит студент; опубликованные — списком ниже.',
      },
    ],
    callouts: [
      {
        kind: 'warning',
        text: 'Объявление увидят только студенты выбранной аудитории: проверьте группу перед публикацией.',
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
  // ── DIG-112 — «maximum completeness»: one section per cabinet menu screen ─
  {
    id: 'dashboard',
    title: 'Dashboard: “Your week”',
    href: '/dashboard',
    summary: 'The week at a glance: upcoming classes, deadlines and quick actions on one screen.',
    steps: [
      {
        text: 'The top card is “Your week”: upcoming classes and schedule changes; below are widgets for tasks, requests and notifications.',
        link: { href: '/dashboard', label: 'Open the dashboard' },
      },
      {
        text: 'Quick actions lead to sections: order a certificate, write to the deanery, open the schedule.',
      },
      {
        text: 'The set and order of the dashboard widgets are configured in “Settings”: hide the noise, raise what matters.',
        link: { href: '/settings', label: 'Open settings' },
      },
    ],
    callouts: [
      {
        kind: 'tip',
        text: 'Widget cards are clickable: jump straight to a class, a task or a notification.',
      },
    ],
  },
  {
    id: 'grades',
    title: 'Grades and the gradebook',
    href: '/grades',
    summary: 'The “how am I doing” summary, the gradebook, discipline cards, the session and the group rating.',
    steps: [
      {
        text: 'The summary shows your average grade, credits and standing in the group; per-assignment points live in the gradebook.',
        link: { href: '/grades', label: 'Open grades' },
      },
      {
        text: 'The gradebook expands per discipline: task points, attendance and the teacher’s comments.',
        link: { href: '/grades/gradebook', label: 'Open the gradebook' },
      },
      {
        text: '“Session”: exams and consultations; the ICS subscription adds the exam schedule to your calendar.',
        link: { href: '/grades/session', label: 'Open the session page' },
      },
      {
        text: '“Group rating” — a table of students by average grade and your place: “top N%”.',
        link: { href: '/grades/rating', label: 'Open the group rating' },
      },
    ],
    callouts: [
      {
        kind: 'tip',
        text: 'The dynamics chart on a discipline card shows how the final grade is coming together.',
      },
    ],
  },
  {
    id: 'notifications',
    title: 'Notifications',
    href: '/notifications',
    summary: 'The notifications center: events grouped by day, the bell panel and quiet hours.',
    steps: [
      {
        text: 'The feed is grouped by day: new events on top, unread ones highlighted; the “Mark all as read” button clears the marks.',
        link: { href: '/notifications', label: 'Open notifications' },
      },
      {
        text: 'The bell in the header is a quick way to see the latest notifications from any cabinet section.',
      },
      {
        text: 'Delivery channels (push, email, Telegram) and quiet hours are configured in “Settings → Notifications”.',
        link: { href: '/settings?tab=notifications', label: 'Open notification settings' },
      },
    ],
    callouts: [
      {
        kind: 'warning',
        text: 'There is no “System” row in the channel matrix: security notifications always arrive.',
      },
    ],
  },
  {
    id: 'news',
    title: 'News and announcements',
    href: '/news',
    summary: 'The university news feed: reading, the “Read” mark and the “Share” button.',
    steps: [
      {
        text: 'The feed shows fresh university news and announcements; opening a news item marks it “Read”.',
        link: { href: '/news', label: 'Open news' },
      },
      {
        text: 'A news card has the full text, the date and “Share”: social networks or copying the link.',
      },
    ],
    callouts: [
      {
        kind: 'tip',
        text: 'You can share a news link with your groupmates — it opens the same page.',
      },
    ],
  },
  {
    id: 'profile',
    title: 'Profile',
    href: '/profile',
    summary: 'Personal details, the student ID card with masked fields, and data fixes via the deanery.',
    steps: [
      {
        text: 'The profile shows your full name, group, faculty, university email and student ID card; some details are masked.',
        link: { href: '/profile', label: 'Open the profile' },
      },
      {
        text: 'Found an error in your details? The button on the profile card creates a deanery ticket with your data prefilled.',
      },
    ],
    callouts: [
      {
        kind: 'warning',
        text: 'The password and active sessions are managed in “Settings → Security”, not here.',
      },
    ],
  },
  {
    id: 'help-faq',
    title: 'Questions and answers',
    href: '/help',
    summary: 'The knowledge base: word-form search, category tiles and articles with actions.',
    steps: [
      {
        text: 'Type your question into the “Find the answer” field: the search understands word forms — “scholarship” and “scholarships” find the scholarship articles.',
        link: { href: '/help', label: 'Open questions and answers' },
      },
      {
        text: 'Category tiles filter the articles: studies, certificates, scholarships, dormitory, transfer, IT and the cabinet sections.',
      },
      {
        text: 'In an article, rate “Was this helpful? Yes / No”, use the action button and check the related articles.',
      },
    ],
    callouts: [
      {
        kind: 'tip',
        text: 'A step-by-step tour of every screen lives next door in the guide: “How to use the cabinet”.',
      },
    ],
  },
  {
    id: 'staff',
    title: 'For staff: the deanery summary',
    href: '/staff',
    summary: 'The duty summary: requests today, the average processing time and overdue items.',
    steps: [
      {
        text: 'The summary shows the day’s numbers for your faculty: incoming requests, the average processing time, overdue ones.',
        link: { href: '/staff', label: 'Open the summary' },
      },
      {
        text: 'Summary cards lead to the staff sections: the request queue, appeals, announcements.',
      },
    ],
    callouts: [
      {
        kind: 'warning',
        text: 'The /staff sections are visible only to the deanery staff role: a student gets a 403 from the server.',
      },
    ],
  },
  {
    id: 'staff-requests',
    title: 'For staff: the request queue',
    href: '/staff/requests',
    summary: 'Faculty requests with SLA highlighting and canonical status transitions.',
    steps: [
      {
        text: 'The queue shows the requests of your faculty: SLA-hot and overdue ones are highlighted, with filters by status.',
        link: { href: '/staff/requests', label: 'Open the request queue' },
      },
      {
        text: 'A request card shows the student’s details, the history and the allowed status transitions; a reason is required for “Needs revision” and “Rejected”.',
      },
      {
        text: 'Download the ready certificate as a PDF: the document carries a QR code for verification at /verify.',
      },
    ],
    callouts: [
      { kind: 'tip', text: 'The status canon: Submitted → Accepted → In progress → Ready → Issued.' },
    ],
  },
  {
    id: 'staff-appeals',
    title: 'For staff: appeals',
    href: '/staff/appeals',
    summary: 'Student appeals of your faculty: chat, reply templates and the “Resolved” status.',
    steps: [
      {
        text: 'The list of faculty appeals: topics, statuses and the latest messages; open a card — that is the chat with the student.',
      },
      {
        text: 'Reply in the chat: templates cover typical questions, and the history is kept by the TS- number.',
        link: { href: '/staff/appeals', label: 'Open appeals' },
      },
      {
        text: 'When the issue is closed, move the appeal to “Resolved” — the student gets a notification.',
      },
    ],
    callouts: [
      {
        kind: 'tip',
        text: 'Answer one question in the existing chat, not in a new ticket.',
      },
    ],
  },
  {
    id: 'staff-announcements',
    title: 'For staff: announcements',
    href: '/staff/announcements',
    summary: 'Publishing announcements to a faculty or a group with a live preview.',
    steps: [
      {
        text: 'Fill in the title, the text and the audience — the faculty or a specific group (the group is checked against the faculty).',
        link: { href: '/staff/announcements', label: 'Open announcements' },
      },
      {
        text: 'The live preview shows what a student will see; published announcements are listed below.',
      },
    ],
    callouts: [
      {
        kind: 'warning',
        text: 'Only students of the chosen audience will see the announcement: double-check the group before publishing.',
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
