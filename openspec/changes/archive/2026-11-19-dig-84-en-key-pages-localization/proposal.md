# Proposal: локализация EN — довести перевод ключевых страниц (DIG-84, BUG-09)

## Зачем

QA-регресс 18.11.2026 (BUG-09, средний): переключение кабинета на EN переводит
шапку и заголовки («Academic performance»), но основное содержимое ключевых
страниц остаётся русским: «Осень 26/27», «Средний балл», «За всё время»,
«Рейтинг в группе», «Вы — единственный студент в группе». Причина DIG-69:
локализованы только каркас (Shell, меню, статусы заявок, степпер) и заголовки
разделов; содержимое экранов /grades, зачётки/выписки и карточки заявки
рендерится захардкоженными RU-строками из страниц и presentation-хелперов.

## Что

- Словари `src/lib/i18n/{ru,en}.ts`: новые ключи `grades.*`, `gradebook.*`,
  `transcript.*`, `requests.*`, `insight.*` — RU-значения байт-в-байт равны
  нынешним строкам интерфейса (юнит- и e2e-тесты рендерят дефолтную RU-локаль).
- Presentation-хелперы получают необязательный хвостовой параметр
  `locale: Locale = 'ru'` (конвенция DIG-69: `pipelineStepLabel(locale, …)`
  для новых, хвостовой параметр для существующих — вызовы и RU-тесты не
  ломаются): `semesterShortLabel`, `semesterKeyLabel`, `bestPercentLabel`,
  `toDisciplineCards`, `trafficLight`, `nextAssessment`, `emptySemesterNote`,
  `debtBadge`, `debtDatePhrase`, `formatDateShort`, `formatScore`,
  `buildGradeInsight` (через `getGradeInsight`), хелперы карточки заявки
  (`expectedReadyLabelFromEvents`, `requestWizardView`, `timelineEventText`).
- Страницы: `/grades` (сводка: GPA-кольцо, кредиты, рейтинг, пилюли семестров,
  дельта «к весне 25/26», светофор, карточки дисциплин с порогами, долги,
  пустые/ошибочные состояния, подсказки-тултипы), `/grades/gradebook`
  (зачётная книжка: сводки семестров, таблица/карточки, CTA выписки),
  выписка PDF `/api/grades/transcript` (все строки документа по локали),
  `/requests/[номер]` (карточка заявки: статус-пилюля, «подана», «Ведёт»,
  параметры и вложения мастера, документ, таймлайн, формы),
  `/requests` (подзаголовок списка).
- Компоненты: `GradeInsightCard`, `GradebookList`, `RequestHistoryTimeline`,
  `RequestFixForm`, `RequestEmailButton`, `CopyRequestNumber` — пропс
  `locale` (дефолт 'ru').

## Non-goals

- `/dashboard` — закрывается задачей dashboard-EN той же волной (не дублируем).
- Карточка дисциплины `/grades/[disciplineId]` и экран `/grades/session` —
  отдельные фреймы Figma вне перечисленных в задаче ключевых страниц.
- Демо-контент (ФИО, названия дисциплин, тексты событий истории, новости)
  остаётся RU по дизайну.
- Менеджерская поверхность `/staff*` не входит в задачу.

## DoD

- EN-рендер ключевых страниц без русских строк основного контента
  (кроме демо-контента); RU — байт-в-байт прежний.
- Юнит-тесты red-first: EN-словарь полон, хелперы и выписка отдают EN.
- `npm run lint`, `npm run typecheck`, `npm run build`, `npm test` — зелёные.
