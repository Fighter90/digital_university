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
