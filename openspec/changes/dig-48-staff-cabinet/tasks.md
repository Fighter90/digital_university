# Tasks: DIG-48 — кабинет сотрудника деканата

- [x] 1. Delta-спека `specs/staff-cabinet/spec.md` (требования с WHEN/THEN).
- [x] 2. Red: `tests/staff-access.test.ts` — студент на `/staff*` получает 403 (forbidden), сотрудник проходит, аноним — на /login — падает.
- [x] 3. Red: `tests/staff-sla.test.ts` — SLA по типам, дедлайн, просрочка/скоро-срок, парсинг и фильтры очереди — падают.
- [x] 4. Red: `tests/staff-transitions.test.ts` — карта разрешённых переходов, обязательная причина доработки, подписи кнопок — падают.
- [x] 5. Red: `tests/staff-summary.test.ts` — сводка (заявок сегодня, среднее время ответа, просрочено) — падает.
- [x] 6. Red: `tests/staff-data.test.ts` — скоуп факультета в очереди/карточке/обращениях/объявлениях, смена статуса с событием и уведомлением, аудит отказов — падают.
- [x] 7. Red: `tests/staff-pages.test.tsx` — рендер сводки, очереди (фильтры, просрочка, «Взять в работу»), карточки (переходы, причина, PDF), обращений (чат, шаблоны, «Решено»), объявлений (форма, предпросмотр) — падают.
- [x] 8. `src/lib/staff-sla.ts` — SLA и фильтры очереди (чистые функции).
- [x] 9. `src/lib/staff-transitions.ts` — разрешённые переходы и валидация причины.
- [x] 10. `src/lib/staff-summary.ts` — агрегаты сводки (чистые).
- [x] 11. Порт + memory-адаптер: заявки/обращения/объявления по факультету, смена статуса = строка + событие + уведомление атомарно.
- [x] 12. `src/server/data/staff-workflow.ts` + экспорт из index: сервисные функции с проверкой роли/факультета и аудитом.
- [x] 13. `src/server/actions/staff.ts` — server actions (в работу, статус, доработка, ответ, решено, объявление).
- [x] 14. `src/lib/route-guard.ts` + `tests/access-control.test.ts` — студент на `/staff*` → forbidden (403).
- [x] 15. Навигация по роли: nav-items, side-nav, tab-bar, top-bar (логотип ведёт сотрудника на /staff).
- [x] 16. Страницы: `/staff` (сводка), `/staff/requests`, `/staff/requests/[number]`, `/staff/appeals`, `/staff/appeals/[id]`, `/staff/announcements` + компоненты.
- [x] 17. API `GET /api/staff/requests/[number]/certificate` — PDF выполненной справки сотрудником факультета.
- [x] 18. Сид: заявки очереди (просроченная + сегодня), сообщение обращения, демо-объявление.
- [x] 19. Зелёная фаза: все unit-тесты зелёные.
- [x] 20. e2e `e2e/staff-cabinet.spec.ts`: 403 студенту, вход сотрудника, «Взять в работу» → у студента событие/уведомление, обращения, объявления, мобайл 360.
- [x] 21. Гейты: lint, typecheck, build, test — зелёные; коммит `feat(staff): ... — DIG-48`.

## Раунд 2 (salvage → доводка)

- [x] 22. Ремонт swap damage от salvage-мерджей: вернуть `scripts/build-lock.mjs`, `scripts/clean-next-types.mjs` и скрипты `build`/`typecheck` каноническими с main — гейт typecheck снова детерминированный.
- [x] 23. Сводка: `getStaffSummaryData` отдаёт `now` (момент выборки), страница считает «заявок сегодня» относительно него — детерминизм unit-теста сводки, тест дополнен.
- [x] 24. Чат обращения: бейдж статуса (`appeal-status-badge`, общий `src/lib/appeal-status.ts`) — после ответа виден «Отвечено» (red-first: unit + e2e).
- [x] 25. e2e-устойчивость: вход ждёт выхода с /login; клик по доступному имени кнопки целиком (aria-label, не подстрока); catch на клик, чья кнопка исчезает при ре-рендере после server action; сброс cookies при смене аккаунта; mobile-сценарий скипается на desktop.
- [x] 26. e2e прогон: 13 passed / 3 skipped (мутации — только desktop) / 0 failed; gates green.

## Раунд 2 (ревью диффа): исправления замечаний

- [x] 27. Единый 404 карточек сотрудника: `staff/loading.tsx` больше не накрывает карточки — сегменты `requests/[number]` и `appeals/[id]` вынесены в route group `(cards)` без loading-boundary на всём пути от корня, скелетон остался в `(dashboard)` (сводка/очереди/списки/объявления). notFound() снова отдаёт статус 404, а не 200-скелетон.
- [x] 28. e2e-ассерты контракта 404 (red подтверждён: с loading-boundary статус был 200): несуществующий номер заявки, заявка чужого факультета (номер берётся чёрным ящиком из списка студента Ильи), несуществующее обращение.
- [x] 29. `scripts/build-lock.mjs` (DIG-55): `process.exit()` больше не пропускает release — код выхода сохраняется, `releaseBuildLock` вызывается до выхода (раньше lock оставался после каждой штатной сборки и «воровался» как stale); добавлен `BUILD_LOCK_PATH` для поведенческих тестов в песочнице; тесты в `tests/build-hermetic.test.ts`.
- [x] 30. `npm run typecheck` сериализован тем же build-lock (DIG-63): новый `scripts/typecheck-locked.mjs` (prune `.next/types` → `next typegen` → `tsc --noEmit` внутри lock), чтобы параллельная сборка другой сессии не теряла типы из-под рук; поведенческие тесты.
- [x] 31. Честность атрибуции: инфраструктурные фиксы DIG-55/DIG-63 вынесены в отдельный коммит с упоминанием обоих DIG (правило `scripts/swarm/` не тронуто).
- [x] 32. Полный зелёный прогон перед merge: gates lint/typecheck/build/test (60 файлов / 949 unit-тестов + node --test 31) + e2e staff-cabinet (desktop 1440 и mobile 360) + e2e data-isolation — 23 passed / 3 skipped (мутации — только desktop) / 0 failed. Прогон выполнялся против изолированного standalone-сервера (копия бандла вне репо, сборка валидировала route groups) под удержанием build-lock: параллельные swarm-сессии на общем checkout сносят `.next` под живым `next start` (ENOENT) и грузят CPU — наблюдаемая флакость e2e инфраструктурная, не дефект кода.
- [ ] 33. Примечание для документатора (п.6 ревью): приложить ПОЛНЫЙ дифф ветки — прошлый был обрезан посреди `staff/requests/[number]/page.tsx`, из-за чего middleware/actions/слой данных/PDF-роут не были видны ревьюеру.
