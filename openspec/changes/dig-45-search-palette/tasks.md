# Tasks: DIG-45 — экран «Поиск по кабинету» (⌘K)

- [x] Спека: delta `specs/search/spec.md` (группы, скоуп, клавиатура, мобильный).
- [x] Red: `tests/search-core.test.ts` — чистое ядро (порядок групп, лимиты,
      нормализация с ё→е, распознавание номера заявки, подсветка).
- [x] Red: `tests/search-data.test.ts` — скоуп `searchCabinet` на memory-db
      (свои заявки, чужой номер не находится, группа/факультет,staff-скоуп,
      производительность < 200 мс).
- [x] Red: `tests/search-palette.test.tsx` — рендер палитры в jsdom (группы
      из ответа API, Enter открывает, Tab переключает группу, AI-подвал,
      недавние запросы в localStorage).
- [x] Ядро: `src/lib/search-core.ts` — типы, нормализация, матчинг,
      группировка, лимиты, `POPULAR_ACTION_IDS`, распознавание номера.
- [x] Данные: `src/lib/faq-catalog.ts` — вымышленный FAQ (заготовка DIG-38).
- [x] Сервер: `src/server/data/search.ts` — скоупированный `searchCabinet`;
      экспорт из `@/server/data`.
- [x] Роут: `src/app/api/search/route.ts` (GET, `?q=`, no-store).
- [x] Палитра: `src/components/shell/search-palette.tsx` — debounce-запросы,
      группы, клавиатура (↑/↓/Enter/Tab), пустое состояние, AI-подвал,
      полноэкранный режим <768 px.
- [x] Роль сессии на клиенте: `ShellUser.role` (user.ts, shell-user.ts,
      обновлён `tests/shell-user.test.ts`).
- [x] e2e: `e2e/search.spec.ts` — desktop 1440 (⌘K, «справка» → Действия и
      Вопросы и ответы, номер заявки, ФИО, Enter открывает, Tab группы,
      AI-подвал) и mobile 360 (полноэкранный поиск, без гор. скролла).
- [x] Гейты: lint, typecheck, vitest, playwright (search + shell-регресс),
      `node scripts/swarm/gates.mjs`.
