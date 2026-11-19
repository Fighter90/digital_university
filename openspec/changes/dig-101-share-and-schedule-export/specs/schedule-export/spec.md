# schedule-export — Delta (DIG-101)

## ADDED Requirements

### Requirement: Блок «Экспорт» на экране расписания

Экран `/schedule` в видах «День» и «Неделя» показывает блок «Экспорт» с
тремя кнопками-ссылками: Markdown (.md), Excel (.xlsx) и PDF. В виде
«Месяц» блок не показывается. Ссылки несут текущий вид (`view=day|week`)
и выбранную дату (`date=YYYY-MM-DD`).

#### Scenario: Кнопки экспорта в виде «Неделя»

- **WHEN** открыт `/schedule?view=week&date=2026-11-19`
- **THEN** блок содержит ссылки на
  `/api/export/schedule.md?view=week&date=2026-11-19`,
  `/api/export/schedule.xlsx?view=week&date=2026-11-19`,
  `/api/export/schedule.pdf?view=week&date=2026-11-19`

#### Scenario: В виде «Месяц» блока нет

- **WHEN** открыт `/schedule?view=month`
- **THEN** блок «Экспорт» в разметке отсутствует

### Requirement: Роуты экспорта отдают файлы по owner-scope

`GET /api/export/schedule.md|xlsx|pdf?view=day|week&date=…` читает пары
только через `requireDataCtx` → `getSchedule` (свойства скоупа из живой
сессии; параметров скоупа в URL нет). Сотрудник без группы получает
единый 404 JSON (`uniformNotFoundResponse`). Ответы не кэшируются
(`private, no-store`), файл отдаётся с корректным Content-Type и
ASCII-именем в Content-Disposition (`schedule-YYYY-MM-DD-day|week.<ext>`).

#### Scenario: День — только пары этого дня

- **WHEN** владелец сессии запрашивает `view=day&date=D`
- **THEN** файл содержит только пары московского дня `D` его группы
  и колонки «Время/Дисциплина/Тип/Аудитория/Преподаватель»

#### Scenario: Неделя — пары с понедельника по воскресенье недели даты

- **WHEN** владелец сессии запрашивает `view=week&date=D`
- **THEN** файл содержит пары с понедельника по воскресенье недели даты `D`

#### Scenario: Чужая группа не экспортируется

- **WHEN** студент группы A запрашивает экспорт, а в данных есть пары
  групп A и B
- **THEN** файл содержит только пары группы A (скоуп задаёт живая сессия)

#### Scenario: Сотруднику — единый 404

- **WHEN** сотрудник (роль STAFF без группы) запрашивает любой экспорт
- **THEN** ответ — 404 JSON `{"error":"not_found"}` (uniform not-found)

#### Scenario: Content-Type по формату

- **WHEN** запрошен формат md / xlsx / pdf
- **THEN** Content-Type — `text/markdown; charset=utf-8` /
  `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` /
  `application/pdf`

### Requirement: Состав и локаль выгрузки

Выгрузка — таблица с колонками «Время / Дисциплина / Тип / Аудитория /
Преподаватель» (EN: Time / Subject / Type / Room / Teacher), заголовок
документа с диапазоном и плашкой «Концепт для конкурса». Заголовки и
подписи — по локали cookie `du-locale`. XLSX — валидный OOXML-пакет
(собственный писатель, без новых зависимостей), тексты ячеек
XML-экранируются; PDF — векторный шрифт проекта (кириллица).

#### Scenario: XLSX открывается как OOXML-пакет

- **WHEN** запрошен schedule.xlsx
- **THEN** файл — ZIP (сигнатура PK) с `[Content_Types].xml`,
  `xl/workbook.xml` и `xl/worksheets/sheet1.xml`; лист содержит строку
  заголовков и строки пар; спецсимволы текста (`<`, `&`, `"`) экранированы

#### Scenario: Пустой диапазон

- **WHEN** в запрошенном диапазоне пар нет
- **THEN** файл содержит заголовок и колонки, строки пар отсутствуют,
  выгрузка помечена «Пар нет»
