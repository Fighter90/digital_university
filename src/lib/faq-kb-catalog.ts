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
  'STUDY' | 'CERTIFICATES' | 'SCHOLARSHIPS' | 'DORMITORY' | 'TRANSFER' | 'IT';

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
];

export const FAQ_CATEGORY_LABELS: Record<FaqCategory, string> = {
  STUDY: 'Учёба и сессия',
  CERTIFICATES: 'Справки',
  SCHOLARSHIPS: 'Стипендии и выплаты',
  DORMITORY: 'Общежитие',
  TRANSFER: 'Перевод и восстановление',
  IT: 'IT и доступ',
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
};

/** EN-метки категорий (RU-канон — FAQ_CATEGORY_LABELS выше). */
export const FAQ_CATEGORY_LABELS_EN: Record<FaqCategory, string> = {
  STUDY: 'Studies and exams',
  CERTIFICATES: 'Certificates',
  SCHOLARSHIPS: 'Scholarships and payments',
  DORMITORY: 'Dormitory',
  TRANSFER: 'Transfer and reinstatement',
  IT: 'IT and access',
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
