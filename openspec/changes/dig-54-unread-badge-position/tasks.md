# Tasks: DIG-54 — фикс позиции счётчика непрочитанных

- [x] Red: unit-тест `tests/unread-badge.test.tsx` — контейнер
      `data-testid="unread-badge"` на колокольчике, inline-вариант без
      `absolute` в сайдбаре, скрытие при нуле (упал на HEAD-коде: 3 red).
- [x] Red: e2e — позиция бейджа (внутри колокольчика на 1440 и 360, без
      пересечения с сайдбаром, скрытие при 0 через polling).
- [x] `UnreadBadge`: вариант `variant: 'floating' | 'inline'` (default
      `floating`), inline — статичный элемент строки.
- [x] `TopBar`: колокольчик — контейнер `data-testid="unread-badge"`.
- [x] `SideNav`: бейдж строки «Уведомления» — `variant="inline"`.
- [x] Green: unit (9/9), e2e cabinet-shell (13/13, оба профиля).
- [x] Гейты: lint=pass, typecheck=pass, build=pass; test — единственное
      падение `grades-page.test.tsx` воспроизводится на чистом HEAD
      (pre-existing, вне задачи).

## Раунд 2 — замечания ревью

- [x] Спека: сценарий «Бейдж в сайдбаре не покидает строку меню» — THEN
      переформулирован в выполнимый (inline: `position: static`, bbox целиком
      в пределах строки меню); невыполнимое «не пересекать `<aside>`»
      (inline-бейдж — потомок aside, bbox всегда внутри) перенесено в сценарий
      бейджа колокольчика в шапке, где его реально проверяет e2e.
- [x] Спека проверяемой: e2e desktop-1440 — новый кейс «sidebar badge is
      inline and stays inside its menu row»: вычисленный `position: static`
      (не классы) + bbox бейджа целиком внутри bbox строки «Уведомления».
- [x] Pre-existing падение `tests/grades-page.test.tsx` зафиксировано
      отдельной Linear-задачей DIG-67, ссылка добавлена в proposal.md.

## Раунд 3 — замечания ревью (тест-гейты упали)

- [x] Red→Green: `tests/grades-page.test.tsx` «семестр без оценок» падал
      календарно (15.11.2026 зачёт «Базы данных» 14.11.2026 стал прошлым,
      `nextAssessment` называл «Информатика» 24.12). «Сейчас» зафиксировано
      `vi.useFakeTimers({ now: 10.11.2026, toFake: ['Date'] })` + restore в
      `finally` — тест детерминирован при любой дате запуска (15/15).
- [x] Продуктовый код DIG-54 не менялся: юнит-контракт бейджа
      (tests/unread-badge.test.tsx, 9/9) и e2e cabinet-shell без изменений.
