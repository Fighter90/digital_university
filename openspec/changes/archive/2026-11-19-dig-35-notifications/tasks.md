# Tasks: центр уведомлений и панель колокольчика — DIG-35

- [x] 1. Red-first: `tests/notifications-server.test.ts` — слой данных и
      серверные агрегаты: `countUnreadNotifications` (0 без профиля/у
      сотрудника, без аудит-шума), `markAllNotificationsRead` (только свои
      строки; сотруднику отказ ROLE_MISMATCH + аудит), `getNotificationFeed`
      (топ-N свежих + счётчик; fail-soft без сессии), порт
      `markAllNotificationsReadByStudent` (memory-адаптер).
- [x] 2. Red-first: `tests/notifications-seed.test.ts` — демо-сид: у каждой
      строки есть объект и что изменилось (нет «Сменился статус по …» без
      конкретики), «Важно» только у срочных (перенос/отмена сегодня,
      недопуск, доработка заявки, дедлайн оплаты), все категории фильтров
      представлены, 3 непрочитанных у Анны (контракт e2e каркаса).
- [x] 3. Red-first: `tests/notifications-screen.test.tsx` — экран
      /notifications: 6 фильтров, группы «Сегодня/Вчера/Ранее», время
      HH:MM/DD.MM, точка «не прочитано», «Важно» только на срочных, фильтры
      сужают список и показывают свой пустой результат, клик строки/действия
      — отметка + переход, «Отметить все прочитанными» с блокировкой и
      обновлением шапки без перезагрузки, пустые состояния, polling 60 с.
- [x] 4. Red-first: `tests/notifications-bell.test.tsx` — панель
      колокольчика: закрыта по умолчанию (aria-expanded=false), максимум 5
      свежих строк, открытие с клавиатуры, фокус в панель, Esc закрывает и
      возвращает фокус, ловушка Tab, клик строки — отметка + переход +
      закрытие, ссылки «Все уведомления»/«Настроить уведомления», polling
      ленты раз в 60 с.
- [x] 5. Red-first: `e2e/notifications.spec.ts` — desktop-1440 и
      mobile-360: рендер центра (фильтры, группы, конкретные строки, «Важно»
      ×3 у Анны), фильтр «Финансы», панель с клавиатуры (Enter/Esc/фокус,
      count 5), сотруднику — пустое состояние; 360 px — без горизонтального
      скролла. Спек без мутаций данных (параллельные воркеры против общего
      стора).
- [x] 6. `src/lib/notification-view.ts` — чистая логика без React и
      серверных импортов: фильтры-категории, сериализация строки ленты
      (`toNotificationFeedItem`), группировка по дням, формат времени,
      константы `NOTIFICATION_FEED_LIMIT=5` / `NOTIFICATIONS_POLL_MS=60_000`.
- [x] 7. Порт DIG-12: `countUnreadNotificationsByStudent`,
      `markAllNotificationsReadByStudent` в memory-адаптере; поля
      `important`/`actionLabel` в `NotificationRow`; barrel `@/server/data`.
- [x] 8. `src/server/data/notifications.ts` — `countUnreadNotifications`,
      `markAllNotificationsRead` (скоуп владельца, аудит отказов).
- [x] 9. `src/server/notifications.ts` — `getUnreadCount` и
      `getNotificationFeed` (fail-soft, скоуп по сессии, сотрудник — пустой
      агрегат); `src/app/api/notifications/count` и
      `src/app/api/notifications/recent` (limit 1..50, no-store, только
      владелец сессии).
- [x] 10. Server actions `src/server/actions/notifications.ts`:
      `markNotificationReadAction` (whitelist id, чужой id — false),
      `markAllNotificationsReadAction`; revalidatePath('/notifications').
- [x] 11. Каркас: `Shell` → `TopBar` → `NotificationsBell` (+`UnreadBadge`
      DIG-14 на реальном счётчике); `(cabinet)/layout.tsx` передаёт ленту
      (`getNotificationFeed`); страницы кабинет-секции без собственного
      `<main>` (контракт cabinet-shell).
- [x] 12. Экран `/notifications` (+ loading-скелетон) и компоненты
      `src/components/notifications/*`: `NotificationsScreen`,
      `NotificationsBell`, `NotificationItemRow` (full/compact),
      `use-safe-router` (SSR-безопасный доступ к роутеру для юнит-пререндера
      страниц); переходы — soft-nav (`router.push`), обновление шапки —
      `router.refresh()` без перезагрузки.
- [x] 13. Сид демо-набора: 14 вымышленных уведомлений (8 Анна, 6 Илья) со
      ссылками на объекты, действиями и метками «Важно».
- [x] 14. Проверка: узкие vitest-файлы зелёные; typecheck и lint чистые;
      полный `vitest run` зелёный.
