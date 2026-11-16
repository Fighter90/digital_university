# Tasks: экран «Обращения в деканат» — DIG-39

- [ ] 1. Red-first: `tests/tickets.test.ts` — чистый модуль `src/lib/tickets.ts`:
- [x] 1. Red-first: `tests/tickets.test.ts` — чистый модуль `src/lib/tickets.ts`:  5 тем с точными метками; маппинг статусов в три видимых («Открыто»,
  «Ждём вас», «Решено»); подпись менеджера «Менеджер программы»; обещание
  «Обычно отвечаем в течение 1 рабочего дня»; `formatTicketTime` (сегодня →
  «HH:MM», вчера → «Вчера», иначе дата); `shortPreview` со свёрткой пробелов.
  Падало до реализации (модуля нет).
- [ ] 2. Red-first: `tests/faq-suggest.test.ts` — `src/lib/faq-suggest.ts`:
  подсказка по ключевым словам текста, короткий/мусорный ввод → пусто,
  приоритет теме обращения, без дублей, типографика («ёлочки»).
  Падало до реализации.
- [ ] 3. Red-first: `tests/deanery.test.ts` — слой данных: список тикетов
- [x] 2. Red-first: `tests/faq-suggest.test.ts` — `src/lib/faq-suggest.ts`:
- [x] 3. Red-first: `tests/deanery.test.ts` — слой данных: список тикетов  owner-scoped (тикеты Анны не видны Илье), чужой/несуществующий номер —
  одинаковый null + аудит (OWNERSHIP_DENIED / NOT_FOUND); создание с темой из
  белого списка, вложениями (≤3), привязкой только к СВОЕЙ заявке и дисциплине
  СВОЕЙ группы; ответ студента возвращает статус в «Открыто»; ответ менеджера
  → статус «Ждём вас» + уведомление (тип TICKET, ссылка на чат) с учётом
  матрицы PUSH; открытие чата помечает сообщения менеджера прочитанными;
  сотруднику — отказ + аудит. Падало до реализации.
- [ ] 4. Red-first: `tests/deanery-page.test.tsx` — контракт страниц (SSR):
- [x] 4. Red-first: `tests/deanery-page.test.tsx` — контракт страниц (SSR):  список (тема, номер, статус, последний ответ, время), обещание срока,
  чат (аватар, ФИО, «Менеджер программы», вложения, «Прочитано»), композер
  (5 тем, вложения, привязка к заявке/дисциплине, «Возможно, это ответ на
  ваш вопрос»), состояние сотрудника «Доступно студентам». Падало до
  реализации.
- [ ] 5. Слой данных: типы (TicketRow/TicketMessageRow, TicketSubject,
- [x] 5. Слой данных: типы (TicketRow/TicketMessageRow, TicketSubject,  TicketStatus), порт (probe/list/find/append/markRead), memory-адаптер,
  `src/server/data/ticket-number.ts` (TS-ГГГГ-XXXXX), `src/server/data/
  deanery.ts` (getDeaneryPage, openTicketChat, createTicket, replyToTicket,
  appendManagerMessage — уведомление + матрица PUSH), barrel.
- [ ] 6. Тип уведомлений TICKET: `src/lib/notification-labels.ts`
  («Обращения» + матрица настроек), синхронизация фикстур тестов настроек.
- [ ] 7. Demo-сид: тикеты Анны (2: «Ждём вас» с перепиской/вложением/привязкой
  к заявке и «Открыто» с привязкой к дисциплине), тикет Ильи («Решено»),
  непрочитанный ответ менеджера + уведомление TICKET со ссылкой на чат.
- [ ] 8. Server actions `src/server/actions/deanery.ts`: создание обращения
  и ответ в чат (requireDataCtx, белые списки, валидация вложений: ≤3 × 5 МБ,
  имя ≤80; revalidatePath).
- [ ] 9. Экран `/deanery`: список + композер с подсказками FAQ («Возможно,
  это ответ на ваш вопрос») и обещанием срока; `/deanery/[number]` — две
  панели на десктопе, отдельный экран чата на мобильном (скелетон списка —
  loading в route-group, у чата — без Suspense над notFound, как у заявок).
- [ ] 10. Зелёные гейты: узкие vitest-прогоны, полный `pnpm test`, `pnpm lint`,
  `pnpm typecheck`, e2e `e2e/deanery.spec.ts` (360 px и 1440 px), gates.
- [ ] 11. Change-папка openspec/changes/dig-39-deanery-tickets — задачи
- [x] 6. Тип уведомлений TICKET: `src/lib/notification-labels.ts`
  («Обращения» + матрица настроек), синхронизация фикстур тестов настроек
  (cabinet-shell, profile-settings-page, schedule; действие настроек
  CHANNEL_TYPES дополнено TICKET).
- [x] 7. Demo-сид: тикеты Анны (2: «Ждём вас» с перепиской/вложением/привязкой
- [x] 8. Server actions `src/server/actions/deanery.ts`: создание обращения
  (успех → redirect в чат) и ответ в чат (requireDataCtx, белые списки,
  валидация вложений: ≤3 × 5 МБ, имя ≤80; revalidatePath).
- [x] 9. Экран `/deanery`: список + композер с подсказками FAQ («Возможно,
  loading в route-group `(list)`, у чата — без Suspense над notFound, как
  у заявок).
- [x] 10. Зелёные гейты: узкие vitest-прогоны, полный `pnpm test`, `pnpm lint`,
  `pnpm typecheck`, e2e `e2e/deanery.spec.ts` (360 px и 1440 px, 10/10),
  gates — green. (Попутно вылечен сгоревший date-bomb тест DIG-26:
  tests/grades-page.test.tsx — статичная дата «первой контрольной» заменена
  на относительную; падал на ветке и без изменений DIG-39.)
- [x] 11. Change-папка openspec/changes/dig-39-deanery-tickets — задачи  отмечаются по ходу.
