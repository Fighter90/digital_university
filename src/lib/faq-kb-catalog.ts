// DIG-38 — база знаний «Вопросы и ответы» (чистый модуль, без React и
// серверных импортов, как services-catalog DIG-29). Контент — вымышленный.
//
// Раунд 3 (ревью): файл живёт как faq-kb-catalog.ts, а не faq-catalog.ts —
// в origin/main src/lib/faq-catalog.ts уже занят каталогом FAQ_ENTRIES
// глобального поиска (DIG-45, src/server/data/search.ts); подмена сломала бы
// поиск по кабинету. Это отдельный домен: статьи /help, а не попадания ⌘K.
//
// Поиск повторяет семантику полнотекстового плана Postgres FTS
// `to_tsvector('russian')` (см. openspec/changes/dig-38-help-faq-screen):
//  - нормализация ё→е, регистр не важен;
//  - стоп-слова отбрасываются («как», «какой», «можно»…);
//  - токены соединяются AND — статья находится, только если каждый
//    значимый токен нашёлся в заголовке или тексте;
//  - словоформы сводятся стеммером, а разные дериваты (стипендия /
//    стипендиальный) сопоставляются правилом «короткий стем — префикс
//    длинного», поэтому запрос «стипендиальный» находит статьи про
//    стипендии (аудированный ЛК не находил ничего);
//  - совпадение в заголовке ранжируется выше совпадения в тексте.

import type { Locale } from '@/lib/i18n';

export type FaqCategory =
  | 'STUDY'
  | 'CERTIFICATES'
  | 'SCHOLARSHIPS'
  | 'DORMITORY'
  | 'TRANSFER'
  | 'IT'
  | 'CABINET';

export type FaqArticle = {
  id: string;
  category: FaqCategory;
  question: string;
  /** Абзацы ответа разделены пустой строкой (\n\n). */
  answer: string;
  related: string[];
  /** Кнопка сервиса, если ответ ведёт к заявке. */
  cta?: { label: string; href: string };
};

export const FAQ_CATEGORY_ORDER: FaqCategory[] = [
  'STUDY',
  'CERTIFICATES',
  'SCHOLARSHIPS',
  'DORMITORY',
  'TRANSFER',
  'IT',
  // DIG-112 — «максимальная полнота»: по статье на каждый экран кабинета.
  'CABINET',
];

export const FAQ_CATEGORY_LABELS: Record<FaqCategory, string> = {
  STUDY: 'Учёба и сессия',
  CERTIFICATES: 'Справки',
  SCHOLARSHIPS: 'Стипендии и выплаты',
  DORMITORY: 'Общежитие',
  TRANSFER: 'Перевод и восстановление',
  IT: 'IT и доступ',
  CABINET: 'Кабинет и разделы',
};

/** Подсказки под большим полем «Найдите ответ» — каждая реально находит статьи. */
export const POPULAR_QUERIES: string[] = [
  'стипендия',
  'справка об обучении',
  'общежитие',
  'пересдача',
  'перевод на другую программу',
];

export const FAQ_ARTICLES: FaqArticle[] = [
  // ── Учёба и сессия ────────────────────────────────────────────────
  {
    id: 'study-retake',
    category: 'STUDY',
    question: 'Как пройти пересдачу?',
    answer:
      'Пересдача назначается деканатом автоматически, если по дисциплине стоит оценка «неудовлетворительно». Заявление подавать не нужно — вас включат в расписание пересдачной сессии, дата появится в разделе «Расписание».\n\nПересдача принимается комиссией, а не одним преподавателем: вопросы задают по всему курсу. Если вторая попытка тоже не пройдена, деканат приглашает на беседу о продлении сессии.',
    related: ['study-attestation', 'study-absence'],
  },
  {
    id: 'study-absence',
    category: 'STUDY',
    question: 'Что делать, если пропустил занятие по болезни?',
    answer:
      'Напишите в деканат в первый же день пропуска — преподавателя предупредят заранее, и пропуск не превратится в неаттестацию.\n\nПосле выздоровления приложите справку от врача к обращению: срок сдачи лабораторной или эссе переносят без штрафных баллов.',
    related: ['study-retake', 'cert-online'],
    cta: { label: 'Написать в деканат', href: '/deanery' },
  },
  {
    id: 'study-attestation',
    category: 'STUDY',
    question: 'Как считается итоговая оценка по дисциплине?',
    answer:
      'Итог складывается из баллов за семестр и экзамена или зачёта: обычно 60 и 40 процентов, точные доли преподаватель публикует на первой лекции.\n\nТекущий прогресс виден в разделе «Успеваемость», подробная статистика — в зачётке. Если по баллам разногласие, сначала спросите на кафедре, затем напишите в деканат.',
    related: ['study-retake', 'study-absence'],
  },
  {
    id: 'study-credits',
    category: 'STUDY',
    question: 'Как переводятся кредиты с другой программы?',
    answer:
      'При внутреннем переходе деканат проводит перезачёт дисциплин: курсы с совпадающим объёмом и содержанием засчитываются автоматически, разницу вы добираете по индивидуальному плану.\n\nЗаявление на перезачёт подаёт академический консультант — приложите программы уже пройденных курсов.',
    related: ['transfer-program', 'study-attestation'],
  },

  // ── Справки ──────────────────────────────────────────────────────
  {
    id: 'cert-online',
    category: 'CERTIFICATES',
    question: 'Какие справки можно заказать онлайн?',
    answer:
      'Справка об обучении, справка о периоде обучения, выписка с оценками и справка для налогового вычета — все они оформляются в разделе «Заявки и справки» без визита в деканат.\n\nВыберите формат: электронную с электронной подписью или бумажную с печатью. О готовности придёт уведомление.',
    related: ['cert-time', 'cert-paper'],
    cta: { label: 'Заказать справку', href: '/requests?order=cert-enrollment' },
  },
  {
    id: 'cert-time',
    category: 'CERTIFICATES',
    question: 'Сколько делается справка?',
    answer:
      'Электронная справка об обучении готова в течение одного рабочего дня, бумажная с печатью — от одного до трёх рабочих дней.\n\nВ пиковые недели сессии срок может вырасти на два дня: статус заказа всегда виден в разделе «Заявки и справки».',
    related: ['cert-online', 'cert-paper'],
    cta: { label: 'Заказать справку', href: '/requests?order=cert-enrollment' },
  },
  {
    id: 'cert-paper',
    category: 'CERTIFICATES',
    question: 'Можно ли получить справку на бумаге с печатью?',
    answer:
      'Да. При заказе выберите формат «бумажная» — документ подготовят на бланке с подписью и печатью деканата, забрать его можно в окошке в рабочие часы.\n\nЕсли нужны сразу несколько экземпляров, укажите число в комментарии к заявке.',
    related: ['cert-online', 'cert-time'],
    cta: { label: 'Заказать справку', href: '/requests?order=cert-enrollment' },
  },

  // ── Стипендии и выплаты ──────────────────────────────────────────
  {
    id: 'schol-when',
    category: 'SCHOLARSHIPS',
    question: 'Когда приходит стипендия?',
    answer:
      'Стипендия приходит на карту в период с 20 по 25 число каждого месяца; точная дата зависит от банка-эмитента.\n\nПервокурсникам первую выплату назначают после выхода приказа о зачислении — обычно это октябрь. Если к 26 числу денег нет, напишите в деканат: проверим реквизиты и фонд выплат.',
    related: ['schol-delay', 'schol-firstyear'],
  },
  {
    id: 'schol-increased',
    category: 'SCHOLARSHIPS',
    question: 'Как получить повышенную стипендию?',
    answer:
      'Повышенная государственная академическая стипендия назначается за достижения в учёбе, науке, спорте и общественной деятельности. Соберите подтверждения — дипломы, публикации, грамоты — и подайте заявку в студсовет в начале семестра.\n\nКонкурс идёт по стипендиальному фонду вуза: чем весомее достижения, тем выше шанс. Первокурсникам участвовать можно уже со второго семестра.',
    related: ['schol-when', 'schol-firstyear', 'schol-social'],
  },
  {
    id: 'schol-firstyear',
    category: 'SCHOLARSHIPS',
    question: 'Какая стипендия у первокурсников?',
    answer:
      'Первокурсникам в первом семестре назначается государственная академическая стипендия по результатам вступительных испытаний: чем выше балл при поступлении, тем больше выплата.\n\nСо второго семестра размер зависит от оценок за сессию, а за особые достижения можно выйти на повышенную. Выплата для нуждающихся оформляется отдельным заявлением из фонда поддержки.',
    related: ['schol-increased', 'schol-when'],
  },
  {
    id: 'schol-social',
    category: 'SCHOLARSHIPS',
    question: 'Как оформить социальную стипендию?',
    answer:
      'Социальная стипендия положена студентам из льготных категорий: возьмите в органе социальной защиты справку о праве на меры поддержки и приложите её к заявлению в разделе «Заявки и справки».\n\nВыплату назначают с первого семестра, от оценок она не зависит; первокурсникам её тоже оформляют сразу.',
    related: ['schol-increased', 'schol-when'],
  },
  {
    id: 'schol-delay',
    category: 'SCHOLARSHIPS',
    question: 'Почему задерживают стипендию?',
    answer:
      'Чаще всего выплата задерживается из-за устаревших реквизитов карты: обновите их в профиле и напишите в деканат — заявку на повторный платёж передадут в бухгалтерию.\n\nЕсли задержка дольше пяти рабочих дней, деканат запросит у бухгалтерии статус платежа по фонду выплат и вернётся с ответом в тот же день.',
    related: ['schol-when', 'schol-social'],
  },
  {
    id: 'schol-flow',
    category: 'SCHOLARSHIPS',
    question: 'Какие выплаты положены студентам?',
    answer:
      'Студентам очной формы положены государственная академическая стипендия, повышенная за достижения, социальная для льготных категорий и разовые выплаты фонда поддержки.\n\nУ каждой выплаты свои правила назначения — базовые условия собраны в статьях этого раздела.',
    related: ['schol-when', 'schol-firstyear'],
  },

  // ── Общежитие ────────────────────────────────────────────────────
  {
    id: 'dorm-apply',
    category: 'DORMITORY',
    question: 'Как заселиться в общежитие?',
    answer:
      'Заявление на заселение подаётся в разделе «Заявки и справки» в августе, после публикации списков. К заезду вы получите номер комнаты и время встречи с комендантом.\n\nВозьмите паспорт и две фотографии: комендант выдаст пропуск и комплект постельного белья.',
    related: ['dorm-price', 'dorm-things'],
    cta: { label: 'Заполнить заявление', href: '/requests' },
  },
  {
    id: 'dorm-price',
    category: 'DORMITORY',
    question: 'Сколько стоит проживание в общежитии?',
    answer:
      'Плата за общежитие — от 600 до 1200 рублей в месяц и зависит от блока: комнаты на двоих-троих дороже, коридорного типа дешевле.\n\nОплатить можно за месяц или сразу за семестр — чек сохраняется в личном кабинете.',
    related: ['dorm-apply', 'dorm-things'],
  },
  {
    id: 'dorm-things',
    category: 'DORMITORY',
    question: 'Что стоит взять с собой в общежитие?',
    answer:
      'Документы, тёплые вещи и аптечку. Холодильник и микроволновка на этаже есть, поэтому часть утвари можно купить уже на месте у старосты этажа.\n\nПолный список запрещённых предметов комендант публикует на первом собрании.',
    related: ['dorm-apply', 'dorm-price'],
  },

  // ── Перевод и восстановление ─────────────────────────────────────
  {
    id: 'transfer-program',
    category: 'TRANSFER',
    question: 'Как перевестись на другую программу?',
    answer:
      'Заявление на перевод подаётся в период с 15 июня по 10 июля: приложите аттестацию за прошедшие сессии и мотивационное письмо.\n\nДеканат сверяет учебные планы — разницу дисциплин вы закроете по индивидуальному графику. Решение приходит в уведомлениях в течение десяти рабочих дней.',
    related: ['transfer-restore', 'study-credits'],
    cta: { label: 'Подать заявление на перевод', href: '/requests' },
  },
  {
    id: 'transfer-restore',
    category: 'TRANSFER',
    question: 'Как восстановиться после отчисления?',
    answer:
      'Заявление о восстановлении рассматривает деканат: важны причина отчисления и сколько семестров прошло. Накопившуюся академическую разницу закрывают в течение года по индивидуальному плану.\n\nСобеседование назначают в течение двух недель после подачи заявления.',
    related: ['transfer-program'],
  },

  // ── IT и доступ ──────────────────────────────────────────────────
  {
    id: 'it-password',
    category: 'IT',
    question: 'Как восстановить пароль от личного кабинета?',
    answer:
      'На экране входа нажмите «Забыли пароль?» и укажите университетскую почту — ссылка для сброса приходит в течение пары минут.\n\nЕсли письмо не приходит, проверьте папку «Спам» и напишите в поддержку IT-отдела: доступ вернут в тот же день.',
    related: ['it-access'],
  },
  {
    id: 'it-access',
    category: 'IT',
    question: 'Почему не открывается расписание?',
    answer:
      'Сначала обновите страницу и проверьте интернет: чаще всего виноват режим экономии трафика на телефоне.\n\nЕсли расписание всё ещё пустое, зайдите с другого браузера и напишите в поддержку IT-отдела — приложите скриншот, так диагностика пойдёт быстрее.',
    related: ['it-password'],
  },
  {
    // DIG-73 — статья про подключение внешнего AI-ассистента по MCP.
    id: 'it-mcp-assistant',
    category: 'IT',
    question: 'Как подключить внешнего AI-ассистента (MCP) к кабинету?',
    answer:
      'MCP (Model Context Protocol) — открытый протокол, по которому ассистенты (Claude, ChatGPT, Cursor) securely читают ваши данные кабинета: расписание на сегодня, оценки и непрочитанные уведомления.\n\nВыпустите персональный токен во вкладке «Настройка MCP», затем на странице «Подключение ассистента (MCP)» скопируйте готовый JSON-конфиг и замените <ВАШ_ТОКЕН> на свой токен. Доступ read-only: ассистент видит только ваши данные, токен в любой момент можно перевыпустить.',
    related: ['it-password', 'it-access'],
    cta: { label: 'Открыть инструкцию MCP', href: '/mcp' },
  },

  // ── Кабинет и разделы (DIG-112 — по статье на каждый экран меню) ──
  {
    id: 'cab-dashboard',
    category: 'CABINET',
    question: 'Как устроена «Главная» кабинета?',
    answer:
      '«Главная» собирает неделю в один экран: сверху «Ваша неделя» с ближайшими парами и изменениями расписания, ниже — виджеты задач, заявок и уведомлений. Быстрые действия ведут в разделы: заказать справку, написать в деканат, открыть расписание.\n\nСостав и порядок виджетов настраиваются в «Настройках»: лишние плитки можно спрятать, важные — поднять выше. Настройки сохраняются в профиле и работают на телефоне и на компьютере.',
    related: ['cab-tasks', 'cab-notifications'],
    cta: { label: 'Открыть главную', href: '/dashboard' },
  },
  {
    id: 'cab-tasks',
    category: 'CABINET',
    question: 'Как работать с задачами и дедлайнами?',
    answer:
      'Раздел «Задачи» собирает ваши задачи и дедлайны дисциплин: ближайшие сверху, просроченные выделены отдельно, чтобы не потерялись. Выполненную задачу отметьте галочкой — счётчик открытых задач рядом с пунктом меню уменьшится.\n\nНапоминания о дедлайнах приходят по выбранным каналам; каналы и тихие часы настраиваются в «Настройках → Уведомления».',
    related: ['cab-dashboard', 'cab-notifications'],
    cta: { label: 'Открыть задачи', href: '/tasks' },
  },
  {
    id: 'cab-schedule',
    category: 'CABINET',
    question: 'Как найти пару и посмотреть детали занятия?',
    answer:
      'Расписание переключается видами «День / Неделя / Месяц»: на телефоне по умолчанию «Сегодня», на компьютере — неделя. Нажмите на пару — откроется панель деталей: время, аудитория, преподаватель, тип занятия; перенос и отмена отмечены особо.\n\nДля видов «День» и «Неделя» работает «Экспорт» — файл Markdown, Excel или PDF; в деталях пары есть «Поделиться» — безопасная публичная ссылка на день расписания.',
    related: ['cab-grades', 'cab-events'],
    cta: { label: 'Открыть расписание', href: '/schedule' },
  },
  {
    id: 'cab-grades',
    category: 'CABINET',
    question: 'Где посмотреть оценки, зачётку и рейтинг группы?',
    answer:
      '«Успеваемость» открывается сводкой «как у меня дела»: средний балл, кредиты и место в группе. Баллы по заданиям, посещаемость и комментарии преподавателя — в зачётке, динамика по дисциплине — на её карточке.\n\nЭкран «Сессия» показывает экзамены и консультации с ICS-подпиской; «Рейтинг группы» — таблица студентов по среднему баллу и отметка «в N% лучших».',
    related: ['study-attestation', 'cab-schedule'],
    cta: { label: 'Открыть успеваемость', href: '/grades' },
  },
  {
    id: 'cab-finance',
    category: 'CABINET',
    question: 'Где посмотреть стипендию, договоры и платежи?',
    answer:
      'Раздел «Финансы» собирает деньги студента в одном месте: форма обучения (бюджет или договор), стипендия с датой выплаты, задолженности и отметка «нет», если долгов нет.\n\nДоговоры и платежи — списком с номерами и статусами; PDF-документы становятся доступны после выпуска. Реальной оплаты в прототипе нет — все суммы вымышленные.',
    related: ['schol-when', 'cab-requests'],
    cta: { label: 'Открыть финансы', href: '/finance' },
  },
  {
    id: 'cab-requests',
    category: 'CABINET',
    question: 'Как отследить статус заявки или справки?',
    answer:
      'Все заказы живут в разделе «Заявки и справки»: номер вида SR-2026-XXXXX виден в списке и в карточке, статус меняется по канону Подана → Принята → В работе → Готова → Выдана.\n\nО смене статуса приходит уведомление на выбранные каналы; готовую справку скачайте PDF из карточки — на документе QR-код проверки подлинности. Чужую заявку открыть нельзя: попытка фиксируется в журнале доступа.',
    related: ['cert-online', 'cert-time'],
    cta: { label: 'Открыть заявки', href: '/requests' },
  },
  {
    id: 'cab-notifications',
    category: 'CABINET',
    question: 'Как настроить уведомления и тихие часы?',
    answer:
      'Центр уведомлений показывает события по дням: новые сверху, непрочитанные выделены, кнопка «Отметить все прочитанными» снимает отметки. Колокольчик в шапке — быстрый доступ к последним событиям из любого раздела.\n\nКаналы доставки — push, e-mail, Telegram — включаются по типам событий в «Настройках → Уведомления»; там же задаются тихие часы, чтобы сообщения не приходили ночью. Сервисные уведомления о безопасности приходят всегда.',
    related: ['cab-settings', 'cab-tasks'],
    cta: { label: 'Открыть уведомления', href: '/notifications' },
  },
  {
    id: 'cab-deanery',
    category: 'CABINET',
    question: 'Как написать в деканат и получить ответ?',
    answer:
      'Раздел «Связь с деканатом»: выберите тему и напишите сообщение — обращение получит номер вида TS-2026-XXXXX. Переписка с менеджером идёт в чате карточки, история сохраняется, к сообщению можно приложить файлы.\n\nОтвет приходит уведомлением; по одному вопросу пишите в существующий чат, а не новым обращением — менеджер видит всю историю.',
    related: ['study-absence', 'cab-feedback'],
    cta: { label: 'Написать в деканат', href: '/deanery' },
  },
  {
    id: 'cab-feedback',
    category: 'CABINET',
    question: 'Куда отправить предложение или жалобу?',
    answer:
      '«Обратная связь» — канал руководству: типы «Предложение», «Жалоба» и «Благодарность», адресаты — деканат, учебный офис, руководство программы или вуза.\n\nПо умолчанию адресат видит имя и группу; включите «Анонимно», и обращение не хранит связи с аккаунтом нигде. Ответ приходит в течение трёх рабочих дней, статусы: На рассмотрении → Отвечено → Решено.',
    related: ['cab-deanery', 'cab-profile'],
    cta: { label: 'Открыть обратную связь', href: '/feedback' },
  },
  {
    id: 'cab-events',
    category: 'CABINET',
    question: 'Как записаться на мероприятие?',
    answer:
      'Афиша «Мероприятий» фильтруется чипами: «На этой неделе», «Карьера», «Онлайн». Нажмите «Записаться» на карточке — место закрепится; повторный клик отменяет запись.\n\nНа карточке видно «Осталось N мест» — счётчик по вместимости события; полное описание, дата и площадка или ссылка на трансляцию — на странице события.',
    related: ['cab-msp', 'cab-dpo'],
    cta: { label: 'Открыть мероприятия', href: '/events' },
  },
  {
    id: 'cab-msp',
    category: 'CABINET',
    question: 'Как поддержать студенческий стартап в МСП?',
    answer:
      'Каталог «МСП» устроен как Product Hunt: лента студенческих проектов, кнопка «▲ Поддержать» — один голос на проект, повторный клик снимает голос. Блок «Запуск дня» — проект с наибольшим числом голосов.\n\nВ карточке запуска — описание, команда и комментарии; свою команду можно заявить кнопкой «Запустить проект». Все проекты вымышленные — это демо-каталог концепта.',
    related: ['cab-events', 'cab-dpo'],
    cta: { label: 'Открыть МСП', href: '/msp' },
  },
  {
    id: 'cab-dpo',
    category: 'CABINET',
    question: 'Как записаться на программу дополнительного образования?',
    answer:
      'Каталог ДПО фильтруется по формату (онлайн, офлайн, гибрид), цене и длительности — чипы комбинируются. «Записаться» — и программа появится во вкладке «Мои программы» с полосой прогресса.\n\nВо вкладке «Документы» — договоры, акты, квитанции и сертификаты ваших программ; скачивание активно после выпуска программы.',
    related: ['cab-events', 'cab-msp'],
    cta: { label: 'Открыть ДПО', href: '/dpo' },
  },
  {
    id: 'cab-people',
    category: 'CABINET',
    question: 'Как найти преподавателя и его контакты?',
    answer:
      '«Справочник» показывает «Моих преподавателей» — только тех, кто ведёт ваши дисциплины, с пометками предметов. Поиск ищет по имени, e-mail и телефону, а также по дисциплине: можно найти, кто ведёт нужный предмет.\n\nНа карточке преподавателя — контакты, время консультаций и «Ближайшие пары» с ним; любимых преподавателей можно отметить звёздочкой в «Избранном».',
    related: ['cab-schedule', 'cab-deanery'],
    cta: { label: 'Открыть справочник', href: '/people' },
  },
  {
    id: 'cab-news',
    category: 'CABINET',
    question: 'Где читать новости и объявления вуза?',
    answer:
      'Лента «Новостей» показывает свежие публикации вуза: открытие новости помечает её «Прочитано», чтобы было видно, что вы уже читали.\n\nВ карточке новости — полный текст, дата и кнопка «Поделиться»: отправить в соцсети или скопировать ссылку — она откроет ту же страницу.',
    related: ['cab-events', 'cab-notifications'],
    cta: { label: 'Открыть новости', href: '/news' },
  },
  {
    id: 'cab-profile',
    category: 'CABINET',
    question: 'Как изменить данные в профиле?',
    answer:
      'Профиль показывает ФИО, группу, факультет, университетскую почту и студенческий билет; часть реквизитов скрыта маской — данные студента меняет деканат, а не сам студент.\n\nНашли ошибку в данных? Кнопка на карточке профиля создаёт обращение в деканат с подставленными данными. Пароль и сессии меняются в «Настройках → Безопасность».',
    related: ['cab-settings', 'it-password'],
    cta: { label: 'Открыть профиль', href: '/profile' },
  },
  {
    id: 'cab-settings',
    category: 'CABINET',
    question: 'Как настроить кабинет под себя?',
    answer:
      '«Настройки» собраны по вкладкам: «Уведомления» — каналы и тихие часы; «Безопасность» — смена пароля и активные сессии; «Вид» — тема, язык (русский или английский), размер шрифта и анимации; «Настройка MCP» — токен для внешнего ассистента. На главной вкладке — «Виджеты главной».\n\nНастройки применяются сразу и сохраняются в профиле, а не в браузере: они работают на любом устройстве после входа.',
    related: ['cab-notifications', 'it-mcp-assistant'],
    cta: { label: 'Открыть настройки', href: '/settings' },
  },
  {
    id: 'cab-ai-assistant',
    category: 'CABINET',
    question: 'О чём можно спросить AI-ассистента?',
    answer:
      'Ассистент отвечает по вашим данным кабинета: расписание на сегодня и ближайшие дни, оценки, заявки, стипендия, задачи. Спросить можно текстом или голосом; в ответах — ссылки на разделы, чтобы перейти в один клик.\n\nАссистент подсказывает, но официальные действия оформляйте в своих разделах: заявки — в «Заявках», вопросы — в «Связи с деканатом». Внешнему ассистенту (Claude, ChatGPT) кабинет отдаёт данные по MCP — см. статью про подключение.',
    related: ['it-mcp-assistant', 'cab-requests'],
    cta: { label: 'Открыть ассистента', href: '/ai-assistant' },
  },
  {
    id: 'cab-staff',
    category: 'CABINET',
    question: 'Как сотруднику работать с очередью заявок?',
    answer:
      'Кабинет сотрудника деканата: «Сводка» с цифрами дня, очередь «Заявок» факультета с SLA-подсветкой, «Обращения» студентов и «Объявления» факультету. Заявки идут по канону статусов, причина обязательна для «Нужна доработка» и «Отклонена».\n\nГотовые справки скачиваются PDF с QR-кодом проверки; обращения закрываются статусом «Решено» в чате карточки. Разделы /staff видны только роли «Сотрудник деканата» — студенту сервер отвечает 403.',
    related: ['cab-requests', 'cab-deanery'],
    cta: { label: 'Открыть кабинет сотрудника', href: '/staff' },
  },
];

export function getFaqArticle(id: string): FaqArticle | null {
  return FAQ_ARTICLES.find((article) => article.id === id) ?? null;
}

// ── DIG-88 — EN-версия каталога (/help при locale=en) ───────────────────────
// RU-каталог — канон; EN-тексты параллельны по id (паритет проверяет
// юнит-тест: каждой RU-статье соответствуют EN-вопрос/ответ). Демо-номера
// канона (SR-/ZD-) и href совпадают, переводятся только тексты.

/** EN-тексты статьи: вопрос, ответ и (если есть) подпись кнопки сервиса. */
export interface FaqArticleEnText {
  question: string;
  answer: string;
  /** EN-подпись CTA (только у статей с RU-cta). */
  ctaLabel?: string;
}

export const FAQ_ARTICLES_EN_TEXT: Record<string, FaqArticleEnText> = {
  'study-retake': {
    question: 'How does the retake work?',
    answer:
      'A retake is scheduled by the deanery automatically when a discipline is graded “fail”. No application is needed — you will be added to the retake session timetable and the date will appear in the “Schedule” section.\n\nA retake is assessed by a committee, not by a single teacher: questions cover the whole course. If the second attempt fails too, the deanery invites you to a talk about extending the session.',
  },
  'study-absence': {
    question: 'What should I do if I missed a class due to illness?',
    answer:
      'Write to the deanery on the very first day of the absence — the teacher will be warned in advance, and the absence will not turn into non-attestation.\n\nAfter recovery, attach a doctor’s certificate to your ticket: the deadline for the lab or essay is moved without penalty points.',
    ctaLabel: 'Write to the deanery',
  },
  'study-attestation': {
    question: 'How is the final grade for a discipline calculated?',
    answer:
      'The final grade combines the semester points and the exam or pass-fail test: usually 60 and 40 percent — the teacher publishes the exact split at the first lecture.\n\nYour current progress is in the “Grades” section and detailed statistics are in the gradebook. If you disagree with the points, ask your department first, then write to the deanery.',
  },
  'study-credits': {
    question: 'How are credits transferred from another programme?',
    answer:
      'For an internal transfer the deanery runs a credit-recognition procedure: courses with matching scope and content are recognised automatically, and you make up the difference with an individual plan.\n\nThe academic advisor submits the credit-recognition application — attach the syllabi of the courses you have already completed.',
  },
  'cert-online': {
    question: 'Which certificates can I order online?',
    answer:
      'The enrollment certificate, the study-period certificate, the grades extract and the tax-deduction certificate — all are issued in “Requests & certificates” without a visit to the deanery.\n\nChoose the format: electronic with an e-signature or paper with a stamp. A notification arrives when it is ready.',
    ctaLabel: 'Order a certificate',
  },
  'cert-time': {
    question: 'How long does a certificate take?',
    answer:
      'The electronic enrollment certificate is ready within one business day; the paper one with a stamp takes from one to three business days.\n\nIn peak exam weeks the time can grow by two days: the order status is always visible in “Requests & certificates”.',
    ctaLabel: 'Order a certificate',
  },
  'cert-paper': {
    question: 'Can I get a paper certificate with a stamp?',
    answer:
      'Yes. When ordering choose the “paper” format — the document is prepared on letterhead with the deanery’s signature and stamp, and you can collect it at the window during working hours.\n\nIf you need several copies at once, specify the number in the request comment.',
    ctaLabel: 'Order a certificate',
  },
  'schol-when': {
    question: 'When does the scholarship arrive?',
    answer:
      'The scholarship arrives on your card between the 20th and the 25th of each month; the exact date depends on the issuing bank.\n\nFirst-year students get the first payment after the enrolment order is published — usually in October. If there is no money by the 26th, write to the deanery: we will check your bank details and the payment fund.',
  },
  'schol-increased': {
    question: 'How do I get the increased scholarship?',
    answer:
      'The increased state academic scholarship is awarded for achievements in studies, science, sports and social activities. Collect the proof — diplomas, publications, awards — and apply to the student council at the start of the semester.\n\nThe competition runs on the university scholarship fund: the stronger the achievements, the higher the chance. First-year students can take part from the second semester.',
  },
  'schol-firstyear': {
    question: 'What scholarship do first-year students get?',
    answer:
      'In the first semester first-year students are granted a state academic scholarship based on their admission results: the higher the entry score, the larger the payment.\n\nFrom the second semester the amount depends on exam grades, and outstanding achievements can raise it to the increased level. A need-based payment is arranged with a separate application from the support fund.',
  },
  'schol-social': {
    question: 'How do I apply for the social scholarship?',
    answer:
      'The social scholarship is for students in eligible categories: get a certificate of eligibility for support measures from the social protection office and attach it to the application in “Requests & certificates”.\n\nThe payment is granted from the first semester and does not depend on grades; first-year students get it right away too.',
  },
  'schol-delay': {
    question: 'Why is my scholarship delayed?',
    answer:
      'Most often the payment is delayed because of outdated card details: update them in your profile and write to the deanery — a repeat-payment request will be passed to the accounting office.\n\nIf the delay is longer than five business days, the deanery will ask the accounting office for the payment status and come back the same day.',
  },
  'schol-flow': {
    question: 'What payments are students entitled to?',
    answer:
      'Full-time students are entitled to the state academic scholarship, the increased one for achievements, the social one for eligible categories, and one-off payments from the support fund.\n\nEach payment has its own award rules — the basic conditions are collected in the articles of this section.',
  },
  'dorm-apply': {
    question: 'How do I move into the dormitory?',
    answer:
      'The housing application is submitted in “Requests & certificates” in August, after the lists are published. By move-in you will get your room number and the time to meet the warden.\n\nBring your passport and two photos: the warden will issue a pass and a bed-linen set.',
    ctaLabel: 'Fill in the application',
  },
  'dorm-price': {
    question: 'How much does dormitory accommodation cost?',
    answer:
      'Dormitory fees range from 600 to 1200 rubles per month depending on the block: rooms for two or three are more expensive, corridor-type rooms are cheaper.\n\nYou can pay monthly or for the whole semester at once — the receipt is kept in your cabinet.',
  },
  'dorm-things': {
    question: 'What should I bring to the dormitory?',
    answer:
      'Documents, warm clothes and a first-aid kit. There is a fridge and a microwave on the floor, so some utensils can be bought on the spot from the floor senior.\n\nThe warden publishes the full list of forbidden items at the first meeting.',
  },
  'transfer-program': {
    question: 'How do I transfer to another programme?',
    answer:
      'The transfer application is submitted between June 15 and July 10: attach your attestation from the past sessions and a motivation letter.\n\nThe deanery compares the curricula — you will close the difference in disciplines with an individual schedule. The decision arrives in notifications within ten business days.',
    ctaLabel: 'Apply for a transfer',
  },
  'transfer-restore': {
    question: 'How do I return after expulsion?',
    answer:
      'The reinstatement application is reviewed by the deanery: the reason for the expulsion and the number of semesters passed matter. The accumulated academic difference is closed within a year with an individual plan.\n\nAn interview is scheduled within two weeks of the application.',
  },
  'it-password': {
    question: 'How do I recover my cabinet password?',
    answer:
      'On the sign-in screen click “Forgot password?” and enter your university email — the reset link arrives within a couple of minutes.\n\nIf the email does not arrive, check the Spam folder and write to the IT department support: access is restored the same day.',
  },
  'it-access': {
    question: 'Why does the schedule not open?',
    answer:
      'First refresh the page and check your connection: most often it is the traffic-saver mode on your phone.\n\nIf the schedule is still empty, try another browser and write to the IT department support — attach a screenshot, it speeds up the diagnostics.',
  },
  'it-mcp-assistant': {
    question: 'How do I connect an external AI assistant (MCP) to the cabinet?',
    answer:
      'MCP (Model Context Protocol) is an open protocol that lets assistants (Claude, ChatGPT, Cursor) securely read your cabinet data: today’s schedule, grades and unread notifications.\n\nIssue a personal token in the “MCP setup” tab, then on the “Connect your assistant (MCP)” page copy the ready JSON config and replace <YOUR_TOKEN> with your token. Access is read-only: the assistant sees only your data, and the token can be re-issued at any time.',
    ctaLabel: 'Open the MCP guide',
  },

  // ── Cabinet and sections (DIG-112 — one article per menu screen) ──
  'cab-dashboard': {
    question: 'How is the cabinet dashboard arranged?',
    answer:
      'The dashboard packs the week into one screen: the top card is “Your week” with upcoming classes and schedule changes, below are widgets for tasks, requests and notifications. Quick actions lead to sections: order a certificate, write to the deanery, open the schedule.\n\nThe set and order of widgets are configured in “Settings”: hide the tiles you do not need and raise the important ones. Settings are saved in your profile and work on both phone and desktop.',
    ctaLabel: 'Open the dashboard',
  },
  'cab-tasks': {
    question: 'How do I work with tasks and deadlines?',
    answer:
      'The “Tasks” section collects your tasks and the discipline deadlines: the nearest ones on top, overdue ones highlighted separately so they do not get lost. Check off a completed task — the counter of open tasks next to the menu item goes down.\n\nDeadline reminders arrive over the channels you chose; the channels and quiet hours are configured in “Settings → Notifications”.',
    ctaLabel: 'Open tasks',
  },
  'cab-schedule': {
    question: 'How do I find a class and see its details?',
    answer:
      'The schedule switches between Day / Week / Month views: on a phone the default is “Today”, on a desktop — the week. Tap a class — the details panel opens: time, room, teacher, class type; a reschedule or a cancellation is marked separately.\n\nThe Day and Week views have “Export” — a Markdown, Excel or PDF file; the class details have “Share” — a safe public link to that schedule day.',
    ctaLabel: 'Open the schedule',
  },
  'cab-grades': {
    question: 'Where are my grades, the gradebook and the group rating?',
    answer:
      '“Grades” opens with the “how am I doing” summary: average grade, credits and standing in the group. Points per assignment, attendance and the teacher’s comments live in the gradebook; the dynamics of a discipline are on its card.\n\nThe “Session” screen shows exams and consultations with an ICS subscription; “Group rating” is a table of students by average grade with a “top N%” mark.',
    ctaLabel: 'Open grades',
  },
  'cab-finance': {
    question: 'Where are the scholarship, contracts and payments?',
    answer:
      'The “Finance” section collects a student’s money matters in one place: the study format (state-funded or contract), the scholarship with its payment date, debts or a “none” mark when there are no debts.\n\nContracts and payments are listed with numbers and statuses; PDF documents become available after issuance. There is no real payment in the prototype — all amounts are fictional.',
    ctaLabel: 'Open finance',
  },
  'cab-requests': {
    question: 'How do I track the status of a request or certificate?',
    answer:
      'All orders live in “Requests & certificates”: the number like SR-2026-XXXXX is visible in the list and on the card, and the status follows the canon Submitted → Accepted → In progress → Ready → Issued.\n\nA status change sends a notification over your chosen channels; download the ready certificate as a PDF from the card — the document carries a QR code for authenticity checks. Someone else’s request cannot be opened: the attempt is recorded in the access log.',
    ctaLabel: 'Open requests',
  },
  'cab-notifications': {
    question: 'How do I configure notifications and quiet hours?',
    answer:
      'The notifications center shows events grouped by day: new ones on top, unread highlighted, and the “Mark all as read” button clears the marks. The bell in the header is a quick way to see the latest events from any section.\n\nDelivery channels — push, email, Telegram — are enabled per event type in “Settings → Notifications”; quiet hours are set there too, so messages do not arrive at night. Security notifications always arrive.',
    ctaLabel: 'Open notifications',
  },
  'cab-deanery': {
    question: 'How do I write to the deanery and get a reply?',
    answer:
      'The “Messages to the deanery” section: pick a topic and write your message — the ticket gets a number like TS-2026-XXXXX. The conversation with the manager happens in the ticket chat, the history is kept, and you can attach files.\n\nThe reply arrives as a notification; for one question, write in the existing chat rather than a new ticket — the manager sees the whole history.',
    ctaLabel: 'Write to the deanery',
  },
  'cab-feedback': {
    question: 'Where do I send a suggestion or a complaint?',
    answer:
      '“Feedback” is the channel to the leadership: the types “Suggestion”, “Complaint” and “Thank-you”, and the recipients — the deanery, the academic office, the programme leadership or the university.\n\nBy default the recipient sees your name and group; turn on “Anonymous” and the message stores no link to your account anywhere. A reply arrives within three business days; statuses: Under review → Answered → Resolved.',
    ctaLabel: 'Open feedback',
  },
  'cab-events': {
    question: 'How do I sign up for an event?',
    answer:
      'The “Events” board is filtered by chips: “This week”, “Career”, “Online”. Click “Sign up” on a card — your spot is reserved; clicking again cancels it.\n\nThe card shows “N spots left” — counted from the event capacity; the full description, date and venue or stream link are on the event page.',
    ctaLabel: 'Open events',
  },
  'cab-msp': {
    question: 'How do I support a student startup in MSP?',
    answer:
      'The “MSP” catalog works like Product Hunt: a feed of student projects, a “▲ Support” button — one vote per project, clicking again removes the vote. The “Launch of the day” block is the project with the most votes.\n\nA launch card has the description, the team and comments; you can enter your own team with the “Launch a project” button. All projects are fictional — this is a demo catalog of the concept.',
    ctaLabel: 'Open MSP',
  },
  'cab-dpo': {
    question: 'How do I enroll in a continuing-education programme?',
    answer:
      'The continuing-education catalog is filtered by format (online, offline, hybrid), price and duration — the chips combine. Click “Enroll” and the programme appears in the “My programmes” tab with a progress bar.\n\nThe “Documents” tab has the contracts, acceptance certificates, receipts and certificates of your programmes; downloading unlocks after the programme graduates.',
    ctaLabel: 'Open continuing education',
  },
  'cab-people': {
    question: 'How do I find a teacher and their contacts?',
    answer:
      'The “Directory” shows “My teachers” — only those who teach your disciplines, with subject marks. Search matches the name, email and phone, as well as the discipline: you can find who teaches the subject you need.\n\nA teacher’s card has contacts, office hours and “Upcoming classes” with them; favourite teachers can be starred in “Favourites”.',
    ctaLabel: 'Open the directory',
  },
  'cab-news': {
    question: 'Where do I read university news and announcements?',
    answer:
      'The “News” feed shows fresh university publications: opening a news item marks it “Read”, so you can see what you have already read.\n\nA news card has the full text, the date and a “Share” button: post to social networks or copy the link — it opens the same page.',
    ctaLabel: 'Open news',
  },
  'cab-profile': {
    question: 'How do I change the details in my profile?',
    answer:
      'The profile shows your full name, group, faculty, university email and student ID card; some details are masked — a student’s data is changed by the deanery, not by the student.\n\nFound an error in your details? The button on the profile card creates a deanery ticket with your data prefilled. The password and sessions are managed in “Settings → Security”.',
    ctaLabel: 'Open the profile',
  },
  'cab-settings': {
    question: 'How do I set the cabinet up for myself?',
    answer:
      '“Settings” are grouped by tabs: “Notifications” — channels and quiet hours; “Security” — password change and active sessions; “Appearance” — theme, language (Russian or English), font size and animations; “MCP setup” — the token for an external assistant. The home tab has the dashboard widgets.\n\nSettings apply immediately and are saved in your profile, not in the browser: they work on any device after signing in.',
    ctaLabel: 'Open settings',
  },
  'cab-ai-assistant': {
    question: 'What can I ask the AI assistant about?',
    answer:
      'The assistant answers from your cabinet data: the schedule for today and the days ahead, grades, requests, the scholarship, tasks. You can ask by text or voice; answers include links to sections for a one-click jump.\n\nThe assistant gives hints, but official actions belong in their own sections: requests in “Requests”, questions in “Messages to the deanery”. An external assistant (Claude, ChatGPT) reads the cabinet over MCP — see the connection article.',
    ctaLabel: 'Open the assistant',
  },
  'cab-staff': {
    question: 'How does a staff member work with the request queue?',
    answer:
      'The deanery staff cabinet: the “Summary” with the day’s numbers, the faculty “Requests” queue with SLA highlighting, student “Appeals” and faculty “Announcements”. Requests follow the status canon, and a reason is required for “Needs revision” and “Rejected”.\n\nReady certificates download as PDF with a verification QR code; appeals are closed with the “Resolved” status in the card chat. The /staff sections are visible only to the deanery staff role — a student gets a 403 from the server.',
    ctaLabel: 'Open the staff cabinet',
  },
};

/** EN-метки категорий (RU-канон — FAQ_CATEGORY_LABELS выше). */
export const FAQ_CATEGORY_LABELS_EN: Record<FaqCategory, string> = {
  STUDY: 'Studies and exams',
  CERTIFICATES: 'Certificates',
  SCHOLARSHIPS: 'Scholarships and payments',
  DORMITORY: 'Dormitory',
  TRANSFER: 'Transfer and reinstatement',
  IT: 'IT and access',
  CABINET: 'Cabinet screens',
};

/** EN-подсказки популярного поиска (каждая реально находит EN-статьи). */
export const POPULAR_QUERIES_EN: string[] = [
  'scholarship',
  'enrollment certificate',
  'dormitory',
  'retake',
  'transfer to another programme',
];

/** Метка категории по локали (RU — прежняя строка). */
export function faqCategoryLabel(locale: Locale, category: FaqCategory): string {
  return locale === 'en' ? FAQ_CATEGORY_LABELS_EN[category] : FAQ_CATEGORY_LABELS[category];
}

/** Подсказки популярного поиска по локали. */
export function popularQueries(locale: Locale = 'ru'): string[] {
  return locale === 'en' ? [...POPULAR_QUERIES_EN] : [...POPULAR_QUERIES];
}

/** Локализованная статья: RU-канон или EN-тексты с теми же id/related/href. */
function localizedFaqArticle(article: FaqArticle, locale: Locale): FaqArticle {
  if (locale !== 'en') return article;
  const en = FAQ_ARTICLES_EN_TEXT[article.id];
  // EN-тексты обязательны для каждой статьи (паритет проверяет тест);
  // отсутствие — fallback на канон без падения рендера.
  if (!en) return article;
  return {
    ...article,
    question: en.question,
    answer: en.answer,
    cta: article.cta ? { ...article.cta, label: en.ctaLabel ?? article.cta.label } : undefined,
  };
}

/** Каталог статей по локали (порядок и id совпадают с каноном). */
export function faqArticles(locale: Locale = 'ru'): FaqArticle[] {
  return FAQ_ARTICLES.map((article) => localizedFaqArticle(article, locale));
}

/** Локализованная статья по id. */
export function getFaqArticleLocalized(id: string, locale: Locale): FaqArticle | null {
  const article = getFaqArticle(id);
  return article ? localizedFaqArticle(article, locale) : null;
}

/** Связанные статьи статьи в её локали (id-связи — канон). */
export function getRelatedFaqArticlesLocalized(article: FaqArticle, locale: Locale): FaqArticle[] {
  return article.related
    .filter((id) => id !== article.id)
    .map((id) => getFaqArticleLocalized(id, locale))
    .filter((a): a is FaqArticle => a !== null);
}

/** Связанные статьи в порядке related, без самой статьи и пустых ссылок. */
export function getRelatedFaqArticles(article: FaqArticle): FaqArticle[] {
  return article.related
    .filter((id) => id !== article.id)
    .map((id) => getFaqArticle(id))
    .filter((a): a is FaqArticle => a !== null);
}

// ── Поиск (семантика Postgres FTS «russian») ─────────────────────────

const STOP_WORDS = new Set(
  [
    'а',
    'без',
    'более',
    'больше',
    'будет',
    'будто',
    'бы',
    'был',
    'была',
    'были',
    'было',
    'быть',
    'в',
    'вам',
    'вас',
    'весь',
    'во',
    'вот',
    'все',
    'всего',
    'всех',
    'вы',
    'где',
    'да',
    'даже',
    'два',
    'для',
    'до',
    'его',
    'ее',
    'ей',
    'если',
    'есть',
    'еще',
    'ж',
    'же',
    'за',
    'здесь',
    'и',
    'из',
    'или',
    'им',
    'иногда',
    'к',
    'ко',
    'как',
    'какая',
    'какие',
    'каких',
    'какой',
    'кого',
    'когда',
    'кто',
    'куда',
    'ли',
    'либо',
    'лишь',
    'мне',
    'мой',
    'мы',
    'на',
    'над',
    'надо',
    'наоборот',
    'например',
    'наш',
    'не',
    'него',
    'ней',
    'нет',
    'ни',
    'нибудь',
    'никогда',
    'ним',
    'них',
    'ничего',
    'но',
    'ну',
    'о',
    'об',
    'однако',
    'он',
    'она',
    'они',
    'оно',
    'опять',
    'от',
    'перед',
    'по',
    'под',
    'пожалуй',
    'почему',
    'при',
    'про',
    'просто',
    'пусть',
    'раз',
    'разве',
    'с',
    'со',
    'сам',
    'свой',
    'своей',
    'так',
    'такая',
    'также',
    'такие',
    'такой',
    'там',
    'тебя',
    'тем',
    'теперь',
    'то',
    'тогда',
    'только',
    'том',
    'тот',
    'три',
    'тут',
    'ты',
    'у',
    'уж',
    'уже',
    'хотя',
    'чей',
    'чем',
    'через',
    'что',
    'чтобы',
    'чуть',
    'это',
    'этот',
    'эта',
    'эти',
    'эту',
    'я',
    'можно',
    'нужно',
    'должен',
    'должна',
    'весь',
  ].map((word) => word.replaceAll('ё', 'е')),
);

/**
 * DIG-88 — английские стоп-слова для EN-корпуса и EN-запросов: без них
 * каждое EN-заглавие матчит «how/do/an» и поиск тонет в шуме. На RU-поиск
 * не влияет — фильтр применяется только к латинским токенам.
 */
const EN_STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'then',
  'do', 'does', 'did', 'done',
  'how', 'what', 'when', 'where', 'why', 'which', 'who',
  'is', 'are', 'am', 'was', 'were', 'be', 'been', 'being',
  'i', 'my', 'me', 'we', 'our', 'you', 'your', 'it', 'its',
  'of', 'on', 'in', 'to', 'for', 'at', 'by', 'with', 'from', 'as',
  'can', 'could', 'should', 'would', 'will', 'shall', 'may', 'might', 'must',
  'get', 'got', 'make', 'made', 'take', 'took', 'have', 'has', 'had',
  'this', 'that', 'these', 'those', 'there', 'their', 'they', 'them',
  'not', 'no', 'yes', 'so', 'up', 'out', 'about', 'into', 'over',
  'many', 'much', 'more', 'most', 'some', 'such', 'only', 'own', 'same',
  'than', 'too', 'very', 'just', 'need', 'one', 'two',
]);

/** Русский стеммер (упрощённый порт Snowball): суффиксы снимаются по группам. */
const ADJECTIVE_ENDINGS = [
  'ыми',
  'ими',
  'ого',
  'ому',
  'его',
  'ему',
  'ая',
  'яя',
  'ое',
  'ее',
  'ые',
  'ие',
  'ый',
  'ий',
  'ой',
  'ей',
  'ым',
  'им',
  'ем',
  'ую',
  'юю',
  'ою',
  'ею',
  'ых',
  'их',
];
const NOUN_ENDINGS = [
  'иями',
  'ями',
  'ами',
  'иях',
  'ях',
  'ием',
  'ией',
  'ии',
  'ий',
  'ия',
  'ие',
  'ье',
  'ья',
  'ей',
  'ой',
  'ам',
  'ям',
  'ом',
  'ах',
  'ов',
  'ев',
  'ию',
  'ью',
  'о',
  'е',
  'у',
  'ы',
  'и',
  'ю',
  'ь',
  'я',
  'а',
  'й',
];
const VERB_ENDINGS = [
  'айтесь',
  'тесь',
  'уется',
  'уются',
  'аются',
  'яется',
  'ишься',
  'ешься',
  'ится',
  'ятся',
  'ется',
  'аете',
  'ите',
  'ешь',
  'ишь',
  'ете',
  'йте',
  'ла',
  'ло',
  'ли',
  'на',
  'но',
  'ны',
  'ем',
  'ет',
  'ют',
  'ть',
  'ся',
  'сь',
  'л',
  'й',
];
const DERIVATIONAL_ENDINGS = ['ость', 'ост'];

const MIN_REMAINDER = 3;
const MIN_STEM_FOR_PREFIX = 4;

function stripLongest(word: string, endings: string[]): string {
  for (const ending of endings) {
    if (word.endsWith(ending) && word.length - ending.length >= MIN_REMAINDER) {
      return word.slice(0, -ending.length);
    }
  }
  return word;
}

function foldDoubleN(word: string): string {
  return word.endsWith('нн') ? word.slice(0, -1) : word;
}

/** Стем одного слова: adj → noun → derivational → verb, с защитой длины. */
function stem(word: string): string {
  let result = stripLongest(word, ADJECTIVE_ENDINGS);
  result = foldDoubleN(result);
  result = stripLongest(result, NOUN_ENDINGS);
  result = stripLongest(result, DERIVATIONAL_ENDINGS);
  result = stripLongest(result, VERB_ENDINGS);
  return result;
}

/** Слова запроса/текста: нормализация, отсев стоп-слов (RU и EN), стемминг. */
export function faqStems(text: string): string[] {
  const words =
    text
      .toLowerCase()
      .replaceAll('ё', 'е')
      .match(/[а-я]+|[a-z]+/g) ?? [];
  return words
    .filter((word) => !STOP_WORDS.has(word) && !EN_STOP_WORDS.has(word))
    .map((word) => (/^[a-z]+$/.test(word) ? word : stem(word)))
    .filter((stemmed) => stemmed.length >= 2);
}

/** Правило «короткий стем — префикс длинного»: стипенди ⊂ стипендиальн. */
function stemMatches(documentStems: ReadonlySet<string>, queryStem: string): boolean {
  for (const documentStem of documentStems) {
    if (Math.min(documentStem.length, queryStem.length) < MIN_STEM_FOR_PREFIX) {
      if (documentStem === queryStem) return true;
      continue;
    }
    if (documentStem.startsWith(queryStem) || queryStem.startsWith(documentStem)) {
      return true;
    }
  }
  return false;
}

/**
 * Поиск по заголовку и тексту: AND по значимым токенам, заголовок
 * ранжируется выше текста. Пустой или целиком стоп-словный запрос не
 * возвращает ничего — пустое состояние решает интерфейс.
 *
 * DIG-88: локаль выбирает корпус статей (EN-каталог для 'en'); RU — канон,
 * прежние результаты байт-в-байт.
 */
export function searchFaqArticles(query: string, locale: Locale = 'ru'): FaqArticle[] {
  const catalog = locale === 'en' ? faqArticles('en') : FAQ_ARTICLES;
  const queryStems = [...new Set(faqStems(query))];
  if (queryStems.length === 0) return [];

  const scored = catalog.flatMap((article) => {
    const titleStems = new Set(faqStems(article.question));
    const textStems = new Set(faqStems(article.answer));
    let score = 0;
    for (const queryStem of queryStems) {
      const inTitle = stemMatches(titleStems, queryStem);
      const inText = stemMatches(textStems, queryStem);
      if (!inTitle && !inText) return [];
      score += inTitle ? 10 : 1;
    }
    return [{ article, score }];
  });

  return scored
    .sort(
      (a, b) => b.score - a.score || catalog.indexOf(a.article) - catalog.indexOf(b.article),
    )
    .map(({ article }) => article);
}
