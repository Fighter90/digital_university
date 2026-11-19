# Tasks — DIG-93 EN: демо-контент без кириллицы

## Red

- [x] tests/i18n-en-cabinet.test.tsx: расширенный «no Cyrillic on EN» — каркас
      (UserMenu-инициалы, SideNav, AI-гид), EN-хелперы, реальные билдеры
      (toTodayView/toDeadlineViews/getTasks-вью/localizeSessionData), страницы
      (dashboard, tasks, grades, session, requests, feedback, deanery, people,
      msp, dpo, profile, more) при locale=en.

## Люди и инициалы

- [x] ru-translit: PEOPLE_NAME_EN (транслит всех демо-персон).
- [x] en-demo-content: enPersonName / localizePersonName /
      localizeProfileFullName / localizeInitials (EN из маппинга или email).
- [x] UserMenu: инициалы и шапка меню по локали.

## Словарь и меню

- [x] ru/en: menu.finance / menu.msp / menu.events (RU — прежние подписи
      nav-items); MENU_KEY_BY_HREF += /finance /msp /events.
- [x] ru/en: aiguide.* (пилюля, панель, экскурсия, вопрос) +
      profile.term.fall/spring; profile-format.currentAcademicPeriod(locale).

## Агрегаты (guard locale, RU байт-в-байт)

- [x] dashboard: toTodayView / toDeadlineViews / toProgressView(+debts) /
      firstName — EN-дисциплины, преподаватели, заметки, даты.
- [x] tasks: getTasks(locale) + localizeTasksData (6 источников; номер
      «ЗД-…» — транслит; глагол, собранный словарём, разбирается).
- [x] session: getSession(locale) + localizeSessionData (шапка, статусы,
      причины, преподаватели, заметки пересдач; матчинг заявок — канон).
- [x] gradebook: getGradebook(locale) — семестры/дисциплины; страница —
      шапка владельца (имя/группа).
- [x] grade-insight: toWork(locale) — EN-имена работ/дисциплин.
- [x] event-details: toEventDetailsView(locale) — заметки/причины/авторы.

## Страницы и компоненты

- [x] dashboard: NewsSection по id сида (NEWS_EN), firstName героя.
- [x] requests: RequestCard — title/reason через localize*; страница чистая.
- [x] feedback: responsePromise(locale), locale в FeedbackList/Outcomes,
      тексты сида по id.
- [x] deanery: id последнего сообщения в TicketListItem, превью по id,
      композер — EN-названия заявок/дисциплин (value — канон).
- [x] people: имена/инициалы/«Ваши дисциплины» по локали (список + [id]).
- [x] msp: авторы — транслит, логотип-буква из EN-титула (карточка, запуск
      дня, комментарии).
- [x] dpo: facultyTag через enFacultyLabel в localizeProgram.
- [x] profile: имя и семестр по локали.
- [x] schedule: EventCard (дисциплина/преподаватель/заметки), фильтр
      преподавателя (подпись по локали, value — канон), панель деталей.
- [x] shell: locale в AiGuide/AiFab; ai-guide EN-контент туров и сценариев;
      voice-input — подписи и язык распознавания.

## Проверка

- [x] npx vitest run — все зелёные (включая расширенный no-Cyrillic).
- [x] Живой аудит прод-сборки (du-locale=en): скоуп задачи — 0 кириллицы.
- [ ] node scripts/swarm/gates.mjs → GATES_SUMMARY: green.
