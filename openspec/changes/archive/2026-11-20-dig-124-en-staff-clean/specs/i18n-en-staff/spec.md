# Delta — DIG-124: кабинет сотрудника и приветствие ассистента на EN без кириллицы (capability i18n-en-staff)

## ADDED

### Requirement: Пять поверхностей кабинета сотрудника и ассистента на EN без кириллицы (DIG-124)

При `locale=en` видимый текст пяти поверхностей — `/staff`,
`/staff/requests`, `/staff/appeals`, `/staff/announcements`, `/ai-assistant` —
не содержит символов `[А-Яа-яЁё]`: факультет, группы, имена, названия заявок,
темы обращений, объявления сида и приветствие ассистента локализуются.
При `locale=ru` рендер остаётся байт-в-байт прежним.

#### Scenario: Сводка и очередь заявок сотрудника на EN

- WHEN сотрудник факультета «ИТ» открывает `/staff` или `/staff/requests`
  с cookie `du-locale=en`
- THEN подзаголовки показывают «IT» (localizedFaculty), карточки очереди —
  EN-названия заявок сида («Military deferment certificate», «Discipline
  credit transfer application»), имена владельцев («Anna Smirnova»),
  группы («PI-21») и исполнителя («Maria Kovaleva»)
- AND при `du-locale=ru` все эти поля — прежние RU-строки байт-в-байт

#### Scenario: Обращения и объявления сотрудника на EN

- WHEN сотрудник открывает `/staff/appeals` или `/staff/announcements`
  при locale=en
- THEN темы обращений сида — по id («Physical education credit question»),
  объявление сида — «PI-21 group meeting / Tomorrow at 10:00, room 305…»,
  аудитория и автор локализованы; в форме объявления `<option>` групп
  показывает EN-подпись при каноническом значении
- AND неизвестные (несидные) темы и тексты — осознанный RU-фолбэк

#### Scenario: Приветствие ассистента по полному ФИО

- WHEN `getAssistantContext` строит контекст студента или сотрудника
- THEN в контексте присутствует `fullName` — полное ФИО владельца сессии
- AND приветствие чата при locale=en — первое слово `enPersonName(fullName)`
  («Анна Смирнова» → «Hello, Anna!»); при locale=ru — прежнее
  «Здравствуйте, Анна!» по короткому имени
