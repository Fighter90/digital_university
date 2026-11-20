# Tasks — DIG-124 EN: кабинет сотрудника без кириллицы

## Red

- [x] tests/en-staff-clean.test.tsx: «no Cyrillic on EN» — рендер сводки/
      очереди/обращений/объявлений с сид-данными (факультет «ИТ», имена,
      группы, названия заявок/тем/объявлений сида) + приветствие ассистента
      EN по полному ФИО («Анна Смирнова» → «Hello, Anna!»); RU байт-в-байт.
      Подтверждён красный до реализации (6 падений).

## Словарь и хелперы

- [x] ru-translit: REQUEST_NAME_EN += «Заявка на летнюю практику»,
      «Вопрос о переносе пересдачи».
- [x] en-demo-content: localizeAppealSubject (по id сида), localizeAnnouncement
      (титул/текст по id).

## Staff-страницы (guard locale, RU байт-в-байт)

- [x] /staff: факультет в подзаголовке — localizedFaculty.
- [x] /staff/requests: факультет, названия заявок (localizeRequestCardTitle),
      имена студентов, группы, исполнитель — по локали.
- [x] /staff/appeals: факультет, темы обращений (localizeAppealSubject),
      имена и группы владельцев.
- [x] /staff/announcements: факультет, аудитория (группа/факультет чипа),
      титул/текст объявления, автор; форма — `<option>` групп с EN-подписью
      при каноническом value.

## Ассистент

- [x] AssistantContext: fullName (полное ФИО владельца сессии).
- [x] getAssistantContext: студент и сотрудник возвращают fullName.
- [x] greetingMessage: EN — первое слово enPersonName(fullName); RU — как было.
- [x] Моки тестов обновлены (assistant-page, assistant-chat-stream,
      assistant-engine, i18n-en-help-assistant-mcp), ассерты fullName
      в assistant-data.

## Проверка

- [x] npx vitest run — все зелёные (включая новый no-Cyrillic).
- [x] node scripts/swarm/gates.mjs → GATES_SUMMARY: green.
