# Tasks: экран «AI-ассистент» с карточками действий — DIG-46

- [x] 1. Red-first: `tests/assistant-engine.test.ts` — чистый движок: 4
  подсказки задачи распознаются точно (завтра / экзамен БД «8»→80 / справка
  для военкомата / академический отпуск); сокращение «БД» по инициалам
  находит «Базы данных», цель «85» не масштабируется; отказ на чужие данные
  («Покажи оценки Ильи Смирнова») и на не-учёбу («Какая погода в Москве?»)
  — вежливо и с примером вопроса; источники под ответом
  («По данным: расписание» / «зачётка, план контроля»); калькулятор на
  фикстуре Анны (Проект 85 · вес 0,3; Тест 2 0,2 и Экзамен 0,5 не сданы):
  цель 80 — недостижима (максимум 76), цель 70 — нужно 88 из 100; для
  сотрудника данные-интенты вежливо отказывают. Падало до реализации
  (модуля нет).
- [x] 2. Red-first: `tests/assistant-data.test.ts` — слой данных:
  `getAssistantContext` скоупит по сессии (Анна — «Анна», завтра 2 события
  ПИ-21 с переносом, дисциплины с экзаменом плана; Илья — данные ЭК-11;
  сотрудник — student:null + аудит ROLE_MISMATCH); `createAssistantRequest`
  создаёт заявку SR-… + уведомление, идемпотентна по заголовку, чужой
  сервис-ид из whitelist отклоняется, сотруднику отказ + аудит;
  `reportAssistantAnswer` создаёт обращение с темой «AI-ассистент: неверный
  ответ», сотруднику отказ. Падало до реализации.
- [x] 3. Red-first: `tests/assistant-page.test.tsx` — контракт /ai-assistant
  (SSR): приветствие с именем, 4 подсказки, «Новый диалог», «История»,
  источник-плашки в клиентском чате не нужны на SSR, deep-link
  `?intent=exam-prep&discipline=PI21-INFO` сеет вопрос; состояние
  сотрудника. Падало до реализации.
- [x] 4. Red-first: `tests/faq-catalog.test.ts` — каталог FAQ: ровно статья
  «Академический отпуск» с непустым ответом, уникальные слаги, страница
  /faq/[slug] рендерит статью, неизвестный слаг — 404 (notFound).
  Падало до реализации.
- [x] 5. `src/lib/assistant-engine.ts` — намерения, цели, матчинг дисциплин
  (инициалы + подстрока + код), сборка ответов/карточек/источников, тексты
  отказов; типы AssistantContext/AssistantReply/AssistantCard (сервер
  формирует VM, клиент рендерит). Экзаменационный элемент плана
  домерживается в план калькулятора, если срез данных отдал план без него
  (иначе веса нормируются неверно — поймано тестом цели 90 по Информатике).
- [x] 6. Слой данных `src/server/data/assistant.ts`: getAssistantContext
  (завтра по Москве через toScheduleEventCards, дисциплины с планом
  и экзаменом, имя, next-study-day), createAssistantRequest (whitelist
  каталога, идемпотентность, номер SR, уведомление), reportAssistantAnswer
  (обращение), barrel @/server/data.
- [x] 7. Server actions `src/server/actions/assistant.ts`:
  submitAssistantRequestAction (requireDataCtx, whitelist, revalidate
  /requests) и reportAssistantAnswerAction (двухшаговое подтверждение в UI).
- [x] 8. FAQ: `src/lib/faq-catalog.ts` + страница `/faq/[slug]` (внутри
  (cabinet), unknown → notFound).
- [x] 9. API `src/app/api/assistant/context/route.ts` — GET с сессией
  (для плавающей панели на любых экранах), no-store.
- [x] 10. Компоненты `src/components/assistant/*`: assistant-chat
  (сообщения, стриминг, подсказки, ввод Enter, «Новый диалог», история,
  источники), assistant-cards (расписание / калькулятор на needForTargetPure
  / заявка с «Подтвердить и отправить» / FAQ), assistant-panel (drawer:
  правая панель на десктопе, весь экран на 360 px, fetch контекста).
- [x] 11. Каркас: AiFab — кнопка «на всех экранах» (открывает панель),
  Shell рендерит AssistantPanel; viewport-мета
  `interactive-widget=resizes-content` (клавиатура не перекрывает ввод);
  `/assistant` — редирект на `/ai-assistant`; страница /ai-assistant
  (RSC-контекст + deep-link seed) + loading-скелетон.
- [x] 12. Red-first: `e2e/assistant.spec.ts` — оба вьюпорта: 4 подсказки,
  карточки (2 события завтра с переносом; калькулятор 88 из 100 для цели 70;
  заявка подтверждением → SR-… в /requests; FAQ-ссылка открывает статью),
  отказ на чужие данные и на «погоду», «Новый диалог», «Сообщить о неверном
  ответе» → обращение, панель по FAB из /dashboard: на 360 px весь экран,
  поле ввода видно. Падало до реализации.
- [ ] 13. Зелёные гейты: узкие vitest-прогоны, полный `pnpm test`,
  `pnpm lint`, `pnpm typecheck`, `node scripts/swarm/gates.mjs`,
  e2e `e2e/assistant.spec.ts` (оба вьюпорта) + старые спеки не сломаны.
- [x] 14. Change-папка openspec/changes/dig-46-ai-assistant-screen
  (proposal, tasks, delta-спека assistant) — задачи отмечаются по ходу.
