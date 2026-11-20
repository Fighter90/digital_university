# REGRESSION-FINDINGS-105.md — наблюдения EN-регресса (DIG-105)

Регресс: полный EN-аудит против прода https://ostrovok.store (2026-11-20,
ночной прогон, МСК). Скрипт: `e2e/zz-en-audit.spec.ts` — 31/31 маршрутов
без кириллицы в профилях desktop-1440 и mobile-360 (вывод:
`docs/shots/en-audit-105-output.txt`). Ручной свип под anna.smirnova:
dashboard / schedule / grades / requests / settings / mcp / people /
notifications.

Три EN-дефекта из свипа ИСПРАВЛЕНЫ в этом изменении (см.
`openspec/changes/dig-105-en-regression-fixes/proposal.md`): ночное
приветствие «Good night», калька «Requests in work / pick-up», русский
формат «18.11» у старых уведомлений на EN. Ниже — наблюдения, которые
дефектом на текущем скоупе НЕ считаются: глобального глоссария не меняем.

## Наблюдения (не исправлены осознанно)

| # | Что | Где | Серьёзность | Комментарий |
|---|-----|-----|-------------|-------------|
| 1 | «Debts» / «Debts pending» / кнопка «To debts» | /grades, dashboard | low | Калька «задолженности»; в академическом EN чаще «Outstanding (requirements)». Понятно, консистентно внутри продукта. Менять — отдельной глоссарионой задачей (затронет RU-канонные тесты и сид). |
| 2 | «Study office methodologist», «Study Office» | /people | low | «Учебный офис»; HSE-style перевод «Study Office» встречается, но «Academic Office» нейтральнее. Не калька-ошибка, а выбор термина. |
| 3 | «Credit test» (для «зачёт») | /dashboard, дедлайны | low | Распространённый перевод RU «зачёт» (pass/fail credit). Оправдано контекстом российской вуз-модели. |
| 4 | «Discipline credit transfer application» | /requests (сид-карточка), /staff/requests | low | «Discipline» — русизм («course» естественнее), но термин встречается в international-контексте credit transfer. Сид-строка, словарь REQUEST_NAME_EN закрытый (DIG-124). |
| 5 | «Threshold not guaranteed yet» | /grades (карточки дисциплин) | low | Дословно «порог не гарантирован»; естественнее «Threshold not yet secured». Понятно, не мешает пониманию. |
| 6 | «Requests in work» в RU-каноне «Заявки в работе» — паритет ок | — | none | RU-вариант не менялся; фикс применён только к EN-строкам. |
| 7 | Приветствие «Good night, Anna!» | /dashboard | **fixed** | Исправлено в этом изменении (EN: «Good evening»). |
| 8 | «Requests in work … pick-up» | /settings, /staff | **fixed** | Исправлено в этом изменении (EN: «in progress» / «pickup»). |
| 9 | Старые уведомления «18.11» на EN | /notifications, колокольчик | **fixed** | Исправлено в этом изменении (EN: «Nov 18»; RU DD.MM — канон). |

## Даты/статусы в МСК — проверки свипа

- Заявки: «submitted November 18 at 11:20 AM MSK» — явная метка МСК (OK).
- Расписание, дедлайны, события — форматтеры с явной зоной Europe/Moscow
  (dashboard-format.ts, schedule-time.ts, request-labels.ts и др.): время
  не зависит от TZ браузера/сервера (контракт DIG-79, покрыт
  tests/msk-timezone.test.ts). Нарушений не найдено.
- Статусы заявок EN: Submitted / Accepted / In progress / Ready / Issued —
  корректные термины, согласованы с RU-каноном.

## Инфраструктурное

- Скрипт аудита `e2e/zz-en-audit.spec.ts` падал по таймауту 30s (31 маршрут
  + два логина ≈ 2 мин) — добавлен `test.setTimeout(240_000)` в этом
  изменении. Не продукт-дефект, а дефект инструмента регресса.
