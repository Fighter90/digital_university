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
  // DIG-73 — страница документации MCP.
  'menu.mcp': 'Подключить ассистента (MCP)',
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
  // DIG-73 — страница документации MCP.
  'title.mcp': 'Подключение ассистента (MCP)',
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

  // ── DIG-86 — вкладка «Доступность»: крупный текст и без эффектов ────────
  'settings.tab.accessibility': 'Доступность',
  'settings.a11yTitle': 'Крупный текст и без эффектов',
  'settings.a11yHint':
    'Режим для слабовидящих: текст крупнее, интерфейс — без анимаций и теней. Настройка не зависит от системных и применяется ко всему кабинету.',
  'settings.a11yLargeText': 'Крупный текст',
  'settings.a11yLargeTextHint':
    'Базовый размер 125%, усиленные начертания и увеличенные отступы — по всему кабинету.',
  'settings.a11yNoEffects': 'Без эффектов',
  'settings.a11yNoEffectsHint':
    'Анимации, плавные появления и тени отключены — интерфейс статичный.',
  'settings.a11ySaved': 'Сохранено — режим доступности применён ко всему кабинету.',
  'settings.a11yIdle': 'Изменения сохраняются сразу и применяются ко всему кабинету.',

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

  // ── DIG-84 — /grades: сводка успеваемости ─────────────────────────────────
  // RU-значения байт-в-байт равны прежним захардкоженным строкам экрана.
  'grades.semestersAria': 'Семестры',
  'grades.term.fall.short': 'Осень',
  'grades.term.spring.short': 'Весна',
  'grades.term.fall.full': 'Осенний семестр',
  'grades.term.spring.full': 'Весенний семестр',
  'grades.gpaRingLabel': 'Средний балл семестра',
  'grades.gpaTitle': 'Средний балл',
  'grades.overallPrefix': 'За всё время:',
  'grades.deltaTo': 'к {semester}',
  'grades.credits': 'Кредиты',
  'grades.creditsSuffix': 'из {required}',
  'grades.groupRating': 'Рейтинг в группе',
  'grades.rankOf': '{rank} из {total}',
  'grades.howCalculated': 'Как считается',
  'grades.bestPercent': 'Вы входите в {percent}% лучших в группе',
  'grades.soleStudent': 'Вы — единственный студент в группе',
  'grades.errorTitle': 'Успеваемость не загрузилась',
  'grades.errorDesc': 'Обновите страницу — если ошибка повторится, сообщите в деканат.',
  'grades.emptyTitle': 'Оценок пока нет',
  'grades.sessionLink': 'Сессия — расписание консультаций и экзаменов',
  'grades.appealLink': 'Нашли ошибку в оценке? Написать в деканат',

  // подсказки сокращений простыми словами
  'grades.gpaHint':
    'GPA — средний балл, взвешенный кредитами дисциплин: дисциплина с 5 кредитами влияет вдвое сильнее, чем с 2.5. Идущие дисциплины входят предварительной накопленной оценкой.',
  'grades.creditsHint':
    'Кредиты — единицы объёма дисциплин (ECTS). На всю программу нужно 240 кредитов; зачитываются завершённые дисциплины с оценкой не ниже порога зачтения.',
  'grades.creditsShortHint': 'Кредит — объём дисциплины: 1 кредит ≈ 36 академических часов.',
  'grades.percentileHint':
    'Место в группе считается по среднему баллу (GPA) за всё время среди студентов группы. Средний балл — взвешенная кредитами оценка по всем дисциплинам; «в N% лучших» — доля группы с баллом не выше вашего.',

  // карточки дисциплин: пороги и допуск
  'grades.creditsShort': '{credits} кр.',
  'grades.level.excellent': 'Отлично',
  'grades.level.good': 'Хорошо',
  'grades.level.satisfactory': 'Удовлетворительно',
  'grades.level.belowPass': 'Ниже порога',
  'grades.level.noGrades': 'Оценок ещё нет',
  'grades.level.riskUnreachable': 'Не дотянуть до порога',
  'grades.level.passSecured': 'Порог уже набран',
  'grades.level.passNotGuaranteed': 'Порог ещё не гарантирован',
  'grades.maxPossible': 'из возможных {score}',
  'grades.noTeacher': 'Преподаватель не указан',
  'grades.admission.graded': 'Экзамен сдан',
  'grades.admission.admitted': 'Допуск к экзамену есть',
  'grades.admission.notAdmitted': 'Допуска к экзамену нет',

  // светофор состояния
  'grades.tl.debtsTitle': 'Есть долги',
  'grades.tl.debtsPhrase': 'Активных долгов: {count}. Ближайшая пересдача — {discipline}',
  'grades.tl.toDebts': 'К долгам',
  'grades.tl.riskTitle': 'Есть риски',
  'grades.tl.riskPhrase':
    '{count} {word} в зоне риска: в {discipline} порог {threshold} уже не дотянуть — обсудите с преподавателем',
  'grades.tl.toSession': 'К сессии',
  'grades.tl.okTitle': 'Всё хорошо',
  'grades.tl.okPhrase': 'Все текущие оценки выше порога зачтения — продолжайте в том же духе',
  'grades.tl.idleTitle': 'Оценок пока нет',
  'grades.tl.idlePhrase': 'В этом семестре ещё нет ни одной оценки',

  // пустой семестр и «первая контрольная»
  'grades.kind.exam': 'Экзамен',
  'grades.kind.credit': 'Зачёт',
  'grades.emptyNote.assessment':
    'Первая контрольная — {kind} по «{discipline}» {date}. Оценки появятся после неё.',
  'grades.emptyNote.current':
    'В этом семестре оценок пока нет — они появятся после первой контрольной.',
  'grades.emptyNote.past':
    'За этот семестр оценок не выставлено — они появятся после первой контрольной.',

  // долги
  'grades.debtsTitle': 'Долги',
  'grades.debt.assigned': 'Назначена',
  'grades.debt.overdue': 'Просрочена',
  'grades.debt.closed': 'Закрыта',
  'grades.debt.overduePhrase': 'Пересдача была {date} — долг не закрыт',
  'grades.debt.assignedToday': 'Пересдача назначена на {date} — сегодня',
  'grades.debt.assignedIn': 'Пересдача назначена на {date} (осталось {days} {word})',
  'grades.debt.closedPhrase': 'Долг закрыт — пересдача {date} зачтена',
  'grades.retakeSignup': 'Записаться на пересдачу',

  // ── DIG-84 — зачётная книжка и выписка ────────────────────────────────────
  'gradebook.studentsOnlyDesc':
    'Зачётная книжка показывает оценки студента — у сотрудника деканата этот раздел пуст.',
  'gradebook.downloadTranscript': 'Скачать выписку PDF',
  'gradebook.subtitle':
    'Оценки по семестрам с итогами. Выписка скачивается сразу — без заявки и очереди.',
  'gradebook.overallAverage': 'Средний балл за всё время',
  'gradebook.creditsEarned': 'Кредиты набрано',
  'gradebook.creditsOf': '{earned} из {required}',
  'gradebook.emptyTitle': 'Оценок пока нет',
  'gradebook.emptyDesc':
    'Как только деканат выставит первые оценки, они появятся здесь по семестрам. Выписку можно скачать уже сейчас — она будет пустой.',
  'gradebook.averageOf': 'Средний балл: {average}',
  'gradebook.creditsLabel': 'Кредиты: {earned} из {total}',
  'gradebook.col.discipline': 'Дисциплина',
  'gradebook.col.control': 'Контроль',
  'gradebook.col.credits': 'Кредиты',
  'gradebook.col.final': 'Итог',
  'gradebook.col.date': 'Дата',
  'gradebook.noFinalYet': 'Итог ещё не выставлен',
  'gradebook.semesterEmpty':
    'Оценок в семестре ещё нет — итог появится, когда деканат выставит оценки.',
  'control.EXAM': 'Экзамен',
  'control.DIFF_CREDIT': 'Диф. зачёт',
  'control.CREDIT': 'Зачёт',

  // выписка PDF (документ)
  'transcript.title': 'Выписка из зачётной книжки',
  'transcript.university': 'Цифровой деканат (демонстрационный вуз)',
  'transcript.concept': 'Концепт для конкурса. Все данные вымышленные.',
  'transcript.student': 'Студент: {name}',
  'transcript.studentMissing': 'Студент: —',
  'transcript.groupCourse': 'Группа: {group}   Курс: {course}',
  'transcript.program': 'Программа: {program}',
  'transcript.gradebookNo': 'Номер зачётной книжки: {number}',
  'transcript.issueDate': 'Дата выдачи: {date}',
  'transcript.col.discipline': 'Дисциплина',
  'transcript.col.control': 'Контроль',
  'transcript.col.credits': 'Кр',
  'transcript.col.final': 'Итог',
  'transcript.col.date': 'Дата',
  'transcript.semesterLine': 'Средний балл семестра: {average}   Кредиты: {earned} из {total}',
  'transcript.noGrades': 'Оценки в зачётной книжке отсутствуют.',
  'transcript.overallAverage': 'Средний балл за всё время: {average}',
  'transcript.creditsEarned': 'Кредиты набрано: {earned} из {required}',
  'transcript.verifyTitle': 'Проверка подлинности документа',
  'transcript.verifyCode': 'Код проверки: {code}',
  'transcript.verifyLink': 'Проверить по ссылке или QR-коду: {url}',
  'transcript.generated': 'Электронный документ прототипа. Сформировано: {datetime}',

  // ── DIG-84 — карточка заявки (/requests/[номер]) ──────────────────────────
  'requests.subtitle':
    'Справки и заявления в одном месте: видно, на каком шаге каждая заявка и что от вас ждут дальше.',
  'requests.backAll': '← Все заявки',
  'requests.submittedPrefix': 'подана',
  'requests.resultTitle': 'Результат',
  'requests.certificateReady': 'Справка готова',
  'requests.certificateDesc':
    'Скачайте PDF или проверьте подлинность по коду — страница проверки открывается без входа (для банка, военкомата, работодателя).',
  'requests.downloadCertificate': 'Скачать справку (PDF)',
  'requests.verifyAuthenticity': 'Проверить подлинность',
  'requests.historyTitle': 'История заявки',
  'requests.expectedAfterFix': 'Срок — после исправления',
  'requests.readyBy': 'Готовность до {date}',
  'requests.ledBy': 'Ведёт: {name}',
  'requests.ledByUnassigned': 'сотрудник деканата',
  'requests.fixAlert': 'Нужна доработка. Что исправить: {reason}',
  'requests.rejectedAlert': 'Отклонено: {reason}',
  'requests.documentReady': 'Документ готов',
  'requests.documentDesc':
    'PDF с QR-кодом проверки. Скачать можно сколько угодно раз — документ формируется при скачивании.',
  'requests.previewAria': 'Превью документа {number}',
  'requests.previewFallback': 'Превью не поддерживается браузером — скачайте PDF ниже.',
  'requests.cancelRequest': 'Отменить заявку',
  'requests.paramsTitle': 'Параметры заявки',
  'requests.attachments': 'Вложения',
  'requests.param.language': 'Язык',
  'requests.param.destination': 'Куда предоставляется',
  'requests.param.copies': 'Экземпляров',
  'requests.param.delivery': 'Способ получения',
  'requests.param.comment': 'Комментарий',
  'requests.fix.label': 'Что исправлено',
  'requests.fix.placeholder': 'Например: исправил ФИО латиницей, приложил скан',
  'requests.fix.success': 'Заявка отправлена повторно',
  'requests.email.send': 'Отправить на email',
  'requests.email.sending': 'Отправляем…',
  'requests.email.sentTo': 'Отправлено на {email}',
  'requests.copy': 'Копировать',
  'requests.copied': 'Скопировано',
  'requests.copyAria': 'Скопировать номер заявки {number}',

  // ── DIG-84 — AI-инсайт «Что изменилось» ───────────────────────────────────
  'insight.title': 'Что изменилось',
  'insight.badge': 'AI-анализ',
  'insight.subtitle': 'Демо-анализ по вашим оценкам {semester}, без внешних сервисов.',
  'insight.chartAria': 'График среднего балла',
  'insight.pointAria': '{date} — средний балл {average} из 100',
  'insight.currentPrefix': '{date} — средний балл',
  'insight.outOf100': 'из 100',
  'insight.deltaToPrev': 'к предыдущей',
  'insight.firstWork': 'первая работа семестра',
  'insight.worksTitle': 'Работы в среднем ({count}):',
  'insight.scoreOf': '{score} из {max}',
  'insight.h.none': 'За месяц новых оценок не было',
  'insight.d.none': 'Средний балл держится на {current} из 100.',
  'insight.h.new.one': 'За месяц появилась новая работа — средний балл достиг {current} из 100',
  'insight.h.new.many': 'За месяц появились {count} {word} — средний балл достиг {current} из 100',
  'insight.d.new.first': 'Средний балл задаёт работа «{work}» ({discipline}, {score} из {max}).',
  'insight.h.up': 'Средний балл за месяц вырос на {delta} {word}: было {baseline}, стало {current}',
  'insight.h.down':
    'Средний балл за месяц снизился на {delta} {word}: было {baseline}, стало {current}',
  'insight.h.flat': 'Средний балл за месяц не изменился: {current} из 100',
  'insight.d.flat': 'Свежие работы ({count}) не сдвинули средний.',
  'insight.d.topWork':
    'Сильнее всего средний {verb} «{work}» ({discipline}, {score} из {max}): {value} {word}.',
  'insight.verb.up': 'подняла',
  'insight.verb.down': 'снизила',
} as const;

export type RuDictionary = typeof ru;
