# TRANSLATION-AUDIT — аудит переводов RU↔EN (DIG-111 / DIG-123)

> Дата: 2026-11-20 · скрипт: `node scripts/i18n-audit.mjs`
> · рантайм-дубль правил: `tests/i18n-audit.test.ts`. Код выхода 0 =
> словари консистентны.

## Сводка

| Проверка | Результат |
|---|---|
| Парность ключей RU↔EN | 1655 ключей в каждом словаре, расхождений: 0 |
| Паритет плейсхолдеров `{name}` | 0 расхождений |
| Незакрытые/лишние фигурные скобки | 0 |
| Кириллица в EN | 0 (кроме осознанно двуязычных `locale.*`) |
| Латинские кальки в RU | 0 (кроме разрешённой латыни) |
| Артефакты (двойные пробелы) | 0 |

## Детали

### Парность ключей — ✅ ок

### Паритет плейсхолдеров — ✅ ок

### Незакрытые плейсхолдеры / фигурные скобки — ✅ ок

### Кириллица в EN-значениях — ✅ ок
Исключение по спеке cabinet-i18n: ключи `locale.*` двуязычны намеренно — переключатель локали находят на обоих языках (`locale.switchAria` = «Interface language / Язык интерфейса», самоназвание кнопки «Русский»).


### Латинские слова-кальки в RU-значениях — ✅ ок
Правило DIG-111: «логин» (кириллицей) — ок, «login» (латиницей) — нет. Разрешённая латынь — ниже, в глоссарии исключений.


### Артефакты строк — ✅ ок
Двойные пробелы внутри значения. Одиночные ведущие/хвостовые пробелы — легитимные склейки строк (« · суффикс», «из {amount}») и не считаются артефактом.


## Глоссарий терминов (канон RU → EN)

| RU | EN | Комментарий |
|---|---|---|
| заявка | request | вся навигация и статусы; «заявление» (документ-ходатайство) — application, слово statement в EN-словаре не используется |
| заявление | application | `staff.type.STATEMENT` = «Application», мастер: «Order a certificate or application» |
| справка | certificate | «Order a certificate», «Certificate ready»; выписка из зачётки — transcript |
| зачётка | gradebook | «Gradebook», «Gradebook number»; дисциплина в таблице — discipline |
| выписка | transcript | «Academic transcript» |
| деканат | deanery | «Digital Deanery», «Message the deanery»; без «dean's office» |
| обращение | appeal / message | очередь сотрудника — appeal, сообщение студента в деканат — message/ticket |
| МСП | SME | `menu.msp` = «SME», `msp.title` = «SME — the student startup catalog» (не «Startups») |
| ДПО | continuing education | `title.dpo` = `menu.dpo` = «Continuing education» (не «Extra education») |
| пересдача | retake | «The retake is today» |
| средний балл | GPA | «Overall GPA», «Group ranking» |
| семестр | semester | «Fall semester 2026/27» |
| пара | class | «No classes today» |
| почта (email) | email | RU-подписи — «Почта», «эл. почта»; слово «email» в RU-строках не используется (калька) |

## Глоссарий исключений: разрешённая латынь в RU

- **Акронимы и стандарты:** AI/ai (демо-теги), MCP, JSON, QR, PDF, XLSX, MD/md,
  ID/id (argon2id), IP, N, ECTS, GPA, MSK, SLA, URL, API, DIG (номера задач).
- **Имя протокола:** Model Context Protocol (Model, Context, Protocol).
- **Продукты/сервисы:** Apple Calendar, Google Calendar, ChatGPT, Claude,
  Claude Desktop, Cursor, Excel, GitHub, Linear, Markdown, Telegram, WhatsApp,
  Push, Speech (Web Speech API), Web.
- **Технические термины:** Bearer, Authorization, argon (argon2id), read-only,
  tools/list (метод MCP), deep-ссылка, demo-токен.
- **Путь настройки в самом клиенте Claude/ChatGPT** (английский UI внешнего
  приложения): Settings → Connectors → Add custom connector.
- **Горячая клавиша:** Command+K.
- **Двуязычная подпись переключателя локали** (spec cabinet-i18n): Language,
  English.

## Исправлено в рамках DIG-111/DIG-123

- RU-кальки: «Отправить на email» → «Отправить на почту»; «ФИО, email или
  телефон…» → «ФИО, эл. почта или телефон…»; «Email виден преподавателям» →
  «Эл. почта видна преподавателям»; канал «Email» → «Почта»;
  «visa-центров — со суммой» → «визовых центров — с суммой».
- EN-терминология: `menu.msp` «Startups» → «SME»; `menu.dpo` «Extra
  education» → «Continuing education»; «заявление» — везде application
  (убраны statement/request-смешения в `requests.subtitle`,
  `empty.requestsDesc`, `finance.action.materialAid.desc`).
- Артефакты: двойные пробелы в `transcript.groupCourse` и
  `transcript.semesterLine` (RU и EN, строки выписки PDF) → одиночные.
