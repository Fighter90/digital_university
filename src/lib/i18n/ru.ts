// DIG-69 — русский словарь интерфейса (дефолтная локаль).
//
// Плоские ключи через точку; EN-словарь (./en) типизирован этим же набором
// ключей, поэтому расхождение наборов ловится на компиляции и юнит-тестом.
//
// ВАЖНО: значения, которые уже рендерятся в интерфейсе на RU, обязаны
// совпадать байт-в-байт с прежними строками — юнит-тесты и e2e рендерят
// дефолтную (RU) локаль.
export const ru = {
  // ── меню (nav-items) ─────────────────────────────────────────────────────
  'menu.dashboard': 'Главная',
  'menu.tasks': 'Задачи',
  'menu.schedule': 'Расписание',
  'menu.grades': 'Успеваемость',
  'menu.gradesShort': 'Оценки',
  'menu.requests': 'Заявки и справки',
  'menu.requestsShort': 'Заявки',
  'menu.notifications': 'Уведомления',
  'menu.deanery': 'Связь с деканатом',
  'menu.feedback': 'Обратная связь',
  'menu.help': 'Вопросы и ответы',
  'menu.guide': 'Справка',
  'menu.people': 'Справочник',
  'menu.aiAssistant': 'AI-ассистент',
  'menu.profile': 'Профиль',
  'menu.settings': 'Настройки',
  'menu.more': 'Ещё',
  'menu.staff': 'Сводка',
  'menu.staffRequests': 'Заявки',
  'menu.staffAppeals': 'Обращения',
  'menu.staffAnnouncements': 'Объявления',

  // ── заголовки страниц ────────────────────────────────────────────────────
  'title.dashboard': 'Главная',
  'title.staffHome': 'Кабинет сотрудника',
  'title.tasks': 'Задачи',
  'title.schedule': 'Расписание',
  'title.grades': 'Успеваемость',
  'title.gradebook': 'Зачётная книжка',
  'title.session': 'Сессия',
  'title.requests': 'Мои заявки',
  'title.notifications': 'Уведомления',
  'title.deanery': 'Обращения в деканат',
  'title.feedback': 'Обратная связь руководству',
  'title.help': 'Вопросы и ответы',
  'title.guide': 'Как пользоваться кабинетом',
  'title.people': 'Справочник',
  'title.profile': 'Профиль',
  'title.settings': 'Настройки',
  'title.more': 'Ещё',
  'title.news': 'Новости и объявления',
  'title.services': 'Каталог сервисов',
  'title.staffDashboard': 'Сводка деканата',
  'title.staffRequests': 'Очередь заявок',
  'title.staffAppeals': 'Обращения студентов',
  'title.staffAnnouncements': 'Объявления',

  // ── плашка концепта ──────────────────────────────────────────────────────
  'concept.pill': 'Концепт для конкурса',
  'concept.banner': 'Концепт для конкурса, не официальный сервис вуза. Все данные вымышленные.',
  'concept.bannerAria': 'Концепт для конкурса',

  // ── каркас (Shell: меню / таб-бар / поиск / выход) ───────────────────────
  'shell.skipToContent': 'К содержимому',
  'shell.navAria': 'Разделы кабинета',
  'shell.tabsAria': 'Мобильная навигация',
  'shell.brandAria': 'Цифровой деканат — на главную',
  'shell.brandName': 'Цифровой деканат',
  'shell.searchAria': 'Поиск по кабинету (Command+K)',
  'shell.searchPlaceholder': 'Найти пару, преподавателя, справку…',
  'shell.assistantAria': 'AI-ассистент',
  'shell.userMenuAria': 'Меню пользователя',
  'shell.logout': 'Выйти',
  'shell.deadlineTitle': 'Ближайший дедлайн',

  // ── переключатель языка ──────────────────────────────────────────────────
  'locale.switchAria': 'Язык интерфейса / Language',
  'locale.ru': 'Русский',
  'locale.en': 'English',

  // ── фильтры заявок (lib/requests-view) ──────────────────────────────────
  'filter.ALL': 'Все',
  'filter.IN_WORK': 'В работе',
  'filter.NEEDS_ACTION': 'Нужно действие',
  'filter.READY': 'Готовы',
  'filter.ARCHIVE': 'Архив',

  // ── статусы заявок (канон + легаси) ─────────────────────────────────────
  'status.SUBMITTED': 'Подана',
  'status.ACCEPTED': 'Принята',
  'status.IN_PROGRESS': 'В работе',
  'status.READY': 'Готова',
  'status.ISSUED': 'Выдана',
  'status.NEEDS_FIX': 'Нужна доработка',
  'status.REJECTED': 'Отклонена',
  'status.CANCELLED': 'Отменена',
  'status.NEEDS_REVISION': 'Требует правок',
  'status.COMPLETED': 'Выполнена',

  // ── степпер конвейера ────────────────────────────────────────────────────
  'stepper.stepOf': 'Шаг {step} из {total}',
  'stepper.stepOfLabel': 'Шаг {step} из {total}: {label}',

  // ── карточка заявки ──────────────────────────────────────────────────────
  'card.submittedAt': 'подана {date}',
  'card.downloadPdf': 'Скачать PDF',
  'card.fix': 'Исправить',
  'card.cancel': 'Отменить',
  'card.cancelPending': 'Отменяем…',
  'card.cancelConfirm': 'Отменить заявку? Действие нельзя отменить.',
  'card.openAria': 'Открыть заявку {number} — {title}',

  // ── строка следующего действия (nextActionLine) ──────────────────────────
  'next.NEEDS_FIX': 'Нужна доработка: {reason}',
  'next.NEEDS_FIX_BARE': 'Нужна доработка',
  'next.REJECTED': 'Отклонено: {reason}',
  'next.REJECTED_BARE': 'Отклонено деканатом',
  'next.READY': 'Документ готов к скачиванию',
  'next.ISSUED': 'Выдан {date}',
  'next.CANCELLED': 'Отменена {date}',
  'next.ACCEPTED_UNTIL': 'Готовность до {date}',
  'next.ACCEPTED_BARE': 'Заявка принята деканатом',
  'next.IN_PROGRESS_UNTIL': 'Готовность до {date}',
  'next.IN_PROGRESS_BARE': 'Деканат готовит документ',
  'next.SUBMITTED_UNTIL': 'Готовность до {date}',
  'next.SUBMITTED_BARE': 'Ожидает приёма деканатом',

  // ── действия сотрудника (staff-transitions: подписи кнопок) ─────────────
  'action.ACCEPTED': 'Принять',
  'action.IN_PROGRESS': 'Взять в работу',
  'action.READY': 'Готова к выдаче',
  'action.ISSUED': 'Выдана',
  'action.NEEDS_FIX': 'Нужна правка данных',
  'action.NEEDS_REVISION': 'Нужна доработка',
  'action.COMPLETED': 'Выполнена',
  'action.REJECTED': 'Отклонить',
  'action.CANCELLED': 'Отменить',

  // ── подтверждения переходов (история событий, aria) ─────────────────────
  'taction.ACCEPTED': 'Заявка принята',
  'taction.IN_PROGRESS': 'Заявка принята в работу',
  'taction.READY': 'Заявка готова к выдаче',
  'taction.ISSUED': 'Документ выдан',
  'taction.NEEDS_FIX': 'Заявка возвращена на правку данных',
  'taction.NEEDS_REVISION': 'Заявка возвращена на доработку',
  'taction.COMPLETED': 'Заявка выполнена',
  'taction.REJECTED': 'Заявка отклонена',
  'taction.CANCELLED': 'Заявка отменена',

  // ── форма смены статуса (сотрудник) ─────────────────────────────────────
  'staffForm.title': 'Сменить статус',
  'staffForm.reasonLabel': 'Причина (обязательна для «Нужна доработка» и «Отклонить»)',

  // ── статусы обращений (appeal-status) ───────────────────────────────────
  'appeal.OPEN': 'Новое',
  'appeal.ANSWERED': 'Отвечено',
  'appeal.CLOSED': 'Закрыто',

  // ── пустые состояния главных списков ────────────────────────────────────
  'empty.requestsTitle': 'Заявок пока нет',
  'empty.requestsDesc':
    'Закажите справку или напишите заявление — заявка появится здесь вместе со сроком готовности.',
  'empty.requestsStaffTitle': 'Заявки студентов',
  'empty.requestsStaffDesc':
    'Раздел показывает заявки студента: у сотрудника он пуст. Чтение списков сотрудником фиксируется в журнале доступа.',
  'empty.noMatchTitle': 'Ничего не найдено',
  'empty.noMatchDesc': 'Попробуйте другой номер или название — или сбросьте фильтр.',
  'empty.resetFilters': 'Сбросить фильтры',
  'empty.staffOnlyTitle': 'Доступно студентам',
  'empty.tasksStaffTitle': 'Экран доступен студентам',
  'empty.deaneryStaffDesc':
    'Обращения с перепиской открываются в кабинете студента. Интерфейс менеджера — в кабинете сотрудника.',
  'empty.feedbackStaffDesc':
    'Предложения, жалобы и благодарности руководству создаются в кабинете студента.',
  'empty.tasksStaffDesc':
    'Задачи собираются по учебной группе и личным данным студента. Кабинет сотрудника с очередью заявок — отдельная задача.',

  // ── список заявок: поиск и CTA ──────────────────────────────────────────
  'requests.searchAria': 'Поиск по номеру и названию заявки',
  'requests.searchPlaceholder': 'Номер или название: ЗД-2026, военкомат…',
  'requests.filtersAria': 'Фильтры заявок',
  'cta.orderCertificate': 'Заказать справку',

  // ── кнопки форм (главные действия) ──────────────────────────────────────
  'btn.submit': 'Отправить',
  'btn.submitting': 'Отправляем…',
  'btn.saving': 'Сохраняем…',
  'btn.resubmit': 'Отправить повторно',
  'btn.askQuestion': 'Отправить вопрос',
  'btn.sendFeedback': 'Отправить обращение',
  'btn.createTicket': 'Создать обращение',
  'btn.save': 'Сохранить',
  'btn.cancel': 'Отмена',
  'btn.retry': 'Повторить',

  // ── подписи настроек (settings-tabs) ────────────────────────────────────
  'settings.tab.home': 'Главная',
  'settings.tab.notifications': 'Уведомления',
  'settings.tab.security': 'Безопасность',
  'settings.tab.appearance': 'Вид',
  'settings.tab.mcp': 'Настройка MCP',
  'settings.languageTitle': 'Язык интерфейса',
  'settings.languageHint': 'Переключение интерфейса кабинета между русским и английским.',

  // ── тосты ────────────────────────────────────────────────────────────────
  'toast.saved': 'Сохранено',
  'toast.savedDesc': 'Изменения применены',
  'toast.localeChanged': 'Язык интерфейса изменён',
  'toast.error': 'Не получилось',
  'toast.errorDesc': 'Что-то пошло не так — попробуйте ещё раз.',

  // ── DIG-42 — «Дополнительное образование» (/dpo) ─────────────────────────
  'title.dpo': 'Дополнительное образование',
  'menu.dpo': 'Доп. образование',
  'dpo.subtitle':
    'Курсы и программы повышения квалификации: каталог, ваши записи и документы. Данные вымышленные, зачисляемости в прототипе нет.',
  'dpo.tab.catalog': 'Каталог программ',
  'dpo.tab.my': 'Мои программы',
  'dpo.tab.docs': 'Документы',
  'dpo.format.all': 'Все',
  'dpo.format.online': 'Онлайн',
  'dpo.format.offline': 'Офлайн',
  'dpo.format.hybrid': 'Гибрид',
  'dpo.card.hours': '{hours} ак. часов',
  'dpo.card.startsAt': 'Старт {date}',
  'dpo.price.free': 'Бесплатно для прототипа',
  'dpo.price.rub': '{price} ₽',
  'dpo.enroll': 'Записаться',
  'dpo.enroll.done': 'Вы записаны ✓',
  'dpo.enroll.alreadyTitle': 'Вы уже записаны на эту программу',
  'dpo.enroll.studentsOnly': 'Запись доступна студентам',
  'dpo.continue': 'Продолжить',
  'dpo.my.continueHint': 'Материалы курса появятся в полной версии кабинета',
  'dpo.my.progressOf': '{percent} %',
  'dpo.my.progressAria': 'Прогресс по программе «{title}»',
  'dpo.my.emptyTitle': 'Пока нет записей',
  'dpo.my.emptyDesc': 'Выберите программу в каталоге и запишитесь — она появится здесь.',
  'dpo.docs.emptyTitle': 'Документов пока нет',
  'dpo.docs.emptyDesc': 'Договоры, акты и сертификаты по вашим программам появятся здесь.',
  'dpo.catalog.emptyTitle': 'Программы не найдены',
  'dpo.catalog.emptyDesc': 'Под выбранный формат ничего не подошло — попробуйте другой фильтр.',
  'dpo.doc.contract': 'Договор',
  'dpo.doc.act': 'Акт',
  'dpo.doc.receipt': 'Квитанция',
  'dpo.doc.certificate': 'Сертификат',
  'dpo.download': 'Скачать',
  'dpo.doc.downloadHint': 'Доступно после выпуска',
} as const;

export type RuDictionary = typeof ru;
