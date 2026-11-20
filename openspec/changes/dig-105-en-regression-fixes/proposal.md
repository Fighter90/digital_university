# DIG-105 — Регресс EN: полный прогон кабинета в английской версии

## Зачем

Полный регресс EN-версии против прода (https://ostrovok.store, cookie
`du-locale=en`, поиск `[А-Яа-яЁё]` в `body.innerText` — e2e
`e2e/zz-en-audit.spec.ts`). После DIG-124 аудит даёт 31/31 маршрутов без
кириллицы. Второй слой регресса — качество EN: ручной свип сценариев под
anna.smirnova (dashboard/schedule/grades/requests/settings/mcp/people/
notifications) нашёл три EN-дефекта, которые кириллицу не содержат, но
нарушают требование «английские термины корректны, без кальки»:

1. **Ночное приветствие «Good night»** (dashboard) — калька прощания:
   в английском «Good night» — только прощание, ночным приветствием
   естественно «Good evening» (RU «Доброй ночи» — норма, не трогаем).
2. **«Requests in work … pick-up»** (настройки, виджеты; заголовок блока
   заявок сотрудника) — калька «в работе» + дефисное написание, расходящееся
   с формулировкой дашборда «ready for pickup». Норма — «Requests in
   progress» / «pickup».
3. **Старые уведомления датированы «18.11»** (экран и колокольчик) —
   русский формат DD.MM независимо от локали: `formatNotificationTime`
   не принимал locale. EN-норма — «Nov 18»; RU-канон DD.MM сохранён
   байт-в-байт.

Также закрыт дефект самого скрипта аудита: `e2e/zz-en-audit.spec.ts` без
`test.setTimeout` падал по таймауту 30s на 31 маршруте (прогон против прода
физически требует ~2 минуты) — добавлен `test.setTimeout(240_000)` по
практике соседних zz-спеков.

## Что делаем

- `src/lib/i18n/en.ts`: `dashboard.greeting.night` → «Good evening»,
  `widgets.desc.requests` → «Requests in progress and ready for pickup»,
  `staff.home.requests.title` → «Requests in progress».
- `src/lib/notification-view.ts`: `formatNotificationTime(…, locale)` —
  EN-старые даты в формате «Nov 18» (en-US, месяц коротко, зона явная
  Europe/Moscow — SSR/гидрация дают одну строку при любом TZ процесса,
  конвенция DIG-79); дефолт `ru` — прежний DD.MM.
- `src/components/notifications/notification-item-row.tsx`: передаёт locale
  в `formatNotificationTime` (экран и колокольчик уже получают locale).
- `tests/en-regression-105.test.ts`: red-first — три дефекта + фиксация
  RU-канона («Доброй ночи», «Заявки в работе», «DD.MM»).
- `e2e/zz-en-audit.spec.ts`: `test.setTimeout(240_000)`.

## Non-goals

- RU-значения словарей и формат DD.MM не меняются ни на байт.
- Наблюдения без явного дефекта («Debts», «Study Office», «Credit test»,
  «Discipline credit transfer») — зафиксированы в REGRESSION-FINDINGS-105.md,
  глобальную глоссарионую правку не делаем.
- `scripts/swarm/`, схема БД, сид — не трогаются.
- Дефекты, найденные аудитом, НЕ EN-специфичные — только в findings-файл.

## Риски

- Минимальные: правки только EN-строк словаря и EN-ветки форматтера времени;
  обе закреплены юнит-тестом с проверкой RU-канона байт-в-байт.
